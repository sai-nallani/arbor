'use client';

import { memo } from 'react';

interface ChatMessageProps {
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
    onContextMenu?: (e: React.MouseEvent) => void;
    links?: Array<{
        id: string;
        quoteStart: number;
        quoteEnd: number;
        targetBlockId: string;
    }>;
    highlightStart?: number;
    onLinkClick?: (targetBlockId: string) => void;
    [key: string]: any; // Allow data attributes
}

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// ... (keep interface)

function ChatMessage({ role, content, isStreaming, onContextMenu, links, highlightStart, highlightEnd, onLinkClick, ...props }: ChatMessageProps) {
    const renderContent = () => {
        if (!content) return isStreaming ? '' : '...';

        // Collect all ranges to style (links + active highlight)
        const ranges: Array<{ start: number; end: number; type: 'link' | 'highlight'; data?: any }> = [];

        if (links) {
            links.forEach(link => {
                ranges.push({ start: link.quoteStart, end: link.quoteEnd, type: 'link', data: link });
            });
        }

        if (highlightStart !== undefined && highlightEnd !== undefined) {
            ranges.push({ start: highlightStart, end: highlightEnd, type: 'highlight' });
        }

        // Sort by start position
        ranges.sort((a, b) => a.start - b.start);

        const segments: React.ReactNode[] = [];
        let lastIndex = 0;

        ranges.forEach((range, idx) => {
            // Skip invalid or overlapping ranges for simplicity
            if (range.start < lastIndex || range.start >= content.length) return;

            // Text before range -> Render as Markdown
            if (range.start > lastIndex) {
                const textPart = content.slice(lastIndex, range.start);
                segments.push(
                    <ReactMarkdown
                        key={`text-${lastIndex}`}
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                    >
                        {textPart}
                    </ReactMarkdown>
                );
            }

            // Range text -> Keep as raw string inside the span (no markdown inside highlights for now to avoid hydration issues)
            // Or we could render markdown inside too? Let's keep it simple first.
            const end = Math.min(range.end, content.length);
            const text = content.slice(range.start, end);

            if (range.type === 'link') {
                segments.push(
                    <span
                        key={`link-${idx}`}
                        className="branch-link"
                        title="Jump to branch"
                        onClick={(e) => {
                            e.stopPropagation();
                            onLinkClick?.(range.data.targetBlockId);
                        }}
                        style={{
                            backgroundColor: 'rgba(255, 215, 0, 0.2)',
                            borderBottom: '1px dashed var(--accent)',
                            cursor: 'pointer',
                            borderRadius: '2px',
                            padding: '0 2px',
                            display: 'inline-block' // Ensure it sits well with markdown blocks
                        }}
                    >
                        {text}
                    </span>
                );
            } else if (range.type === 'highlight') {
                segments.push(
                    <span
                        key={`highlight-${idx}`}
                        className="selection-highlight"
                        style={{
                            backgroundColor: 'var(--accent)',
                            color: 'white',
                            borderRadius: '2px',
                            padding: '0 2px',
                            display: 'inline-block'
                        }}
                    >
                        {text}
                    </span>
                );
            }

            lastIndex = end;
        });

        // Remaining text -> Render as Markdown
        if (lastIndex < content.length) {
            const textPart = content.slice(lastIndex);
            segments.push(
                <ReactMarkdown
                    key={`text-${lastIndex}`}
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                >
                    {textPart}
                </ReactMarkdown>
            );
        }

        if (segments.length === 0) return (
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
            >
                {content}
            </ReactMarkdown>
        );

        return segments;
    };
    return (
        <div className="chat-message-row" {...props}>
            <div className={`chat-message-avatar ${role}`}>
                {role === 'user' ? (
                    <span className="avatar-initial">Y</span>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                )}
            </div>
            <div
                className="chat-message-body"
                onContextMenu={onContextMenu}
            >
                <div className="chat-message-header">
                    <span className="chat-message-role-name">
                        {role === 'user' ? 'You' : 'Arbor AI'}
                    </span>
                </div>
                <div className={`chat-message-text ${isStreaming ? 'streaming' : ''}`}>
                    {renderContent()}
                    {isStreaming && <span className="streaming-cursor" />}
                </div>
                {/* Timestamp for completed assistant messages */}
                {role === 'assistant' && !isStreaming && content && (
                    <div className="message-timestamp">
                        Just now
                    </div>
                )}
            </div>
        </div>
    );
}

export default memo(ChatMessage);
