
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { fileNodes, boards } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// PATCH /api/file-nodes/[id]
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // console.log('[PATCH /api/file-nodes] Request received');
    try {
        const { userId } = await auth();
        // console.log('[PATCH /api/file-nodes] userId:', userId);

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        // console.log('[PATCH /api/file-nodes] target id:', id);

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            console.error('[PATCH /api/file-nodes] Invalid UUID format:', id);
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }

        const body = await request.json();
        // console.log('[PATCH /api/file-nodes] body:', body);
        const { name, positionX, positionY } = body;

        // Fetch the node first
        // console.log('[PATCH /api/file-nodes] Fetching node...');
        const node = await db
            .select()
            .from(fileNodes)
            .where(eq(fileNodes.id, id));

        // console.log('[PATCH /api/file-nodes] Node found:', node.length > 0 ? 'yes' : 'no');

        if (node.length === 0) {
            console.warn('[PATCH /api/file-nodes] Node not found in database');
            return NextResponse.json({ error: 'File node not found' }, { status: 404 });
        }

        // Verify user owns the board
        // console.log('[PATCH /api/file-nodes] Verifying board ownership for boardId:', node[0].boardId);
        const board = await db
            .select()
            .from(boards)
            .where(and(eq(boards.id, node[0].boardId), eq(boards.userId, userId)));

        // console.log('[PATCH /api/file-nodes] Board found:', board.length > 0 ? 'yes' : 'no');

        if (board.length === 0) {
            console.warn('[PATCH /api/file-nodes] User does not own the board');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Build update object
        const updates: Partial<typeof fileNodes.$inferInsert> = {};
        if (name !== undefined) updates.name = name;
        if (positionX !== undefined) updates.positionX = positionX;
        if (positionY !== undefined) updates.positionY = positionY;

        // console.log('[PATCH /api/file-nodes] Applying updates:', updates);

        // Update the node
        const [updatedNode] = await db
            .update(fileNodes)
            .set(updates)
            .where(eq(fileNodes.id, id))
            .returning();

        // console.log('[PATCH /api/file-nodes] Update successful');

        return NextResponse.json(updatedNode);
    } catch (error: any) {
        console.error('[PATCH /api/file-nodes] Server error:', error);
        return NextResponse.json({
            error: 'Failed to update file node',
            message: String(error?.message || error),
            stack: String(error?.stack || '')
        }, { status: 500 });
    }
}

// DELETE /api/file-nodes/[id]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Fetch the node first
        const node = await db
            .select()
            .from(fileNodes)
            .where(eq(fileNodes.id, id));

        if (node.length === 0) {
            return NextResponse.json({ error: 'File node not found' }, { status: 404 });
        }

        // Verify user owns the board
        const board = await db
            .select()
            .from(boards)
            .where(and(eq(boards.id, node[0].boardId), eq(boards.userId, userId)));

        if (board.length === 0) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Delete the node
        await db.delete(fileNodes).where(eq(fileNodes.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting file node:', error);
        return NextResponse.json({ error: 'Failed to delete file node' }, { status: 500 });
    }
}
