'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface ChatInputProps {
    onSend: (content: string) => void;
    isLoading: boolean;
    onStop?: () => void;
    placeholder?: string;
}

export default function ChatInput({
    onSend,
    isLoading,
    onStop,
    placeholder = 'Type a message...',
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
        <div className="chat-input-container">
            <textarea
                ref={textareaRef}
                className="chat-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isLoading}
                rows={1}
            />
            {isLoading ? (
                <button
                    className="chat-stop-btn"
                    onClick={onStop}
                    type="button"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    Stop
                </button>
            ) : (
                <button
                    className="chat-send-btn"
                    onClick={handleSend}
                    disabled={!value.trim()}
                    type="button"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                </button>
            )}
        </div>
    );
}
