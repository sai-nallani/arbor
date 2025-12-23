'use client';

import { useCallback, useState, useEffect } from 'react';
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
import ChatModal from '../chat/ChatModal';

// Define custom node types
const nodeTypes = {
    chatBlock: ChatBlockNode,
};

interface CanvasProps {
    boardId: string;
    boardName: string;
}

interface ChatBlockData {
    id: string;
    title: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export default function Canvas({ boardId, boardName }: CanvasProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [selectedBlock, setSelectedBlock] = useState<ChatBlockData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch existing chat blocks for this board
    useEffect(() => {
        async function fetchBlocks() {
            try {
                const response = await fetch(`/api/chat-blocks?boardId=${boardId}`);
                if (response.ok) {
                    const blocks = await response.json();

                    if (blocks.length === 0) {
                        // Create initial block if none exist
                        const newBlock = await createBlock(250, 150);
                        if (newBlock) {
                            setNodes([{
                                id: newBlock.id,
                                type: 'chatBlock',
                                position: { x: newBlock.positionX, y: newBlock.positionY },
                                data: {
                                    id: newBlock.id,
                                    title: newBlock.title,
                                    messages: [],
                                    onOpen: () => openBlock(newBlock.id, newBlock.title),
                                },
                            }]);
                        }
                    } else {
                        // Convert blocks to nodes
                        const nodeList: Node[] = blocks.map((block: any) => ({
                            id: block.id,
                            type: 'chatBlock',
                            position: { x: block.positionX, y: block.positionY },
                            data: {
                                id: block.id,
                                title: block.title,
                                messages: [],
                                onOpen: () => openBlock(block.id, block.title),
                            },
                        }));
                        setNodes(nodeList);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch blocks:', error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchBlocks();
    }, [boardId]);

    // Create a new block
    async function createBlock(x: number, y: number) {
        try {
            const response = await fetch('/api/chat-blocks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    boardId,
                    title: 'New Chat',
                    positionX: x,
                    positionY: y,
                }),
            });
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Failed to create block:', error);
        }
        return null;
    }

    // Open a block in the modal
    async function openBlock(blockId: string, title: string) {
        try {
            const response = await fetch(`/api/chat-blocks/${blockId}`);
            if (response.ok) {
                const block = await response.json();
                setSelectedBlock({
                    id: block.id,
                    title: block.title,
                    messages: block.messages.map((m: any) => ({
                        role: m.role,
                        content: m.content,
                    })),
                });
            }
        } catch (error) {
            console.error('Failed to fetch block:', error);
        }
    }

    // Update node position on drag end
    const handleNodesChange = useCallback((changes: any) => {
        onNodesChange(changes);

        // Save position changes
        changes.forEach(async (change: any) => {
            if (change.type === 'position' && change.dragging === false && change.position) {
                await fetch(`/api/chat-blocks/${change.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        positionX: change.position.x,
                        positionY: change.position.y,
                    }),
                });
            }
        });
    }, [onNodesChange]);

    const onConnect: OnConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    if (isLoading) {
        return (
            <div className="canvas-loading">
                <div className="loading-spinner" />
                <p>Loading canvas...</p>
            </div>
        );
    }

    return (
        <div className="react-flow-canvas">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
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

            {/* Chat Modal */}
            {selectedBlock && (
                <ChatModal
                    blockId={selectedBlock.id}
                    title={selectedBlock.title}
                    initialMessages={selectedBlock.messages}
                    onClose={() => setSelectedBlock(null)}
                />
            )}
        </div>
    );
}
