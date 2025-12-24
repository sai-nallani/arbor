'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface ChatInputProps {
    onSend: (content: string) => void;
    isLoading: boolean;
    onStop?: () => void;
    placeholder?: string;
    compact?: boolean;
    isSearchEnabled?: boolean;
    onSearchToggle?: (enabled: boolean) => void;
}

export default function ChatInput({
    onSend,
    isLoading,
    onStop,
    placeholder = 'Type a message...',
    compact = false,
    isSearchEnabled = false,
    onSearchToggle,
}: ChatInputProps) {
    const [value, setValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        }
    }, [value]);

    // Handle send
    const handleSend = () => {
        const trimmed = value.trim();
        if (!trimmed || isLoading) return;

        onSend(trimmed);
        setValue('');
        // We do NOT reset search here if we want persistence, or we can let parent decide.
        // User asked to "enable web search capabilities", usually per-message or session. 
        // Let's assume per-message but sticky? "toggle" implies sticky or per-message.
        // I'll leave the reset logic to the parent if desired.

        // Reset height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    // Handle keyboard
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={`chat-input-wrapper ${compact ? 'compact' : ''}`}>
            <div className="chat-input-card">
                <textarea
                    ref={textareaRef}
                    className="chat-input"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={compact ? "Type a message..." : "Reply to Arbor..."}
                    disabled={isLoading}
                    rows={1}
                />
                <div className="chat-input-footer">
                    <div className="chat-input-tools">
                        <button
                            className={`chat-tool-btn ${isSearchEnabled ? 'active' : ''}`}
                            type="button"
                            title="Toggle Web Search"
                            onClick={() => onSearchToggle?.(!isSearchEnabled)}
                            style={{
                                color: isSearchEnabled ? 'var(--accent)' : 'currentColor',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                width: 'auto',
                                paddingRight: '8px'
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>Web Search</span>
                        </button>
                    </div>
                    <div className="chat-input-actions">
                        {isLoading ? (
                            <button
                                className="chat-stop-btn-icon"
                                onClick={onStop}
                                type="button"
                                title="Stop generating"
                            >
                                <div className="stop-icon-square" />
                            </button>
                        ) : (
                            <button
                                className="chat-send-btn-icon"
                                onClick={handleSend}
                                disabled={!value.trim()}
                                type="button"
                                title="Send message"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="19" x2="12" y2="5" />
                                    <polyline points="5 12 12 5 19 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
