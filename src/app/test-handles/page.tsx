'use client';

import { useCallback } from 'react';
import {
    ReactFlow,
    Handle,
    Position,
    useNodesState,
    useEdgesState,
    addEdge,
    Background,
    Controls,
    ConnectionMode,
    MarkerType,
    type OnConnect,
    type Node,
    type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Custom node with ONLY source handles at each position
// In loose mode, source can connect to source
function CustomNode({ data }: { data: { label: string } }) {
    return (
        <div style={{
            background: '#1a1a2e',
            border: '2px solid #A67B5B',
            borderRadius: '8px',
            padding: '20px',
            color: 'white',
            minWidth: '150px',
            textAlign: 'center',
        }}>
            {/* Only source handles - no target handles */}
            <Handle type="source" position={Position.Top} id="top" style={{ background: '#A67B5B' }} />
            <Handle type="source" position={Position.Right} id="right" style={{ top: '50%', background: '#A67B5B' }} />
            <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: '#A67B5B' }} />
            <Handle type="source" position={Position.Left} id="left" style={{ top: '50%', background: '#A67B5B' }} />

            <div>{data.label}</div>
        </div>
    );
}

const nodeTypes = { custom: CustomNode };

const initialNodes: Node[] = [
    { id: 'A', type: 'custom', position: { x: 100, y: 200 }, data: { label: 'Node A' } },
    { id: 'B', type: 'custom', position: { x: 400, y: 200 }, data: { label: 'Node B' } },
];

const initialEdges: Edge[] = [];

export default function TestHandlesPage() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const onConnect: OnConnect = useCallback((connection) => {
        console.log('Connection:', connection);

        // With only source handles in loose mode, connection.source is where we dragged FROM
        // and connection.target is where we dropped ON
        const newEdge: Edge = {
            id: `e-${connection.source}-${connection.target}-${Date.now()}`,
            source: connection.source!,
            target: connection.target!,
            sourceHandle: connection.sourceHandle,
            targetHandle: connection.targetHandle,
            type: 'smoothstep',
            style: { stroke: '#A67B5B', strokeWidth: 2 },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#A67B5B',
            },
        };
        setEdges((eds) => addEdge(newEdge, eds));
    }, [setEdges]);

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                connectionMode={ConnectionMode.Loose}
                fitView
            >
                <Background />
                <Controls />

                <div style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    background: 'rgba(0,0,0,0.8)',
                    color: 'white',
                    padding: '15px',
                    borderRadius: '8px',
                    zIndex: 100,
                    maxWidth: '300px',
                }}>
                    <h3 style={{ marginBottom: '10px' }}>Source-Only Handles Test</h3>
                    <ul style={{ marginLeft: '20px' }}>
                        <li>Only SOURCE handles at each position</li>
                        <li>connectionMode="loose" allows source-to-source</li>
                        <li>Try connecting A.right to B.left</li>
                    </ul>
                    <p style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
                        Check console for connection logs
                    </p>
                </div>
            </ReactFlow>
        </div>
    );
}
