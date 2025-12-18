/**
 * BackpackNode - Base class for nodes in BackpackFlow v2.0
 * 
 * Extends PocketFlow's BaseNode with:
 * - Automatic namespace composition (assigned by Flow)
 * - Backpack integration for state management
 * - Access control support
 * - Event streaming hooks
 * 
 * Design Pattern: Graph-Assigned Namespaces
 * - Nodes define their segment (identity)
 * - Flow composes full namespace path (context)
 * 
 * Based on TECH-SPEC-001 §4: BackpackNode Class
 */

import { BaseNode } from '../pocketflow';
import { Backpack } from '../storage/backpack';
import { PackOptions } from '../storage/types';

/**
 * Context passed to BackpackNode during instantiation
 */
export interface NodeContext {
    namespace: string;        // Full namespace path (e.g., "sales.researchAgent.chat")
    backpack: Backpack;       // Shared Backpack instance
    eventStreamer?: any;      // Optional event streamer (Phase 6)
}

/**
 * Node configuration (minimal, extended by specific node types)
 */
export interface NodeConfig {
    id: string;               // Unique node ID in the flow
    [key: string]: any;       // Node-specific config
}

/**
 * BackpackNode - Base class for all v2.0 nodes
 * 
 * Usage:
 * ```typescript
 * class ChatNode extends BackpackNode {
 *     static namespaceSegment = "chat";
 *     
 *     async exec(input: any) {
 *         const query = this.backpack.unpack('userQuery', this.id);
 *         const response = await callLLM(query);
 *         this.backpack.pack('chatResponse', response);
 *         return response;
 *     }
 * }
 * ```
 */
export class BackpackNode<S = any> extends BaseNode<S> {
    /**
     * Namespace segment for this node type
     * 
     * Defined by node class (e.g., "chat", "search", "summary")
     * Flow will compose it into full path (e.g., "sales.chat")
     * 
     * If not defined, falls back to node ID
     */
    static namespaceSegment?: string;
    
    /**
     * Node ID (unique within the flow)
     */
    public readonly id: string;
    
    /**
     * Full namespace path assigned by Flow
     * 
     * Example: "sales.researchAgent.chat"
     */
    public readonly namespace: string;
    
    /**
     * Shared Backpack instance
     */
    protected readonly backpack: Backpack;
    
    /**
     * Event streamer for telemetry (Phase 6)
     */
    protected readonly eventStreamer?: any;
    
    /**
     * Constructor - called by Flow during node instantiation
     * 
     * @param config - Node configuration (id + node-specific options)
     * @param context - Execution context (namespace + backpack)
     */
    constructor(config: NodeConfig, context: NodeContext) {
        super();
        
        this.id = config.id;
        this.namespace = context.namespace;
        this.backpack = context.backpack;
        this.eventStreamer = context.eventStreamer;
    }
    
    /**
     * Override _run to inject Backpack metadata and emit lifecycle events
     * 
     * This ensures all pack() calls include:
     * - nodeId
     * - nodeName
     * - namespace
     * 
     * And emits telemetry events at each lifecycle phase (PRD-002)
     */
    async _run(shared: S): Promise<string | undefined> {
        const startTime = Date.now();
        const backpackReads: string[] = [];
        const backpackWrites: string[] = [];
        
        // Store original methods
        const originalPack = this.backpack.pack.bind(this.backpack);
        const originalUnpack = this.backpack.unpack.bind(this.backpack);
        const originalUnpackRequired = this.backpack.unpackRequired.bind(this.backpack);
        
        // Create wrapper for pack() that tracks writes
        const wrappedPack = (key: string, value: any, options?: PackOptions): void => {
            backpackWrites.push(key);
            return originalPack(key, value, {
                ...options,
                nodeId: options?.nodeId || this.id,
                nodeName: options?.nodeName || this.constructor.name,
                namespace: options?.namespace || this.namespace
            });
        };
        
        // Create wrapper for unpack() that tracks reads
        const wrappedUnpack = <V = any>(key: string, nodeId?: string): V | undefined => {
            backpackReads.push(key);
            return originalUnpack<V>(key, nodeId || this.id);
        };
        
        // Create wrapper for unpackRequired() that tracks reads
        const wrappedUnpackRequired = <V = any>(key: string, nodeId?: string): V => {
            backpackReads.push(key);
            return originalUnpackRequired<V>(key, nodeId || this.id);
        };
        
        // Temporarily replace methods
        // @ts-ignore - intentional method replacement
        this.backpack.pack = wrappedPack;
        // @ts-ignore
        this.backpack.unpack = wrappedUnpack;
        // @ts-ignore
        this.backpack.unpackRequired = wrappedUnpackRequired;
        
        try {
            // PRD-002: Emit NODE_START event
            this.emitNodeStart(shared);
            
            // Run prep phase
            const prepStartTime = Date.now();
            const prepResult = await this.prep(shared);
            
            // PRD-002: Emit PREP_COMPLETE event
            this.emitPrepComplete(prepResult, [...backpackReads]); // Copy reads up to this point
            
            // Run exec phase
            const execStartTime = Date.now();
            const execResult = await this._exec(prepResult);
            const execDuration = Date.now() - execStartTime;
            
            // PRD-002: Emit EXEC_COMPLETE event
            this.emitExecComplete(execResult, execDuration);
            
            // Run post phase
            const action = await this.post(shared, prepResult, execResult);
            const totalDuration = Date.now() - startTime;
            
            // PRD-002: Emit NODE_END event
            this.emitNodeEnd(action, backpackWrites, totalDuration);
            
            return action;
            
        } catch (error) {
            // PRD-002: Emit ERROR event
            const phase = this.determineErrorPhase(error);
            this.emitError(error as Error, phase);
            throw error;
            
        } finally {
            // Restore original methods
            // @ts-ignore
            this.backpack.pack = originalPack;
            // @ts-ignore
            this.backpack.unpack = originalUnpack;
            // @ts-ignore
            this.backpack.unpackRequired = originalUnpackRequired;
        }
    }
    
    // ===== EVENT EMISSION HELPERS (PRD-002) =====
    
    /**
     * Emit NODE_START event
     */
    private emitNodeStart(shared: S): void {
        if (!this.eventStreamer) return;
        
        try {
            const { StreamEventType } = require('../events/types');
            
            this.eventStreamer.emit(
                StreamEventType.NODE_START,
                {
                    nodeName: this.constructor.name,
                    nodeId: this.id,
                    namespace: this.namespace,
                    params: {}, // Could include node config here
                    backpackSnapshot: this.getBackpackSnapshot()
                },
                {
                    sourceNode: this.constructor.name,
                    nodeId: this.id,
                    namespace: this.namespace,
                    runId: (this.backpack as any).runId
                }
            );
        } catch (error) {
            console.warn('Failed to emit NODE_START event:', error);
        }
    }
    
    /**
     * Emit PREP_COMPLETE event
     */
    private emitPrepComplete(prepResult: unknown, backpackReads: string[]): void {
        if (!this.eventStreamer) return;
        
        try {
            const { StreamEventType } = require('../events/types');
            
            this.eventStreamer.emit(
                StreamEventType.PREP_COMPLETE,
                {
                    prepResult,
                    backpackReads
                },
                {
                    sourceNode: this.constructor.name,
                    nodeId: this.id,
                    namespace: this.namespace,
                    runId: (this.backpack as any).runId
                }
            );
        } catch (error) {
            console.warn('Failed to emit PREP_COMPLETE event:', error);
        }
    }
    
    /**
     * Emit EXEC_COMPLETE event
     */
    private emitExecComplete(execResult: unknown, durationMs: number): void {
        if (!this.eventStreamer) return;
        
        try {
            const { StreamEventType } = require('../events/types');
            
            this.eventStreamer.emit(
                StreamEventType.EXEC_COMPLETE,
                {
                    execResult,
                    attempts: 1, // TODO: Track retry attempts
                    durationMs
                },
                {
                    sourceNode: this.constructor.name,
                    nodeId: this.id,
                    namespace: this.namespace,
                    runId: (this.backpack as any).runId
                }
            );
        } catch (error) {
            console.warn('Failed to emit EXEC_COMPLETE event:', error);
        }
    }
    
    /**
     * Emit NODE_END event
     */
    private emitNodeEnd(action: string | undefined, backpackWrites: string[], durationMs: number): void {
        if (!this.eventStreamer) return;
        
        try {
            const { StreamEventType } = require('../events/types');
            
            this.eventStreamer.emit(
                StreamEventType.NODE_END,
                {
                    action,
                    backpackWrites,
                    durationMs
                },
                {
                    sourceNode: this.constructor.name,
                    nodeId: this.id,
                    namespace: this.namespace,
                    runId: (this.backpack as any).runId
                }
            );
        } catch (error) {
            console.warn('Failed to emit NODE_END event:', error);
        }
    }
    
    /**
     * Emit ERROR event
     */
    private emitError(error: Error, phase: 'prep' | 'exec' | 'post'): void {
        if (!this.eventStreamer) return;
        
        try {
            const { StreamEventType } = require('../events/types');
            
            this.eventStreamer.emit(
                StreamEventType.ERROR,
                {
                    phase,
                    error: error.message,
                    stack: error.stack,
                    backpackStateAtError: this.getBackpackSnapshot()
                },
                {
                    sourceNode: this.constructor.name,
                    nodeId: this.id,
                    namespace: this.namespace,
                    runId: (this.backpack as any).runId
                }
            );
        } catch (emitError) {
            console.warn('Failed to emit ERROR event:', emitError);
        }
    }
    
    /**
     * Get a snapshot of current Backpack state for events
     */
    private getBackpackSnapshot(): Record<string, any> {
        const snapshot: Record<string, any> = {};
        for (const key of this.backpack.keys()) {
            snapshot[key] = this.backpack.peek(key);
        }
        return snapshot;
    }
    
    /**
     * Determine which phase an error occurred in (heuristic)
     */
    private determineErrorPhase(error: any): 'prep' | 'exec' | 'post' {
        // Simple heuristic based on stack trace or error type
        const stack = error?.stack || '';
        if (stack.includes('.prep')) return 'prep';
        if (stack.includes('.post')) return 'post';
        return 'exec'; // Default to exec
    }
    
    /**
     * Helper method: Pack data to Backpack
     * 
     * Automatically includes node metadata
     * 
     * @param key - Key to store
     * @param value - Value to store
     * @param options - Optional overrides
     */
    protected pack(key: string, value: any, options?: Partial<PackOptions>): void {
        this.backpack.pack(key, value, {
            ...options,
            nodeId: options?.nodeId || this.id,
            nodeName: options?.nodeName || this.constructor.name,
            namespace: options?.namespace || this.namespace
        });
    }
    
    /**
     * Helper method: Unpack data from Backpack (graceful)
     * 
     * Returns undefined if not found or access denied
     * 
     * @param key - Key to retrieve
     * @returns Value or undefined
     */
    protected unpack<V = any>(key: string): V | undefined {
        return this.backpack.unpack<V>(key, this.id);
    }
    
    /**
     * Helper method: Unpack data from Backpack (fail-fast)
     * 
     * Throws if not found or access denied
     * 
     * @param key - Key to retrieve
     * @returns Value (guaranteed)
     */
    protected unpackRequired<V = any>(key: string): V {
        return this.backpack.unpackRequired<V>(key, this.id);
    }
    
    /**
     * Helper method: Query by namespace pattern
     * 
     * @param pattern - Namespace pattern (e.g., "sales.*")
     * @returns Record of matching values
     */
    protected unpackByNamespace(pattern: string): Record<string, any> {
        return this.backpack.unpackByNamespace(pattern, this.id);
    }
}

