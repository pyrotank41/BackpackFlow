/**
 * FlowVisualizer - Reusable hierarchical flow visualization
 * 
 * Subscribe to EventStreamer to display nested flow execution in real-time.
 * 
 * Usage:
 * ```typescript
 * const visualizer = new FlowVisualizer(eventStreamer);
 * await flow.run();
 * // Nested execution automatically displayed!
 * ```
 */

import { EventStreamer, StreamEventType, BackpackEvent } from '../events';

export interface FlowVisualizerOptions {
    showTimestamps?: boolean;
    showPrepComplete?: boolean;
    showBackpackPacks?: boolean;
    colorize?: boolean;
}

export class FlowVisualizer {
    private startTime: number;
    private nodeStack: Array<{ name: string, startTime: number, namespace: string }> = [];
    private options: Required<FlowVisualizerOptions>;
    
    constructor(
        private eventStreamer: EventStreamer,
        options: FlowVisualizerOptions = {}
    ) {
        this.options = {
            showTimestamps: options.showTimestamps ?? true,
            showPrepComplete: options.showPrepComplete ?? true,
            showBackpackPacks: options.showBackpackPacks ?? true,
            colorize: options.colorize ?? false
        };
        
        this.startTime = Date.now();
        this.setupEventHandlers();
    }
    
    /**
     * Start visualizing - call this before running the flow
     */
    start(): void {
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`🎬 EXECUTION TIMELINE`);
        console.log(`${'─'.repeat(80)}\n`);
    }
    
    /**
     * End visualization - call this after flow completes
     */
    end(): void {
        // Close any remaining open nodes
        while (this.nodeStack.length > 0) {
            const node = this.nodeStack.pop()!;
            const elapsed = this.getElapsed();
            const indent = this.getIndent(node.namespace);
            const nodeDuration = ((Date.now() - node.startTime) / 1000).toFixed(2);
            console.log(`${indent}└─ [${elapsed}s] ✓ Complete (${nodeDuration}s total)\n`);
        }
        
        console.log(`${'─'.repeat(80)}`);
        console.log(`✅ Flow Complete!`);
        console.log(`${'─'.repeat(80)}\n`);
    }
    
    /**
     * Setup event handlers for visualization
     */
    private setupEventHandlers(): void {
        this.eventStreamer.on('*', (event: BackpackEvent) => {
            const elapsed = this.getElapsed();
            const namespace = event.namespace || '';
            const namespaceDepth = namespace.split('.').length;
            const indent = this.getIndent(namespace);
            
            switch (event.type) {
                case StreamEventType.NODE_START:
                    this.handleNodeStart(event, elapsed, namespace, namespaceDepth, indent);
                    break;
                    
                case StreamEventType.PREP_COMPLETE:
                    if (this.options.showPrepComplete) {
                        console.log(`${indent}│  [${elapsed}s] ✓ Preparation phase complete`);
                    }
                    break;
                    
                case StreamEventType.EXEC_COMPLETE:
                    const duration = event.payload.durationMs;
                    console.log(`${indent}│  [${elapsed}s] ⚡ Execution complete (${duration}ms)`);
                    break;
                    
                case StreamEventType.NODE_END:
                    this.handleNodeEnd(event, elapsed, namespace, indent);
                    break;
                    
                case StreamEventType.ERROR:
                    this.handleError(event, elapsed, namespace, indent);
                    break;
                    
                case StreamEventType.BACKPACK_PACK:
                    if (this.options.showBackpackPacks) {
                        const key = event.payload.key;
                        console.log(`${indent}│  [${elapsed}s] 💾 Packed '${key}'`);
                    }
                    break;
            }
        });
    }
    
    /**
     * Handle NODE_START event
     */
    private handleNodeStart(
        event: BackpackEvent,
        elapsed: string,
        namespace: string,
        namespaceDepth: number,
        indent: string
    ): void {
        // Close previous sibling nodes at same level
        while (this.nodeStack.length > 0) {
            const top = this.nodeStack[this.nodeStack.length - 1];
            const topDepth = top.namespace.split('.').length;
            
            // If top is at same level or deeper, and not a parent of current
            if (topDepth >= namespaceDepth && !namespace.startsWith(top.namespace + '.')) {
                const closingNode = this.nodeStack.pop()!;
                const closingIndent = this.getIndent(closingNode.namespace);
                const nodeDuration = ((Date.now() - closingNode.startTime) / 1000).toFixed(2);
                console.log(`${closingIndent}└─ [${elapsed}s] ✓ Complete (${nodeDuration}s total)\n`);
            } else {
                break;
            }
        }
        
        // Start new node with proper indentation
        this.nodeStack.push({ name: event.sourceNode, startTime: Date.now(), namespace });
        
        const padding = '─'.repeat(Math.max(0, 60 - indent.length - event.sourceNode.length));
        console.log(`${indent}┌─ ${event.sourceNode} ${padding}`);
        console.log(`${indent}│  [${elapsed}s] 🚀 Starting...`);
    }
    
    /**
     * Handle NODE_END event
     */
    private handleNodeEnd(
        event: BackpackEvent,
        elapsed: string,
        namespace: string,
        indent: string
    ): void {
        // Find the matching node in the stack
        const nodeIndex = this.nodeStack.findIndex(n => n.namespace === namespace);
        if (nodeIndex !== -1) {
            // Close all children first
            while (this.nodeStack.length > nodeIndex + 1) {
                const childNode = this.nodeStack.pop()!;
                const childIndent = this.getIndent(childNode.namespace);
                const childDuration = ((Date.now() - childNode.startTime) / 1000).toFixed(2);
                console.log(`${childIndent}└─ [${elapsed}s] ✓ Complete (${childDuration}s total)\n`);
            }
            
            // Now close this node
            const node = this.nodeStack.pop()!;
            const nodeDuration = ((Date.now() - node.startTime) / 1000).toFixed(2);
            const action = event.payload.action;
            console.log(`${indent}│  [${elapsed}s] → Next: ${action}`);
            console.log(`${indent}└─ [${elapsed}s] ✓ Complete (${nodeDuration}s total)\n`);
        }
    }
    
    /**
     * Handle ERROR event
     */
    private handleError(
        event: BackpackEvent,
        elapsed: string,
        namespace: string,
        indent: string
    ): void {
        console.log(`${indent}│  [${elapsed}s] ❌ Error: ${event.payload.error}`);
        const errorNodeIndex = this.nodeStack.findIndex(n => n.namespace === namespace);
        if (errorNodeIndex !== -1) {
            console.log(`${indent}└─ [${elapsed}s] ✗ Failed\n`);
            this.nodeStack.splice(errorNodeIndex, 1);
        }
    }
    
    /**
     * Get elapsed time since start
     */
    private getElapsed(): string {
        return ((Date.now() - this.startTime) / 1000).toFixed(2);
    }
    
    /**
     * Get indent string based on namespace
     */
    private getIndent(namespace: string): string {
        // Count how many open parents this namespace has
        const openParentsCount = this.nodeStack.filter(n => 
            namespace.startsWith(n.namespace + '.') && n.namespace !== namespace
        ).length;
        return '│  '.repeat(openParentsCount);
    }
}

