import { db } from '@/db';
import { stickyContextLinks } from '@/db/schema';
import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';

// POST /api/sticky-context-links
export async function POST(req: NextRequest) {
    const { userId } = getAuth(req);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { stickyNoteId, targetBlockId } = await req.json();

        if (!stickyNoteId || !targetBlockId) {
            return NextResponse.json({ error: 'Missing defined IDs' }, { status: 400 });
        }

        // Check if link exists
        const existing = await db.select().from(stickyContextLinks)
            .where(and(
                eq(stickyContextLinks.stickyNoteId, stickyNoteId),
                eq(stickyContextLinks.targetBlockId, targetBlockId)
            ));

        if (existing.length > 0) {
            return NextResponse.json(existing[0]);
        }

        const [newLink] = await db.insert(stickyContextLinks).values({
            stickyNoteId,
            targetBlockId,
        }).returning();

        return NextResponse.json(newLink);
    } catch (error) {
        console.error('Error creating sticky context link:', error);
        return NextResponse.json({ error: 'Failed to create sticky context link' }, { status: 500 });
    }
}

// DELETE /api/sticky-context-links?stickyNoteId=...&targetBlockId=...
export async function DELETE(req: NextRequest) {
    const { userId } = getAuth(req);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const stickyNoteId = searchParams.get('stickyNoteId');
    const targetBlockId = searchParams.get('targetBlockId');

    if (!stickyNoteId || !targetBlockId) {
        return NextResponse.json({ error: 'Missing IDs' }, { status: 400 });
    }

    try {
        await db.delete(stickyContextLinks)
            .where(and(
                eq(stickyContextLinks.stickyNoteId, stickyNoteId),
                eq(stickyContextLinks.targetBlockId, targetBlockId)
            ));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting sticky context link:', error);
        return NextResponse.json({ error: 'Failed to delete sticky context link' }, { status: 500 });
    }
}
