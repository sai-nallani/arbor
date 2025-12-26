/**
 * Context Links API Route
 *
 * POST /api/context-links - Create a context link between chat blocks
 * DELETE /api/context-links - Remove a context link
 * GET /api/context-links?boardId=xxx - List all context links for a board
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { contextLinks, chatBlocks } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';

// Helper: Check if adding source → target would create a cycle
// Uses BFS to see if target can reach source through existing links
async function wouldCreateCycle(sourceBlockId: string, targetBlockId: string): Promise<boolean> {
    // If source === target, it's a self-loop (cycle)
    if (sourceBlockId === targetBlockId) {
        return true;
    }

    // BFS from target to see if we can reach source
    const visited = new Set<string>();
    const queue: string[] = [targetBlockId];

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        // Get all blocks that this block provides context TO
        const outgoingLinks = await db
            .select({ targetId: contextLinks.targetBlockId })
            .from(contextLinks)
            .where(eq(contextLinks.sourceBlockId, current));

        for (const link of outgoingLinks) {
            if (link.targetId === sourceBlockId) {
                // Found a path from target back to source - cycle!
                return true;
            }
            if (!visited.has(link.targetId)) {
                queue.push(link.targetId);
            }
        }
    }

    return false;
}

// Helper: Get all ancestor block IDs (blocks that provide context to this block, transitively)
async function getAncestorBlockIds(blockId: string): Promise<string[]> {
    const ancestors: string[] = [];
    const visited = new Set<string>();
    const queue: string[] = [blockId];

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        // Get all blocks that provide context TO this block
        const incomingLinks = await db
            .select({ sourceId: contextLinks.sourceBlockId })
            .from(contextLinks)
            .where(eq(contextLinks.targetBlockId, current));

        for (const link of incomingLinks) {
            if (!visited.has(link.sourceId)) {
                ancestors.push(link.sourceId);
                queue.push(link.sourceId);
            }
        }
    }

    return ancestors;
}

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { sourceBlockId, targetBlockId, sourceHandle, targetHandle } = body;

        if (!sourceBlockId || !targetBlockId) {
            return NextResponse.json(
                { error: 'sourceBlockId and targetBlockId are required' },
                { status: 400 }
            );
        }

        // Verify both blocks exist and belong to the same board
        const [sourceBlock, targetBlock] = await Promise.all([
            db.select().from(chatBlocks).where(eq(chatBlocks.id, sourceBlockId)).then(r => r[0]),
            db.select().from(chatBlocks).where(eq(chatBlocks.id, targetBlockId)).then(r => r[0]),
        ]);

        if (!sourceBlock || !targetBlock) {
            return NextResponse.json({ error: 'Block not found' }, { status: 404 });
        }

        if (sourceBlock.boardId !== targetBlock.boardId) {
            return NextResponse.json(
                { error: 'Cannot link blocks from different boards' },
                { status: 400 }
            );
        }

        // Check for cycles
        const createsCycle = await wouldCreateCycle(sourceBlockId, targetBlockId);
        if (createsCycle) {
            return NextResponse.json(
                { error: 'Cannot create link: would create a cycle' },
                { status: 400 }
            );
        }

        // Check if link already exists
        const existingLink = await db
            .select()
            .from(contextLinks)
            .where(and(
                eq(contextLinks.sourceBlockId, sourceBlockId),
                eq(contextLinks.targetBlockId, targetBlockId)
            ));

        if (existingLink.length > 0) {
            // Return existing link instead of error
            return NextResponse.json(existingLink[0], { status: 200 });
        }

        // Create the link
        const [newLink] = await db
            .insert(contextLinks)
            .values({
                sourceBlockId,
                targetBlockId,
                sourceHandle: sourceHandle || 'right',
                targetHandle: targetHandle || 'left',
            })
            .returning();

        return NextResponse.json(newLink, { status: 201 });
    } catch (error: any) {
        console.error('Error creating context link:', error);

        // Handle unique constraint violation
        if (error.code === '23505') {
            return NextResponse.json(
                { error: 'Link already exists' },
                { status: 409 }
            );
        }

        return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const linkId = searchParams.get('id');
        const sourceBlockId = searchParams.get('sourceBlockId');
        const targetBlockId = searchParams.get('targetBlockId');

        if (linkId) {
            // Delete by link ID
            await db.delete(contextLinks).where(eq(contextLinks.id, linkId));
        } else if (sourceBlockId && targetBlockId) {
            // Delete by source/target pair
            await db.delete(contextLinks).where(
                and(
                    eq(contextLinks.sourceBlockId, sourceBlockId),
                    eq(contextLinks.targetBlockId, targetBlockId)
                )
            );
        } else {
            return NextResponse.json(
                { error: 'Either id or both sourceBlockId and targetBlockId are required' },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting context link:', error);
        return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const boardId = searchParams.get('boardId');
        const blockId = searchParams.get('blockId');

        if (blockId) {
            // Get ancestors for a specific block (for greying out during drag)
            const ancestors = await getAncestorBlockIds(blockId);
            return NextResponse.json({ ancestors });
        }

        if (!boardId) {
            return NextResponse.json(
                { error: 'boardId is required' },
                { status: 400 }
            );
        }

        // Get all context links for the board
        // We need to join with chat_blocks to filter by board
        const links = await db
            .select({
                id: contextLinks.id,
                sourceBlockId: contextLinks.sourceBlockId,
                targetBlockId: contextLinks.targetBlockId,
                sourceHandle: contextLinks.sourceHandle,
                targetHandle: contextLinks.targetHandle,
                createdAt: contextLinks.createdAt,
            })
            .from(contextLinks)
            .innerJoin(chatBlocks, eq(contextLinks.sourceBlockId, chatBlocks.id))
            .where(eq(chatBlocks.boardId, boardId));

        return NextResponse.json(links);
    } catch (error) {
        console.error('Error fetching context links:', error);
        return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
    }
}
