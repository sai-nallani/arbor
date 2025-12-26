import { db } from '@/db';
import { stickyNotes } from '@/db/schema';
import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';

// GET /api/sticky-notes?boardId=...
export async function GET(req: NextRequest) {
    const { userId } = getAuth(req);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const boardId = searchParams.get('boardId');

    if (!boardId) {
        return NextResponse.json({ error: 'Board ID is required' }, { status: 400 });
    }

    try {
        const notes = await db.select().from(stickyNotes).where(eq(stickyNotes.boardId, boardId));
        return NextResponse.json(notes);
    } catch (error) {
        console.error('Error fetching sticky notes:', error);
        return NextResponse.json({ error: 'Failed to fetch sticky notes' }, { status: 500 });
    }
}

// POST /api/sticky-notes
export async function POST(req: NextRequest) {
    const { userId } = getAuth(req);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { boardId, positionX, positionY, content, color } = await req.json();

        if (!boardId) {
            return NextResponse.json({ error: 'Board ID is required' }, { status: 400 });
        }

        const [newNote] = await db.insert(stickyNotes).values({
            boardId,
            positionX,
            positionY,
            content: content || '',
            color: color || 'yellow',
            width: 200,
            height: 200,
        }).returning();

        return NextResponse.json(newNote);
    } catch (error) {
        console.error('Error creating sticky note:', error);
        return NextResponse.json({ error: 'Failed to create sticky note' }, { status: 500 });
    }
}
