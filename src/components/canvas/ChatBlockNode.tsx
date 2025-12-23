'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface ChatBlockData {
    title: string;
    messages: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
}

interface ChatBlockNodeProps {
    data: ChatBlockData;
    selected?: boolean;
}

function ChatBlockNode({ data, selected }: ChatBlockNodeProps) {
    return (
        <div className={`chat-block-node ${selected ? 'selected' : ''}`}>
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
                    <p className="chat-block-empty">Click to start chatting...</p>
                ) : (
                    <p className="chat-block-preview">
                        {data.messages[data.messages.length - 1]?.content.slice(0, 100)}...
                    </p>
                )}
            </div>

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
