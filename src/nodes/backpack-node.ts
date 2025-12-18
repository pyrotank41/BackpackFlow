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
     * Override _run to inject Backpack metadata automatically
     * 
     * This ensures all pack() calls include:
     * - nodeId
     * - nodeName
     * - namespace
     * 
     * Without requiring developers to pass them manually
     */
    async _run(shared: S): Promise<string | undefined> {
        // Store original pack method
        const originalPack = this.backpack.pack.bind(this.backpack);
        
        // Create wrapper that injects metadata
        const wrappedPack = (key: string, value: any, options?: PackOptions): void => {
            return originalPack(key, value, {
                ...options,
                nodeId: options?.nodeId || this.id,
                nodeName: options?.nodeName || this.constructor.name,
                namespace: options?.namespace || this.namespace
            });
        };
        
        // Temporarily replace pack method
        // @ts-ignore - intentional method replacement
        this.backpack.pack = wrappedPack;
        
        try {
            // Run the node's lifecycle
            return await super._run(shared);
        } finally {
            // Restore original pack method
            // @ts-ignore
            this.backpack.pack = originalPack;
        }
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

