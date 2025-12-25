/**
 * Chat API Route
 * 
 * POST /api/chat - Streaming chat endpoint using dedalus-react
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Dedalus, { DedalusRunner } from 'dedalus-labs';
import { streamToWebResponse } from 'dedalus-react/server';
import { db } from '@/db';
import { messages, chatBlocks, aiErrorLogs } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

const client = new Dedalus({
    apiKey: process.env.DEDALUS_API_KEY,
});
const runner = new DedalusRunner(client);

// System prompt to enforce formatting
const SYSTEM_PROMPT = `You are a helpful AI assistant. You must use LaTeX formatting for all mathematical expressions. IMPORTANT: You MUST use dollar signs ($) for inline math (e.g., $E=mc^2$) and double dollar signs ($$) for block math. Do NOT use \\( ... \\) or \\[ ... \\] delimiters. You must strictly follow Markdown formatting rules for all output. Add appropriate spacing and paragraphing when necessary. Make it readable for the user.`;

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const body = await req.json();
        const { messages: chatMessages, model, chatBlockId, isSearchEnabled, branchContext, imageUrls } = body;

        if (!chatMessages || !Array.isArray(chatMessages)) {
            return new Response(JSON.stringify({ error: 'Messages required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // NOTE: User message saving is now handled in EmbeddedChat.tsx to capture the database ID
        // for branch linking. Do not save here to avoid duplicates.

        // Build messages for AI, including context if branched
        // First, clean up the messages - remove empty content and obvious duplicates
        const cleanMessages = chatMessages.filter((msg: any, index: number, arr: any[]) => {
            // Remove messages with empty content
            if (!msg.content || (typeof msg.content === 'string' && !msg.content.trim())) {
                return false;
            }
            // Remove consecutive duplicates (same role and content)
            if (index > 0) {
                const prev = arr[index - 1];
                if (prev.role === msg.role && prev.content === msg.content) {
                    return false;
                }
            }
            return true;
        });

        // process current messages to inject hidden context
        const processedCurrentMessages = cleanMessages.map((msg: any) => {
            if (msg.hiddenContext && typeof msg.content === 'string') {
                return {
                    ...msg,
                    content: `[Context: ${msg.hiddenContext}]\n\n${msg.content}`
                };
            }
            return msg;
        });

        // Initialize with system prompt + current messages
        let aiMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...processedCurrentMessages
        ];

        if (branchContext) {
            let historyMessages: any[] = [];
            let highlightedText = '';

            try {
                // Fetch the current block to get the highlighted text if available
                if (chatBlockId) {
                    const [block] = await db
                        .select()
                        .from(chatBlocks)
                        .where(eq(chatBlocks.id, chatBlockId));
                    if (block && block.branchSourceText) {
                        highlightedText = block.branchSourceText || '';
                    }
                }

                // Check if it's an array of IDs (strings)
                if (Array.isArray(branchContext) && branchContext.length > 0 && typeof branchContext[0] === 'string') {
                    // Fetch messages from DB
                    const contextMsgs = await db
                        .select()
                        .from(messages)
                        .where(inArray(messages.id, branchContext))
                        .orderBy(messages.createdAt);

                    historyMessages = contextMsgs.map(m => ({
                        role: m.role,
                        content: m.content
                    }));
                } else {
                    // Legacy/Fallback parsing
                    const parsed = typeof branchContext === 'string' ? JSON.parse(branchContext) : branchContext;
                    if (Array.isArray(parsed)) {
                        historyMessages = parsed.map((m: any) => ({
                            role: m.role,
                            content: m.content
                        }));
                    }
                }
            } catch (e) {
                console.warn('Failed to parse branchContext:', e);
            }

            if (historyMessages.length > 0) {
                const systemInstruction = highlightedText
                    ? `The user has branched from the conversation above by highlighting this text: "${highlightedText}". 
                   The user's next message is a continuation based on this specific context. Please respond accordingly.`
                    : `The user has branched from the conversation above. Please continue based on that context.`;

                // Construct final array: Global System -> History -> Branch Context -> Current Messages
                aiMessages = [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...historyMessages,
                    {
                        role: 'system',
                        content: systemInstruction
                    },
                    ...processedCurrentMessages
                ];
            }
        }

        // Process all messages to handle image markers and convert to multimodal content
        aiMessages = aiMessages.map((msg, index) => {
            if (msg.role !== 'user' || typeof msg.content !== 'string') {
                return msg;
            }

            // Check for [IMAGE:url] markers
            const imageMarkerRegex = /\[IMAGE:(https?:\/\/[^\]]+)\]/g;
            const matches = msg.content.match(imageMarkerRegex);

            // For the last message, we also check the direct imageUrls param
            const isLastMessage = index === aiMessages.length - 1;
            const directImages = isLastMessage ? (imageUrls || []) : [];

            if (!matches && directImages.length === 0) {
                return msg;
            }

            let contentParts: any[] = [];
            let cleanContent = msg.content;
            let msgImageUrls: string[] = [...directImages];

            // Extract URLs from markers
            if (matches) {
                const extractedUrls = matches.map((m: string) => m.replace('[IMAGE:', '').replace(']', ''));
                msgImageUrls = [...msgImageUrls, ...extractedUrls];
                // Remove markers from text
                cleanContent = msg.content.replace(imageMarkerRegex, '').trim();
            }

            // Add text part
            if (cleanContent) {
                contentParts.push({
                    type: 'text',
                    text: cleanContent
                });
            }

            // Add image parts
            for (const url of msgImageUrls) {
                contentParts.push({
                    type: 'image_url',
                    image_url: {
                        url: url
                    }
                });
            }

            return {
                ...msg,
                content: contentParts
            };
        });

        // Create streaming response using Dedalus
        let targetModel = model || 'anthropic/claude-opus-4-5';

        // Check if ANY message has images to enforce vision model
        const hasImages = aiMessages.some(m => Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url'));

        if (hasImages) {
            // Dedalus only supports OpenAI for images currently
            if (!targetModel.startsWith('openai/') || targetModel === 'openai/gpt-5' || targetModel === 'openai/gpt-5-pro' || targetModel === 'openai/gpt-5-mini' || targetModel === 'openai/o3' || targetModel === 'openai/o3-pro') {
                console.log(`Auto-switching model from ${targetModel} to openai/gpt-4.1 for image support`);
                targetModel = 'openai/gpt-4.1';
            }
        }


        const stream = await runner.run({
            messages: aiMessages,
            model: targetModel,
            stream: true,
            mcp_servers: isSearchEnabled ? ['https://mcp.exa.ai/mcp'] : undefined,
        });

        // Wrap stream to monitor for errors (empty or "...")
        // We need to cast to AsyncIterable to iterate
        const wrappedStream = async function* () {
            let fullContent = '';
            try {
                for await (const chunk of (stream as any)) {
                    // Accumulate content to check for validity
                    const content = chunk.choices?.[0]?.delta?.content || '';
                    if (content) fullContent += content;
                    yield chunk;
                }
            } finally {
                // Check if output was invalid
                const trimmed = fullContent.trim();
                if (!trimmed || trimmed === '...' || trimmed === '') {
                    console.warn('[API/Chat] Invalid AI response detected:', fullContent);

                    // Log to database (fire and forget)
                    db.insert(aiErrorLogs).values({
                        userId: userId || 'anonymous',
                        model: targetModel,
                        inputMessages: aiMessages as any, // Cast JSON
                        errorType: !trimmed ? 'empty_content' : 'ellipsis_error',
                        rawOutput: fullContent
                    }).catch(err => console.error('Failed to log AI error:', err));
                }
            }
        };

        // Use dedalus-react's helper to convert stream to Web Response
        return streamToWebResponse(wrappedStream());
    } catch (error) {
        console.error('Chat API error:', error);
        return new Response(JSON.stringify({ error: 'Chat failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
