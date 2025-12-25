'use client';

import React from 'react';
import { BaseEdge, EdgeProps, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';

/**
 * ContextEdge - Custom edge for context links between chat blocks
 * 
 * Visual style:
 * - Solid brown line matching the app accent color
 * - Arrow marker at the target end
 * - Delete button on hover
 */
export default function ContextEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
}: EdgeProps) {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const onDelete = data?.onDelete as ((id: string) => void) | undefined;

    return (
        <>
            <BaseEdge
                id={id}
                path={edgePath}
                style={{
                    stroke: '#A67B5B', // Brown accent color
                    strokeWidth: 2,
                    ...style,
                }}
                markerEnd={markerEnd}
            />
            {onDelete && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: 'all',
                            cursor: 'pointer',
                        }}
                        className="context-edge-delete nodrag nopan"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(id);
                        }}
                        title="Remove context link"
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{
                                background: 'var(--background, #1e1e1e)',
                                borderRadius: '50%',
                                padding: '2px',
                                color: '#A67B5B',
                            }}
                        >
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
