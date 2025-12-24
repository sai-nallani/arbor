'use client';

import { useState, useEffect } from 'react';

const thinkingMessages = [
    "Analyzing your question...",
    "Gathering relevant information...",
    "Formulating a comprehensive response...",
    "Connecting the dots...",
    "Synthesizing insights...",
    "Exploring different perspectives...",
    "Organizing thoughts...",
    "Crafting the best answer...",
];

export default function ThinkingIndicator() {
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % thinkingMessages.length);
        }, 2000); // Change message every 2 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="thinking-indicator">
            <div className="thinking-header">
                <svg
                    className="thinking-spinner"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                <span className="thinking-title">Working...</span>
            </div>
            <div className="thinking-status">
                <span className="thinking-dot" />
                <span className="thinking-message">{thinkingMessages[messageIndex]}</span>
            </div>
        </div>
    );
}
