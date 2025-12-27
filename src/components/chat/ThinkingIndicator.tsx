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

const deepResearchMessages = [
    "Searching the web...",
    "Reading multiple sources...",
    "Cross-referencing information...",
    "Analyzing search results...",
    "Compiling research findings...",
    "Verifying facts...",
    "Building comprehensive answer...",
];

interface ThinkingIndicatorProps {
    isDeepResearch?: boolean;
}

export default function ThinkingIndicator({ isDeepResearch = false }: ThinkingIndicatorProps) {
    const [messageIndex, setMessageIndex] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    const messages = isDeepResearch ? deepResearchMessages : thinkingMessages;

    useEffect(() => {
        const messageInterval = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % messages.length);
        }, 2000);

        return () => clearInterval(messageInterval);
    }, [messages.length]);

    // Timer for deep research
    useEffect(() => {
        if (!isDeepResearch) return;

        const timerInterval = setInterval(() => {
            setElapsedSeconds((prev) => prev + 1);
        }, 1000);

        return () => clearInterval(timerInterval);
    }, [isDeepResearch]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

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
                <span className="thinking-title">
                    {isDeepResearch ? 'Deep Researching...' : 'Working...'}
                </span>
                {isDeepResearch && (
                    <span className="thinking-timer" style={{ marginLeft: '8px', opacity: 0.7, fontSize: '12px' }}>
                        {formatTime(elapsedSeconds)}
                    </span>
                )}
            </div>
            {isDeepResearch && (
                <div className="thinking-note" style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px', marginBottom: '4px' }}>
                    Deep research can take 1-3 minutes. Please be patient.
                </div>
            )}
            <div className="thinking-status">
                <span className="thinking-dot" />
                <span className="thinking-message">{messages[messageIndex]}</span>
            </div>
        </div>
    );
}

