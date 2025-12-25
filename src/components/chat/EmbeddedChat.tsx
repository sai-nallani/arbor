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
    boardId: string;
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
    hasImage?: boolean; // True if chat block has images (persisted in DB)
    onImageUploaded?: (imageInfo: { id: string; url: string; name: string, mimeType?: string }) => void;
    onHasImageChange?: (hasImage: boolean) => void; // Callback to persist hasImage to DB
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

// Vision-capable models
const VISION_MODELS = [
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
];

export default function EmbeddedChat({
    blockId,
    boardId,
    title,
    initialMessages = [],
    onClose,
    onMaximize,
    onDelete,
    onBranch,
    onLinkClick,
    links,
    model = 'anthropic/claude-sonnet-4-5-20250929',
    onModelChange,
    branchContext,
    hasBeenResized = false,
    hasImage = false,
    onImageUploaded,
    onHasImageChange,
}: EmbeddedChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [branchPending, setBranchPending] = useState<ContextMenuState | null>(null);
    const [isSearchEnabled, setIsSearchEnabled] = useState(false);
    const [hasImagesInContext, setHasImagesInContext] = useState(hasImage);
    const pendingImagesRef = useRef<string[]>([]);

    // Map to track database IDs for messages (key: message index, value: database ID)
    // Initialize with IDs from initialMessages
    const messageIdMapRef = useRef<Map<number, string>>(new Map());

    // Sync state with prop (e.g. initial load vs client toggle)
    useEffect(() => {
        setHasImagesInContext(hasImage);
    }, [hasImage]);

    // Force switch to vision model if images are present and current model is not supported
    useEffect(() => {
        if (hasImagesInContext && !VISION_MODELS.includes(model)) {
            console.log('Images detected, auto-switching to GPT-4o');
            onModelChange?.('openai/gpt-4o');
        }
    }, [hasImagesInContext, model, onModelChange]);

    // Lock to vision model if images in context (Dedalus only supports OpenAI for images)
    // We keep this for render-time logic, but the useEffect above handles the actual state change
    const effectiveModel = hasImagesInContext && !VISION_MODELS.includes(model)
        ? 'openai/gpt-4o'
        : model;

    const allModelOptions = [
        { value: 'anthropic/claude-opus-4-5', label: 'Claude Opus 4.5' },
        { value: 'openai/gpt-4o', label: 'GPT-4o (Vision)' },
        { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (Vision)' },
        { value: 'openai/gpt-5', label: 'GPT-5' },
        { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
        { value: 'anthropic/claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
        { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
        { value: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro' },
    ];

    // Filter to vision-only models when images are in context
    const modelOptions = hasImagesInContext
        ? allModelOptions.filter(opt => VISION_MODELS.includes(opt.value))
        : allModelOptions;

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
            body: { chatBlockId: blockId, model: effectiveModel, isSearchEnabled, branchContext, imageUrls: pendingImagesRef.current },
        },
        onFinish: async ({ message }) => {
            console.log('Chat finished, saving message:', message);

            // Save assistant message to database
            const contentToSave = typeof message.content === 'string' ? message.content : '';

            // Only save if there's actual content
            if (contentToSave.trim()) {
                try {
                    const response = await fetch(`/api/chat-blocks/${blockId}/messages`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            role: 'assistant',
                            content: contentToSave,
                        }),
                    });

                    if (response.ok) {
                        const savedMessage = await response.json();
                        // Store the database ID for this message
                        // The assistant message will be at the current last position
                        // The assistant message is now part of the messages array, so its index is length - 1
                        const msgIndex = messages.length - 1;
                        messageIdMapRef.current.set(msgIndex, savedMessage.id);
                        console.log('Saved assistant message with ID:', savedMessage.id, 'at index:', msgIndex);
                    }
                } catch (err) {
                    console.error('Failed to save assistant message:', err);
                }
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

    // Keep a ref to messages for the event listener to access latest state without re-binding
    const messagesRef = useRef(messages);
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Initialize message ID map with initial messages
    useEffect(() => {
        // console.log('[MessageIdMap] Initializing with initialMessages:', initialMessages.map((m, i) => ({ i, id: (m as any).id })));
        initialMessages.forEach((m, i) => {
            const id = (m as any).id;
            if (id) {
                messageIdMapRef.current.set(i, id);
            }
        });
        // console.log('[MessageIdMap] After init:', Array.from(messageIdMapRef.current.entries()));
    }, [initialMessages]); // Run when initialMessages changes (e.g. on maximize/refresh)

    const handleSend = async (content: string, images?: string[]) => {
        if (!content.trim() && (!images || images.length === 0)) return;

        let messageContent = content;
        if (images && images.length > 0) {
            setHasImagesInContext(true);
            // Persist hasImage to database
            if (!hasImage) {
                onHasImageChange?.(true);
            }
            // Embed image URLs in message content with a special marker for API to parse
            const imageMarkers = images.map(url => `[IMAGE:${url}]`).join(' ');
            messageContent = `${content}\n\n${imageMarkers}`;
        }

        // Save user message to database FIRST to get the ID
        try {
            const response = await fetch(`/api/chat-blocks/${blockId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: 'user', content: messageContent }),
            });

            if (response.ok) {
                const savedMessage = await response.json();
                // Store the database ID for this message at the NEXT index (current messages length)
                const userMsgIndex = messages.length;
                messageIdMapRef.current.set(userMsgIndex, savedMessage.id);
                console.log('[EmbeddedChat] Saved user message with ID:', savedMessage.id, 'at index:', userMsgIndex);
            } else {
                const errorText = await response.text();
                console.error('[EmbeddedChat] Failed to save user message:', response.status, errorText);
            }
        } catch (err) {
            console.error('[EmbeddedChat] Network error saving user message:', err);
        }

        // Now send to AI (the API route won't re-save since we already saved)
        sendMessage(messageContent);
        setIsSearchEnabled(false);
    };

    // Handle global mouse up to detect selection robustly
    useEffect(() => {
        const handleGlobalMouseUp = (e: MouseEvent) => {
            // If dragging/resizing, ignore
            if ((e.target as Element).closest('.drag-handle')) return;

            // If clicking ON the context menu or inline input, ignore (let their own handlers work)
            if ((e.target as Element).closest('.context-menu') || (e.target as Element).closest('.inline-input')) return;

            const selection = window.getSelection();
            const selectedText = selection?.toString().trim();

            // If no text selected, we MUST close the menu (per user request "If there is no selection... should not appear")
            if (!selectedText) {
                setContextMenu(null);
                return;
            }

            // We only care if:
            // 1. There is text selected
            // 2. The selection is inside THIS chat container
            if (selectedText && selection && selection.rangeCount > 0 && containerRef.current) {
                const anchorNode = selection.anchorNode;
                // Check if selection is inside this specific chat instance
                if (!containerRef.current.contains(anchorNode)) {
                    return;
                }

                // Find which message this belongs to
                // We need to traverse up from the anchorNode to find the message row
                let currentNode: Node | null = anchorNode;
                let messageRow: Element | null = null;

                while (currentNode && currentNode !== containerRef.current) {
                    if (currentNode instanceof Element && currentNode.hasAttribute('data-message-index')) {
                        messageRow = currentNode;
                        break;
                    }
                    currentNode = currentNode.parentNode;
                }

                if (messageRow) {
                    const indexStr = messageRow.getAttribute('data-message-index');
                    if (indexStr !== null) {
                        const index = parseInt(indexStr, 10);
                        const msg = messagesRef.current[index];

                        if (msg) {
                            const rawContent = typeof msg.content === 'string' ? msg.content : '';

                            // strip image markers to match what is rendered
                            const imageMarkerRegex = /\[IMAGE:(https?:\/\/[^\]]+)\]/g;
                            const cleanContent = rawContent.replace(imageMarkerRegex, '');

                            // Try to find the start position in clean content
                            let start = cleanContent.indexOf(selectedText);
                            if (start === -1) {
                                // Fallback: try raw content if clean failed (e.g. if selection crossed marker?)
                                // But usually clean is what user sees.
                                start = 0;
                            }

                            const dbMessageId = messageIdMapRef.current.get(index) || (initialMessages[index] as any)?.id || null;

                            setContextMenu({
                                x: e.clientX,
                                y: e.clientY + 10,
                                sourceMessageId: dbMessageId,
                                quoteStart: start,
                                quoteEnd: start + selectedText.length,
                                quoteText: selectedText,
                                messageIndex: index,
                            });
                            return; // Success, context menu set
                        }
                    }
                }
            }

            // If we got here and didn't set a menu, we usually clear it.
            // But per user request, we want the menu to PERSIST even if clicked outside.
            // So we DO NOT clear contextMenu here.

            // Only time it clears is:
            // 1. Explicit 'onClose' (e.g. Escape key)
            // 2. Selecting new text (updates it)
            // 3. Initiating branch (clears it)
        };

        document.addEventListener('mouseup', handleGlobalMouseUp);
        return () => {
            document.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [initialMessages]); // Dependencies minimal, uses refs for dynamic data

    const initiateBranch = () => {
        if (contextMenu) {
            console.log('[Branch] Initiating with sourceMessageId:', contextMenu.sourceMessageId);
            // Move state to pending to show input
            setBranchPending(contextMenu);
            setContextMenu(null);
        }
    };

    const confirmBranch = (prompt: string) => {
        if (branchPending && onBranch) {
            // Context history: all messages up to AND including the selected one
            // Context history: all messages up to AND including the selected one
            const history = messages.slice(0, branchPending.messageIndex + 1).map((m, i) => ({
                id: messageIdMapRef.current.get(i), // Get real DB ID
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

            // Clear pending states to remove overlay and close prompt
            setBranchPending(null);
            setContextMenu(null);

            // Also clear the browser selection for a clean finish
            try {
                window.getSelection()?.removeAllRanges();
            } catch (e) {
                // Ignore if selection API is not available (e.g. some mobile/old browsers)
            }
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
                    value={hasImagesInContext ? effectiveModel : model}
                    onChange={(e) => onModelChange?.(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()} // Prevent drag
                    disabled={hasImagesInContext}
                    title={hasImagesInContext ? "Vision model locked (images attached)" : "Select Model"}
                    style={hasImagesInContext ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
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
            <div className="embedded-chat-messages nodrag nowheel" ref={containerRef} style={{ position: 'relative' }}>

                {messages.length === 0 ? (
                    <div className="chat-empty-state small">
                        <p>Start chatting...</p>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        // Get the database ID for this message
                        const msgDbId = messageIdMapRef.current.get(index) || (initialMessages[index] as any)?.id;

                        return (
                            <ChatMessage
                                key={`msg-${index}`}
                                role={msg.role as 'user' | 'assistant'}
                                content={typeof msg.content === 'string' ? msg.content : ''}
                                isStreaming={status === 'streaming' && index === messages.length - 1 && msg.role === 'assistant'}
                                highlightStart={branchPending && branchPending.messageIndex === index ? branchPending.quoteStart : undefined}
                                highlightEnd={branchPending && branchPending.messageIndex === index ? branchPending.quoteEnd : undefined}
                                links={links && msgDbId ? links[msgDbId] : undefined}
                                onLinkClick={onLinkClick}
                                data-message-index={index}
                            />
                        );
                    })
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
                    boardId={boardId}
                    onImagesChange={(hasInputImages) => setHasImagesInContext(hasInputImages || hasImage)}
                    onImageUploaded={onImageUploaded}
                />
            </div>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    persist={true}
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
                    quoteText={branchPending.quoteText}
                    x={branchPending.x}
                    y={branchPending.y}
                    onClose={() => setBranchPending(null)}
                    onSubmit={confirmBranch}
                />
            )}
        </div>
    );
}
