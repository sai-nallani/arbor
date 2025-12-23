'use client';

import { useEffect, useRef } from 'react';
import { useChat } from 'dedalus-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

interface ChatModalProps {
    blockId: string;
    title: string;
    initialMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    onClose: () => void;
    onTitleChange?: (title: string) => void;
}

export default function ChatModal({
    blockId,
    title,
    initialMessages = [],
    onClose,
    onTitleChange,
}: ChatModalProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const {
        messages,
        sendMessage,
        status,
        stop,
        error,
    } = useChat({
        id: blockId,
        messages: initialMessages.map((m, i) => ({
            id: `${blockId}-${i}`,
            role: m.role,
            content: m.content,
        })),
        transport: {
            api: '/api/chat',
            body: { chatBlockId: blockId },
        },
        onFinish: async ({ message }) => {
            // Save assistant message to database
            await fetch(`/api/chat-blocks/${blockId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: 'assistant',
                    content: message.content,
                }),
            });
        },
    });

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Handle send
    const handleSend = async (content: string) => {
        // Save user message first
        await fetch(`/api/chat-blocks/${blockId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'user', content }),
        });

        // Then send to AI
        sendMessage(content);
    };

    // Handle backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="chat-modal-backdrop" onClick={handleBackdropClick}>
            <div className="chat-modal">
                {/* Header */}
                <div className="chat-modal-header">
                    <h2 className="chat-modal-title">{title}</h2>
                    <button className="chat-modal-close" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Messages */}
                <div className="chat-modal-messages">
                    {messages.length === 0 ? (
                        <div className="chat-empty-state">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                            </svg>
                            <p>Start a conversation...</p>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <ChatMessage
                                key={msg.id}
                                role={msg.role as 'user' | 'assistant'}
                                content={msg.content}
                                isStreaming={status === 'streaming' && msg === messages[messages.length - 1] && msg.role === 'assistant'}
                            />
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Error display */}
                {error && (
                    <div className="chat-error">
                        <span>Error: {error.message}</span>
                    </div>
                )}

                {/* Input */}
                <ChatInput
                    onSend={handleSend}
                    isLoading={status === 'streaming' || status === 'submitted'}
                    onStop={stop}
                />
            </div>
        </div>
    );
}
