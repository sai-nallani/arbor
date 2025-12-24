'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
    const router = useRouter();
    const [isCreating, setIsCreating] = useState(false);

    async function handleNewBoard() {
        if (isCreating) return;
        setIsCreating(true);

        try {
            const response = await fetch('/api/boards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Untitled Board' }),
            });

            if (response.ok) {
                const newBoard = await response.json();
                // Dispatch event to notify sidebar of new board
                window.dispatchEvent(new CustomEvent('boardCreated', { detail: newBoard }));
                router.push(`/chat/${newBoard.id}`);
            }
        } catch (error) {
            console.error('Error creating board:', error);
        } finally {
            setIsCreating(false);
        }
    }

    return (
        <div className="canvas-container">
            {/* Infinite canvas placeholder - will add React Flow later */}
            <div className="canvas-empty-state">
                <div className="empty-state-content">
                    <svg
                        width="64"
                        height="64"
                        viewBox="0 0 80 100"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="empty-state-icon"
                    >
                        <path d="M40 95 L40 50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
                        <path d="M40 50 L40 30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
                        <path d="M40 55 L25 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
                        <path d="M40 55 L55 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
                        <circle cx="25" cy="40" r="4" fill="var(--accent)" opacity="0.6" />
                        <circle cx="55" cy="40" r="4" fill="var(--accent-secondary)" opacity="0.6" />
                        <circle cx="40" cy="30" r="4" fill="var(--accent-nature)" opacity="0.6" />
                    </svg>
                    <h2>Start a new conversation</h2>
                    <p>Create a board to begin exploring ideas on your canvas</p>
                    <button
                        className="new-chat-btn"
                        onClick={handleNewBoard}
                        disabled={isCreating}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        {isCreating ? 'Creating...' : 'New Board'}
                    </button>
                </div>
            </div>
        </div>
    );
}
