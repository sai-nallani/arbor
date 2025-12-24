import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { boards, chatBlocks, messages, messageLinks } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import CanvasWrapper from '@/components/canvas/CanvasWrapper';

interface ChatBlockWithMessages {
    id: string;
    title: string;
    positionX: number;
    positionY: number;
    messages: Array<{
        id: string;
        role: string;
        content: string;
    }>;
}

interface PageProps {
    params: Promise<{ boardId: string }>;
}

export default async function BoardPage({ params }: PageProps) {
    const { userId } = await auth();

    if (!userId) {
        redirect('/');
    }

    const { boardId } = await params;

    // Fetch board with ownership check
    const board = await db
        .select()
        .from(boards)
        .where(and(eq(boards.id, boardId), eq(boards.userId, userId)));

    if (board.length === 0) {
        redirect('/chat');
    }

    // Fetch all chat blocks for this board with their messages
    const blocks = await db
        .select()
        .from(chatBlocks)
        .where(eq(chatBlocks.boardId, boardId));

    // Fetch messages for all blocks
    const blocksWithMessages: ChatBlockWithMessages[] = await Promise.all(
        blocks.map(async (block) => {
            const blockMessages = await db
                .select()
                .from(messages)
                .where(eq(messages.chatBlockId, block.id))
                .orderBy(messages.createdAt);

            return {
                id: block.id,
                title: block.title,
                positionX: block.positionX,
                positionY: block.positionY,
                messages: blockMessages.map((m) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                })),
            };
        })
    );

    // Fetch message links (footnotes)
    // We want all links where the target block is in this board
    // Filter outgoing links from messages in this board
    const blockIds = blocks.map(b => b.id);
    let links: typeof messageLinks.$inferSelect[] = [];

    if (blockIds.length > 0) {
        links = await db
            .select()
            .from(messageLinks)
            .where(inArray(messageLinks.targetBlockId, blockIds));
    }

    return (
        <CanvasWrapper
            boardId={boardId}
            boardName={board[0].name}
            initialBlocks={blocksWithMessages}
            initialLinks={links}
        />
    );
}
