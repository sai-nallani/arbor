/**
 * Image Context Links API Route
 * 
 * POST /api/image-context-links - Create a link from an image node to a chat block
 * DELETE /api/image-context-links - Delete an existing link
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { imageContextLinks, fileNodes, chatBlocks, boards } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { imageNodeId, chatBlockId } = body;

        if (!imageNodeId || !chatBlockId) {
            return NextResponse.json({ error: 'imageNodeId and chatBlockId are required' }, { status: 400 });
        }

        // Verify the image node exists and belongs to user's board
        const imageNode = await db.query.fileNodes.findFirst({
            where: eq(fileNodes.id, imageNodeId),
        });

        if (!imageNode) {
            return NextResponse.json({ error: 'Image node not found' }, { status: 404 });
        }

        // Verify user owns the board
        const board = await db.query.boards.findFirst({
            where: and(
                eq(boards.id, imageNode.boardId),
                eq(boards.userId, userId)
            ),
        });

        if (!board) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify target block exists and is on same board
        const targetBlock = await db.query.chatBlocks.findFirst({
            where: and(
                eq(chatBlocks.id, chatBlockId),
                eq(chatBlocks.boardId, imageNode.boardId)
            ),
        });

        if (!targetBlock) {
            return NextResponse.json({ error: 'Target chat block not found' }, { status: 404 });
        }

        // Create the link
        const newLink = await db.insert(imageContextLinks).values({
            imageNodeId,
            targetBlockId: chatBlockId,
        }).returning();

        console.log('[POST /api/image-context-links] Created link:', imageNodeId, '→', chatBlockId);

        return NextResponse.json(newLink[0], { status: 201 });

    } catch (error: any) {
        // Handle unique constraint violation
        if (error?.code === '23505') {
            return NextResponse.json({ error: 'Link already exists' }, { status: 409 });
        }
        console.error('Error creating image context link:', error);
        return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const imageNodeId = searchParams.get('imageNodeId');
        const chatBlockId = searchParams.get('chatBlockId');

        if (!imageNodeId || !chatBlockId) {
            return NextResponse.json({ error: 'imageNodeId and chatBlockId are required' }, { status: 400 });
        }

        // Verify ownership through the image node's board
        const imageNode = await db.query.fileNodes.findFirst({
            where: eq(fileNodes.id, imageNodeId),
        });

        if (!imageNode) {
            return NextResponse.json({ error: 'Image node not found' }, { status: 404 });
        }

        const board = await db.query.boards.findFirst({
            where: and(
                eq(boards.id, imageNode.boardId),
                eq(boards.userId, userId)
            ),
        });

        if (!board) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Delete the link
        await db.delete(imageContextLinks).where(
            and(
                eq(imageContextLinks.imageNodeId, imageNodeId),
                eq(imageContextLinks.targetBlockId, chatBlockId)
            )
        );

        console.log('[DELETE /api/image-context-links] Deleted link:', imageNodeId, '→', chatBlockId);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting image context link:', error);
        return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 });
    }
}
