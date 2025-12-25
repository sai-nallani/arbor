import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { boards, chatBlocks, messages, messageLinks, fileNodes, fileLinks, contextLinks } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import CanvasWrapper from '@/components/canvas/CanvasWrapper';

interface ChatBlockWithMessages {
    id: string;
    title: string;
    positionX: number;
    positionY: number;
    model: string;
    isExpanded: boolean;
    hasImage: boolean;
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

    // Fetch all file nodes (images) for this board
    const files = await db
        .select()
        .from(fileNodes)
        .where(eq(fileNodes.boardId, boardId));

    // Fetch file links to reconstruct edges
    const linksData = await db
        .select()
        .from(fileLinks)
        .innerJoin(fileNodes, eq(fileLinks.fileNodeId, fileNodes.id))
        .where(eq(fileNodes.boardId, boardId));

    // Map file links to simpler format if needed, or pass as is
    // We'll pass raw links for now

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
                model: block.model,
                isExpanded: block.isExpanded || false,
                hasImage: block.hasImage || false,
                messages: blockMessages.map((m) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                })),
            };
        })
    );

    // Fetch message links (footnotes) based on SOURCE messages
    // This ensures we get all highlights that should be rendered on the loaded messages
    const allMessageIds = blocksWithMessages.flatMap(b => b.messages.map(m => m.id));
    let footnotes: typeof messageLinks.$inferSelect[] = [];

    if (allMessageIds.length > 0) {
        footnotes = await db
            .select()
            .from(messageLinks)
            .where(inArray(messageLinks.sourceMessageId, allMessageIds));
    }

    // Fetch context links between chat blocks on this board
    const blockIds = blocks.map(b => b.id);
    let contextLinksData: { id: string; sourceBlockId: string; targetBlockId: string }[] = [];
    if (blockIds.length > 0) {
        const rawLinks = await db
            .select({
                id: contextLinks.id,
                sourceBlockId: contextLinks.sourceBlockId,
                targetBlockId: contextLinks.targetBlockId,
            })
            .from(contextLinks)
            .where(inArray(contextLinks.sourceBlockId, blockIds));
        contextLinksData = rawLinks;
    }

    return (
        <CanvasWrapper
            boardId={boardId}
            boardName={board[0].name}
            initialBlocks={blocksWithMessages}
            initialLinks={footnotes}
            initialFiles={files}
            initialFileLinks={linksData.map(l => l.file_links)}
            initialContextLinks={contextLinksData}
        />
    );
}
