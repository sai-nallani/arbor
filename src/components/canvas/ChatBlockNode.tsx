'use client';


import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, useUpdateNodeInternals } from '@xyflow/react';
import EmbeddedChat from '../chat/EmbeddedChat';

interface ChatBlockData {
    id: string;
    title: string;
    messages: Array<{
        role: 'user' | 'assistant';
        content: string;
        id?: string;
    }>;
    links?: Record<string, any[]>;
    model?: string;
    boardId?: string;
    hasImage?: boolean;
    onOpen?: () => void;
    onMaximize?: (blockId: string) => void;
    onDelete?: (blockId: string) => void;
    onRename?: (blockId: string, newTitle: string) => void;
    onModelChange?: (blockId: string, newModel: string) => void;
    onExpandToggle?: (blockId: string, isExpanded: boolean) => void;
    onHasImageChange?: (blockId: string, hasImage: boolean) => void;
    onBranch?: (sourceMessageId: string, quoteStart: number, quoteEnd: number, quoteText: string, contextMessages: any[]) => void;
    onLinkClick?: (targetBlockId: string) => void;
    onImageUploaded?: (imageInfo: { id: string; url: string; name: string, mimeType?: string }) => void;
    isExpanded?: boolean;
    branchContext?: string;
}

interface ChatBlockNodeProps {
    data: ChatBlockData;
    selected?: boolean;
}

function ChatBlockNode({ data, selected }: ChatBlockNodeProps) {
    // Initialize from data, but keep local state for responsiveness
    // We use a key trick or useEffect to sync if data updates from outside
    const [isExpanded, setIsExpanded] = useState(!!data.isExpanded);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(data.title);
    const [hasBeenResized, setHasBeenResized] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const lastMessage = data.messages[data.messages.length - 1];
    const updateNodeInternals = useUpdateNodeInternals();

    // Force update handles when resized or expanded
    useEffect(() => {
        updateNodeInternals(data.id);
        // Double check with a small delay for animation completion
        const timer = setTimeout(() => updateNodeInternals(data.id), 300);
        return () => clearTimeout(timer);
    }, [data.id, isExpanded, hasBeenResized, updateNodeInternals]);

    // Sync state if data.isExpanded changes (e.g. initial load vs client toggle)
    useEffect(() => {
        setIsExpanded(!!data.isExpanded);
    }, [data.isExpanded]);

    // Toggle expansion
    const handleExpandToggle = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(true);
        data.onExpandToggle?.(data.id, true);
    }, [data]);

    const handleClose = useCallback(() => {
        setIsExpanded(false);
        data.onExpandToggle?.(data.id, false);
    }, [data]);

    const handleMaximize = useCallback(() => {
        setIsExpanded(false); // Collapse when maximizing
        data.onMaximize?.(data.id);
    }, [data]);

    // Memoize callbacks passed to EmbeddedChat to prevent infinite update loops
    const handleModelChange = useCallback((newModel: string) => {
        data.onModelChange?.(data.id, newModel);
    }, [data.id, data.onModelChange]);

    const handleHasImageChange = useCallback((newHasImage: boolean) => {
        data.onHasImageChange?.(data.id, newHasImage);
    }, [data.id, data.onHasImageChange]);

    const handleRenameFromChat = useCallback((newTitle: string) => {
        data.onRename?.(data.id, newTitle);
    }, [data.id, data.onRename]);

    const handleDelete = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        data.onDelete?.(data.id);
    }, [data]);

    // Handle rename
    const handleTitleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditTitle(data.title);
        setIsEditing(true);
    };

    const handleTitleSave = () => {
        const trimmed = editTitle.trim();
        if (trimmed && trimmed !== data.title) {
            data.onRename?.(data.id, trimmed);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.stopPropagation(); // Prevent newline if it were textarea, but good practice
            handleTitleSave();
        }
        if (e.key === 'Escape') {
            e.stopPropagation();
            setEditTitle(data.title);
            setIsEditing(false);
        }
    };

    return (
        <>
            <div
                className={`chat-block-node ${selected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''} ${hasBeenResized ? 'resized' : ''}`}
                style={isExpanded ? {
                    width: hasBeenResized ? '100%' : 800,
                    height: hasBeenResized ? '100%' : 800,
                    minWidth: 400,
                    minHeight: 350,
                    cursor: 'default',
                    transition: 'none' // Disable transition when expanded to allow smooth resizing
                } : undefined}
            >
                {/* Input handle for connections */}
                {/* Input handle for connections - REMOVED DUPLICATE */}

                {isExpanded ? (
                    <EmbeddedChat
                        blockId={data.id}
                        boardId={data.boardId || ''}
                        title={data.title}
                        initialMessages={data.messages}
                        onClose={handleClose}
                        onMaximize={handleMaximize}
                        onDelete={handleDelete}
                        onBranch={data.onBranch}
                        onLinkClick={data.onLinkClick}
                        links={data.links}
                        model={data.model}
                        branchContext={data.branchContext}
                        onModelChange={handleModelChange}
                        hasBeenResized={hasBeenResized}
                        hasImage={!!data.hasImage}
                        onImageUploaded={data.onImageUploaded}
                        onHasImageChange={handleHasImageChange}
                        onRename={handleRenameFromChat}
                    />
                ) : (
                    <>
                        <div className="chat-block-header">
                            <div className="chat-block-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                                </svg>
                            </div>
                            {isEditing ? (
                                <input
                                    type="text"
                                    className="chat-block-title-input"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    onBlur={handleTitleSave}
                                    onKeyDown={handleKeyDown}
                                    autoFocus
                                    onFocus={(e) => e.target.select()}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span
                                    className="chat-block-title"
                                    onDoubleClick={handleTitleDoubleClick}
                                    title="Double-click to rename"
                                >
                                    {data.title}
                                </span>
                            )}
                            <div className="chat-block-actions">
                                {!isEditing && (
                                    <div className="chat-block-btn" onClick={() => { setEditTitle(data.title); setIsEditing(true); }} role="button" title="Rename">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 20h9" />
                                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                        </svg>
                                    </div>
                                )}
                                <div className="chat-block-btn" onClick={handleMaximize} role="button" title="View in Modal">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </div>
                                <div className="chat-block-btn" onClick={handleExpandToggle} role="button" title="Expand to Canvas">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                                    </svg>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <div
                                        className={`chat-block-btn delete ${showDeleteConfirm ? 'active' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(!showDeleteConfirm); }}
                                        role="button"
                                        title="Delete"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </div>
                                    {showDeleteConfirm && (
                                        <div
                                            className="delete-confirm-popover"
                                            style={{
                                                position: 'absolute',
                                                top: '100%',
                                                right: 0,
                                                marginTop: '8px',
                                                background: '#1a1a1a',
                                                border: '1px solid var(--border)',
                                                borderRadius: '8px',
                                                padding: '12px',
                                                zIndex: 100,
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                                width: '180px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '8px'
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                                Delete this chat?
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => setShowDeleteConfirm(false)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '6px',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--border)',
                                                        background: 'transparent',
                                                        color: 'var(--text-secondary)',
                                                        fontSize: '12px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        handleDelete(e);
                                                        setShowDeleteConfirm(false);
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        padding: '6px',
                                                        borderRadius: '4px',
                                                        border: 'none',
                                                        background: '#ef4444',
                                                        color: 'white',
                                                        fontSize: '12px',
                                                        cursor: 'pointer',
                                                        fontWeight: 500
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div
                            className="chat-block-content"
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(true);
                                data.onExpandToggle?.(data.id, true);
                            }}
                        >
                            {data.messages.length === 0 ? (
                                <p className="chat-block-empty">Double-click to chat...</p>
                            ) : (
                                <p className="chat-block-preview">
                                    <span className="chat-block-preview-role">
                                        {lastMessage.role === 'user' ? 'You: ' : 'AI: '}
                                    </span>
                                    {lastMessage.content.slice(0, 80)}
                                    {lastMessage.content.length > 80 ? '...' : ''}
                                </p>
                            )}
                        </div>

                        {/* Message count badge */}
                        {data.messages.length > 0 && (
                            <div className="chat-block-badge">
                                {data.messages.length}
                            </div>
                        )}
                    </>
                )}

                {/* Input handle for incoming connections (Start of chat) */}
                <Handle
                    type="target"
                    position={Position.Top}
                    className="chat-block-handle"
                    id="top"
                    style={{ left: '50%', transform: 'translateX(-50%)' }}
                />

                {/* Output handle for branching (End of chat) */}
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="chat-block-handle"
                    id="bottom"
                    style={{ left: '50%', transform: 'translateX(-50%)' }}
                />

                {/* Context link handles - right side for outgoing context */}
                <Handle
                    type="source"
                    position={Position.Right}
                    className="chat-block-handle context-handle"
                    id="context-out"
                    style={{ top: '50%', transform: 'translateY(-50%)' }}
                />

                {/* Context link handles - left side for incoming context */}
                <Handle
                    type="target"
                    position={Position.Left}
                    className="chat-block-handle context-handle"
                    id="context-in"
                    style={{ top: '50%', transform: 'translateY(-50%)' }}
                />
            </div>

            {/* Resizer only active when expanded and selected - moved to end for z-index */}
            {isExpanded && selected && (
                <NodeResizer
                    minWidth={400}
                    minHeight={350}
                    handleStyle={{ width: 8, height: 8, zIndex: 1000 }}
                    onResizeEnd={() => setHasBeenResized(true)}
                />
            )}
        </>
    );
}

export default memo(ChatBlockNode);
