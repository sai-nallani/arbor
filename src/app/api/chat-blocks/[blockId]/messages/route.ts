/**
 * Messages API Route
 * 
 * POST /api/chat-blocks/[blockId]/messages - Save a message
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { chatBlocks, messages, boards } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/chat-blocks/[blockId]/messages
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ blockId: string }> }
) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { blockId } = await params;

        let body;
        try {
            body = await request.json();
        } catch (e) {
            console.error('[API] Failed to parse JSON body:', e);
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const { role, content } = body;

        // console.log(`[API] Saving message for block ${blockId}:`, { role, contentLength: content?.length, contentSample: typeof content === 'string' ? content.slice(0, 20) : content });

        // Relaxed validation: Allow empty string for content, but role matches
        if (!role || content === undefined || content === null) {
            console.error('[API] Missing role or content:', { role, content, body });
            return NextResponse.json({
                error: 'role and content required',
                received: { role, content: content === undefined ? 'undefined' : content }
            }, { status: 400 });
        }

        // Fetch the block first
        const block = await db
            .select()
            .from(chatBlocks)
            .where(eq(chatBlocks.id, blockId));

        if (block.length === 0) {
            return NextResponse.json({ error: 'Block not found' }, { status: 404 });
        }

        // Verify user owns the board
        const board = await db
            .select()
            .from(boards)
            .where(and(eq(boards.id, block[0].boardId), eq(boards.userId, userId)));

        if (board.length === 0) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Save the message
        const [newMessage] = await db
            .insert(messages)
            .values({
                chatBlockId: blockId,
                role,
                content,
                hiddenContext: body.hiddenContext || null,
            })
            .returning();

        // Update block's updatedAt
        await db
            .update(chatBlocks)
            .set({ updatedAt: new Date() })
            .where(eq(chatBlocks.id, blockId));

        return NextResponse.json(newMessage, { status: 201 });
    } catch (error) {
        console.error('Error saving message:', error);
        return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }
}
