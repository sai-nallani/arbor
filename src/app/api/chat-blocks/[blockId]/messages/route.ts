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
        const body = await request.json();
        const { role, content } = body;

        if (!role || !content) {
            return NextResponse.json({ error: 'role and content required' }, { status: 400 });
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
