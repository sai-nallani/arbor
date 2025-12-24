'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useChat } from 'dedalus-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ContextMenu from '../ui/ContextMenu';
import InlineInput from './InlineInput';
import ThinkingIndicator from './ThinkingIndicator';

interface EmbeddedChatProps {
    blockId: string;
    title: string;
    initialMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    onClose: () => void;
    onMaximize: () => void;
    onDelete?: (e: React.MouseEvent) => void;
    onBranch?: (sourceMessageId: string, quoteStart: number, quoteEnd: number, quoteText: string, contextMessages: any[]) => void;
    links?: Record<string, any[]>;
    model?: string;
    onModelChange?: (model: string) => void;
    branchContext?: string;
    onLinkClick?: (targetBlockId: string) => void;
    hasBeenResized?: boolean;
}

interface ContextMenuState {
    x: number;
    y: number;
    sourceMessageId: string;
    quoteStart: number;
    quoteEnd: number;
    quoteText: string;
    messageIndex: number;
}

export default function EmbeddedChat({
    blockId,
    title,
    initialMessages = [],
    onClose,
    onMaximize,
    onDelete,
    onBranch,
    onLinkClick,
    links,
    model = 'openai/gpt-5',
    onModelChange,
    branchContext,
    hasBeenResized = false,
}: EmbeddedChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [branchPending, setBranchPending] = useState<ContextMenuState | null>(null);
    const [isSearchEnabled, setIsSearchEnabled] = useState(false);

    const modelOptions = [
        { value: 'anthropic/claude-opus-4-5', label: 'Claude Opus 4.5' },
        { value: 'openai/gpt-5', label: 'GPT-5' },
        { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
        { value: 'anthropic/claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
        { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
        { value: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro' },
    ];

    // Separate persistent history from a pending user prompt (for auto-reply)
    const [processedMessages, pendingPrompt] = useMemo(() => {
        if (initialMessages.length > 0) {
            const lastMsg = initialMessages[initialMessages.length - 1];
            if (lastMsg.role === 'user') {
                return [initialMessages.slice(0, -1), lastMsg.content];
            }
        }
        return [initialMessages, null];
    }, [initialMessages]);

    const {
        messages,
        sendMessage,
        status,
        stop,
        error,
    } = useChat({
        id: blockId,
        messages: processedMessages.map((m, i) => ({
            id: (m as any).id || `${blockId}-${i}`,
            role: m.role,
            content: m.content,
        })),
        transport: {
            api: '/api/chat',
            body: { chatBlockId: blockId, model, isSearchEnabled, branchContext },
        },
        onFinish: async ({ message }) => {
            console.log('Chat finished, saving message:', message);

            // Save assistant message to database
            const contentToSave = typeof message.content === 'string' ? message.content : '';

            // Only save if there's actual content
            if (contentToSave.trim()) {
                await fetch(`/api/chat-blocks/${blockId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        role: 'assistant',
                        content: contentToSave,
                    }),
                }).catch(err => console.error('Failed to save assistant message:', err));
            } else {
                console.warn('Empty assistant response - not saving to database');
            }
        },
        onError: (error) => {
            console.error('Chat streaming error:', error);
        },
    });

    const hasInitialized = useRef(false);

    // Auto-trigger response if there is a pending prompt
    useEffect(() => {
        if (!hasInitialized.current && pendingPrompt) {
            hasInitialized.current = true;
            console.log('Auto-triggering response for:', pendingPrompt);
            sendMessage(pendingPrompt);
        }
    }, [pendingPrompt, sendMessage]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (content: string) => {
        if (!content.trim()) return;

        // Send to AI - the /api/chat route will save the user message to the database
        sendMessage(content);
        setIsSearchEnabled(false); // Reset search toggle after send
    };

    // Handle context menu
    const handleContextMenu = (e: React.MouseEvent, index: number, msg: any) => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        if (selectedText && selection && selection.rangeCount > 0) {
            e.preventDefault();
            e.stopPropagation();

            // Simple range detection - relative to the message content node would be better but this is MVP
            // We'll trust the selection text for now and assume first occurrence if strict index needed
            // For robust implementation, we'd need to calculate offset relative to the message div
            // Here we just pass the text and assume full match or index 0 for MVP

            // To get start/end strictly, we can check selection.anchorOffset etc if selection is within this node
            // But React event handling makes accessing the exact text node tricky without refs
            // We'll search for the text in content

            const content = typeof msg.content === 'string' ? msg.content : '';
            const start = content.indexOf(selectedText);

            if (start !== -1) {
                setContextMenu({
                    x: e.clientX,
                    y: e.clientY + 20, // Offset to not cover text
                    // WORKAROUND: We will assume we can get the real ID if we passed it in initialMessages
                    // But `useChat` messages structure matches what we passed.
                    sourceMessageId: (initialMessages[index] as any)?.id || null,
                    quoteStart: start,
                    quoteEnd: start + selectedText.length,
                    quoteText: selectedText,
                    messageIndex: index,
                });
            }
        }
    };

    const initiateBranch = () => {
        if (contextMenu) {
            // Move state to pending to show input
            setBranchPending(contextMenu);
            setContextMenu(null);
        }
    };

    const confirmBranch = (prompt: string) => {
        if (branchPending && onBranch) {
            // Context history: all messages up to AND including the selected one
            const history = messages.slice(0, branchPending.messageIndex + 1).map(m => ({
                role: m.role,
                content: m.content
            }));

            // Add the new prompt as the first message of the new branch (after context)
            const newContext = [
                ...history,
                { role: 'user', content: prompt }
            ];

            onBranch(
                branchPending.sourceMessageId,
                branchPending.quoteStart,
                branchPending.quoteEnd,
                branchPending.quoteText,
                newContext
            );
            setBranchPending(null);
        }
    };

    return (
        <div className={`embedded-chat ${hasBeenResized ? 'resized' : ''}`}>
            {/* Header */}
            <div className="embedded-chat-header drag-handle">
                <div className="chat-block-icon" style={{ marginRight: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                </div>
                <h3 className="embedded-chat-title" style={{ flex: '0 0 auto', marginRight: 10 }}>{title}</h3>

                {/* Model Selector */}
                <select
                    className="model-selector"
                    value={model}
                    onChange={(e) => onModelChange?.(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()} // Prevent drag
                    title="Select Model"
                >
                    {modelOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>

                <div className="embedded-chat-actions">
                    <button
                        className="embedded-chat-action-btn"
                        onClick={onClose}
                        title="Minimize"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 12H6" />
                        </svg>
                    </button>
                    <button
                        className="embedded-chat-action-btn"
                        onClick={onMaximize}
                        title="View in Modal"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                    {onDelete && (
                        <button
                            className="embedded-chat-action-btn delete"
                            onClick={onDelete}
                            title="Delete"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Messages - nodrag to allow text selection/scrolling, nowheel to prevent canvas zoom */}
            <div className="embedded-chat-messages nodrag nowheel">
                {messages.length === 0 ? (
                    <div className="chat-empty-state small">
                        <p>Start chatting...</p>
                    </div>
                ) : (
                    messages.map((msg, index) => (
                        <ChatMessage
                            key={`msg-${index}`}
                            role={msg.role as 'user' | 'assistant'}
                            content={typeof msg.content === 'string' ? msg.content : ''}
                            isStreaming={status === 'streaming' && index === messages.length - 1 && msg.role === 'assistant'}
                            onContextMenu={(e) => handleContextMenu(e, index, msg)}
                            links={links && initialMessages[index] ? links[(initialMessages[index] as any).id] : undefined}
                            onLinkClick={onLinkClick}
                            data-message-index={index}
                        />
                    ))
                )}

                {/* Thinking indicator - shows when AI is processing before streaming starts */}
                {status === 'submitted' && (
                    <ThinkingIndicator />
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Error display */}
            {error && (
                <div className="chat-error text-xs p-2">
                    <span>{error.message}</span>
                </div>
            )}

            {/* Input - nodrag to allow typing */}
            <div className="embedded-chat-input nodrag">
                <ChatInput
                    onSend={handleSend}
                    isLoading={status === 'streaming' || status === 'submitted'}
                    onStop={stop}
                    placeholder="Type a message..."
                    compact
                    isSearchEnabled={isSearchEnabled}
                    onSearchToggle={setIsSearchEnabled}
                />
            </div>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    actions={[
                        {
                            label: 'Branch from here',
                            onClick: initiateBranch,
                        },
                    ]}
                />
            )}

            {branchPending && (
                <InlineInput
                    x={branchPending.x}
                    y={branchPending.y}
                    onClose={() => setBranchPending(null)}
                    onSubmit={confirmBranch}
                />
            )}
        </div>
    );
}
