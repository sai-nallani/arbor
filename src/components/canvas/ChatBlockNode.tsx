'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface ChatBlockData {
    id: string;
    title: string;
    messages: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
    onOpen?: () => void;
}

interface ChatBlockNodeProps {
    data: ChatBlockData;
    selected?: boolean;
}

function ChatBlockNode({ data, selected }: ChatBlockNodeProps) {
    const lastMessage = data.messages[data.messages.length - 1];

    const handleClick = (e: React.MouseEvent) => {
        // Only open on double-click or if clicking the content area
        if (e.detail === 2 || (e.target as HTMLElement).classList.contains('chat-block-content')) {
            data.onOpen?.();
        }
    };

    return (
        <div
            className={`chat-block-node ${selected ? 'selected' : ''}`}
            onClick={handleClick}
        >
            {/* Input handle for connections */}
            <Handle
                type="target"
                position={Position.Top}
                className="chat-block-handle"
            />

            <div className="chat-block-header">
                <div className="chat-block-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                </div>
                <span className="chat-block-title">{data.title}</span>
            </div>

            <div className="chat-block-content">
                {data.messages.length === 0 ? (
                    <p className="chat-block-empty">Double-click to start chatting...</p>
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

            {/* Output handle for branching */}
            <Handle
                type="source"
                position={Position.Bottom}
                className="chat-block-handle"
            />
        </div>
    );
}

export default memo(ChatBlockNode);
