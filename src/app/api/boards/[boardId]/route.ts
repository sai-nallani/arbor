import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { boards } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// PATCH /api/boards/[boardId] - Rename a board
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ boardId: string }> }
) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { boardId } = await params;
        const body = await request.json();
        const { name } = body;

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        // Update the board name (only if owned by user)
        const updated = await db
            .update(boards)
            .set({ name: name.trim(), updatedAt: new Date() })
            .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
            .returning();

        if (updated.length === 0) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        return NextResponse.json(updated[0]);
    } catch (error) {
        console.error('Error updating board:', error);
        return NextResponse.json({ error: 'Failed to update board' }, { status: 500 });
    }
}

// DELETE /api/boards/[boardId] - Delete a board
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ boardId: string }> }
) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { boardId } = await params;

        // Delete the board (only if owned by user)
        const deleted = await db
            .delete(boards)
            .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
            .returning();

        if (deleted.length === 0) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting board:', error);
        return NextResponse.json({ error: 'Failed to delete board' }, { status: 500 });
    }
}
