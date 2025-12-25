'use client';

import { memo } from 'react';

interface ChatMessageProps {
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
    onMouseUp?: (e: React.MouseEvent) => void;
    links?: Array<{
        id: string;
        quoteStart: number;
        quoteEnd: number;
        targetBlockId: string;
    }>;
    highlightStart?: number;
    highlightEnd?: number;
    onLinkClick?: (targetBlockId: string) => void;
    [key: string]: any; // Allow data attributes
}

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';


// ... (keep interface)

function ChatMessage({ role, content, isStreaming, onMouseUp, links, highlightStart, highlightEnd, onLinkClick, ...props }: ChatMessageProps) {
    // Parse IMAGE markers and extract URLs
    const parseImageMarkers = (text: string): { cleanText: string; imageUrls: string[] } => {
        const imageMarkerRegex = /\[IMAGE:(https?:\/\/[^\]]+)\]/g;
        const imageUrls: string[] = [];
        let match;
        while ((match = imageMarkerRegex.exec(text)) !== null) {
            imageUrls.push(match[1]);
        }
        const cleanText = text.replace(imageMarkerRegex, '');
        return { cleanText, imageUrls };
    };

    const { cleanText, imageUrls } = parseImageMarkers(content || '');

    const renderContent = () => {
        if (!cleanText && imageUrls.length === 0) return isStreaming ? '' : '...';

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
            if (range.start < lastIndex || range.start >= cleanText.length) return;

            // Text before range -> Render as Markdown
            if (range.start > lastIndex) {
                const textPart = cleanText.slice(lastIndex, range.start);
                segments.push(
                    <ReactMarkdown
                        key={`text-${lastIndex}`}
                        remarkPlugins={[remarkMath, remarkGfm]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                            p: ({ children }) => <span style={{ display: 'inline' }}>{children}</span>,
                            div: ({ children }) => <span style={{ display: 'inline' }}>{children}</span>,
                        }}
                    >
                        {textPart}
                    </ReactMarkdown>
                );
            }

            // Range text -> Rendered as a span to avoid breaking layout
            const end = Math.min(range.end, cleanText.length);
            const text = cleanText.slice(range.start, end);

            if (range.type === 'link') {
                segments.push(
                    <span key={`link-space-before-${idx}`}> </span>
                );
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
                            display: 'inline' // Changed to inline to avoid breaking text flow
                        }}
                    >
                        {text}
                    </span>
                );
                segments.push(
                    <span key={`link-space-after-${idx}`}> </span>
                );
            } else if (range.type === 'highlight') {
                segments.push(
                    <span key={`highlight-space-before-${idx}`}> </span>
                );
                segments.push(
                    <span
                        key={`highlight-${idx}`}
                        className="selection-highlight"
                        style={{
                            backgroundColor: 'var(--accent)',
                            color: 'white',
                            borderRadius: '2px',
                            padding: '0 2px',
                            display: 'inline' // Changed to inline to avoid breaking text flow
                        }}
                    >
                        {text}
                    </span>
                );
                segments.push(
                    <span key={`highlight-space-after-${idx}`}> </span>
                );
            }

            lastIndex = end;
        });

        // Remaining text -> Render as Markdown
        if (lastIndex < cleanText.length) {
            const textPart = cleanText.slice(lastIndex);
            segments.push(
                <ReactMarkdown
                    key={`text-${lastIndex}`}
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                        p: ({ children }) => <span style={{ display: 'inline' }}>{children}</span>,
                        div: ({ children }) => <span style={{ display: 'inline' }}>{children}</span>,
                    }}
                >
                    {textPart}
                </ReactMarkdown>
            );
        }

        // If no segments, render whole clean text as markdown
        if (segments.length === 0 && cleanText) {
            segments.push(
                <ReactMarkdown
                    key="full-content"
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeKatex]}
                >
                    {cleanText}
                </ReactMarkdown>
            );
        }

        // Render attached images
        if (imageUrls.length > 0) {
            segments.push(
                <div key="images" className="message-images" style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {imageUrls.map((url, i) => (
                        <img
                            key={`img-${i}`}
                            src={url}
                            alt={`Attached image ${i + 1}`}
                            style={{
                                maxWidth: '200px',
                                maxHeight: '150px',
                                borderRadius: '8px',
                                border: '1px solid var(--accent)',
                                objectFit: 'cover'
                            }}
                        />
                    ))}
                </div>
            );
        }

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
                onMouseUp={onMouseUp}
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
