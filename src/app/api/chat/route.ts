/**
 * Chat API Route
 * 
 * POST /api/chat - Streaming chat endpoint using OpenAI Responses API
 * Implements strict rate limiting and frontend compatibility adapter.
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import OpenAI from "openai";
import { db } from '@/db';
import { messages, chatBlocks, aiErrorLogs, contextLinks, imageContextLinks, fileNodes, stickyContextLinks, stickyNotes, dailyTokenUsage } from '@/db/schema';
import { eq, inArray, asc, and } from 'drizzle-orm';

// Character to token heuristic (approximate)
const ESTIMATED_CHARS_PER_TOKEN = 4;
const DAILY_TOKEN_LIMIT = 100000;

export const runtime = 'nodejs'; // Ensure node runtime for buffering if needed, though edge usually fine for openai

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// System prompt to enforce formatting
const SYSTEM_PROMPT = `You are a helpful AI assistant. You must use LaTeX formatting for all mathematical expressions. IMPORTANT: You MUST use dollar signs ($) for inline math (e.g., $E=mc^2$) and double dollar signs ($$) for block math. Do NOT use \\( ... \\) or \\[ ... \\] delimiters. You must strictly follow Markdown formatting rules for all output. Add appropriate spacing and paragraphing when necessary. Make it readable for the user.`;

export async function POST(req: NextRequest) {
    const requestId = Math.random().toString(36).substring(7);
    // console.log(`\n========== [CHAT ${requestId}] NEW REQUEST (OPENAI SDK) ==========`);

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
        const { messages: chatMessages, model, chatBlockId, isSearchEnabled, thinkHarder, branchContext, imageUrls, pendingHiddenContext } = body;

        // DEBUG: Log incoming message context
        console.log('[CHAT API DEBUG] pendingHiddenContext:', pendingHiddenContext);
        console.log('[CHAT API DEBUG] Messages count:', chatMessages?.length);
        if (chatMessages && chatMessages.length > 0) {
            const lastMsg = chatMessages[chatMessages.length - 1];
            console.log('[CHAT API DEBUG] Last message:', { role: lastMsg.role, contentSnippet: lastMsg.content?.slice(0, 50), hiddenContext: lastMsg.hiddenContext });
        }

        // --- 1. Rate Limit Check ---
        const today = new Date().toISOString().split('T')[0];

        // Fetch current usage (tokens and deep research count)
        let currentUsage = 0;
        let deepResearchUsedToday = 0;
        try {
            const usageRecord = await db.query.dailyTokenUsage.findFirst({
                where: and(
                    eq(dailyTokenUsage.userId, userId),
                    eq(dailyTokenUsage.date, today)
                )
            });
            if (usageRecord) {
                currentUsage = usageRecord.tokenCount;
                deepResearchUsedToday = usageRecord.deepResearchCount || 0;
            }
        } catch (e) {
            console.error('Failed to fetch daily token usage:', e);
        }

        // Check if Deep Research is requested but limit reached
        const isDeepResearchEnabled = isSearchEnabled; // Renamed internally
        const isDeepResearchLimitReached = deepResearchUsedToday >= 1;

        if (isDeepResearchEnabled && isDeepResearchLimitReached) {
            return new Response(JSON.stringify({ error: 'Deep Research limit reached (1/day). Please try again tomorrow.' }), {
                status: 429, // Too Many Requests
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Estimate input tokens to check if this specific request pushes over
        // Simple heuristic: sum length of all text content
        let inputCharCount = 0;
        if (Array.isArray(chatMessages)) {
            inputCharCount = chatMessages.reduce((acc: number, msg: any) => acc + (typeof msg.content === 'string' ? msg.content.length : 0), 0);
        }
        const estimatedInputTokens = Math.ceil(inputCharCount / ESTIMATED_CHARS_PER_TOKEN);

        const isLimitExceeded = (currentUsage + estimatedInputTokens) > DAILY_TOKEN_LIMIT;

        // --- 2. Model Selection & Fallback ---
        let selectedModel = model || 'openai/gpt-5.1';
        let apiModelName = selectedModel.replace('openai/', '');

        // Model switching based on modes
        if (isDeepResearchEnabled) {
            apiModelName = 'o4-mini-deep-research';
        } else if (thinkHarder) {
            apiModelName = 'o4-mini';
        }

        // General rate limit fallback for non-special models
        if (isLimitExceeded && !isDeepResearchEnabled && !thinkHarder) {
            if (apiModelName === 'gpt-5.1' || apiModelName === 'gpt-4o' || apiModelName === 'gpt-4.1') {
                apiModelName = 'gpt-5-mini';
            }
        }

        // --- 3. Context & Message Construction (Existing Logic) ---
        // (Reusing the robust context fetching log from previous route, adapted for new flow)

        // ... Clean messages ...
        const cleanMessages = chatMessages.filter((msg: any, index: number, arr: any[]) => {
            const isEmpty = !msg.content || (typeof msg.content === 'string' && !msg.content.trim());
            if (isEmpty) return false;
            // Remove consecutive duplicates
            if (index > 0) {
                const prev = arr[index - 1];
                if (prev.role === msg.role && prev.content === msg.content) return false;
            }
            return true;
        });

        // ... Repair messages ...
        const repairedMessages: any[] = [];
        for (let i = 0; i < cleanMessages.length; i++) {
            const msg = cleanMessages[i];
            if (i > 0 && msg.role === 'user' && repairedMessages[repairedMessages.length - 1]?.role === 'user') {
                repairedMessages.push({
                    role: 'assistant',
                    content: 'I apologize, but I was unable to respond to that. Could you please try again?'
                });
            }
            repairedMessages.push(msg);
        }

        // ... Inject hidden context ...
        const processedCurrentMessages = repairedMessages.map((msg: any, index: number) => {
            let content = msg.content;

            // First check for hiddenContext on the message itself (from DB)
            if (msg.hiddenContext && typeof msg.content === 'string') {
                content = `[Context: ${msg.hiddenContext}]\n\n${msg.content}`;
            }

            // Then check for pendingHiddenContext (from auto-triggered branch) for the LAST user message
            if (pendingHiddenContext && index === repairedMessages.length - 1 && msg.role === 'user' && typeof msg.content === 'string') {
                content = `[Context: ${pendingHiddenContext}]\n\n${content}`;
            }

            // Strictly return standard fields. OpenAI Responses API complains if 'id' is not in 'msg_' format.
            return {
                role: msg.role,
                content: content
            };
        });

        // ... Fetch detailed context links ...
        let contextFromLinks: any[] = [];
        if (chatBlockId) {
            // Get source blocks
            const getSourceBlockIds = async (blockId: string): Promise<string[]> => {
                const sources: string[] = [];
                const visited = new Set<string>();
                const queue: string[] = [blockId];
                while (queue.length > 0) {
                    const current = queue.shift()!;
                    if (visited.has(current)) continue;
                    visited.add(current);
                    const links = await db.select({ sourceId: contextLinks.sourceBlockId }).from(contextLinks).where(eq(contextLinks.targetBlockId, current));
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

            if (sourceBlockIds.length > 0) {
                const contextMessages = await db.select({ role: messages.role, content: messages.content }).from(messages).where(inArray(messages.chatBlockId, sourceBlockIds)).orderBy(asc(messages.createdAt));
                contextFromLinks = contextMessages.map(m => ({ role: m.role, content: m.content }));
            }

            // ... Image Context ...
            try {
                const linkedImages = await db.select({ url: fileNodes.url }).from(imageContextLinks).innerJoin(fileNodes, eq(imageContextLinks.imageNodeId, fileNodes.id)).where(eq(imageContextLinks.targetBlockId, chatBlockId));
                if (linkedImages.length > 0) {
                    const imageContentParts = linkedImages.map(img => ({ type: 'input_image', image_url: img.url }));
                    const textPart = { type: 'input_text', text: `Here are ${linkedImages.length} image(s) provided as context:` };
                    contextFromLinks.unshift({ role: 'user', content: [textPart, ...imageContentParts] });
                }
            } catch (ignore) { }

            // ... Sticky Note Context ...
            try {
                const linkedStickyNotes = await db.select({ content: stickyNotes.content }).from(stickyContextLinks).innerJoin(stickyNotes, eq(stickyContextLinks.stickyNoteId, stickyNotes.id)).where(eq(stickyContextLinks.targetBlockId, chatBlockId));
                if (linkedStickyNotes.length > 0) {
                    const stickyContent = linkedStickyNotes.filter(n => n.content?.trim()).map(n => n.content).join('\n\n---\n\n');
                    if (stickyContent) contextFromLinks.unshift({ role: 'user', content: `Sticky notes context:\n\n${stickyContent}` });
                }
            } catch (ignore) { }
        }

        // ... Final Assembly ...
        let finalMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...contextFromLinks,
            ...(contextFromLinks.length > 0 ? [{ role: 'system', content: '[End of context. Conversation follows.]' }] : []),
            ...processedCurrentMessages
        ];

        // ... Branch Context ...
        if (branchContext) {
            let historyMessages: any[] = [];
            // (Simplified logic for branch context loading - reusing array check)
            if (Array.isArray(branchContext) && branchContext.length > 0 && typeof branchContext[0] === 'string') {
                const contextMsgs = await db.select().from(messages).where(inArray(messages.id, branchContext)).orderBy(messages.createdAt);
                historyMessages = contextMsgs.map(m => ({ role: m.role, content: m.content }));
            }
            // Fallback for legacy JSON
            else if (typeof branchContext === 'string') {
                try {
                    const parsed = JSON.parse(branchContext);
                    if (Array.isArray(parsed)) historyMessages = parsed.map((m: any) => ({ role: m.role, content: m.content }));
                } catch (e) { }
            }

            if (historyMessages.length > 0) {
                finalMessages = [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...historyMessages,
                    { role: 'system', content: "The user has branched from the above conversation." },
                    ...processedCurrentMessages
                ];
            }
        }

        // Process images (convert [IMAGE:url] to blocks)
        finalMessages = finalMessages.map((msg, index) => {
            if (msg.role !== 'user' || typeof msg.content !== 'string') return msg;
            const imageMarkerRegex = /\[IMAGE:(https?:\/\/[^\]]+)\]/g;
            const matches = msg.content.match(imageMarkerRegex);
            const isLastMessage = index === finalMessages.length - 1;
            const directImages = isLastMessage ? (imageUrls || []) : [];

            if (!matches && directImages.length === 0) return msg;

            let contentParts: any[] = [];
            let cleanContent = msg.content;
            let msgImageUrls: string[] = [...directImages];

            if (matches) {
                msgImageUrls = [...msgImageUrls, ...matches.map((m: string) => m.replace('[IMAGE:', '').replace(']', ''))];
                cleanContent = msg.content.replace(imageMarkerRegex, '').trim();
            }

            if (cleanContent) contentParts.push({ type: 'input_text', text: cleanContent });
            for (const url of msgImageUrls) contentParts.push({ type: 'input_image', image_url: url });

            return { ...msg, content: contentParts };
        });

        // --- 4. Call OpenAI Responses API ---

        // Prepare configured params
        let reasoningOptions = undefined;
        // Logic: o4-mini reasoning = built-in; gpt-5.1 + thinkHarder = high effort (legacy fallback if needed)
        // o4-mini models have reasoning built-in, no need for extra params.
        // For gpt-5.1, the reasoning.effort param was confirmed to not work, so removing.

        // Tools: Deep research models REQUIRE web_search_preview. Regular models also get it. Only reasoning (o4-mini) doesn't need it.
        const tools = (!thinkHarder) ? [{ type: 'web_search_preview' as const }] : undefined;

        // console.log(`[CHAT ${requestId}] Calling OpenAI Responses API with model: ${apiModelName}, Search: ${isSearchEnabled}, ThinkHarder: ${!!thinkHarder}`);

        const response = await client.responses.create({
            model: apiModelName,
            input: finalMessages as any[], // Casting as OpenAI types might slightly differ but structure is compatible
            stream: true,
            reasoning: reasoningOptions as any,
            tools: tools,
        });

        // --- 5. Stream Adapter for Dedalus Frontend ---
        const encoder = new TextEncoder();

        const readable = new ReadableStream({
            async start(controller) {
                let totalUsage = 0;

                try {
                    for await (const event of response) {
                        // The Responses API yields events. We need to extract content.
                        // Event structure depends on the specific streamed object type.
                        // Assuming standard new format: event.output or similar updates.
                        // Note: If usage is included, it might be in a specific event or property.

                        // NOTE: The user provided example "for await (const event of response) { console.log(event) }"
                        // We need to inspect 'event'.

                        // For 'text' output (most common):
                        // We look for delta updates to stream to frontend.
                        // Dedalus frontend expects standard OpenAI chunks: { choices: [{ delta: { content: "..." } }] }

                        // Checking event type logic (based on standard OpenAI patterns or assumed structure from new API):
                        // If event is a content delta:
                        let deltaContent = '';

                        // Robust check for various response shapes (since docs are new)
                        // Case A: Responses API Delta (Found in test script)
                        if ((event as any).type === 'response.output_item.delta') {
                            const delta = (event as any).delta;
                            if (delta && delta.type === 'output_text_delta' && delta.text) {
                                deltaContent = delta.text;
                            }
                        }
                        // Case B: Responses API Delta (Found in live curl test - crucial fix)
                        else if ((event as any).type === 'response.output_text.delta') {
                            if ((event as any).delta) deltaContent = (event as any).delta;
                            else if ((event as any).text) deltaContent = (event as any).text;
                        }
                        // Case C: Standard Chat Completion Chunk (Legacy/Fallback)
                        else if ((event as any).choices?.[0]?.delta?.content) {
                            deltaContent = (event as any).choices[0].delta.content;
                        }

                        // Extract Usage (usually in final chunk or separate event)
                        if ((event as any).usage) {
                            const usage = (event as any).usage;
                            if (usage.total_tokens) {
                                totalUsage = usage.total_tokens;
                                // console.log(`[CHAT ${requestId}] Usage info received: ${totalUsage} tokens`);
                            }
                        }

                        if (deltaContent) {
                            // Adapt to Dedalus format
                            const chunk = {
                                choices: [{
                                    delta: { content: deltaContent },
                                    finish_reason: null
                                }]
                            };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));

                            // Small delay to slow down streaming for better readability
                            await new Promise(resolve => setTimeout(resolve, 40));
                        }
                    }

                    // Send done signal
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));

                } catch (err) {
                    console.error(`[CHAT ${requestId}] Stream error:`, err);
                    controller.error(err);
                } finally {
                    // --- 6. Update Daily Usage ---
                    if (userId) {
                        try {
                            // Calculate deep research increment (1 if used, 0 otherwise)
                            const deepResearchIncrement = isDeepResearchEnabled ? 1 : 0;

                            // Simple Upsert logic with atomic increments
                            await db.insert(dailyTokenUsage).values({
                                userId: userId,
                                date: today,
                                tokenCount: totalUsage > 0 ? totalUsage : 0,
                                deepResearchCount: deepResearchIncrement,
                            }).onConflictDoUpdate({
                                target: [dailyTokenUsage.userId, dailyTokenUsage.date],
                                set: {
                                    tokenCount: totalUsage > 0 ? sql`${dailyTokenUsage.tokenCount} + ${totalUsage}` : sql`${dailyTokenUsage.tokenCount}`,
                                    deepResearchCount: sql`${dailyTokenUsage.deepResearchCount} + ${deepResearchIncrement}`,
                                    updatedAt: new Date()
                                }
                            });
                        } catch (dbErr) {
                            console.error(`[CHAT ${requestId}] Failed to update usage stats:`, dbErr);
                        }
                    }
                    controller.close();
                }
            }
        });

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        console.error('Chat API error:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}


// Helper to use SQL operator
import { sql } from 'drizzle-orm';
