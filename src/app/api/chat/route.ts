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
import { eq } from 'drizzle-orm';

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
        const { messages: chatMessages, model, chatBlockId, isSearchEnabled, branchContext } = body;

        if (!chatMessages || !Array.isArray(chatMessages)) {
            return new Response(JSON.stringify({ error: 'Messages required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // If chatBlockId is provided, save the user message to database
        if (chatBlockId) {
            const userMessage = chatMessages[chatMessages.length - 1];
            if (userMessage?.role === 'user') {
                await db.insert(messages).values({
                    chatBlockId,
                    role: 'user',
                    content: userMessage.content,
                });
            }
        }

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
            let contextStr = '';
            let highlightedText = '';

            try {
                const parsed = JSON.parse(branchContext);

                // New format with highlightedText
                if (parsed.conversationHistory && parsed.highlightedText) {
                    const history = parsed.conversationHistory;
                    highlightedText = parsed.highlightedText;
                    contextStr = history.map((m: any) => `${m.role}: ${m.content}`).join('\n');
                }
                // Legacy format (array of messages)
                else if (Array.isArray(parsed)) {
                    contextStr = parsed.map((m: any) => `${m.role}: ${m.content}`).join('\n');
                }
            } catch (e) {
                contextStr = branchContext;
            }

            const systemPrompt = highlightedText
                ? `The user has branched from a previous conversation. They specifically highlighted this text: "${highlightedText}"

Previous conversation context:
${contextStr}
---
The user's question relates to the highlighted text above. Please provide a focused response.`
                : `Reference Context from previous branch:\n${contextStr}\n---\nContinue the conversation based on this context.`;

            aiMessages = [
                {
                    role: 'system',
                    content: systemPrompt
                },
                ...chatMessages
            ];
        }

        // Create streaming response using Dedalus
        const stream = await runner.run({
            messages: aiMessages,
            model: model || 'anthropic/claude-opus-4',
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
