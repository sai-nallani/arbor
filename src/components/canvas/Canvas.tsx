'use client';

import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
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
import OrbitEdge from './OrbitEdge';

// Define custom node types
const nodeTypes = {
    chatBlock: ChatBlockNode,
};

const edgeTypes = {
    orbit: OrbitEdge,
};

interface ChatBlockWithMessages {
    id: string;
    title: string;
    positionX: number;
    positionY: number;
    isExpanded?: boolean;
    branchContext?: string;
    messages: Array<{
        id: string;
        role: string;
        content: string;
    }>;
}

interface CanvasProps {
    boardId: string;
    boardName: string;
    initialBlocks?: ChatBlockWithMessages[];
    initialLinks?: MessageLink[];
}

interface MessageLink {
    id: string;
    sourceMessageId: string;
    targetBlockId: string;
    quoteStart: number;
    quoteEnd: number;
    quoteText: string | null;
}

interface SelectedBlockData {
    id: string;
    title: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export default function Canvas({ boardId, boardName, initialBlocks = [], initialLinks = [] }: CanvasProps) {
    // Process initial links into a map
    const initialLinksMap = useMemo(() => {
        const map: Record<string, MessageLink[]> = {};
        initialLinks.forEach(link => {
            if (!map[link.sourceMessageId]) {
                map[link.sourceMessageId] = [];
            }
            map[link.sourceMessageId].push(link);
        });
        return map;
    }, [initialLinks]);

    // Store messages separately for quick lookup
    const [blockMessages, setBlockMessages] = useState<Record<string, Array<{ role: 'user' | 'assistant'; content: string }>>>(() => {
        const initial: Record<string, Array<{ role: 'user' | 'assistant'; content: string }>> = {};
        initialBlocks.forEach((block) => {
            initial[block.id] = block.messages.map((m) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            }));
        });
        return initial;
    });

    // Convert initial blocks to nodes
    const initialNodes: Node[] = useMemo(() => {
        if (initialBlocks.length === 0) {
            return [];
        }
        return initialBlocks.map((block) => ({
            id: block.id,
            type: 'chatBlock',
            position: { x: block.positionX, y: block.positionY },
            data: {
                id: block.id,
                title: block.title,
                isExpanded: block.isExpanded,
                branchContext: block.branchContext,
                messages: block.messages.map((m) => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                    id: m.id // Ensure ID is passed for linking
                })),
                links: initialLinksMap,
            },
        }));
    }, [initialBlocks, initialLinksMap]);

    // Calculate initial edges
    const initialEdges: Edge[] = useMemo(() => {
        if (initialLinks.length === 0) return [];

        const edges: Edge[] = [];
        const messageToBlockMap = new Map<string, string>();

        // Build map of messageId -> blockId
        initialBlocks.forEach(block => {
            block.messages.forEach(msg => {
                messageToBlockMap.set(msg.id, block.id);
            });
        });

        initialLinks.forEach(link => {
            const sourceBlockId = messageToBlockMap.get(link.sourceMessageId);
            if (sourceBlockId) {
                edges.push({
                    id: `e-${sourceBlockId}-${link.targetBlockId}`,
                    source: sourceBlockId,
                    target: link.targetBlockId,
                    animated: false,
                    style: { stroke: 'var(--muted)', strokeWidth: 2 },
                });
            }
        });

        return edges;
    }, [initialBlocks, initialLinks]);

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
    const [edges, setEdges, onEdgesState] = useEdgesState<Edge>(initialEdges);
    const [selectedBlock, setSelectedBlock] = useState<SelectedBlockData | null>(null);
    const [needsInitialBlock, setNeedsInitialBlock] = useState(initialBlocks.length === 0);
    const [rfInstance, setRfInstance] = useState<any>(null); // React Flow instance
    const initializingRef = useRef(false);

    // Handle link click to highlight edge and animate orb
    const handleLinkClick = useCallback((sourceBlockId: string, targetBlockId: string) => {
        setEdges((eds) => eds.map((edge) => {
            const isTarget = edge.source === sourceBlockId && edge.target === targetBlockId;
            return {
                ...edge,
                animated: false, // We use custom animation now
                type: 'orbit',
                style: {
                    ...edge.style,
                    stroke: isTarget ? 'var(--accent)' : 'var(--muted)',
                    strokeWidth: isTarget ? 3 : 2,
                },
                zIndex: isTarget ? 10 : 0,
                data: {
                    ...edge.data,
                    isAnimating: isTarget ? Date.now() : false, // Trigger with timestamp
                }
            };
        }));
    }, [setEdges]);

    // Delete a block
    const deleteBlock = useCallback(async (blockId: string) => {
        console.log('Attempting to delete block:', blockId);

        if (!window.confirm('Are you sure you want to delete this chat?')) {
            console.log('Delete cancelled by user');
            return;
        }

        console.log('Proceeding with delete for block:', blockId);

        // Optimistic update
        // Optimistic update
        setNodes((nds) => {
            // 1. Remove the deleted node
            const remainingNodes = nds.filter((node) => node.id !== blockId);

            // 2. Clean up references (links) in remaining nodes
            return remainingNodes.map(node => {
                const links = node.data.links as Record<string, MessageLink[]> | undefined;
                if (!links) return node;

                let hasChanges = false;
                const newLinks: Record<string, MessageLink[]> = {};

                Object.entries(links).forEach(([msgId, msgLinks]) => {
                    const filteredLinks = msgLinks.filter(link => link.targetBlockId !== blockId);
                    if (filteredLinks.length !== msgLinks.length) {
                        hasChanges = true;
                    }
                    if (filteredLinks.length > 0) {
                        newLinks[msgId] = filteredLinks;
                    }
                });

                if (hasChanges) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            links: newLinks
                        }
                    };
                }
                return node;
            });
        });
        setEdges((eds) => eds.filter((edge) => edge.source !== blockId && edge.target !== blockId));

        try {
            await fetch(`/api/chat-blocks/${blockId}`, { method: 'DELETE' });
            console.log('Block deleted from server:', blockId);
        } catch (error) {
            console.error('Failed to delete block:', error);
        }
    }, [setNodes, setEdges]);

    // Create a new block defined here, but with access to rfInstance
    const createBlock = useCallback(async (x?: number, y?: number) => {
        let positionX = x;
        let positionY = y;

        // If no position provided, try to spawn in center of view
        if (positionX === undefined || positionY === undefined) {
            if (rfInstance) {
                // Get center of viewport
                const center = rfInstance.screenToFlowPosition({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                });
                positionX = center.x - 200; // Center the block (assuming 400px width)
                positionY = center.y - 150;
            } else {
                // Fallback
                positionX = 250;
                positionY = 150;
            }
        }

        try {
            const response = await fetch('/api/chat-blocks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    boardId,
                    title: 'New Chat',
                    positionX: positionX,
                    positionY: positionY,
                }),
            });
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Failed to create block:', error);
        }
        return null;
    }, [boardId, rfInstance]);

    // Rename a block
    const renameBlock = useCallback(async (blockId: string, newTitle: string) => {
        // Optimistic update
        setNodes((nds) => nds.map((node) => {
            if (node.id === blockId) {
                return {
                    ...node,
                    data: { ...node.data, title: newTitle }
                };
            }
            return node;
        }));

        try {
            await fetch(`/api/chat-blocks/${blockId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle }),
            });
        } catch (error) {
            console.error('Failed to rename block:', error);
        }
    }, [setNodes]);

    // Updates a block's model
    const handleModelChange = useCallback(async (blockId: string, newModel: string) => {
        // Optimistic update
        setNodes((nds) => nds.map((node) => {
            if (node.id === blockId) {
                return {
                    ...node,
                    data: { ...node.data, model: newModel }
                };
            }
            return node;
        }));

        try {
            await fetch(`/api/chat-blocks/${blockId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: newModel }),
            });
        } catch (error) {
            console.error('Failed to update block model:', error);
        }
    }, [setNodes]);

    // Handle expand toggle persistence
    const handleExpandToggle = useCallback(async (blockId: string, isExpanded: boolean) => {
        // Optimistic update
        setNodes((nds) => nds.map((node) => {
            if (node.id === blockId) {
                return {
                    ...node,
                    data: { ...node.data, isExpanded }
                };
            }
            return node;
        }));

        try {
            await fetch(`/api/chat-blocks/${blockId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isExpanded }),
            });
        } catch (error) {
            console.error('Failed to update block expansion:', error);
        }
    }, [setNodes]);



    // Handle branching
    const handleBranch = useCallback(async (
        parentBlockId: string,
        sourceMessageId: string,
        quoteStart: number,
        quoteEnd: number,
        quoteText: string,
        contextMessages: any[]
    ) => {
        console.log('Branching from block:', parentBlockId);

        // Find parent position
        const parentNode = nodes.find(n => n.id === parentBlockId);
        const parentX = parentNode?.position.x ?? 250;
        const parentY = parentNode?.position.y ?? 150;

        // Smart Placement: Find open spot
        let newX = parentX + 450;
        let newY = parentY;
        let isOverlapping = true;

        // Improve collision detection for expanded nodes
        const GAP = 50;

        // Simple grid-like search downwards
        // Safety break after 20 tries to prevent infinite loop
        let attempts = 0;
        while (isOverlapping && attempts < 20) {
            isOverlapping = nodes.some(n => {
                const nx = n.position.x;
                const ny = n.position.y;
                // Expanded nodes are larger (600x600) + padding
                const nWidth = n.data.isExpanded ? 650 : 400;
                const nHeight = n.data.isExpanded ? 650 : 400;

                // My new block size (default small)
                const myWidth = 400;
                const myHeight = 400;

                // Check intersection
                return (
                    newX < nx + nWidth &&
                    newX + myWidth > nx &&
                    newY < ny + nHeight &&
                    newY + myHeight > ny
                );
            });

            if (isOverlapping) {
                newY += (450); // Increment
                attempts++;
            }
        }

        // Prepare data: 
        // contextMessages contains history + new prompt
        // We want to persist history in branchContext, and only new prompt in visible messages
        const history = contextMessages.slice(0, -1);
        const newPrompt = contextMessages[contextMessages.length - 1];

        // Initial messages for the new block (visible)
        const initialVisibleMessages = [newPrompt];

        // Context string for AI/DB - include the highlighted text so AI knows what user is referring to
        const branchContextStr = JSON.stringify({
            conversationHistory: history,
            highlightedText: quoteText,
            userQuestion: newPrompt.content
        });

        try {
            const response = await fetch('/api/chat-blocks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    boardId,
                    title: 'Branch: ' + (quoteText.length > 20 ? quoteText.slice(0, 20) + '...' : quoteText),
                    positionX: newX,
                    positionY: newY,
                    parentId: parentBlockId,
                    initialMessages: initialVisibleMessages,
                    branchContext: branchContextStr,
                    sourceMessageId,
                    quoteStart,
                    quoteEnd,
                    quoteText
                }),
            });

            if (response.ok) {
                const newBlock = await response.json();

                const newLink: MessageLink = {
                    id: `link-${Date.now()}`, // Temporary ID for client
                    sourceMessageId,
                    targetBlockId: newBlock.id,
                    quoteStart,
                    quoteEnd,
                    quoteText
                };

                // Add new block to state
                setBlockMessages((prev) => ({
                    ...prev,
                    [newBlock.id]: initialVisibleMessages.map((m: any) => ({
                        role: m.role,
                        content: m.content
                    }))
                }));

                // Update nodes: Add new block AND update source block links for immediate highlight
                setNodes((nds) => {
                    const updatedNodes = nds.map(node => {
                        if (node.id === parentBlockId) {
                            const currentLinks = (node.data.links as Record<string, MessageLink[]>) || {};
                            const msgLinks = currentLinks[sourceMessageId] || [];
                            return {
                                ...node,
                                data: {
                                    ...node.data,
                                    links: {
                                        ...currentLinks,
                                        [sourceMessageId]: [...msgLinks, newLink]
                                    }
                                }
                            };
                        }
                        return node;
                    });

                    return updatedNodes.concat({
                        id: newBlock.id,
                        type: 'chatBlock',
                        position: { x: newBlock.positionX, y: newBlock.positionY },
                        data: {
                            id: newBlock.id,
                            title: newBlock.title,
                            messages: initialVisibleMessages,
                            branchContext: branchContextStr,
                        },
                    });
                });

                // Add edge
                setEdges((eds) => addEdge({
                    id: `e-${parentBlockId}-${newBlock.id}`, // Explicit ID for styling
                    source: parentBlockId,
                    target: newBlock.id,
                    sourceHandle: null,
                    targetHandle: null,
                    type: 'orbit',
                    animated: false,
                    style: { stroke: 'var(--muted)', strokeWidth: 2 },
                    data: { isAnimating: false },
                }, eds));
            }
        } catch (error) {
            console.error('Failed to branch block:', error);
        }
    }, [boardId, nodes, setNodes, setEdges, setBlockMessages]);

    // Maximize a block in the modal
    const maximizeBlock = useCallback((blockId: string) => {
        // Fetch fresh messages
        fetch(`/api/chat-blocks/${blockId}`)
            .then((res) => res.json())
            .then((block) => {
                setSelectedBlock({
                    id: block.id,
                    title: block.title,
                    messages: block.messages.map((m: any) => ({
                        role: m.role,
                        content: m.content,
                    })),
                });
            });
    }, []);

    // Create initial block if none exist (client-side only)
    useEffect(() => {
        if (needsInitialBlock && !initializingRef.current) {
            initializingRef.current = true;
            createBlock(250, 150).then((newBlock) => {
                if (newBlock) {
                    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
                    setBlockMessages((prev) => ({ ...prev, [newBlock.id]: messages }));
                    setNodes([{
                        id: newBlock.id,
                        type: 'chatBlock',
                        position: { x: newBlock.positionX, y: newBlock.positionY },
                        data: {
                            id: newBlock.id,
                            title: newBlock.title,
                            messages: messages,
                            links: initialLinksMap,
                        },
                    }]);
                    setNeedsInitialBlock(false);
                }
                initializingRef.current = false;
            });
        }
    }, [needsInitialBlock, createBlock, setNodes]);

    // Update node data with callbacks
    const nodesWithCallbacks = useMemo(() => {
        return nodes.map((node) => ({
            ...node,
            data: {
                ...node.data,
                onMaximize: maximizeBlock,
                onDelete: deleteBlock,
                onRename: renameBlock,
                onModelChange: handleModelChange,
                onExpandToggle: handleExpandToggle,
                onBranch: (sourceMessageId: string, quoteStart: number, quoteEnd: number, quoteText: string, contextMessages: any[]) =>
                    handleBranch(node.id, sourceMessageId, quoteStart, quoteEnd, quoteText, contextMessages),
                onLinkClick: (targetBlockId: string) => handleLinkClick(node.id, targetBlockId),
            },
        }));
    }, [nodes, maximizeBlock, deleteBlock, renameBlock, handleModelChange, handleBranch, handleLinkClick, handleExpandToggle]);

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

    // Handle modal close - refresh messages from cache
    const handleModalClose = () => {
        setSelectedBlock(null);
    };

    return (
        <div className="react-flow-canvas">
            <ReactFlow
                nodes={nodesWithCallbacks}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesState}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onInit={(instance) => {
                    setRfInstance(instance);
                    // Restore viewport if exists
                    const saved = localStorage.getItem(`arbor_viewport_${boardId}`);
                    if (saved) {
                        const { x, y, zoom } = JSON.parse(saved);
                        instance.setViewport({ x, y, zoom });
                    }
                }}
                onMoveEnd={(event, viewport) => {
                    localStorage.setItem(`arbor_viewport_${boardId}`, JSON.stringify(viewport));
                }}
                fitView={!localStorage.getItem(`arbor_viewport_${boardId}`)} // Only fit view if no saved state
                fitViewOptions={{ padding: 0.5 }}
                minZoom={0.1}
                maxZoom={2}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={2.5}
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
                    onClose={handleModalClose}
                />
            )}

            {/* Add Block Button */}
            <button
                className="add-block-btn"
                onClick={() => createBlock().then(newBlock => {
                    if (newBlock) {
                        const messages: Array<any> = [];
                        setBlockMessages((prev) => ({ ...prev, [newBlock.id]: messages }));
                        setNodes((nds) => nds.concat({
                            id: newBlock.id,
                            type: 'chatBlock',
                            position: { x: newBlock.positionX, y: newBlock.positionY },
                            data: {
                                id: newBlock.id,
                                title: newBlock.title,
                                model: newBlock.model || 'openai/gpt-5',
                                messages: messages,
                                links: initialLinksMap,
                            },
                        }));
                    }
                })}
                title="New Chat"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                </svg>
            </button>
        </div>
    );
}
