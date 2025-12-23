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
        const { messages: chatMessages, model, chatBlockId } = body;

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

        // Create streaming response using Dedalus
        const stream = await runner.run({
            messages: chatMessages,
            model: model || 'openai/gpt-4o-mini',
            stream: true,
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
