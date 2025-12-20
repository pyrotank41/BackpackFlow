/**
 * Flow - Namespace composer and node orchestrator for BackpackFlow v2.0
 * 
 * Responsibilities:
 * - Compose namespaces for nodes (Graph-Assigned pattern)
 * - Manage shared Backpack instance
 * - Orchestrate node execution
 * - Support nested flows/subgraphs
 * 
 * Design Pattern: Graph-Assigned Namespaces
 * - Flow owns the namespace path
 * - Nodes define their segment
 * - Flow composes: parent.namespace + node.segment
 * 
 * Based on TECH-SPEC-001 §4: Flow Class
 */

import { Backpack } from '../storage/backpack';
import { BackpackNode, NodeConfig, NodeContext } from '../nodes/backpack-node';
import { BaseStorage } from '../storage/types';

/**
 * Flow configuration
 */
export interface FlowConfig {
    namespace?: string;           // Namespace for this flow (e.g., "sales")
    backpack?: Backpack;          // Optional: use existing Backpack
    backpackOptions?: {           // Or: create new Backpack with options
        enableAccessControl?: boolean;
        strictMode?: boolean;
        maxHistorySize?: number;
    };
    initialData?: BaseStorage;    // Initial data for new Backpack
    eventStreamer?: any;          // Event streamer for telemetry
}

/**
 * Flow - Manages nodes and composes namespaces
 * 
 * Usage:
 * ```typescript
 * const flow = new Flow({ namespace: "sales" });
 * 
 * const chatNode = flow.addNode(ChatNode, { id: "chat" });
 * const searchNode = flow.addNode(SearchNode, { id: "search" });
 * 
 * chatNode.on("needs_search", searchNode);
 * 
 * const result = await flow.run(chatNode, input);
 * ```
 */
export class Flow<S = any> {
    /**
     * Namespace for this flow
     */
    public readonly namespace: string;
    
    /**
     * Shared Backpack instance
     */
    public readonly backpack: Backpack;
    
    /**
     * Event streamer for telemetry
     */
    private readonly eventStreamer?: any;
    
    /**
     * Registry of nodes in this flow
     */
    private readonly nodes: Map<string, BackpackNode> = new Map();
    
    /**
     * Entry node for the flow
     */
    private entryNode?: BackpackNode;
    
    /**
     * Create a new Flow
     * 
     * @param config - Flow configuration
     */
    constructor(config: FlowConfig = {}) {
        this.namespace = config.namespace || '';
        this.eventStreamer = config.eventStreamer;
        
        // Use existing Backpack or create new one
        if (config.backpack) {
            this.backpack = config.backpack;
        } else {
            this.backpack = new Backpack(
                config.initialData,
                config.backpackOptions
            );
        }
    }
    
    /**
     * Add a node to the flow with automatic namespace composition
     * 
     * Algorithm:
     * 1. Get node's segment (from static property or config.id)
     * 2. Compose full namespace: parent.namespace + segment
     * 3. Instantiate node with composed namespace + shared backpack
     * 4. Register node in flow
     * 
     * @param NodeClass - Node class to instantiate
     * @param config - Node configuration
     * @returns Instantiated node
     */
    addNode<T extends BackpackNode, C extends NodeConfig = NodeConfig>(
        NodeClass: typeof BackpackNode & { new(config: C, context: NodeContext): T },
        config: C
    ): T {
        // Get namespace segment from node class or config
        const segment = (NodeClass as any).namespaceSegment || config.id;
        
        // Compose full namespace
        const fullNamespace = this.composeNamespace(segment);
        
        // Create node context
        const context: NodeContext = {
            namespace: fullNamespace,
            backpack: this.backpack,
            eventStreamer: this.eventStreamer
        };
        
        // Instantiate node
        const node = new NodeClass(config, context) as T;
        
        // Register in flow
        this.nodes.set(config.id, node);
        
        return node;
    }
    
    /**
     * Register an already-instantiated node in the flow
     * 
     * Used by FlowLoader when deserializing nodes that were created via fromConfig()
     * 
     * @param id - Node ID
     * @param node - Node instance
     */
    registerNode(id: string, node: BackpackNode): void {
        this.nodes.set(id, node);
    }
    
    /**
     * Compose namespace from parent namespace + segment
     * 
     * Examples:
     * - composeNamespace("chat") with namespace="" → "chat"
     * - composeNamespace("chat") with namespace="sales" → "sales.chat"
     * - composeNamespace("chat") with namespace="sales.agent" → "sales.agent.chat"
     * 
     * @param segment - Node's namespace segment
     * @returns Full namespace path
     */
    private composeNamespace(segment: string): string {
        if (!this.namespace) {
            return segment;
        }
        return `${this.namespace}.${segment}`;
    }
    
    /**
     * Get a node by ID
     * 
     * @param nodeId - Node ID
     * @returns Node instance or undefined
     */
    getNode(nodeId: string): BackpackNode | undefined {
        return this.nodes.get(nodeId);
    }
    
    /**
     * Get all nodes in the flow
     * 
     * @returns Array of nodes
     */
    getAllNodes(): BackpackNode[] {
        return Array.from(this.nodes.values());
    }
    
    /**
     * Set the entry node for the flow
     * 
     * @param nodeOrId - Node instance or node ID
     * @returns This flow (for chaining)
     */
    setEntryNode(nodeOrId: BackpackNode | string): this {
        if (typeof nodeOrId === 'string') {
            const node = this.nodes.get(nodeOrId);
            if (!node) {
                throw new Error(`Node with ID '${nodeOrId}' not found in flow`);
            }
            this.entryNode = node;
        } else {
            this.entryNode = nodeOrId;
        }
        return this;
    }
    
    /**
     * Run the flow starting from entry node
     * 
     * @param shared - Shared state object
     * @returns Final action or undefined
     */
    async run(shared: S): Promise<string | undefined>;
    
    /**
     * Run the flow starting from a specific node
     * 
     * @param startNode - Node to start from
     * @param shared - Shared state object
     * @returns Final action or undefined
     */
    async run(startNode: BackpackNode, shared: S): Promise<string | undefined>;
    
    /**
     * Run the flow
     */
    async run(
        startNodeOrShared: BackpackNode | S,
        sharedOrUndefined?: S
    ): Promise<string | undefined> {
        let currentNode: BackpackNode | undefined;
        let shared: S;
        
        // Handle overloaded signatures
        if (startNodeOrShared instanceof BackpackNode) {
            currentNode = startNodeOrShared;
            shared = sharedOrUndefined as S;
        } else {
            if (!this.entryNode) {
                throw new Error('No entry node set. Use setEntryNode() or pass a node to run()');
            }
            currentNode = this.entryNode;
            shared = startNodeOrShared;
        }
        
        // Execute flow
        let action: string | undefined;
        
        while (currentNode) {
            // Run current node
            action = await currentNode._run(shared);
            
            // Get next node based on action
            if (action) {
                const nextNode = currentNode.getNextNode(action);
                // Only continue if next node is a BackpackNode
                if (nextNode instanceof BackpackNode) {
                    currentNode = nextNode;
                } else if (nextNode) {
                    console.warn('Next node is not a BackpackNode, ending flow');
                    break;
                } else {
                    currentNode = undefined;
                }
            } else {
                // No action returned, end flow
                break;
            }
        }
        
        return action;
    }
    
    /**
     * Create a nested subflow
     * 
     * The subflow inherits:
     * - Parent namespace (composed)
     * - Shared Backpack instance
     * - Event streamer
     * 
     * Usage:
     * ```typescript
     * const mainFlow = new Flow({ namespace: "sales" });
     * const subflow = mainFlow.createSubflow({ namespace: "agent" });
     * // Subflow namespace: "sales.agent"
     * ```
     * 
     * @param config - Subflow configuration
     * @returns New Flow instance with inherited context
     */
    createSubflow(config: Omit<FlowConfig, 'backpack' | 'backpackOptions' | 'initialData'>): Flow<S> {
        const subflowNamespace = this.composeNamespace(config.namespace || '');
        
        return new Flow<S>({
            ...config,
            namespace: subflowNamespace,
            backpack: this.backpack,  // Share same Backpack
            eventStreamer: this.eventStreamer  // Share event streamer
        });
    }
    
    /**
     * Get flow statistics
     * 
     * @returns Flow stats
     */
    getStats(): {
        namespace: string;
        nodeCount: number;
        backpackSize: number;
        hasEntryNode: boolean;
    } {
        return {
            namespace: this.namespace,
            nodeCount: this.nodes.size,
            backpackSize: this.backpack.size(),
            hasEntryNode: !!this.entryNode
        };
    }
}

