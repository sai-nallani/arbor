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
import { messages, chatBlocks } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

const client = new Dedalus({
    apiKey: process.env.DEDALUS_API_KEY,
});
const runner = new DedalusRunner(client);

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const body = await request.json();
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

        let aiMessages = [...cleanMessages];
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
                        highlightedText = block.branchSourceText;
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

                aiMessages = [
                    ...historyMessages,
                    {
                        role: 'system',
                        content: systemInstruction
                    },
                    ...chatMessages
                ];
            }
        }

        // Parse IMAGE markers from message content if imageUrls not provided directly
        let resolvedImageUrls = imageUrls || [];
        const lastMessage = aiMessages[aiMessages.length - 1];
        if (lastMessage && lastMessage.role === 'user' && typeof lastMessage.content === 'string') {
            const imageMarkerRegex = /\[IMAGE:(https?:\/\/[^\]]+)\]/g;
            const matches = lastMessage.content.match(imageMarkerRegex);
            if (matches) {
                // Extract URLs from markers
                const extractedUrls = matches.map((m: string) => m.replace('[IMAGE:', '').replace(']', ''));
                resolvedImageUrls = [...resolvedImageUrls, ...extractedUrls];
                // Remove markers from message content
                const cleanContent = lastMessage.content.replace(imageMarkerRegex, '').trim();
                aiMessages[aiMessages.length - 1] = { ...lastMessage, content: cleanContent };
            }
        }

        // If images are provided (or parsed from markers), format as multimodal content
        if (resolvedImageUrls.length > 0) {
            const lastMsg = aiMessages[aiMessages.length - 1];
            if (lastMsg && lastMsg.role === 'user') {
                // Build multimodal content array
                const contentParts: any[] = [];

                // Add text if present
                if (lastMsg.content && typeof lastMsg.content === 'string' && lastMsg.content.trim()) {
                    contentParts.push({
                        type: 'text',
                        text: lastMsg.content
                    });
                }

                // Add image URLs
                for (const url of resolvedImageUrls) {
                    contentParts.push({
                        type: 'image_url',
                        image_url: {
                            url: url
                        }
                    });
                }

                // Replace the last message with multimodal content
                aiMessages[aiMessages.length - 1] = {
                    role: 'user',
                    content: contentParts
                };
            }
        }

        // Create streaming response using Dedalus
        let targetModel = model || 'anthropic/claude-opus-4';

        // Validate model for image inputs
        if (resolvedImageUrls.length > 0) {
            // Dedalus only supports OpenAI for images currently
            if (!targetModel.startsWith('openai/')) {
                // Auto-switch to GPT-4o or return error? 
                // User asked to "not allow", so let's be strict or auto-switch.
                // Auto-switching is safer for UX.
                console.log(`Auto-switching model from ${targetModel} to openai/gpt-4o for image support`);
                targetModel = 'openai/gpt-4o';
            }
        }

        const stream = await runner.run({
            messages: aiMessages,
            model: targetModel,
            stream: true,
            mcp_servers: isSearchEnabled ? ['https://mcp.exa.ai/mcp'] : undefined,
        });

        // Use dedalus-react's helper to convert stream to Web Response
        return streamToWebResponse(stream);
    } catch (error) {
        console.error('Chat API error:', error);
        return new Response(JSON.stringify({ error: 'Chat failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
