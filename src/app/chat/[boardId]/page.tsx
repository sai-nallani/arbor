"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
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

interface Board {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}

export default function BoardPage() {
    const params = useParams();
    const boardId = params.boardId as string;
    const [board, setBoard] = useState<Board | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchBoard() {
            try {
                const response = await fetch('/api/boards');
                if (response.ok) {
                    const boards: Board[] = await response.json();
                    const currentBoard = boards.find(b => b.id === boardId);
                    setBoard(currentBoard || null);
                }
            } catch (error) {
                console.error('Error fetching board:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchBoard();
    }, [boardId]);

    if (loading) {
        return (
            <div className="canvas-container">
                <div className="canvas-loading">
                    <div className="loading-spinner" />
                    <p>Loading board...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="canvas-container">
            <Canvas boardId={boardId} boardName={board?.name || 'Untitled Board'} />
        </div>
    );
}
