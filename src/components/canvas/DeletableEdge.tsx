'use client';

import React from 'react';
import { BaseEdge, EdgeProps, getSmoothStepPath, EdgeLabelRenderer } from '@xyflow/react';

/**
 * DeletableEdge - Custom smoothstep edge with a delete button on hover
 */
export default function DeletableEdge({
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
    const [edgePath, labelX, labelY] = getSmoothStepPath({
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
                    stroke: '#A67B5B',
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
                            zIndex: 1000,
                        }}
                        className="deletable-edge-button nodrag nopan"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDelete(id);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        title="Delete connection"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{
                                background: 'var(--background, #1e1e1e)',
                                borderRadius: '50%',
                                padding: '3px',
                                color: '#A67B5B',
                                border: '1px solid #A67B5B',
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
