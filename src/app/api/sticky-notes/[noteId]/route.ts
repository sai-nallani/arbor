import { db } from '@/db';
import { stickyNotes } from '@/db/schema';
import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';

// PATCH /api/sticky-notes/[noteId]
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ noteId: string }> }
) {
    const { userId } = getAuth(req);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { noteId } = await params;
        const updates = await req.json();

        const [updatedNote] = await db.update(stickyNotes)
            .set({
                ...updates,
                updatedAt: new Date(),
            })
            .where(eq(stickyNotes.id, noteId))
            .returning();

        if (!updatedNote) {
            return NextResponse.json({ error: 'Sticky note not found' }, { status: 404 });
        }

        return NextResponse.json(updatedNote);
    } catch (error) {
        console.error('Error updating sticky note:', error);
        return NextResponse.json({ error: 'Failed to update sticky note' }, { status: 500 });
    }
}

// DELETE /api/sticky-notes/[noteId]
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ noteId: string }> }
) {
    const { userId } = getAuth(req);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { noteId } = await params;

        const [deletedNote] = await db.delete(stickyNotes)
            .where(eq(stickyNotes.id, noteId))
            .returning();

        if (!deletedNote) {
            return NextResponse.json({ error: 'Sticky note not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting sticky note:', error);
        return NextResponse.json({ error: 'Failed to delete sticky note' }, { status: 500 });
    }
}
