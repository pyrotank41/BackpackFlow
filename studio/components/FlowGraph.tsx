"use client";

import React, { useEffect, useState } from "react";
import {
    ReactFlow,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    ConnectionLineType,
    BackgroundVariant,
    Node,
    useReactFlow,
    ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { transformToReactFlow } from "../lib/flow-graph";
import { useTheme } from "./theme-provider";
import StudioNode from "./StudioNode";

interface FlowGraphProps {
    agentId: string;
    onNodeSelect?: (nodeId: string, nodeData: any) => void;
    activeNodeIds?: string[];
}

function FlowGraphInternal({ agentId, onNodeSelect, activeNodeIds = [] }: FlowGraphProps) {
    const { screenToFlowPosition } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nodeMetadata, setNodeMetadata] = useState<Record<string, any>>({});
    const { theme } = useTheme();
    const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
        "dark"
    );

    const nodeTypes = React.useMemo(() => ({ studioNode: StudioNode }), []);

    // Apply active node highlighting
    useEffect(() => {
        setNodes((nds) =>
            nds.map((node) => {
                const isActive = activeNodeIds.includes(node.id);
                // We simplify the logic here: just update data.isActive using immutable pattern
                // The StudioNode component handles the actual visual changes (border, shadow, spinner)
                if (node.data?.isActive === isActive) {
                    return node; // No change
                }

                return {
                    ...node,
                    zIndex: isActive ? 10 : 1, // Bring active nodes to front
                    data: {
                        ...node.data,
                        isActive,
                    },
                };
            })
        );
    }, [activeNodeIds, setNodes]);

    // Resolve system theme to actual theme
    useEffect(() => {
        if (theme === "system") {
            const systemTheme = window.matchMedia(
                "(prefers-color-scheme: dark)"
            ).matches
                ? "dark"
                : "light";
            setResolvedTheme(systemTheme);

            // Listen for system theme changes
            const mediaQuery = window.matchMedia(
                "(prefers-color-scheme: dark)"
            );
            const handler = (e: MediaQueryListEvent) => {
                setResolvedTheme(e.matches ? "dark" : "light");
            };
            mediaQuery.addEventListener("change", handler);
            return () => mediaQuery.removeEventListener("change", handler);
        } else {
            setResolvedTheme(theme as "light" | "dark");
        }
    }, [theme]);

    useEffect(() => {
        async function fetchGraph() {
            setLoading(true);
            setError(null);
            try {
                // Fetch graph data
                const graphResponse = await fetch(`/api/agents/${agentId}/graph`);
                const graphData = await graphResponse.json();

                if (!graphData.success || !graphData.graph) {
                    setError(graphData.error || "Failed to load graph");
                    return;
                }

                let config = graphData.graph;

                // Unwrap internal flow if needed
                if (
                    config.nodes.length === 1 &&
                    config.nodes[0].internalFlow
                ) {
                    config = config.nodes[0].internalFlow;
                }

                // Fetch node metadata for all node types in the graph
                const nodeTypes = Array.from(new Set<string>(config.nodes.map((n: any) => n.type)));
                const metadataPromises = nodeTypes.map(async (type: string) => {
                    try {
                        const res = await fetch(`/api/nodes/${type}`);
                        if (res.ok) {
                            const metadata = await res.json();
                            return [type, metadata];
                        }
                    } catch (err) {
                        console.warn(`Failed to fetch metadata for ${type}:`, err);
                    }
                    return [type, null];
                });

                const metadataEntries = await Promise.all(metadataPromises);
                const metadata = Object.fromEntries(metadataEntries.filter(([, m]) => m !== null));
                setNodeMetadata(metadata);

                // Transform to React Flow format with metadata
                const { nodes: flowNodes, edges: flowEdges } =
                    transformToReactFlow(config, graphData.metadata, metadata);
                
                const nodesWithCustomType = flowNodes.map((node: any) => {
                    // Apply StudioNode to any functional node (detected by having a nodeType in its data)
                    if (node.data?.nodeType) {
                        return {
                            ...node,
                            type: 'studioNode',
                            data: {
                                ...node.data,
                                originalStyle: { ...node.style }
                            }
                        };
                    }
                    return node;
                });

                setNodes(nodesWithCustomType as Node[]);
                setEdges(flowEdges as any);

                // Small delay to ensure React Flow has measured nodes before fitView
                setTimeout(() => {
                    screenToFlowPosition({ x: 0, y: 0 }); // Just to use a hook to ensure it's available
                    // We'll actually use the hook in a separate effect for better react flow integration
                }, 100);

            } catch (err) {
                console.error("Failed to fetch agent graph:", err);
                setError("Failed to fetch graph from API");
            } finally {
                setLoading(false);
            }
        }

        if (agentId) {
            fetchGraph();
        }
    }, [agentId, setNodes, setEdges]);

    const { fitView } = useReactFlow();

    // Explicit fitView when loading finishes and nodes are present
    useEffect(() => {
        if (!loading && nodes.length > 0) {
            // Immediate fit
            fitView({ padding: 0.2, duration: 400 });
            
            // Delayed retry to catch any race conditions with sidebar transitions
            const timer = setTimeout(() => {
                fitView({ padding: 0.2, duration: 400 });
            }, 500);
            
            return () => clearTimeout(timer);
        }
    }, [loading, nodes.length, fitView]);

    // Handle node click
    const handleNodeClick = React.useCallback((_event: React.MouseEvent, node: any) => {
        if (onNodeSelect && node.data.nodeType) {
            const metadata = nodeMetadata[node.data.nodeType];
            onNodeSelect(node.id, {
                ...node.data,
                metadata
            });
        }
    }, [onNodeSelect, nodeMetadata]);

    const onDragOver = React.useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);

    // NEW: Smart Parent/Child Drag Logic
    const onNodeDragStop = React.useCallback(
        (_: any, node: Node) => {
            const container = nodes.find((n) => n.id === "agent-container");
            if (!container || node.id === "agent-container") return;

            const cw = (container as any).measured?.width || 600;
            const ch = (container as any).measured?.height || 300;
            const cx = container.position.x;
            const cy = container.position.y;

            // Get absolute position of the node
            // If it's currently a child, its .position is already relative
            const absolutePos = node.parentId 
                ? { x: node.position.x + cx, y: node.position.y + cy }
                : node.position;

            const isInside = 
                absolutePos.x >= cx &&
                absolutePos.x <= cx + cw &&
                absolutePos.y >= cy &&
                absolutePos.y <= cy + ch;

            if (isInside && node.parentId !== "agent-container") {
                // Dragged INTO container
                setNodes((nds) =>
                    nds.map((n) =>
                        n.id === node.id
                            ? {
                                  ...n,
                                  parentId: "agent-container",
                                  extent: "parent",
                                  position: {
                                      x: absolutePos.x - cx,
                                      y: absolutePos.y - cy,
                                  },
                              }
                            : n
                    )
                );
            } else if (!isInside && node.parentId === "agent-container") {
                // Dragged OUT of container
                setNodes((nds) =>
                    nds.map((n) =>
                        n.id === node.id
                            ? {
                                  ...n,
                                  parentId: undefined,
                                  extent: undefined,
                                  position: absolutePos,
                              }
                            : n
                    )
                );
            }
        },
        [nodes, setNodes]
    );

    const onDrop = React.useCallback(
        async (event: React.DragEvent) => {
            event.preventDefault();
            const type = event.dataTransfer.getData("application/reactflow");
            if (!type) return;

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            // Fetch metadata if missing
            let metadata = nodeMetadata[type];
            if (!metadata) {
                try {
                    const res = await fetch(`/api/nodes/${type}`);
                    if (res.ok) {
                        metadata = await res.json();
                        setNodeMetadata(prev => ({ ...prev, [type]: metadata }));
                    }
                } catch (err) {
                    console.warn(`Failed to fetch metadata for ${type}:`, err);
                }
            }

            // SMART DROP LOGIC: Check if dropped inside agent container
            const container = nodes.find(n => n.id === 'agent-container');
            let parentId = undefined;
            let finalPosition = position;

            if (container) {
                // Approximate bounding box (width/height usually 400x600 for containers)
                // If measured width is available, use it.
                const cw = (container as any).measured?.width || 400;
                const ch = (container as any).measured?.height || 600;
                const cx = container.position.x;
                const cy = container.position.y;

                if (
                    position.x >= cx && 
                    position.x <= cx + cw && 
                    position.y >= cy && 
                    position.y <= cy + ch
                ) {
                    parentId = 'agent-container';
                    // Position must be relative to parent
                    finalPosition = {
                        x: position.x - cx,
                        y: position.y - cy
                    };
                }
            }

            const newNode: Node = {
                id: `${type}-${Date.now()}`,
                type: "studioNode",
                position: finalPosition,
                parentId,
                extent: parentId ? 'parent' : undefined,
                data: {
                    label: metadata?.displayName || type,
                    nodeType: type,
                    isActive: false,
                },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [screenToFlowPosition, nodeMetadata, setNodes, nodes]
    );

    if (loading) {
        return (
            <div className="h-full w-full bg-background flex items-center justify-center">
                <div className="text-muted-foreground animate-pulse text-xs font-black uppercase tracking-widest">
                    Initializing Flow...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full w-full bg-background flex items-center justify-center p-4 text-center">
                <div className="text-destructive text-sm font-bold">
                    ❌ {error}
                </div>
            </div>
        );
    }



    return (
        <div className="h-full w-full overflow-hidden relative">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onNodeDragStop={onNodeDragStop}
                connectionLineType={ConnectionLineType.Bezier}
                fitView
                colorMode={resolvedTheme}
            >
                <Background
                    color="rgba(156, 163, 175, 0.25)"
                    gap={25}
                    size={2}
                    variant={BackgroundVariant.Dots}
                />
                <Controls className="bg-background border-border text-foreground fill-foreground" />
            </ReactFlow>


        </div>
    );
}

export default function FlowGraph(props: FlowGraphProps) {
    return (
        <ReactFlowProvider>
            <FlowGraphInternal {...props} />
        </ReactFlowProvider>
    );
}
