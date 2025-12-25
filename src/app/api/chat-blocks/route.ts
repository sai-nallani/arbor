/**
 * Chat Blocks API Routes
 * 
 * GET  /api/chat-blocks - Fetch all blocks for a board
 * POST /api/chat-blocks - Create a new chat block
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { chatBlocks, boards, messages, messageLinks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/chat-blocks?boardId=xxx
export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const boardId = request.nextUrl.searchParams.get('boardId');

        if (!boardId) {
            return NextResponse.json({ error: 'boardId required' }, { status: 400 });
        }

        // Verify user owns the board
        const board = await db
            .select()
            .from(boards)
            .where(and(eq(boards.id, boardId), eq(boards.userId, userId)));

        if (board.length === 0) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        // Fetch all chat blocks for this board
        const blocks = await db
            .select()
            .from(chatBlocks)
            .where(eq(chatBlocks.boardId, boardId));

        return NextResponse.json(blocks);
    } catch (error) {
        console.error('Error fetching chat blocks:', error);
        return NextResponse.json({ error: 'Failed to fetch blocks' }, { status: 500 });
    }
}

// POST /api/chat-blocks
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            boardId,
            title,
            positionX,
            positionY,
            parentId,
            branchContext,
            branchSourceText,
            initialMessages, // Array of { role, content } to clone
            sourceMessageId, // For linking
            quoteStart,
            quoteEnd,
            quoteText,
            hasImage
        } = body;

        if (!boardId) {
            return NextResponse.json({ error: 'boardId required' }, { status: 400 });
        }

        // Verify user owns the board
        const board = await db
            .select()
            .from(boards)
            .where(and(eq(boards.id, boardId), eq(boards.userId, userId)));

        if (board.length === 0) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        // Transactional creation

        const result = await db.transaction(async (tx) => {
            // 1. Create the chat block

            const [newBlock] = await tx
                .insert(chatBlocks)
                .values({
                    boardId,
                    title: title || 'New Chat',
                    model: body.model || 'anthropic/claude-opus-4-5',
                    positionX: positionX ?? 250,
                    positionY: positionY ?? 150,
                    parentId: parentId || null,
                    branchContext: branchContext || null,
                    branchSourceText: branchSourceText || quoteText || null,
                    hasImage: !!hasImage,
                })
                .returning();



            // 2. Clone initial messages if provided
            let createdMessages: any[] = [];
            if (initialMessages && Array.isArray(initialMessages) && initialMessages.length > 0) {

                createdMessages = await tx.insert(messages).values(
                    initialMessages.map((msg: any) => ({
                        chatBlockId: newBlock.id,
                        role: msg.role,
                        content: msg.content,
                        hiddenContext: msg.hiddenContext || null
                    }))
                ).returning();
            }

            // 3. Create message link if source provided
            let linkId = null;
            if (sourceMessageId && quoteStart !== undefined && quoteEnd !== undefined) {

                const [newLink] = await tx.insert(messageLinks).values({
                    sourceMessageId,
                    targetBlockId: newBlock.id,
                    quoteStart,
                    quoteEnd,
                    quoteText: quoteText || null,
                }).returning();
                linkId = newLink.id;
                console.log('[POST /api/chat-blocks] Message link created with ID:', linkId);
            }

            return { ...newBlock, linkId, messages: createdMessages };
        });


        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        console.error('Error creating chat block:', error);
        return NextResponse.json({ error: 'Failed to create block' }, { status: 500 });
    }
}
