'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface InlineInputProps {
    x: number;
    y: number;
    onSubmit: (value: string) => void;
    onClose: () => void;
    quoteText?: string;
}

export default function InlineInput({ x, y, onSubmit, onClose, quoteText }: InlineInputProps) {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [value, setValue] = useState('');

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (inputRef.current && !inputRef.current.parentElement?.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        // Delay attaching to avoid immediate closing
        setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }, 0);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    const handleSubmit = () => {
        if (value.trim()) {
            onSubmit(value);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="inline-input-container"
            style={{
                position: 'fixed',
                top: y,
                left: x,
                zIndex: 10000,
                background: 'var(--subtle)',
                border: '1px solid var(--accent)',
                borderRadius: '8px',
                padding: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                width: '300px',
                display: 'flex',
                gap: '8px',
                flexDirection: 'column',
                animation: 'fadeIn 0.1s ease-out',
            }}
        >
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
                Branch with prompt:
            </div>
            {quoteText && (
                <div style={{
                    fontSize: '11px',
                    color: 'var(--foreground)',
                    fontStyle: 'italic',
                    borderLeft: '2px solid var(--accent)',
                    paddingLeft: '4px',
                    margin: '4px 0',
                    maxHeight: '60px',
                    overflowY: 'auto',
                    opacity: 0.8
                }}>
                    "{quoteText}"
                </div>
            )}
            <textarea
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a follow-up..."
                style={{
                    width: '100%',
                    minHeight: '60px',
                    background: 'var(--background)',
                    border: '1px solid var(--muted)',
                    borderRadius: '4px',
                    padding: '8px',
                    fontSize: '14px',
                    color: 'var(--foreground)',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'inherit',
                }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                    onClick={onClose}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!value.trim()}
                    style={{
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        opacity: value.trim() ? 1 : 0.6,
                    }}
                >
                    Branch
                </button>
            </div>
        </div>,
        document.body
    );
}
