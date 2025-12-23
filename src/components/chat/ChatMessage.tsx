'use client';

import { memo } from 'react';

interface ChatMessageProps {
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
}

function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
    return (
        <div className={`chat-message ${role}`}>
            <div className="chat-message-avatar">
                {role === 'user' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                )}
            </div>
            <div className="chat-message-content">
                <span className="chat-message-role">
                    {role === 'user' ? 'You' : 'Assistant'}
                </span>
                <div className={`chat-message-text ${isStreaming ? 'streaming' : ''}`}>
                    {content || (isStreaming ? '' : '...')}
                    {isStreaming && <span className="streaming-cursor" />}
                </div>
            </div>
        </div>
    );
}

export default memo(ChatMessage);
