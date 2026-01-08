/**
 * Flow Graph Utilities
 * 
 * Transforms BackpackFlow exported JSON into React Flow format.
 */

import { Node, Edge, MarkerType, Position } from '@xyflow/react';

export interface ReactFlowGraph {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Transform BackpackFlow config to React Flow format (Horizontal Layout)
 */
export function transformToReactFlow(config: any, metadata?: any, nodeMetadata?: Record<string, any>): ReactFlowGraph {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const chatTrigger = metadata?.triggers?.find((t: any) => t.type === 'chat');
  const chatOutput = metadata?.outputs?.chat;

  // HORIZONTAL FLOW: Input on Left, Output on Right
  const sourcePosition = Position.Right;
  const targetPosition = Position.Left;

  // 1. Add Entry Node (Trigger)
  const entryNodeId = 'trigger-node';
  nodes.push({
    id: entryNodeId,
    type: 'input',
    data: { label: chatTrigger ? `${chatTrigger.inputKey}` : 'User Input' },
    position: { x: 0, y: 150 },
    sourcePosition,
    targetPosition,
    style: { 
      background: 'var(--background)', 
      color: 'var(--foreground)', 
      border: '1px solid var(--border)', 
      borderRadius: '30px', 
      width: 100, 
      fontSize: '10px', 
      fontWeight: 'bold',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
    }
  });

  // 2. Add Parent Container for the main agent
  const containerX = 180;
  const nodeSpacing = 140;
  const containerWidth = (config.nodes.length * nodeSpacing) + 100;
  
  nodes.push({
    id: 'agent-container',
    data: { label: `${config.namespace}` },
    position: { x: containerX, y: 50 },
    style: { 
      width: containerWidth, 
      height: 300,
      borderRadius: '24px',
      paddingLeft: '30px',
      color: 'var(--muted-foreground)',
      fontSize: '10px',
      fontWeight: 'bold',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      pointerEvents: 'none', 
      border: '1px dashed var(--border)',
      backgroundColor: 'transparent'
    },
  });

  // 3. Map nodes
  config.nodes.forEach((node: any, index: number) => {
    const nodeMeta = nodeMetadata?.[node.type];
    
    nodes.push({
      id: node.id,
      parentId: 'agent-container',
      data: { 
        label: nodeMeta?.displayName || node.id,
        nodeType: node.type,
        nodeParams: node.params
      },
      position: { x: 40 + (index * nodeSpacing), y: 100 },
      extent: 'parent',
      sourcePosition,
      targetPosition,
    });
  });

  // 4. Map internal edges
  config.edges.forEach((edge: any, index: number) => {
    // Hide "complete" labels as they represent the default happy path
    const shouldShowLabel = edge.condition && 
                           edge.condition !== 'default' && 
                           edge.condition.toLowerCase() !== 'complete';
    
    edges.push({
      id: `e-${edge.from}-${edge.to}-${index}`,
      source: edge.from,
      target: edge.to,
      label: shouldShowLabel ? edge.condition : undefined,
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'var(--primary)',
        width: 15,
        height: 15,
      },
      style: { 
        stroke: 'var(--primary)', 
        strokeWidth: 2,
        opacity: 0.6
      },
    });
  });

  // 5. Connect Trigger to first node
  if (config.entryNodeId) {
    edges.push({
      id: 'e-trigger-entry',
      source: entryNodeId,
      target: config.entryNodeId,
      animated: true,
      style: { strokeDasharray: '5,5', stroke: 'var(--border)' }
    });
  }

  // 6. Add Exit Node (Output)
  const exitX = containerX + containerWidth + 60;
  const exitNodeId = 'output-node';
  
  nodes.push({
    id: exitNodeId,
    type: 'output',
    data: { label: chatOutput ? `${chatOutput.outputKey}` : 'Agent Response' },
    position: { x: exitX, y: 150 },
    sourcePosition,
    targetPosition,
    style: { 
        background: 'var(--background)', 
        color: 'var(--foreground)', 
        border: '1px solid var(--border)', 
        borderRadius: '30px', 
        width: 100, 
        fontSize: '10px', 
        fontWeight: 'bold',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
    }
  });

  // 7. Connect last node to Output
  const sourceNodeIds = new Set(config.edges.map((e: any) => e.from));
  const leafNodes = config.nodes.filter((n: any) => !sourceNodeIds.has(n.id));

  leafNodes.forEach((node: any, idx: number) => {
    edges.push({
      id: `e-${node.id}-output-${idx}`,
      source: node.id,
      target: exitNodeId,
      animated: true,
      style: { strokeDasharray: '5,5', stroke: 'var(--border)' }
    });
  });

  return { nodes, edges };
}
