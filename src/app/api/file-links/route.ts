
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { fileLinks, chatBlocks, boards } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { chatBlockId, fileNodeId } = body;

        if (!chatBlockId || !fileNodeId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify user owns the chat block (and thus the board)
        const block = await db
            .select()
            .from(chatBlocks)
            .where(eq(chatBlocks.id, chatBlockId));

        if (block.length === 0) {
            return NextResponse.json({ error: 'Block not found' }, { status: 404 });
        }

        const board = await db
            .select()
            .from(boards)
            .where(and(eq(boards.id, block[0].boardId), eq(boards.userId, userId)));

        if (board.length === 0) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Create file link
        const [newLink] = await db
            .insert(fileLinks)
            .values({
                chatBlockId,
                fileNodeId,
            })
            .returning();

        return NextResponse.json(newLink, { status: 201 });
    } catch (error) {
        console.error('Error creating file link:', error);
        return NextResponse.json({ error: 'Failed to create file link' }, { status: 500 });
    }
}
