'use client';

import React, { useState, memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';

export interface ImageNodeData {
    id: string;
    name: string;
    url: string;
    mimeType: string;
    onDelete?: (id: string) => void;
    isExpanded?: boolean;
    onExpandToggle?: (id: string, expanded: boolean) => void;
}

function ImageNode({ id, data, selected }: NodeProps) {
    const nodeData = data as unknown as ImageNodeData;
    const [isExpanded, setIsExpanded] = useState(!!nodeData.isExpanded);
    const [showPreview, setShowPreview] = useState(false);

    const handleExpand = () => {
        const newState = !isExpanded;
        setIsExpanded(newState);
        nodeData.onExpandToggle?.(id, newState);
    };


    return (
        <>
            <div
                className={`image-node ${selected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}
                style={isExpanded ? {
                    width: '100%',
                    height: '100%',
                    minWidth: 250,
                    minHeight: 200,
                } : undefined}
            >
                {/* Input handle */}
                <Handle
                    type="target"
                    position={Position.Top}
                    className="image-node-handle"
                    id="top"
                />

                {/* Output handle */}
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="image-node-handle"
                    id="bottom"
                />

                {/* Context output handle - for linking to chat blocks */}
                <Handle
                    type="source"
                    position={Position.Right}
                    className="chat-block-handle context-handle"
                    id="context-out"
                    style={{ top: '50%' }}
                />

                {isExpanded ? (
                    // Expanded view - full image
                    <div className="image-node-expanded">
                        <div className="image-node-header drag-handle">
                            <span className="image-node-title">{nodeData.name}</span>
                            <div className="image-node-actions">
                                <button
                                    className="image-action-btn"
                                    onClick={() => setShowPreview(true)}
                                    title="Preview"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </button>
                                <button
                                    className="image-action-btn"
                                    onClick={handleExpand}
                                    title="Minimize"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M5 12h14" />
                                    </svg>
                                </button>
                                {nodeData.onDelete && (
                                    <button
                                        className="image-action-btn delete"
                                        onClick={() => nodeData.onDelete?.(id)}
                                        title="Delete"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="image-node-content nodrag">
                            <img
                                src={nodeData.url}
                                alt={nodeData.name}
                                className="image-node-full"
                            />
                        </div>
                    </div>
                ) : (
                    // Minimized view - thumbnail with title
                    <div className="image-node-minimized" onClick={handleExpand}>
                        <div className="image-node-thumbnail">
                            <img
                                src={nodeData.url}
                                alt={nodeData.name}
                            />
                        </div>
                        <div className="image-node-info">
                            <span className="image-node-name">{nodeData.name}</span>
                            <span className="image-node-type">Image</span>
                        </div>
                    </div>
                )}

                {/* Resizer when expanded and selected - MUST be inside the node container */}
                {isExpanded && selected && (
                    <NodeResizer
                        minWidth={250}
                        minHeight={200}
                        handleStyle={{ width: 8, height: 8, zIndex: 1000 }}
                    />
                )}
            </div>

            {/* Preview modal */}
            {showPreview && (
                <div
                    className="image-preview-overlay"
                    onClick={() => setShowPreview(false)}
                >
                    <div className="image-preview-container" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="image-preview-close"
                            onClick={() => setShowPreview(false)}
                        >
                            ×
                        </button>
                        <img
                            src={nodeData.url}
                            alt={nodeData.name}
                            className="image-preview-full"
                        />
                        <div className="image-preview-caption">{nodeData.name}</div>
                    </div>
                </div>
            )}


        </>
    );
}

export default memo(ImageNode);
