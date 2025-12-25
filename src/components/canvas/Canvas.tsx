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
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import ChatBlockNode from './ChatBlockNode';
import ImageNode from './ImageNode';
import ChatModal from '../chat/ChatModal';
import OrbitEdge from './OrbitEdge';

// Define custom node types
const nodeTypes = {
    chatBlock: ChatBlockNode,
    imageNode: ImageNode,
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
    model?: string;
    hasImage?: boolean;
    messages: Array<{
        id: string;
        role: string;
        content: string;
    }>;
}

interface MessageLink {
    id: string;
    sourceMessageId: string;
    targetBlockId: string;
    quoteStart: number;
    quoteEnd: number;
    quoteText: string | null;
}

interface FileNodeData {
    id: string;
    name: string;
    mimeType: string;
    url: string;
    positionX: number;
    positionY: number;
}

interface FileLinkData {
    id: string;
    chatBlockId: string;
    fileNodeId: string;
}

interface SelectedBlockData {
    id: string;
    title: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface CanvasProps {
    boardId: string;
    boardName: string;
    initialBlocks?: ChatBlockWithMessages[];
    initialLinks?: MessageLink[];
    initialFiles?: FileNodeData[];
    initialFileLinks?: FileLinkData[];
}

export default function Canvas({
    boardId,
    boardName,
    initialBlocks = [],
    initialLinks = [],
    initialFiles = [],
    initialFileLinks = []
}: CanvasProps) {
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
        const nodes: Node[] = [];
        const ids = new Set<string>();

        // Add Chat Blocks
        initialBlocks.forEach((block) => {
            if (ids.has(block.id)) return;
            ids.add(block.id);

            nodes.push({
                id: block.id,
                type: 'chatBlock',
                position: { x: block.positionX, y: block.positionY },
                data: {
                    id: block.id,
                    boardId: boardId,
                    title: block.title,
                    isExpanded: block.isExpanded,
                    branchContext: block.branchContext,
                    model: block.model,
                    hasImage: block.hasImage,
                    messages: block.messages.map((m) => ({
                        role: m.role as 'user' | 'assistant',
                        content: m.content,
                        id: m.id // Ensure ID is passed for linking
                    })),
                    links: initialLinksMap,
                },
            });
        });

        // Add File Nodes (Images)
        initialFiles.forEach((file) => {
            if (ids.has(file.id)) return;
            ids.add(file.id);

            nodes.push({
                id: file.id,
                type: 'imageNode',
                position: { x: file.positionX, y: file.positionY },
                data: {
                    id: file.id,
                    url: file.url,
                    alt: file.name,
                    name: file.name,
                    mimeType: file.mimeType,
                },
            });
        });

        return nodes;
    }, [initialBlocks, initialLinksMap, initialFiles, boardId]);

    // Calculate initial edges
    const initialEdges: Edge[] = useMemo(() => {
        const edges: Edge[] = [];
        const messageToBlockMap = new Map<string, string>();

        // Build map of messageId -> blockId
        initialBlocks.forEach(block => {
            block.messages.forEach(msg => {
                messageToBlockMap.set(msg.id, block.id);
            });
        });

        // Add Chat Links
        initialLinks.forEach(link => {
            const sourceBlockId = messageToBlockMap.get(link.sourceMessageId);
            if (sourceBlockId) {
                edges.push({
                    id: `e-${sourceBlockId}-${link.targetBlockId}`,
                    source: sourceBlockId,
                    target: link.targetBlockId,
                    animated: false,
                    style: { stroke: 'var(--muted)', strokeWidth: 2 },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: 'var(--muted)',
                    },
                });
            }
        });

        // Add File Links (Orbit Edges)
        initialFileLinks.forEach(link => {
            edges.push({
                id: `orbit-${link.fileNodeId}-${link.chatBlockId}`,
                source: link.fileNodeId,
                target: link.chatBlockId,
                type: 'orbit',
                animated: true,
                style: { stroke: 'var(--accent)', strokeWidth: 2, opacity: 0.8 },
            });
        });

        return edges;
    }, [initialLinks, initialFileLinks, initialBlocks]);



    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
    const [edges, setEdges, onEdgesState] = useEdgesState<Edge>(initialEdges);
    const [selectedBlock, setSelectedBlock] = useState<SelectedBlockData | null>(null);
    const [needsInitialBlock, setNeedsInitialBlock] = useState(initialBlocks.length === 0);
    const [rfInstance, setRfInstance] = useState<any>(null); // React Flow instance
    const [showAddMenu, setShowAddMenu] = useState(false);
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
                    opacity: isTarget ? 1 : 0.8
                },
                markerEnd: edge.markerEnd ? {
                    type: MarkerType.ArrowClosed,
                    color: isTarget ? 'var(--accent)' : 'var(--muted)',
                } : undefined,
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
                // Debug log to trace data persistence
                console.log('[handleModelChange] Updating model for block:', blockId, 'Current hasImage:', node.data.hasImage);
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
        // Refactored to store array of message IDs as requested
        const branchContextIds = history.map((m: any) => m.id).filter(Boolean);

        // We still keep the prompt context for the AI, but for DB storage we use IDs
        // The API now expects branchContext to be the ID array


        try {
            console.log('[handleBranch] Creating branch with sourceMessageId:', sourceMessageId, 'quoteText:', quoteText);
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
                    branchContext: branchContextIds,
                    sourceMessageId,
                    quoteStart,
                    quoteEnd,
                    quoteText
                }),
            });

            if (response.ok) {
                const responseData = await response.json();
                const newBlock = responseData;

                const newLink: MessageLink = {
                    id: responseData.linkId || `link-${Date.now()}`, // Use ID from response or generate client-side
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

                    // Add the new block at a position below the parent
                    // The smart placement already calculated newX and newY
                    const newBlockNode = {
                        id: newBlock.id,
                        type: 'chatBlock',
                        position: { x: newX, y: newY },
                        data: {
                            id: newBlock.id,
                            boardId: boardId,
                            title: newBlock.title || 'New Branch',
                            messages: initialVisibleMessages,
                            branchContext: newBlock.branchContext,
                            model: newBlock.model || 'openai/gpt-4o',
                            isExpanded: true,
                        },
                    };

                    return updatedNodes.concat(newBlockNode);
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
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: 'var(--muted)',
                    },
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
                            boardId: boardId,
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

    // Handle image upload completion
    const handleImageUploaded = useCallback((chatBlockId: string, imageInfo: { id: string; url: string; name: string, mimeType?: string }) => {
        // Robustness: if imageInfo is a string, it means arguments were mismatched
        if (typeof imageInfo === 'string') {
            console.error('[Canvas] handleImageUploaded called with string instead of object! This indicates a prop mismatch.', { chatBlockId, imageInfo });
            return;
        }

        console.log(`[Canvas] Image uploaded for block ${chatBlockId}:`, imageInfo);

        const chatBlock = nodes.find(n => n.id === chatBlockId);
        if (!chatBlock) {
            console.error(`[Canvas] Could not find chat block ${chatBlockId} after image upload`);
            return;
        }

        const baseX = chatBlock.position.x;
        const baseY = chatBlock.position.y;

        // Position image node to the left of the chat block
        const imageX = baseX - 250;
        const imageY = baseY;

        const imageNodeId = imageInfo.id;

        // Update nodes: update the chat block status and add the image node in one go
        setNodes(nds => {
            const updatedNds = nds.map(n => {
                if (n.id === chatBlockId) {
                    return { ...n, data: { ...n.data, hasImage: true } };
                }
                return n;
            });

            // Only add the image node if it doesn't already exist
            if (!updatedNds.find(n => n.id === imageNodeId)) {
                updatedNds.push({
                    id: imageNodeId,
                    type: 'imageNode',
                    position: { x: imageX, y: imageY },
                    data: {
                        id: imageInfo.id,
                        name: imageInfo.name,
                        url: imageInfo.url,
                        mimeType: imageInfo.mimeType || 'image/*',
                        onDelete: deleteBlock,
                    },
                });
            }

            return updatedNds;
        });

        // Persist to database
        // 1. Update File Node position (it was already created by the upload API)
        if (!imageInfo.id) {
            console.error('[Canvas] ABORTING persistence: imageInfo.id is MISSING!', imageInfo);
            return;
        }

        const patchUrl = `/api/file-nodes/${imageInfo.id}`;
        console.log(`[Canvas] Line-by-Line: Entering persistence step for image ${imageInfo.id}`);
        console.log(`[Canvas] Line-by-Line: Target PATCH URL: ${patchUrl}`);

        fetch(patchUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                positionX: imageX,
                positionY: imageY
            })
        }).then(async (res) => {
            console.log(`[Canvas] Line-by-Line: PATCH response received. Status: ${res.status}`);
            if (res.ok) {
                console.log('[Canvas] Line-by-Line: File node position updated successfully');

                // 2. Create File Link (Orbit)
                console.log(`[Canvas] Line-by-Line: Creating file link for chatBlock: ${chatBlockId}`);
                const linkRes = await fetch('/api/file-links', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatBlockId,
                        fileNodeId: imageInfo.id
                    })
                });

                if (linkRes.ok) {
                    console.log('[Canvas] Line-by-Line: File link saved');
                } else {
                    const error = await linkRes.json().catch(() => ({}));
                    console.error('[Canvas] Line-by-Line: Failed to save file link:', linkRes.status, error);
                }
            } else {
                let errorData;
                try {
                    errorData = await res.json();
                } catch (e) {
                    try {
                        errorData = await res.text();
                    } catch (e2) {
                        errorData = 'Could not parse error body';
                    }
                }
                console.error('[Canvas] Line-by-Line: PATCH failed with status:', res.status, 'Error Body:', errorData);
                console.error('[Canvas] Debug Info: Target ID was:', imageInfo.id);
            }
        }).catch(err => {
            console.error('[Canvas] Line-by-Line: Network/Fetch error during PATCH:', err);
        });

        // Add edge from image to chat block
        setEdges(eds => addEdge({
            id: `e-${imageNodeId}-${chatBlockId}`,
            source: imageNodeId,
            target: chatBlockId,
            type: 'orbit',
            animated: false,
            style: { stroke: 'var(--muted)', strokeWidth: 2 },
            data: { isAnimating: false },
        }, eds));
    }, [nodes, setNodes, setEdges, deleteBlock]);

    // Handle hasImage persistence
    const handleHasImageChange = useCallback(async (blockId: string, hasImage: boolean) => {
        // Optimistic update
        setNodes((nds) => nds.map((node) => {
            if (node.id === blockId) {
                return {
                    ...node,
                    data: { ...node.data, hasImage }
                };
            }
            return node;
        }));

        try {
            await fetch(`/api/chat-blocks/${blockId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hasImage }),
            });
        } catch (error) {
            console.error('Failed to update block hasImage:', error);
        }
    }, [setNodes]);

    // Update node data with callbacks
    const nodesWithCallbacks = useMemo(() => {
        const ids = new Set();
        const duplicates: string[] = [];

        return nodes.map((node) => {
            if (ids.has(node.id)) {
                duplicates.push(node.id);
            }
            ids.add(node.id);

            if (duplicates.length > 0 && node.id === duplicates[0]) {
                console.warn('[Canvas] Duplicate node ID detected in ReactFlow nodes array:', node.id, node);
            }

            return {
                ...node,
                data: {
                    ...node.data,
                    onMaximize: maximizeBlock,
                    onDelete: deleteBlock,
                    onRename: renameBlock,
                    onModelChange: handleModelChange,
                    onExpandToggle: handleExpandToggle,
                    onHasImageChange: handleHasImageChange,
                    onBranch: (sourceMessageId: string, quoteStart: number, quoteEnd: number, quoteText: string, contextMessages: any[]) =>
                        handleBranch(node.id, sourceMessageId, quoteStart, quoteEnd, quoteText, contextMessages),
                    onLinkClick: (targetBlockId: string) => handleLinkClick(node.id, targetBlockId),
                    onImageUploaded: (imageInfo: { id: string; url: string; name: string, mimeType?: string }) => handleImageUploaded(node.id, imageInfo),
                },
            };
        });
    }, [nodes, maximizeBlock, deleteBlock, renameBlock, handleModelChange, handleBranch, handleLinkClick, handleExpandToggle, handleImageUploaded, handleHasImageChange]);

    // Update node position on drag end
    const handleNodesChange = useCallback((changes: any) => {
        onNodesChange(changes);

        // Save position changes
        changes.forEach(async (change: any) => {
            if (change.type === 'position' && change.dragging === false && change.position) {
                const node = nodes.find(n => n.id === change.id);
                if (!node) return;

                const endpoint = node.type === 'chatBlock'
                    ? `/api/chat-blocks/${change.id}`
                    : `/api/file-nodes/${change.id}`;

                try {
                    const response = await fetch(endpoint, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            positionX: change.position.x,
                            positionY: change.position.y,
                        }),
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`[Canvas] Failed to save position for ${node.type} ${change.id}:`, response.status, errorText);
                    }
                } catch (err) {
                    console.error(`[Canvas] Network error saving position for ${node.type} ${change.id}:`, err);
                }
            }
        });
    }, [onNodesChange, nodes]);

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

            {/* Add Block Button with Dropdown */}
            <div className="add-block-container">
                <button
                    className="add-block-btn"
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    title="Add to Canvas"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </button>

                {showAddMenu && (
                    <div className="add-block-dropdown">
                        <button
                            className="add-dropdown-item"
                            onClick={() => {
                                setShowAddMenu(false);
                                createBlock().then(newBlock => {
                                    if (newBlock) {
                                        const messages: Array<any> = [];
                                        setBlockMessages((prev) => ({ ...prev, [newBlock.id]: messages }));
                                        setNodes((nds) => nds.concat({
                                            id: newBlock.id,
                                            type: 'chatBlock',
                                            position: { x: newBlock.positionX, y: newBlock.positionY },
                                            data: {
                                                id: newBlock.id,
                                                boardId: boardId,
                                                title: newBlock.title,
                                                model: newBlock.model || 'openai/gpt-5',
                                                messages: messages,
                                                links: initialLinksMap,
                                            },
                                        }));
                                    }
                                });
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                            </svg>
                            <span>Chat Block</span>
                        </button>
                        <button
                            className="add-dropdown-item"
                            onClick={() => {
                                setShowAddMenu(false);
                                // Trigger file picker for image
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/png,image/jpeg,image/jpg,image/webp';
                                input.onchange = async (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) {
                                        const formData = new FormData();
                                        formData.append('file', file);
                                        formData.append('boardId', boardId);

                                        try {
                                            const response = await fetch('/api/images', {
                                                method: 'POST',
                                                body: formData,
                                            });
                                            if (response.ok) {
                                                const data = await response.json();
                                                // Get center of viewport
                                                let posX = 250, posY = 150;
                                                if (rfInstance) {
                                                    const center = rfInstance.screenToFlowPosition({
                                                        x: window.innerWidth / 2,
                                                        y: window.innerHeight / 2,
                                                    });
                                                    posX = center.x - 100;
                                                    posY = center.y - 100;
                                                }

                                                setNodes((nds) => nds.concat({
                                                    id: data.id,
                                                    type: 'imageNode',
                                                    position: { x: posX, y: posY },
                                                    data: {
                                                        id: data.id,
                                                        name: data.name,
                                                        url: data.url,
                                                        mimeType: file.type,
                                                        onDelete: deleteBlock,
                                                    },
                                                }));
                                            }
                                        } catch (error) {
                                            console.error('Failed to upload image:', error);
                                        }
                                    }
                                };
                                input.click();
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                            <span>Image</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
