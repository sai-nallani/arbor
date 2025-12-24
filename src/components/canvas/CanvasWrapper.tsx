'use client';

import dynamic from 'next/dynamic';

// Dynamically import Canvas to avoid SSR issues with React Flow
const Canvas = dynamic(() => import('@/components/canvas/Canvas'), {
    ssr: false,
    loading: () => (
        <div className="canvas-container">
            <div className="canvas-loading">
                <div className="loading-spinner" />
                <p>Loading canvas...</p>
            </div>
        </div>
    ),
});

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

interface MessageLink {
    id: string;
    sourceMessageId: string;
    targetBlockId: string;
    quoteStart: number;
    quoteEnd: number;
    quoteText: string | null;
}

interface CanvasWrapperProps {
    boardId: string;
    boardName: string;
    initialBlocks: ChatBlockWithMessages[];
    initialLinks?: MessageLink[];
}

export default function CanvasWrapper({ boardId, boardName, initialBlocks, initialLinks }: CanvasWrapperProps) {
    return (
        <div className="canvas-container">
            <Canvas
                boardId={boardId}
                boardName={boardName}
                initialBlocks={initialBlocks}
                initialLinks={initialLinks}
            />
        </div>
    );
}
