"use client";

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { ThemeToggle } from './ThemeToggle';

interface Board {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}

export function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [boards, setBoards] = useState<Board[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    // Fetch boards on mount
    useEffect(() => {
        async function fetchBoards() {
            try {
                const response = await fetch('/api/boards');
                if (response.ok) {
                    const data = await response.json();
                    setBoards(data);
                }
            } catch (error) {
                console.error('Error fetching boards:', error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchBoards();
    }, []);

    // Listen for new board creation from other components
    useEffect(() => {
        const handleBoardCreated = (event: CustomEvent<Board>) => {
            setBoards(prev => [event.detail, ...prev]);
        };

        window.addEventListener('boardCreated', handleBoardCreated as EventListener);
        return () => {
            window.removeEventListener('boardCreated', handleBoardCreated as EventListener);
        };
    }, []);

    // Handle creating a new board
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
                setBoards(prev => [newBoard, ...prev]);
                router.push(`/chat/${newBoard.id}`);
            }
        } catch (error) {
            console.error('Error creating board:', error);
        } finally {
            setIsCreating(false);
        }
    }

    // Handle deleting a board
    async function handleDeleteBoard(e: React.MouseEvent, boardId: string) {
        e.preventDefault();
        e.stopPropagation();

        if (deletingId) return;

        setDeletingId(boardId);
        try {
            const response = await fetch(`/api/boards/${boardId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setBoards(prev => prev.filter(b => b.id !== boardId));

                // If we deleted the current board, navigate to /chat
                if (pathname === `/chat/${boardId}`) {
                    router.push('/chat');
                }
            }
        } catch (error) {
            console.error('Error deleting board:', error);
        } finally {
            setDeletingId(null);
        }
    }

    // Handle renaming a board
    async function handleRenameBoard(boardId: string) {
        const trimmedName = editingName.trim();
        if (!trimmedName) {
            setEditingId(null);
            return;
        }

        // Optimistic update - update UI immediately
        const previousName = boards.find(b => b.id === boardId)?.name;
        setBoards(prev => prev.map(b => b.id === boardId ? { ...b, name: trimmedName } : b));
        setEditingId(null);

        // Then make the API call
        try {
            const response = await fetch(`/api/boards/${boardId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmedName }),
            });

            if (!response.ok) {
                // Revert on error
                setBoards(prev => prev.map(b => b.id === boardId ? { ...b, name: previousName || '' } : b));
            }
        } catch (error) {
            console.error('Error renaming board:', error);
            // Revert on error
            setBoards(prev => prev.map(b => b.id === boardId ? { ...b, name: previousName || '' } : b));
        }
    }

    // Start editing a board name
    function startEditing(board: Board) {
        setMenuOpenId(null);
        setEditingId(board.id);
        setEditingName(board.name);
    }

    // Toggle menu
    function toggleMenu(e: React.MouseEvent, boardId: string) {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpenId(menuOpenId === boardId ? null : boardId);
    }

    return (
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            {/* Header */}
            <div className="sidebar-header">
                {!isCollapsed && (
                    <a href="/" className="sidebar-logo">
                        <svg width="24" height="30" viewBox="0 0 80 100" fill="none">
                            <path d="M40 95 L40 50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            <path d="M40 55 L25 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M40 55 L55 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <circle cx="25" cy="40" r="3" fill="var(--accent)" />
                            <circle cx="55" cy="40" r="3" fill="var(--accent-secondary)" />
                            <circle cx="40" cy="30" r="3" fill="var(--accent-nature)" />
                        </svg>
                        <span>Arbor</span>
                    </a>
                )}
                <button
                    className="sidebar-toggle"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {isCollapsed ? (
                            <path d="M9 18l6-6-6-6" />
                        ) : (
                            <path d="M15 18l-6-6 6-6" />
                        )}
                    </svg>
                </button>
            </div>

            {/* New Board Button */}
            <button
                className="new-board-sidebar-btn"
                onClick={handleNewBoard}
                disabled={isCreating}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                </svg>
                {!isCollapsed && <span>{isCreating ? 'Creating...' : 'New Board'}</span>}
            </button>

            {/* Board List */}
            <nav className="sidebar-nav">
                {!isCollapsed && <div className="sidebar-section-title">Recent</div>}
                <ul className="board-list">
                    {isLoading ? (
                        <li className="board-item-loading">
                            {!isCollapsed && <span>Loading...</span>}
                        </li>
                    ) : boards.length === 0 ? (
                        <li className="board-item-empty">
                            {!isCollapsed && (
                                <div className="empty-boards-content">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="empty-boards-icon">
                                        <path d="M12 22V8" strokeLinecap="round" />
                                        <path d="M12 8c0-3-2-5-5-6" strokeLinecap="round" />
                                        <path d="M12 8c0-3 2-5 5-6" strokeLinecap="round" />
                                        <path d="M12 14c-2 0-4-1-5-3" strokeLinecap="round" />
                                        <path d="M12 14c2 0 4-1 5-3" strokeLinecap="round" />
                                    </svg>
                                    <span className="empty-boards-text">No boards yet</span>
                                    <span className="empty-boards-hint">Create one to get started</span>
                                </div>
                            )}
                        </li>
                    ) : (
                        boards.map((board) => {
                            const isActive = pathname === `/chat/${board.id}`;
                            const isDeleting = deletingId === board.id;
                            return (
                                <li key={board.id} className="board-item-wrapper">
                                    <a
                                        href={`/chat/${board.id}`}
                                        className={`board-item ${isActive ? 'active' : ''}`}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <rect x="3" y="3" width="18" height="18" rx="2" />
                                            <path d="M9 3v18M3 9h6M3 15h6" />
                                        </svg>
                                        {!isCollapsed && (
                                            <>
                                                {editingId === board.id ? (
                                                    <input
                                                        type="text"
                                                        className="board-name-input"
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        onBlur={() => handleRenameBoard(board.id)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleRenameBoard(board.id);
                                                            if (e.key === 'Escape') setEditingId(null);
                                                        }}
                                                        autoFocus
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <span className="board-name">
                                                        {board.name}
                                                    </span>
                                                )}
                                                <div className="board-menu-container">
                                                    <button
                                                        className="board-menu-btn"
                                                        onClick={(e) => toggleMenu(e, board.id)}
                                                        aria-label="Board options"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                            <circle cx="12" cy="5" r="2" />
                                                            <circle cx="12" cy="12" r="2" />
                                                            <circle cx="12" cy="19" r="2" />
                                                        </svg>
                                                    </button>
                                                    {menuOpenId === board.id && (
                                                        <div className="board-menu-dropdown">
                                                            <button
                                                                className="board-menu-item"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    startEditing(board);
                                                                }}
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                </svg>
                                                                Rename
                                                            </button>
                                                            <button
                                                                className="board-menu-item danger"
                                                                onClick={(e) => {
                                                                    setMenuOpenId(null);
                                                                    handleDeleteBoard(e, board.id);
                                                                }}
                                                                disabled={isDeleting}
                                                            >
                                                                {isDeleting ? (
                                                                    <div className="delete-spinner" />
                                                                ) : (
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                                                                    </svg>
                                                                )}
                                                                Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </a>
                                </li>
                            );
                        })
                    )}
                </ul>
            </nav>

            {/* Footer with Theme Toggle and User */}
            <div className="sidebar-footer">
                {/* Theme Toggle */}
                <div className="theme-toggle-section">
                    <ThemeToggle isCollapsed={isCollapsed} />
                </div>

                {/* User Account */}
                <div className="user-section">
                    <UserButton
                        afterSignOutUrl="/"
                        appearance={{
                            elements: {
                                avatarBox: isCollapsed ? "w-8 h-8" : "w-9 h-9"
                            }
                        }}
                    />
                    {!isCollapsed && (
                        <div className="user-info">
                            <span className="user-label">Account</span>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}


