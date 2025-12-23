/**
 * Individual Chat Block API Routes
 * 
 * GET    /api/chat-blocks/[blockId] - Fetch block with messages
 * PATCH  /api/chat-blocks/[blockId] - Update block position/title
 * DELETE /api/chat-blocks/[blockId] - Delete a block
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { chatBlocks, messages, boards } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// GET /api/chat-blocks/[blockId]
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ blockId: string }> }
) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { blockId } = await params;

        // Fetch the block with board ownership check
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

        // Fetch messages for this block
        const blockMessages = await db
            .select()
            .from(messages)
            .where(eq(messages.chatBlockId, blockId))
            .orderBy(messages.createdAt);

        return NextResponse.json({
            ...block[0],
            messages: blockMessages,
        });
    } catch (error) {
        console.error('Error fetching block:', error);
        return NextResponse.json({ error: 'Failed to fetch block' }, { status: 500 });
    }
}

// PATCH /api/chat-blocks/[blockId]
export async function PATCH(
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
        const { title, positionX, positionY } = body;

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

        // Build update object
        const updates: Partial<typeof chatBlocks.$inferInsert> = {
            updatedAt: new Date(),
        };

        if (title !== undefined) updates.title = title;
        if (positionX !== undefined) updates.positionX = positionX;
        if (positionY !== undefined) updates.positionY = positionY;

        // Update the block
        const [updatedBlock] = await db
            .update(chatBlocks)
            .set(updates)
            .where(eq(chatBlocks.id, blockId))
            .returning();

        return NextResponse.json(updatedBlock);
    } catch (error) {
        console.error('Error updating block:', error);
        return NextResponse.json({ error: 'Failed to update block' }, { status: 500 });
    }
}

// DELETE /api/chat-blocks/[blockId]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ blockId: string }> }
) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { blockId } = await params;

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

        // Delete the block (messages cascade delete)
        await db.delete(chatBlocks).where(eq(chatBlocks.id, blockId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting block:', error);
        return NextResponse.json({ error: 'Failed to delete block' }, { status: 500 });
    }
}
