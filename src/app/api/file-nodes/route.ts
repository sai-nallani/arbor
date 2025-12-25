
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { fileNodes, boards } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { boardId, name, mimeType, url, positionX, positionY } = body;

        if (!boardId || !name || !url) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify user owns the board
        const board = await db
            .select()
            .from(boards)
            .where(and(eq(boards.id, boardId), eq(boards.userId, userId)));

        if (board.length === 0) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        // Create file node
        const [newNode] = await db
            .insert(fileNodes)
            .values({
                boardId,
                name,
                mimeType: mimeType || 'application/octet-stream',
                url,
                positionX: positionX ?? 0,
                positionY: positionY ?? 0,
            })
            .returning();

        return NextResponse.json(newNode, { status: 201 });
    } catch (error) {
        console.error('Error creating file node:', error);
        return NextResponse.json({ error: 'Failed to create file node' }, { status: 500 });
    }
}
