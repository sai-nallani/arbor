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
    ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import ChatBlockNode from './ChatBlockNode';
import ImageNode from './ImageNode';
import ChatModal from '../chat/ChatModal';
import OrbitEdge from './OrbitEdge';
import ContextEdge from './ContextEdge';
import DeletableEdge from './DeletableEdge';
import StickyNoteNode from './StickyNoteNode';
import { useConnectionStyle } from '@/hooks/useConnectionStyle';

// Define custom node types
const nodeTypes = {
    chatBlock: ChatBlockNode,
    imageNode: ImageNode,
    stickyNote: StickyNoteNode,
};

const edgeTypes = {
    orbit: OrbitEdge,
    context: ContextEdge,
    deletable: DeletableEdge,
};

interface ChatBlockWithMessages {
    id: string;
    title: string;
    positionX: number;
    positionY: number;
    width?: number;
    height?: number;
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

interface ContextLinkData {
    id: string;
    sourceBlockId: string;
    targetBlockId: string;
    sourceHandle?: string;
    targetHandle?: string;
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
    initialContextLinks?: ContextLinkData[];
    initialStickyNotes?: any[]; // Simplified for now
}

export default function Canvas({
    boardId,
    boardName,
    initialBlocks = [],
    initialLinks = [],
    initialFiles = [],
    initialFileLinks = [],
    initialContextLinks = [],
    initialStickyNotes = []
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
                style: { width: block.width || 800, height: block.height || 800 },
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
                style: { width: 400, height: 350 },
                data: {
                    id: file.id,
                    url: file.url,
                    alt: file.name,
                    name: file.name,
                    mimeType: file.mimeType,
                },
            });
        });

        // Add Sticky Notes
        initialStickyNotes.forEach((note) => {
            if (ids.has(note.id)) return;
            ids.add(note.id);

            nodes.push({
                id: note.id,
                type: 'stickyNote',
                position: { x: note.positionX, y: note.positionY },
                style: { width: note.width || 200, height: note.height || 200 },
                data: {
                    id: note.id,
                    content: note.content,
                    color: note.color,
                    // We'll attach handlers later via updateNodeInternals or useEffect if needed, 
                    // but better to pass them here if defined constantly
                },
            });
        });

        return nodes;
    }, [initialBlocks, initialLinksMap, initialFiles, initialStickyNotes, boardId]);

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
                    sourceHandle: 'bottom',
                    targetHandle: 'top',
                    type: 'deletable',
                    animated: false,
                    style: { stroke: '#A67B5B', strokeWidth: 2 },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: '#A67B5B',
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
                sourceHandle: 'bottom',
                targetHandle: 'top',
                type: 'deletable',
                animated: false,
                style: { stroke: '#A67B5B', strokeWidth: 2 },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: '#A67B5B',
                },
            });
        });

        // Add Context Links (Context Edges)
        initialContextLinks.forEach(link => {
            // Check if source is an image node
            const isImageNode = initialFiles.some(f => f.id === link.sourceBlockId);
            const imageUrl = isImageNode ? initialFiles.find(f => f.id === link.sourceBlockId)?.url : undefined;

            // Check if source is a sticky note
            const isStickyNote = initialStickyNotes.some(n => n.id === link.sourceBlockId);

            let edgeId = `context-${link.sourceBlockId}-${link.targetBlockId}`;
            if (isImageNode) {
                edgeId = `image-context-${link.sourceBlockId}-${link.targetBlockId}`;
            } else if (isStickyNote) {
                edgeId = `sticky-context-${link.sourceBlockId}-${link.targetBlockId}`;
            }

            edges.push({
                id: edgeId,
                source: link.sourceBlockId,
                target: link.targetBlockId,
                sourceHandle: link.sourceHandle || 'right',
                targetHandle: link.targetHandle || 'left',
                type: 'deletable',
                animated: false,
                style: { stroke: '#A67B5B', strokeWidth: 2 },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: '#A67B5B',
                },
                data: {
                    isImageContext: isImageNode,
                    imageUrl: imageUrl,
                }
            });
        });

        // We also need to handle sticky context links here if they were passed, 
        // but currently the prop initialContextLinks might only contain chat-chat links if fetched that way.
        // Assuming the parent component passes all context links normalized or we need a new prop.
        // For now, ignoring initial sticky links in this specific block until prop is updated or they are included in initialContextLinks.

        return edges;
    }, [initialLinks, initialFileLinks, initialContextLinks, initialBlocks, initialFiles, initialStickyNotes]);



    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedBlock, setSelectedBlock] = useState<SelectedBlockData | null>(null);
    const [needsInitialBlock, setNeedsInitialBlock] = useState(initialBlocks.length === 0);
    const [rfInstance, setRfInstance] = useState<any>(null); // React Flow instance
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [placementMode, setPlacementMode] = useState<'chat' | 'image' | 'sticky' | null>(null);
    const [errorToast, setErrorToast] = useState<string | null>(null);



    // State for placement mode (creating new blocks)eRef(false);
    const initializingRef = useRef(false);

    // Ref for nodes to avoid dependency cycles in callbacks
    const nodesRef = useRef(nodes);
    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    // Helper to get real DB ID from message index
    const getMessageId = (blockId: string, index: number) => {
        const block = nodesRef.current.find(n => n.id === blockId);
        if (block && block.data && (block.data as any).messages && (block.data as any).messages[index]) {
            return (block.data as any).messages[index].id;
        }
        return null;
    };

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

    // Create a context link between two chat blocks
    const createContextLink = useCallback(async (
        sourceBlockId: string,
        targetBlockId: string,
        sourceHandle?: string,
        targetHandle?: string
    ) => {
        try {
            const response = await fetch('/api/context-links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceBlockId, targetBlockId, sourceHandle, targetHandle }),
            });

            if (!response.ok) {
                const error = await response.json();
                console.warn('Context link creation blocked:', error.error);

                // Show user-friendly error toast
                const errorMessage = error.error || 'Failed to create context link';
                setErrorToast(errorMessage);
                setTimeout(() => setErrorToast(null), 4000); // Auto-dismiss after 4 seconds

                // Remove optimistic edge on failure
                setEdges((eds) => eds.filter(e => e.id !== `context-${sourceBlockId}-${targetBlockId}`));
                return;
            }

            // console.log('Context link created:', sourceBlockId, '→', targetBlockId);
        } catch (error) {
            console.warn('Context link network error:', error);
            setErrorToast('Network error creating context link');
            setTimeout(() => setErrorToast(null), 4000);
            // Remove optimistic edge on failure
            setEdges((eds) => eds.filter(e => e.id !== `context-${sourceBlockId}-${targetBlockId}`));
        }
    }, [setEdges]);

    // Delete a context link
    const deleteContextLink = useCallback(async (edgeId: string) => {
        // Find the edge to get source and target IDs
        let sourceId: string | undefined;
        let targetId: string | undefined;
        let isImageContext = false;

        setEdges((eds) => {
            const edge = eds.find(e => e.id === edgeId);
            if (edge) {
                sourceId = edge.source;
                targetId = edge.target;
                isImageContext = !!edge.data?.isImageContext;
            }
            return eds.filter(e => e.id !== edgeId);
        });

        // Wait for state update to get the values
        await new Promise(resolve => setTimeout(resolve, 0));

        if (!sourceId || !targetId) {
            console.error('Could not determine source/target for context link deletion');
            return;
        }

        try {
            const endpoint = isImageContext
                ? `/api/image-context-links?imageNodeId=${sourceId}&chatBlockId=${targetId}`
                : `/api/context-links?sourceBlockId=${sourceId}&targetBlockId=${targetId}`;

            const response = await fetch(endpoint, {
                method: 'DELETE',
            });
            if (response.ok) {
                // console.log(`${isImageContext ? 'Image context' : 'Context'} link deleted:`, sourceId, '→', targetId);

                // If it was an image context link, check if we should update the target block's hasImage state
                if (isImageContext && targetId) {
                    const currentEdges = rfInstance ? rfInstance.getEdges() : [];

                    // Check if there are any REMAINING image context links to this target
                    // We filter out the current edgeId because setEdges might not have flushed yet for rfInstance (depends on implementation)
                    // But usually rfInstance.getEdges() returns strict current state. 
                    // Since we called setEdges above, and it's React state, rfInstance might still show the old one or not.
                    // Safest is to filter out the deleted edge explicitly.
                    const otherImageLinks = currentEdges.filter((e: Edge) =>
                        e.target === targetId &&
                        e.id !== edgeId &&
                        (e.data?.isImageContext || e.source.startsWith('image-')) // Robust check
                    );

                    if (otherImageLinks.length === 0) {
                        // console.log('No remaining image links for block', targetId, '- setting hasImage=false');
                        // Update local node state
                        setNodes((nds) => nds.map((node) => {
                            if (node.id === targetId) {
                                return {
                                    ...node,
                                    data: { ...node.data, hasImage: false }
                                };
                            }
                            return node;
                        }));

                        // Update server
                        fetch(`/api/chat-blocks/${targetId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ hasImage: false }),
                        }).catch(e => console.error('Failed to sync hasImage=false:', e));
                    }
                }
            } else {
                console.error(`Failed to delete ${isImageContext ? 'image context' : 'context'} link:`, await response.text());
            }
        } catch (error) {
            console.error('Error deleting context link:', error);
        }
    }, [setEdges, rfInstance, setNodes]);

    // Update Sticky Note content/color
    const updateStickyNote = useCallback(async (id: string, content: string, color: string) => {
        // Optimistic update
        setNodes((nds) => nds.map((node) => {
            if (node.id === id) {
                return {
                    ...node,
                    data: { ...node.data, content, color }
                };
            }
            return node;
        }));

        try {
            await fetch(`/api/sticky-notes/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, color }),
            });
        } catch (error) {
            console.error('Failed to update sticky note:', error);
            // Revert or show toast?
        }
    }, [setNodes]);

    // Delete Sticky Note
    const deleteStickyNote = useCallback(async (id: string) => {
        setNodes((nds) => nds.filter((n) => n.id !== id));
        try {
            await fetch(`/api/sticky-notes/${id}`, {
                method: 'DELETE',
            });
        } catch (error) {
            console.error('Failed to delete sticky note:', error);
        }
    }, [setNodes]);

    // Create Sticky Note from highlighted text (called from context menu)
    const handleCreateStickyNote = useCallback(async (sourceNodeId: string, content: string) => {
        // Find the source node to position the sticky note nearby
        const sourceNode = nodes.find(n => n.id === sourceNodeId);
        const baseX = sourceNode?.position.x ?? 250;
        const baseY = sourceNode?.position.y ?? 150;

        // Position to the right of the source node
        const positionX = baseX + 500;
        const positionY = baseY;

        const tempId = `temp-sticky-${Date.now()}`;

        // Optimistic update
        setNodes((nds) => nds.concat({
            id: tempId,
            type: 'stickyNote',
            position: { x: positionX, y: positionY },
            data: {
                id: tempId,
                content,
                color: 'yellow',
                onUpdate: updateStickyNote,
                onDelete: deleteStickyNote,
            },
        }));

        // Create on server
        try {
            const response = await fetch('/api/sticky-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    boardId,
                    positionX,
                    positionY,
                    content,
                    color: 'yellow',
                }),
            });

            if (response.ok) {
                const note = await response.json();
                setNodes((nds) =>
                    nds.map(n => n.id === tempId ? { ...n, id: note.id, data: { ...n.data, id: note.id } } : n)
                );
            } else {
                console.error('Failed to save sticky note');
                setNodes(nds => nds.filter(n => n.id !== tempId));
                setErrorToast('Failed to save sticky note');
            }
        } catch (error) {
            console.error('Error creating sticky note:', error);
            setNodes(nds => nds.filter(n => n.id !== tempId));
            setErrorToast('Error creating sticky note');
        }
    }, [nodes, setNodes, boardId, updateStickyNote, deleteStickyNote]);

    // Inject callbacks into nodes (especially for sticky notes)
    useEffect(() => {
        setNodes((nds) => nds.map((node) => {
            if (node.type === 'stickyNote') {
                // Check if callbacks are missing or stale (though memoized shouldn't be stale if deps correct)
                if (!node.data.onUpdate || !node.data.onDelete) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            onUpdate: updateStickyNote,
                            onDelete: deleteStickyNote,
                        }
                    };
                }
            }
            return node;
        }));
    }, [setNodes, updateStickyNote, deleteStickyNote]);

    // Inject onDelete callbacks into deletable edges loaded from database
    useEffect(() => {
        setEdges((eds) => eds.map(edge => {
            if (edge.type === 'deletable' && !edge.data?.onDelete) {
                return {
                    ...edge,
                    data: {
                        ...edge.data,
                        onDelete: deleteContextLink,
                    },
                };
            }
            return edge;
        }));
    }, [deleteContextLink, setEdges]);

    // Create an image context link - Defined BEFORE onConnect to avoid use-before-declaration
    const createImageContextLink = useCallback(async (imageNodeId: string, chatBlockId: string) => {
        try {
            const response = await fetch('/api/image-context-links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageNodeId, chatBlockId }),
            });

            if (!response.ok) {
                const error = await response.json();
                console.warn('Image context link creation blocked:', error.error);
                setErrorToast(error.error || 'Failed to create image context link');
                setTimeout(() => setErrorToast(null), 4000);
                // Remove optimistic edge on failure
                setEdges((eds) => eds.filter(e => e.id !== `image-context-${imageNodeId}-${chatBlockId}`));
                return;
            }

            // console.log('Image context link created:', imageNodeId, '→', chatBlockId);

            // Update target block hasImage state to true
            setNodes((nds) => nds.map((node) => {
                if (node.id === chatBlockId) {
                    return {
                        ...node,
                        data: { ...node.data, hasImage: true }
                    };
                }
                return node;
            }));

            // Persist check
            fetch(`/api/chat-blocks/${chatBlockId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hasImage: true }),
            }).catch(e => console.error('Failed to sync hasImage=true:', e));

        } catch (error) {
            console.warn('Image context link network error:', error);
            setErrorToast('Network error creating image context link');
            setTimeout(() => setErrorToast(null), 4000);
            setEdges((eds) => eds.filter(e => e.id !== `image-context-${imageNodeId}-${chatBlockId}`));
        }
    }, [setEdges, setNodes]);

    // Create a sticky context link
    const createStickyContextLink = useCallback(async (stickyNoteId: string, chatBlockId: string) => {
        try {
            const response = await fetch('/api/sticky-context-links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stickyNoteId, targetBlockId: chatBlockId }),
            });

            if (!response.ok) {
                const error = await response.json();
                console.warn('Sticky context link creation blocked:', error.error);
                setErrorToast(error.error || 'Failed to create sticky context link');
                setTimeout(() => setErrorToast(null), 4000);
                setEdges((eds) => eds.filter(e => e.id !== `sticky-context-${stickyNoteId}-${chatBlockId}`));
                return;
            }

            // console.log('Sticky context link created:', stickyNoteId, '→', chatBlockId);
        } catch (error) {
            console.warn('Sticky context link network error:', error);
            setErrorToast('Network error creating sticky context link');
            setTimeout(() => setErrorToast(null), 4000);
            setEdges((eds) => eds.filter(e => e.id !== `sticky-context-${stickyNoteId}-${chatBlockId}`));
        }
    }, [setEdges]);

    // Handle new connections (user dragging from one node to another)
    // With source-only handles and connectionMode="loose", any handle can connect to any handle
    const onConnect: OnConnect = useCallback((connection) => {
        const sourceNode = nodesRef.current.find(n => n.id === connection.source);
        const targetNode = nodesRef.current.find(n => n.id === connection.target);

        if (!sourceNode || !targetNode) return;

        // Prevent self-connections
        if (connection.source === connection.target) return;

        const sourceType = sourceNode.type;
        const targetType = targetNode.type;

        // Generate edge ID
        const edgeId = `e-${connection.source}-${connection.target}-${Date.now()}`;

        // Create edge with consistent styling
        const newEdge: Edge = {
            id: edgeId,
            source: connection.source!,
            target: connection.target!,
            sourceHandle: connection.sourceHandle,
            targetHandle: connection.targetHandle,
            type: 'deletable',
            animated: false,
            style: { stroke: '#A67B5B', strokeWidth: 2 },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#A67B5B',
            },
            data: {
                onDelete: deleteContextLink,
            },
        };

        setEdges((eds) => {
            // Remove any existing edge between these nodes (in either direction)
            const filtered = eds.filter(e =>
                !((e.source === connection.source && e.target === connection.target) ||
                    (e.source === connection.target && e.target === connection.source))
            );
            return addEdge(newEdge, filtered);
        });

        // Persist to database based on node types
        if (sourceType === 'chatBlock' && targetType === 'chatBlock') {
            createContextLink(connection.source!, connection.target!, connection.sourceHandle || undefined, connection.targetHandle || undefined);
        } else if (sourceType === 'stickyNote' && targetType === 'chatBlock') {
            createStickyContextLink(connection.source!, connection.target!);
        } else if (sourceType === 'imageNode' && targetType === 'chatBlock') {
            createImageContextLink(connection.source!, connection.target!);
        }
        // Other combinations are added visually but not persisted
    }, [setEdges, createContextLink, deleteContextLink, createImageContextLink, createStickyContextLink]);

    // Keyboard shortcut for new chat block (Ctrl+G)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+G or Cmd+G
            if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
                e.preventDefault();
                setPlacementMode('chat');
                // You might also want to show a toast or indicator
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);



    // Delete a block or node
    const deleteBlock = useCallback(async (blockId: string) => {
        // console.log('Attempting to delete block:', blockId);

        // Determine node type before removing from state
        const nodeToDelete = nodesRef.current.find(n => n.id === blockId);
        const nodeType = nodeToDelete?.type;

        // console.log('Proceeding with delete for block:', blockId, 'Type:', nodeType);

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
            let endpoint = '';
            if (nodeType === 'chatBlock') {
                endpoint = `/api/chat-blocks/${blockId}`;
            } else if (nodeType === 'imageNode') {
                endpoint = `/api/file-nodes/${blockId}`;
            } else if (nodeType === 'stickyNote') {
                endpoint = `/api/sticky-notes/${blockId}`;
            } else {
                console.warn('Unknown node type for deletion:', nodeType);
                return;
            }

            const response = await fetch(endpoint, { method: 'DELETE' });
            if (!response.ok) {
                console.error('Failed to delete node, status:', response.status);
            } else {
                // console.log('Node deleted from server:', blockId);
            }
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
                // console.log('[handleModelChange] Updating model for block:', blockId, 'Current hasImage:', node.data.hasImage);
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
        let needsDbFetch = false;

        setNodes((nds) => nds.map((node) => {
            if (node.id === blockId) {
                const currentData = node.data as any;

                if (!isExpanded) {
                    // Minimizing: Save current dimensions to data 
                    // and CLEAR style AND node dimensions to force re-measure

                    // Save mostly from style as that is what we manipulate
                    const widthToSave = node.style?.width || node.width;
                    const heightToSave = node.style?.height || node.height;

                    // console.log(`[Canvas] Minimizing block ${blockId}, saving dimensions:`, widthToSave, heightToSave);

                    const newData = {
                        ...node.data,
                        isExpanded: false,
                        expandedWidth: widthToSave,
                        expandedHeight: heightToSave,
                    };

                    return {
                        ...node,
                        width: undefined, // Force re-measure
                        height: undefined,
                        style: {
                            ...node.style,
                            width: undefined,
                            height: undefined
                        },
                        data: newData
                    };
                } else {
                    // Expanding: Restore dimensions from data if available
                    // console.log(`[Canvas] Expanding block ${blockId}, cached dimensions:`, currentData.expandedWidth, currentData.expandedHeight);

                    if (currentData.expandedWidth && currentData.expandedHeight) {
                        return {
                            ...node,
                            style: {
                                ...node.style,
                                width: currentData.expandedWidth,
                                height: currentData.expandedHeight,
                            },
                            data: { ...node.data, isExpanded: true }
                        };
                    }

                    // If no cached dimensions, mark for DB fetch
                    needsDbFetch = true;

                    return {
                        ...node,
                        style: {
                            ...node.style,
                            width: 800, // Reasonable default until DB fetch
                            height: 800
                        },
                        data: { ...node.data, isExpanded: true }
                    };
                }
            }
            return node;
        }));

        try {
            // Persist isExpanded state
            await fetch(`/api/chat-blocks/${blockId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isExpanded }),
            });

            // If expanding and we need authoritative dimensions from DB
            if (isExpanded && needsDbFetch) {
                const res = await fetch(`/api/chat-blocks/${blockId}`);
                if (res.ok) {
                    const blockData = await res.json();

                    setNodes((nds) => nds.map((node) => {
                        if (node.id === blockId && node.data.isExpanded) {
                            // Only update if we still don't have good dimensions (race condition check)
                            // or just force update to be safe
                            return {
                                ...node,
                                style: {
                                    ...node.style,
                                    width: blockData.width || 800,
                                    height: blockData.height || 800
                                },
                                data: {
                                    ...node.data,
                                    expandedWidth: blockData.width,
                                    expandedHeight: blockData.height
                                } as any
                            };
                        }
                        return node;
                    }));
                }
            }
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
        if (!sourceMessageId) {
            console.error('[Canvas] Cannot branch: sourceMessageId is missing');
            return;
        }


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

        // RECURSIVE CONTEXT:
        // We need to include the parent's branchContext (grandparent context) + the new history from this block
        let parentContextIds: string[] = [];
        if (parentNode && parentNode.data.branchContext) {
            if (Array.isArray(parentNode.data.branchContext)) {
                parentContextIds = parentNode.data.branchContext as string[];
            }
            // If it's a JSON string (legacy), parse it? 
            // The type definition says string[] | undefined mostly now in practice, but let's be safe later if needed.
            // For now assuming array of strings as per new schema usage.
        }

        const currentHistoryIds = history.map((m: any) => m.id).filter(Boolean);

        // Combine and deduplicate
        // Use Set to ensure no duplicates, though strictly appending should be fine in a tree
        const branchContextIds = Array.from(new Set([...parentContextIds, ...currentHistoryIds]));

        // Augment the new prompt with hidden context if we have a quote
        // This tells the AI what "this" refers to without showing it in the chat UI
        if (quoteText) {
            newPrompt.hiddenContext = `User highlighted: "${quoteText}" in the previous message.`;
        }



        // We still keep the prompt context for the AI, but for DB storage we use IDs
        // The API now expects branchContext to be the ID array

        // Check for images in context to set hasImage flag
        // If parent has image OR any message in the new context chain has logic markers
        const contextHasImages = contextMessages.some(m =>
            typeof m.content === 'string' && m.content.includes('[IMAGE:')
        );
        const parentHasImages = !!parentNode?.data.hasImage;
        const shouldHaveImage = contextHasImages || parentHasImages;

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
                    branchContext: branchContextIds,
                    sourceMessageId,
                    quoteStart,
                    quoteEnd,
                    quoteText,
                    model: 'openai/gpt-5.1', // Default to GPT-5.1 for branches
                    hasImage: shouldHaveImage
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
                // IMPORTANT: Use the messages returned from API because they have the real database IDs!
                const finalMessages = responseData.messages && responseData.messages.length > 0
                    ? responseData.messages.map((m: any) => ({
                        id: m.id,
                        role: m.role,
                        content: m.content
                    }))
                    : initialVisibleMessages;

                setBlockMessages((prev) => ({
                    ...prev,
                    [newBlock.id]: finalMessages
                }));

                // Update nodes: Add new block AND update source block links for immediate highlight
                setNodes((nds) => {
                    const updatedNodes = nds.map(node => {
                        if (node.id === parentBlockId) {
                            // IMMUTABLE UPDATE: Create copies of everything
                            const currentLinks = { ...((node.data.links as Record<string, MessageLink[]>) || {}) };
                            const msgLinks = [...(currentLinks[sourceMessageId] || [])];

                            // Update the specific message's links
                            currentLinks[sourceMessageId] = [...msgLinks, newLink];

                            return {
                                ...node,
                                data: {
                                    ...node.data,
                                    links: currentLinks
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
                        style: { width: 800, height: 800 },
                        data: {
                            id: newBlock.id,
                            boardId: boardId,
                            title: newBlock.title || 'New Branch',
                            messages: finalMessages,
                            branchContext: newBlock.branchContext,
                            model: newBlock.model || 'openai/gpt-5.1',
                            isExpanded: true,
                            hasImage: newBlock.hasImage || shouldHaveImage,
                        },
                    };

                    return updatedNodes.concat(newBlockNode);
                });

                // Add edge
                setEdges((eds) => addEdge({
                    id: `e-${parentBlockId}-${newBlock.id}`,
                    source: parentBlockId,
                    target: newBlock.id,
                    sourceHandle: 'bottom',
                    targetHandle: 'top',
                    type: 'deletable',
                    animated: false,
                    style: { stroke: '#A67B5B', strokeWidth: 2 },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: '#A67B5B',
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

    // Escape key to cancel placement mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && placementMode) {
                setPlacementMode(null);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [placementMode]);

    // Handle image upload completion
    const handleImageUploaded = useCallback((chatBlockId: string, imageInfo: { id: string; url: string; name: string, mimeType?: string }) => {
        // Robustness: if imageInfo is a string, it means arguments were mismatched
        if (typeof imageInfo === 'string') {
            console.error('[Canvas] handleImageUploaded called with string instead of object! This indicates a prop mismatch.', { chatBlockId, imageInfo });
            return;
        }

        // console.log(`[Canvas] Image uploaded for block ${chatBlockId}:`, imageInfo);

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
                    style: { width: 400, height: 350 },
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
        // console.log(`[Canvas] Line-by-Line: Entering persistence step for image ${imageInfo.id}`);
        // console.log(`[Canvas] Line-by-Line: Target PATCH URL: ${patchUrl}`);

        fetch(patchUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                positionX: imageX,
                positionY: imageY
            })
        }).then(async (res) => {
            // console.log(`[Canvas] Line-by-Line: PATCH response received. Status: ${res.status}`);
            if (res.ok) {
                // console.log('[Canvas] Line-by-Line: File node position updated successfully');

                // 2. Create File Link (Orbit)
                // console.log(`[Canvas] Line-by-Line: Creating file link for chatBlock: ${chatBlockId}`);
                const linkRes = await fetch('/api/file-links', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatBlockId,
                        fileNodeId: imageInfo.id
                    })
                });

                if (linkRes.ok) {
                    // console.log('[Canvas] Line-by-Line: File link saved');
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
            sourceHandle: 'bottom',
            targetHandle: 'top',
            type: 'deletable',
            animated: false,
            style: { stroke: '#A67B5B', strokeWidth: 2 },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#A67B5B',
            },
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
                    onCreateStickyNote: (content: string) => handleCreateStickyNote(node.id, content),
                },
            };
        });
    }, [nodes, maximizeBlock, deleteBlock, renameBlock, handleModelChange, handleBranch, handleLinkClick, handleExpandToggle, handleImageUploaded, handleHasImageChange, handleCreateStickyNote]);

    // Update node position on drag end
    const handleNodesChange = useCallback((changes: any) => {
        onNodesChange(changes);

        // Save position changes
        changes.forEach(async (change: any) => {
            if (change.type === 'position' && change.dragging === false && change.position) {
                // Use ref to avoid dependency cycle
                const node = nodesRef.current.find(n => n.id === change.id);
                if (!node) return;

                // Ignore temporary nodes (optimistic updates not yet saved to DB)
                if (change.id.startsWith('temp-')) return;

                let endpoint = '';
                if (node.type === 'chatBlock') {
                    endpoint = `/api/chat-blocks/${change.id}`;
                } else if (node.type === 'imageNode') {
                    endpoint = `/api/file-nodes/${change.id}`;
                } else if (node.type === 'stickyNote') {
                    endpoint = `/api/sticky-notes/${change.id}`;
                } else {
                    return;
                }

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
                        console.error('Failed to save node position');
                    }
                } catch (error) {
                    console.error('Error saving node position:', error);
                }
            }


        });
    }, [onNodesChange]); // Removed 'nodes' dependency


    // Handle modal close - refresh messages from cache
    const handleModalClose = () => {
        setSelectedBlock(null);
    };

    // Handle pane click for placement mode
    const handlePaneClick = useCallback(async (event: React.MouseEvent) => {
        if (!placementMode || !rfInstance) return;

        // Get the click position in flow coordinates
        const position = rfInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });

        if (placementMode === 'chat') {
            const clickX = position.x - 200;
            const clickY = position.y - 100;

            const tempId = `temp-${Date.now()}`;
            // Optimistic update
            setNodes((nds) => nds.concat({
                id: tempId,
                type: 'chatBlock',
                position: { x: clickX, y: clickY },
                style: { width: 800, height: 800 },
                data: {
                    id: tempId,
                    boardId: boardId,
                    title: 'New Chat',
                    model: 'openai/gpt-5.1',
                    messages: [],
                    links: initialLinksMap,
                    isExpanded: true,
                },
            }));

            // Create on server
            createBlock(clickX, clickY).then(newBlock => {
                if (newBlock) {
                    setNodes((nds) => nds.map(node => {
                        if (node.id === tempId) {
                            return {
                                ...node,
                                id: newBlock.id,
                                data: { ...node.data, id: newBlock.id },
                            };
                        }
                        return node;
                    }));
                }
            });
        } else if (placementMode === 'sticky') {
            const tempId = `temp-sticky-${Date.now()}`;
            const newNode: Node = {
                id: tempId,
                type: 'stickyNote',
                position: position,
                style: { width: 200, height: 200 },
                data: {
                    id: tempId,
                    content: '',
                    color: 'yellow',
                    onUpdate: updateStickyNote,
                    onDelete: deleteBlock, // Use unified delete handler
                },
            };
            setNodes((nds) => nds.concat(newNode));

            try {
                const response = await fetch('/api/sticky-notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        boardId,
                        positionX: position.x,
                        positionY: position.y,
                        content: '',
                        color: 'yellow',
                    }),
                });

                if (response.ok) {
                    const note = await response.json();
                    setNodes((nds) =>
                        nds.map(n => n.id === tempId ? { ...n, id: note.id, data: { ...n.data, id: note.id } } : n)
                    );
                } else {
                    console.error('Failed to save sticky note');
                    // Remove temp node on failure
                    setNodes(nds => nds.filter(n => n.id !== tempId));
                    setErrorToast('Failed to save sticky note');
                }
            } catch (error) {
                console.error('Error creating sticky note:', error);
                setNodes(nds => nds.filter(n => n.id !== tempId));
                setErrorToast('Error creating sticky note');
            }
        }

        // Exit placement mode
        setPlacementMode(null);
    }, [placementMode, rfInstance, createBlock, setNodes, boardId, initialLinksMap, updateStickyNote, deleteStickyNote]);

    // Track mouse position for paste
    const mousePosRef = useRef({ x: 0, y: 0 });
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Handle Image Paste
    const handleImagePaste = useCallback(async (file: File) => {
        if (!rfInstance || !boardId) return;

        // Use current mouse position converted to flow coords
        const position = rfInstance.screenToFlowPosition({
            x: mousePosRef.current.x,
            y: mousePosRef.current.y
        });

        // 1. Upload image and create DB record
        const formData = new FormData();
        formData.append('file', file);
        formData.append('boardId', boardId);
        formData.append('positionX', position.x.toString());
        formData.append('positionY', position.y.toString());

        try {
            // Optimistic update - show immediately
            const tempId = `temp-img-${Date.now()}`;
            const previewUrl = URL.createObjectURL(file);

            const newNode: Node = {
                id: tempId,
                type: 'imageNode',
                position: position,
                style: { width: 300, height: 'auto' }, // Default size
                data: {
                    id: tempId,
                    name: file.name,
                    url: previewUrl,
                    mimeType: file.type,
                    // Add handlers immediately so it works
                    onDelete: (id: string) => {
                        setNodes(nds => nds.filter(n => n.id !== id));
                    }
                },
            };
            setNodes(nds => nds.concat(newNode));

            const response = await fetch('/api/images', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();

                // Replace temp node with real node
                setNodes(nds => nds.map(n => {
                    if (n.id === tempId) {
                        return {
                            ...n,
                            id: data.id,
                            data: {
                                ...n.data,
                                id: data.id,
                                url: data.url, // Use real URL from storage
                                name: data.name,
                                mimeType: data.mimeType,
                            }
                        };
                    }
                    return n;
                }));
            } else {
                console.error('Failed to upload pasted image');
                // Remove temp node on failure
                setNodes(nds => nds.filter(n => n.id !== tempId));
                setErrorToast('Failed to upload image');
                setTimeout(() => setErrorToast(null), 3000);
            }
        } catch (error) {
            console.error('Error pasting image:', error);
            setErrorToast('Error pasting image');
            setTimeout(() => setErrorToast(null), 3000);
        }
    }, [rfInstance, boardId, setNodes]);

    // Global Paste Listener
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            // Check if we are pasting into an input/textarea - if so, ignore
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
                return;
            }

            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                    const file = items[i].getAsFile();
                    if (file) {
                        e.preventDefault(); // Prevent default browser paste
                        handleImagePaste(file);
                        return; // Handle one image at a time for now
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste as any);
        return () => window.removeEventListener('paste', handlePaste as any);
    }, [handleImagePaste]);

    return (
        <div className={`react-flow-canvas ${placementMode ? 'placement-mode' : ''}`}>
            <ReactFlow
                nodes={nodesWithCallbacks}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionMode={ConnectionMode.Loose}
                connectionRadius={60}
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
                onPaneClick={handlePaneClick}
                style={placementMode ? { cursor: 'crosshair' } : undefined}
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

            {/* Error Toast */}
            {errorToast && (
                <div className="error-toast" onClick={() => setErrorToast(null)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    <span>{errorToast}</span>
                </div>
            )}

            {/* Placement Mode Instruction */}
            {placementMode && (
                <div className="placement-instruction">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span>Click anywhere to place chat block</span>
                    <span className="placement-hint">Press ESC to cancel</span>
                </div>
            )}

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
                                setPlacementMode('chat');
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
                                                    style: { width: 400, height: 350 },
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
                        <button
                            className="add-dropdown-item"
                            onClick={() => {
                                setShowAddMenu(false);
                                setPlacementMode('sticky');
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <line x1="10" y1="9" x2="8" y2="9" />
                            </svg>
                            <span>Sticky Note</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
