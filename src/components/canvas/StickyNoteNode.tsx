'use client';

import React, { useState, memo, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';

export interface StickyNoteData {
    id: string;
    content: string;
    color: string;
    onDelete?: (id: string) => void;
    onUpdate?: (id: string, content: string, color: string) => void;
}

const colors = {
    yellow: '#fff9c4',
    blue: '#e3f2fd',
    green: '#e8f5e9',
    charcoal: '#333333',
    slate: '#1E293B',
};

function StickyNoteNode({ id, data, selected }: NodeProps) {
    const nodeData = data as unknown as StickyNoteData;
    const [content, setContent] = useState(nodeData.content);
    const [color, setColor] = useState(nodeData.color || 'yellow');

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
    };

    const handleBlur = () => {
        if (content !== nodeData.content || color !== nodeData.color) {
            nodeData.onUpdate?.(id, content, color);
        }
    };

    const handleColorChange = (newColor: string) => {
        setColor(newColor);
        nodeData.onUpdate?.(id, content, newColor);
    };

    const isDark = color === 'charcoal' || color === 'slate';
    const textColor = isDark ? '#ffffff' : '#333333';

    return (
        <div
            className={`sticky-note-node ${selected ? 'selected' : ''}`}
            style={{
                backgroundColor: colors[color as keyof typeof colors] || colors.yellow,
                width: '100%',
                height: '100%',
                minWidth: 150,
                minHeight: 150,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '2px', // Slight rounded, mostly square
                boxShadow: selected ? '0 0 0 2px var(--accent)' : '2px 2px 5px rgba(0,0,0,0.1)',
                transition: 'box-shadow 0.2s',
                position: 'relative',
                color: textColor,
            }}
        >
            {/* Source-only handles - connectionMode="loose" allows any handle to connect to any handle */}
            <Handle type="source" position={Position.Top} id="top" style={{ width: 16, height: 16, background: '#A67B5B' }} />
            <Handle type="source" position={Position.Right} id="right" style={{ top: '50%', width: 16, height: 16, background: '#A67B5B' }} />
            <Handle type="source" position={Position.Bottom} id="bottom" style={{ width: 16, height: 16, background: '#A67B5B' }} />
            <Handle type="source" position={Position.Left} id="left" style={{ top: '50%', width: 16, height: 16, background: '#A67B5B' }} />

            {/* Header / Actions */}
            <div className="sticky-note-header drag-handle" style={{ padding: '8px', cursor: 'grab', display: 'flex', justifyContent: 'space-between', opacity: selected ? 1 : 0, transition: 'opacity 0.2s' }}>
                <div className="color-picker" style={{ display: 'flex', gap: '4px' }}>
                    {Object.keys(colors).map((c) => (
                        <div
                            key={c}
                            className="color-dot"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleColorChange(c);
                            }}
                            style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                backgroundColor: colors[c as keyof typeof colors],
                                border: '1px solid rgba(0,0,0,0.1)',
                                cursor: 'pointer',
                            }}
                            title={c}
                        />
                    ))}
                </div>
                {nodeData.onDelete && (
                    <button
                        onClick={() => nodeData.onDelete?.(id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: textColor, opacity: 0.7 }}
                    >
                        ×
                    </button>
                )}
            </div>

            {/* Content Area */}
            <textarea
                className="sticky-note-content nodrag"
                value={content}
                onChange={handleContentChange}
                onBlur={handleBlur}
                placeholder="Type something..."
                style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    resize: 'none',
                    padding: '8px 12px 12px 12px',
                    fontFamily: 'var(--font-mono)', // Or handwriting font if requested
                    fontSize: '14px',
                    color: textColor,
                    outline: 'none',
                    width: '100%',
                }}
            />

            {/* Resizer when selected */}
            {selected && (
                <NodeResizer
                    minWidth={150}
                    minHeight={150}
                    handleStyle={{ width: 8, height: 8, zIndex: 1000 }}
                    isVisible={selected}
                />
            )}
        </div>
    );
}

export default memo(StickyNoteNode);
