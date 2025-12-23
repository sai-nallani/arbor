import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { boards } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

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
