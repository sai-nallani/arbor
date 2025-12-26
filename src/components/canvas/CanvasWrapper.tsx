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
    width?: number;
    height?: number;
    model?: string;
    isExpanded?: boolean;
    hasImage?: boolean; // Persisted strict mode for vision models
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

interface FileNodeData {
    id: string;
    name: string;
    mimeType: string;
    url: string;
    positionX: number;
    positionY: number;
}

interface FileLinkData {
    id: string;
    chatBlockId: string;
    fileNodeId: string;
}

interface ContextLinkData {
    id: string;
    sourceBlockId: string;
    targetBlockId: string;
}

interface CanvasWrapperProps {
    boardId: string;
    boardName: string;
    initialBlocks: ChatBlockWithMessages[];
    initialLinks?: MessageLink[];
    initialFiles?: FileNodeData[];
    initialFileLinks?: FileLinkData[];
    initialContextLinks?: ContextLinkData[];
    initialStickyNotes?: any[];
}

export default function CanvasWrapper({
    boardId,
    boardName,
    initialBlocks,
    initialLinks,
    initialFiles,
    initialFileLinks,
    initialContextLinks,
    initialStickyNotes
}: CanvasWrapperProps) {
    return (
        <div className="canvas-container">
            <Canvas
                boardId={boardId}
                boardName={boardName}
                initialBlocks={initialBlocks}
                initialLinks={initialLinks}
                initialFiles={initialFiles}
                initialFileLinks={initialFileLinks}
                initialContextLinks={initialContextLinks}
                initialStickyNotes={initialStickyNotes}
            />
        </div>
    );
}
