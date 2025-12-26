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
import { messages, chatBlocks, aiErrorLogs, contextLinks, imageContextLinks, fileNodes, stickyContextLinks, stickyNotes } from '@/db/schema';
import { eq, inArray, asc } from 'drizzle-orm';

const client = new Dedalus({
    apiKey: process.env.DEDALUS_API_KEY,
});
const runner = new DedalusRunner(client);

// System prompt to enforce formatting
const SYSTEM_PROMPT = `You are a helpful AI assistant. You must use LaTeX formatting for all mathematical expressions. IMPORTANT: You MUST use dollar signs ($) for inline math (e.g., $E=mc^2$) and double dollar signs ($$) for block math. Do NOT use \\( ... \\) or \\[ ... \\] delimiters. You must strictly follow Markdown formatting rules for all output. Add appropriate spacing and paragraphing when necessary. Make it readable for the user.`;

export async function POST(req: NextRequest) {
    const requestId = Math.random().toString(36).substring(7);
    // console.log(`\n========== [CHAT ${requestId}] NEW REQUEST ==========`);

    try {
        const { userId } = await auth();
        // console.log(`[CHAT ${requestId}] User: ${userId || 'UNAUTHORIZED'}`);

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const body = await req.json();
        const { messages: chatMessages, model, chatBlockId, isSearchEnabled, branchContext, imageUrls } = body;

        // console.log(`[CHAT ${requestId}] Block: ${chatBlockId}`);
        // console.log(`[CHAT ${requestId}] Model requested: ${model}`);
        // console.log(`[CHAT ${requestId}] Search enabled: ${isSearchEnabled}`);
        // console.log(`[CHAT ${requestId}] Has branchContext: ${!!branchContext}`);
        // console.log(`[CHAT ${requestId}] Incoming messages count: ${chatMessages?.length || 0}`);

        if (!chatMessages || !Array.isArray(chatMessages)) {
            // console.log(`[CHAT ${requestId}] ERROR: Messages required`);
            return new Response(JSON.stringify({ error: 'Messages required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Log incoming messages summary
        // console.log(`[CHAT ${requestId}] --- Incoming Messages ---`);
        chatMessages.forEach((msg: any, i: number) => {
            if (typeof msg.content === 'string') {
                const preview = msg.content.substring(0, 100);
                // console.log(`[CHAT ${requestId}]   [${i}] ${msg.role}: ${preview}${msg.content.length > 100 ? '...' : ''}`);
            } else {
                // Print full array content for multipart messages
                // console.log(`[CHAT ${requestId}]   [${i}] ${msg.role}: [MULTIPART] ${JSON.stringify(msg.content)}`);
            }
        });

        // NOTE: User message saving is now handled in EmbeddedChat.tsx to capture the database ID
        // for branch linking. Do not save here to avoid duplicates.

        // Build messages for AI, including context if branched
        // First, clean up the messages - remove empty content and obvious duplicates
        // console.log(`[CHAT ${requestId}] --- Cleaning Messages ---`);
        const cleanMessages = chatMessages.filter((msg: any, index: number, arr: any[]) => {
            // Remove messages with empty content
            const isEmpty = !msg.content || (typeof msg.content === 'string' && !msg.content.trim());
            if (isEmpty) {
                // console.log(`[CHAT ${requestId}]   REMOVING [${index}] ${msg.role}: empty content (type: ${typeof msg.content}, value: ${JSON.stringify(msg.content)?.substring(0, 50)})`);
                return false;
            }
            // Remove consecutive duplicates (same role and content)
            if (index > 0) {
                const prev = arr[index - 1];
                if (prev.role === msg.role && prev.content === msg.content) {
                    // console.log(`[CHAT ${requestId}]   REMOVING [${index}] ${msg.role}: duplicate of previous`);
                    return false;
                }
            }
            return true;
        });
        // console.log(`[CHAT ${requestId}] After cleaning: ${cleanMessages.length} of ${chatMessages.length} messages kept`);

        // Fix consecutive user messages by inserting placeholder assistant responses
        // This can happen when previous AI responses were empty/null
        const repairedMessages: any[] = [];
        for (let i = 0; i < cleanMessages.length; i++) {
            const msg = cleanMessages[i];
            if (i > 0 && msg.role === 'user' && repairedMessages[repairedMessages.length - 1]?.role === 'user') {
                // Insert placeholder assistant message
                // console.log(`[CHAT ${requestId}]   INSERTING placeholder assistant between [${i - 1}] and [${i}] to fix consecutive users`);
                repairedMessages.push({
                    role: 'assistant',
                    content: 'I apologize, but I was unable to respond to that. Could you please try again or rephrase your question?'
                });
            }
            repairedMessages.push(msg);
        }

        if (repairedMessages.length !== cleanMessages.length) {
            // console.log(`[CHAT ${requestId}] After repair: ${repairedMessages.length} messages (added ${repairedMessages.length - cleanMessages.length} placeholders)`);
        }

        // process current messages to inject hidden context
        const processedCurrentMessages = repairedMessages.map((msg: any) => {
            if (msg.hiddenContext && typeof msg.content === 'string') {
                return {
                    ...msg,
                    content: `[Context: ${msg.hiddenContext}]\n\n${msg.content}`
                };
            }
            return msg;
        });

        // Fetch context from linked source blocks (context links feature)
        // console.log(`[CHAT ${requestId}] --- Fetching Context Links ---`);
        let contextFromLinks: any[] = [];
        if (chatBlockId) {
            // Get all source blocks that provide context to this block (transitively)
            const getSourceBlockIds = async (blockId: string): Promise<string[]> => {
                const sources: string[] = [];
                const visited = new Set<string>();
                const queue: string[] = [blockId];

                while (queue.length > 0) {
                    const current = queue.shift()!;
                    if (visited.has(current)) continue;
                    visited.add(current);

                    // Get blocks that provide context TO this block
                    const links = await db
                        .select({ sourceId: contextLinks.sourceBlockId })
                        .from(contextLinks)
                        .where(eq(contextLinks.targetBlockId, current));

                    for (const link of links) {
                        if (!visited.has(link.sourceId)) {
                            sources.push(link.sourceId);
                            queue.push(link.sourceId);
                        }
                    }
                }

                return sources;
            };

            const sourceBlockIds = await getSourceBlockIds(chatBlockId);
            // console.log(`[CHAT ${requestId}] Source blocks found: ${sourceBlockIds.length}`);
            if (sourceBlockIds.length > 0) {
                // console.log(`[CHAT ${requestId}] Source IDs: ${sourceBlockIds.map(id => id.substring(0, 8)).join(', ')}`);
                // Fetch messages from all source blocks, ordered by creation time
                const contextMessages = await db
                    .select({
                        role: messages.role,
                        content: messages.content,
                        createdAt: messages.createdAt,
                    })
                    .from(messages)
                    .where(inArray(messages.chatBlockId, sourceBlockIds))
                    .orderBy(asc(messages.createdAt));

                contextFromLinks = contextMessages.map(m => ({
                    role: m.role,
                    content: m.content
                }));
            }

            // Fetch linked images for context
            try {
                const linkedImages = await db
                    .select({
                        url: fileNodes.url,
                        name: fileNodes.name,
                        mimeType: fileNodes.mimeType,
                    })
                    .from(imageContextLinks)
                    .innerJoin(fileNodes, eq(imageContextLinks.imageNodeId, fileNodes.id))
                    .where(eq(imageContextLinks.targetBlockId, chatBlockId));

                // console.log(`[CHAT ${requestId}] Linked images found: ${linkedImages.length}`);

                if (linkedImages.length > 0) {
                    // creating a user message with all images
                    const imageContentParts = linkedImages.map(img => ({
                        type: 'image_url',
                        image_url: { url: img.url }
                    }));

                    const textPart = {
                        type: 'text',
                        text: `Here are ${linkedImages.length} image(s) provided as context for this conversation:`
                    };

                    // Add to the beginning of context links
                    contextFromLinks.unshift({
                        role: 'user',
                        content: [textPart, ...imageContentParts]
                    });

                    // console.log(`[CHAT ${requestId}] Added ${linkedImages.length} images to context`);
                }
            } catch (error) {
                console.error(`[CHAT ${requestId}] Error fetching linked images:`, error);
                // Continue without context images if query fails
            }

            // Fetch linked sticky notes for context
            try {
                const linkedStickyNotes = await db
                    .select({
                        content: stickyNotes.content,
                        color: stickyNotes.color,
                    })
                    .from(stickyContextLinks)
                    .innerJoin(stickyNotes, eq(stickyContextLinks.stickyNoteId, stickyNotes.id))
                    .where(eq(stickyContextLinks.targetBlockId, chatBlockId));

                // console.log(`[CHAT ${requestId}] Linked sticky notes found: ${linkedStickyNotes.length}`);

                if (linkedStickyNotes.length > 0) {
                    // Combine all sticky note contents
                    const stickyContent = linkedStickyNotes
                        .filter(note => note.content && note.content.trim())
                        .map(note => note.content)
                        .join('\n\n---\n\n');

                    if (stickyContent) {
                        // Add as a user message at the beginning of context
                        contextFromLinks.unshift({
                            role: 'user',
                            content: `Here are some notes provided as context for this conversation:\n\n${stickyContent}`
                        });

                        // console.log(`[CHAT ${requestId}] Added ${linkedStickyNotes.length} sticky note(s) to context`);
                    }
                }
            } catch (error) {
                console.error(`[CHAT ${requestId}] Error fetching linked sticky notes:`, error);
                // Continue without sticky notes if query fails
            }
        } else {
            // console.log(`[CHAT ${requestId}] No chatBlockId, skipping context links`);
        }

        // Initialize with system prompt + context from links + current messages
        let aiMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...contextFromLinks,
            ...(contextFromLinks.length > 0 ? [{ role: 'system', content: '[End of context from linked conversations. The following is the current conversation.]' }] : []),
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
        let targetModel = model || 'anthropic/claude-sonnet-4-5-20250929';
        // console.log(`[CHAT ${requestId}] Initial model: ${targetModel}`);

        // Check if ANY message has images to enforce vision model
        const hasImages = aiMessages.some(m => Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url'));
        // console.log(`[CHAT ${requestId}] Has images: ${hasImages}`);

        if (hasImages) {
            // Dedalus currently ONLY supports OpenAI for vision inputs
            // If the model is not an OpenAI model, switch to GPT-4o
            // We do checking for specific OpenAI models to allow user to select different GPT-4 variants if available
            const isOpenAIVision = targetModel.startsWith('openai/') && !['openai/gpt-3.5-turbo', 'openai/o1-preview', 'openai/o1-mini'].includes(targetModel);

            if (!isOpenAIVision) {
                // console.log(`[CHAT ${requestId}] Auto-switching to openai/gpt-4o for vision support (original: ${targetModel} not supported for images)`);
                targetModel = 'openai/gpt-4o';
            }
        }

        // Log final message array summary
        // console.log(`[CHAT ${requestId}] --- FINAL AI MESSAGES (${aiMessages.length} total) ---`);
        aiMessages.forEach((msg: any, i: number) => {
            const content = typeof msg.content === 'string'
                ? msg.content.substring(0, 100)
                : Array.isArray(msg.content)
                    ? `[multipart: ${msg.content.length} parts]`
                    : '[unknown]';
            // console.log(`[CHAT ${requestId}]   [${i}] ${msg.role}: ${content}${content.length >= 100 ? '...' : ''}`);
        });

        // FULL JSON DUMP FOR DEBUGGING
        // console.log(`[CHAT ${requestId}] === FULL MESSAGES JSON ===`);
        // console.log(JSON.stringify(aiMessages, null, 2));
        // console.log(`[CHAT ${requestId}] === END FULL JSON ===`);

        // Sanitize messages to remove any 'id' fields which cause empty responses in Dedalus
        const sanitizedAiMessages = aiMessages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        // console.log(`[CHAT ${requestId}] Calling Dedalus with model: ${targetModel}`);

        // Helper function to run with a model and stream response
        const runWithModel = async (model: string) => {
            const stream = await runner.run({
                messages: sanitizedAiMessages,
                model: [model, "openai/gpt-4.1"],
                stream: true,
                mcp_servers: isSearchEnabled ? ['https://mcp.exa.ai/mcp'] : undefined,
            });
            return stream;
        };

        let stream = await runWithModel(targetModel);
        // console.log(`[CHAT ${requestId}] Stream created successfully`);

        // Wrap stream to monitor for errors and handle empty responses
        const wrappedStream = async function* () {
            let fullContent = '';
            let chunkCount = 0;
            let usedModel = targetModel;
            let currentStream: any = stream;
            let retried = false;

            try {
                for await (const chunk of currentStream) {
                    chunkCount++;

                    // Log first few chunks for debugging
                    if (chunkCount <= 3) {
                        // console.log(`[CHAT ${requestId}] Chunk ${chunkCount}:`, JSON.stringify(chunk).substring(0, 300));
                    }

                    const content = chunk.choices?.[0]?.delta?.content || '';
                    const finishReason = chunk.choices?.[0]?.finish_reason;

                    // Detect immediate empty response with stop (model refusal)
                    if (chunkCount === 1 && content === '' && finishReason === 'stop' && !retried) {
                        console.error(`[CHAT ${requestId}] ⚠️ Model returned empty immediately - retrying with gpt-4.1`);
                        retried = true;
                        usedModel = 'openai/gpt-4.1';

                        // Get new stream with fallback model
                        currentStream = await runWithModel(usedModel);

                        // Iterate over new stream
                        for await (const retryChunk of currentStream) {
                            chunkCount++;
                            if (chunkCount <= 5) {
                                // console.log(`[CHAT ${requestId}] Retry Chunk ${chunkCount - 1}:`, JSON.stringify(retryChunk).substring(0, 300));
                            }
                            const retryContent = retryChunk.choices?.[0]?.delta?.content || '';
                            if (retryContent) fullContent += retryContent;
                            yield retryChunk;
                        }
                        return; // Exit after retry stream completes
                    }

                    if (content) fullContent += content;
                    yield chunk;
                }
            } catch (streamError) {
                console.error(`[CHAT ${requestId}] Stream error:`, streamError);
                throw streamError;
            } finally {
                // console.log(`[CHAT ${requestId}] Stream finished. Model: ${usedModel}, Chunks: ${chunkCount}, Content length: ${fullContent.length}`);
                const trimmed = fullContent.trim();
                if (!trimmed || trimmed === '...' || trimmed === '') {
                    console.error(`[CHAT ${requestId}] ⚠️ INVALID RESPONSE - empty or ellipsis`);
                    console.error(`[CHAT ${requestId}] Raw output: "${fullContent}"`);

                    // Log to database (fire and forget)
                    db.insert(aiErrorLogs).values({
                        userId: userId || 'anonymous',
                        model: usedModel,
                        inputMessages: aiMessages as any,
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
