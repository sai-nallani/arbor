'use client';

import { useCallback, useState } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    addEdge,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
    type OnConnect,
    BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import ChatBlockNode from './ChatBlockNode';

// Define custom node types
const nodeTypes = {
    chatBlock: ChatBlockNode,
};

interface CanvasProps {
    boardId: string;
    boardName: string;
}

// Initial node for a new board
const getInitialNodes = (boardName: string): Node[] => [
    {
        id: 'initial-node',
        type: 'chatBlock',
        position: { x: 250, y: 150 },
        data: {
            title: boardName || 'New Chat',
            messages: [],
        },
    },
];

const initialEdges: Edge[] = [];

export default function Canvas({ boardId, boardName }: CanvasProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(getInitialNodes(boardName));
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const onConnect: OnConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    return (
        <div className="react-flow-canvas">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.5 }}
                minZoom={0.1}
                maxZoom={2}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    color="var(--canvas-dots)"
                />
                <Controls
                    className="react-flow-controls"
                    showInteractive={false}
                />
                <MiniMap
                    className="react-flow-minimap"
                    nodeColor="var(--accent)"
                    maskColor="rgba(0, 0, 0, 0.6)"
                    pannable
                    zoomable
                />
            </ReactFlow>
        </div>
    );
}
