/**
 * BackpackFlow v2.0 - Flow Loader
 * 
 * PRD-003: Config-Driven Flow Loading
 * 
 * Orchestrates loading flows from JSON configuration.
 */

import { Flow } from '../flows/flow';
import { BackpackNode, NodeContext } from '../nodes/backpack-node';
import { Backpack } from '../storage/backpack';
import { DependencyContainer } from './dependency-container';
import { 
    FlowConfig, 
    FlowEdge,
    NodeConfig, 
    SerializableNode, 
    SerializableNodeClass,
    SerializationError,
    ValidationError,
    EdgeMappings,
    ExportOptions
} from './types';

/**
 * Node Registry Entry
 */
interface NodeRegistryEntry {
    nodeClass: typeof BackpackNode & SerializableNodeClass;
    configSchema?: any;
}

/**
 * Flow Loader
 * 
 * Loads flows from JSON configuration with validation and dependency injection.
 * 
 * Usage:
 * ```typescript
 * const loader = new FlowLoader();
 * loader.register('ChatNode', ChatNode);
 * 
 * const deps = new DependencyContainer();
 * deps.register('llmClient', openaiClient);
 * 
 * const flow = await loader.loadFlow(config, deps);
 * ```
 */
export class FlowLoader {
    private nodeRegistry: Map<string, NodeRegistryEntry> = new Map();
    
    /**
     * Register a node type
     * 
     * @param type - Node type name (e.g., "ChatNode")
     * @param nodeClass - Node class
     * @param configSchema - Optional validation schema
     */
    register(
        type: string, 
        nodeClass: typeof BackpackNode & SerializableNodeClass,
        configSchema?: any
    ): void {
        this.nodeRegistry.set(type, { nodeClass, configSchema });
    }
    
    /**
     * Load flow from configuration
     * 
     * @param config - Flow configuration
     * @param deps - Dependency container
     * @returns Flow instance
     * @throws SerializationError if config is invalid
     */
    async loadFlow(
        config: FlowConfig,
        deps: DependencyContainer
    ): Promise<Flow> {
        // 1. Validate schema version
        if (!config.version) {
            throw new ValidationError(
                'Missing config version',
                [{ field: 'version', error: 'required' }]
            );
        }
        
        if (config.version !== '2.0.0') {
            throw new SerializationError(
                `Unsupported config version: ${config.version}. Expected 2.0.0`
            );
        }
        
        // 2. Create flow with shared Backpack
        const backpack = deps.has('backpack') 
            ? deps.get('backpack')
            : undefined;
        
        const eventStreamer = deps.has('eventStreamer')
            ? deps.get('eventStreamer')
            : undefined;
        
        const flow = new Flow({
            namespace: config.namespace,
            backpack,
            eventStreamer
        });
        
        // 3. Instantiate nodes using fromConfig (if available)
        const nodeInstances = new Map<string, BackpackNode>();
        
        for (const nodeConfig of config.nodes) {
            try {
                // Get node class from registry
                const entry = this.nodeRegistry.get(nodeConfig.type);
                if (!entry) {
                    throw new SerializationError(
                        `Unknown node type: ${nodeConfig.type}. Did you forget to register it?`
                    );
                }
                
                const NodeClass = entry.nodeClass;
                
                // Prefer fromConfig if available (handles NodeConfig structure properly)
                if (typeof (NodeClass as any).fromConfig === 'function') {
                    // Get namespace segment
                    const segment = (NodeClass as any).namespaceSegment || nodeConfig.id;
                    const fullNamespace = this.composeNamespace(flow.namespace, segment);
                    
                    const context: NodeContext = {
                        namespace: fullNamespace,
                        backpack: flow.backpack,
                        eventStreamer: deps.has('eventStreamer') ? deps.get('eventStreamer') : undefined
                    };
                    
                    const node = (NodeClass as any).fromConfig(nodeConfig, context, deps);
                    flow.registerNode(nodeConfig.id, node);
                    nodeInstances.set(nodeConfig.id, node);
                } else {
                    // Fallback: use Flow.addNode (direct constructor call)
                    const node = flow.addNode(NodeClass as any, nodeConfig);
                    nodeInstances.set(nodeConfig.id, node);
                }
            } catch (error) {
                throw new SerializationError(
                    `Failed to instantiate node '${nodeConfig.id}' of type '${nodeConfig.type}'`,
                    error as Error
                );
            }
        }
        
        // 4. Build flow graph (setup edges)
        for (const edge of config.edges) {
            const fromNode = nodeInstances.get(edge.from);
            const toNode = nodeInstances.get(edge.to);
            
            if (!fromNode) {
                throw new SerializationError(
                    `Edge references unknown source node: ${edge.from}`
                );
            }
            
            if (!toNode) {
                throw new SerializationError(
                    `Edge references unknown target node: ${edge.to}`
                );
            }
            
            // Setup edge with optional mappings (PRD-005 Issue #4)
            if (edge.mappings && Object.keys(edge.mappings).length > 0) {
                // Apply mappings by wrapping the target node's _run method
                this.applyEdgeMappings(toNode, edge.mappings, flow.backpack);
            }
            
            // Setup edge using PocketFlow's .on() method
            fromNode.on(edge.condition, toNode);
        }
        
        return flow;
    }
    
    /**
     * Apply edge mappings to a node (PRD-005 Issue #4)
     * 
     * Wraps the node's _run method to apply key mappings before execution
     */
    private applyEdgeMappings(
        node: BackpackNode,
        mappings: EdgeMappings,
        backpack: Backpack
    ): void {
        const originalRun = node._run.bind(node);
        
        // @ts-ignore - Override _run to apply mappings first
        node._run = async function(shared: any) {
            // Apply mappings before node execution
            for (const [sourceKey, targetKey] of Object.entries(mappings)) {
                const value = backpack.unpack(sourceKey);
                
                if (value !== undefined) {
                    // Check for conflicts (PRD-005 Q3: throw error)
                    const existingValue = backpack.unpack(targetKey);
                    if (existingValue !== undefined && existingValue !== value) {
                        throw new SerializationError(
                            `Mapping conflict on node '${node.id}': Key '${targetKey}' already exists with a different value. ` +
                            `Cannot map '${sourceKey}' -> '${targetKey}'.`
                        );
                    }
                    
                    // Apply mapping
                    backpack.pack(targetKey, value, {
                        nodeId: node.id,
                        nodeName: 'EdgeMapping',
                        namespace: (node as any).namespace
                    });
                }
            }
            
            // Execute original node
            return await originalRun(shared);
        };
    }
    
    /**
     * Compose namespace from parent and segment
     */
    private composeNamespace(parent: string, segment: string): string {
        if (!parent) return segment;
        return `${parent}.${segment}`;
    }
    
    /**
     * Instantiate a node from configuration
     * 
     * @param config - Node configuration
     * @param flow - Flow instance
     * @param deps - Dependency container
     * @returns Node instance
     */
    private async instantiateNode(
        config: NodeConfig,
        flow: Flow,
        deps: DependencyContainer
    ): Promise<BackpackNode> {
        // 1. Get node class from registry
        const entry = this.nodeRegistry.get(config.type);
        if (!entry) {
            throw new SerializationError(
                `Unknown node type: ${config.type}. Did you forget to register it?`
            );
        }
        
        const { nodeClass, configSchema } = entry;
        
        // 2. Validate config against schema (if provided)
        if (configSchema) {
            try {
                configSchema.parse(config);
            } catch (error: any) {
                throw new ValidationError(
                    `Invalid config for node '${config.id}' of type '${config.type}'`,
                    error.errors || [],
                    error
                );
            }
        }
        
        // 3. Deserialize using node's fromConfig method
        if (typeof nodeClass.fromConfig === 'function') {
            // Use the node's custom fromConfig
            const context = {
                namespace: flow.namespace,
                backpack: flow.backpack,
                eventStreamer: deps.has('eventStreamer') ? deps.get('eventStreamer') : undefined
            };
            
            return nodeClass.fromConfig(config, context, deps) as unknown as BackpackNode;
        } else {
            // Fallback: use Flow's addNode (simpler path)
            return flow.addNode(nodeClass as any, config);
        }
    }
    
    /**
     * Export flow to configuration with nested flows (PRD-004)
     * 
     * @param flow - Flow instance
     * @param options - Export options (depth control, sensitive data)
     * @returns Flow configuration with nested flows
     */
    exportFlow(flow: Flow, options?: ExportOptions): FlowConfig {
        const maxDepth = options?.depth ?? 10;  // Default max depth of 10
        const visited = new Set<string>();
        return this._exportFlowRecursive(flow, 0, maxDepth, visited);
    }
    
    /**
     * Recursively export flow and nested flows (PRD-004)
     * 
     * @param flow - Flow instance
     * @param currentDepth - Current nesting depth
     * @param maxDepth - Maximum allowed depth
     * @param visited - Set of visited flow namespaces (for circular reference detection)
     * @returns Flow configuration
     */
    private _exportFlowRecursive(
        flow: Flow,
        currentDepth: number,
        maxDepth: number,
        visited: Set<string>
    ): FlowConfig {
        // Circular reference detection
        const flowId = flow.namespace;
        if (visited.has(flowId)) {
            throw new SerializationError(
                `Circular reference detected: Flow '${flowId}' appears multiple times in hierarchy. ` +
                `This usually indicates a node containing a flow that contains itself.`
            );
        }
        visited.add(flowId);
        
        const nodes: NodeConfig[] = [];
        const edges: FlowEdge[] = [];
        
        // Extract nodes
        for (const node of flow.getAllNodes()) {
            let config: NodeConfig;
            
            if ('toConfig' in node && typeof (node as any).toConfig === 'function') {
                config = (node as any).toConfig();
            } else {
                // Fallback: basic config with warning
                console.warn(
                    `[BackpackFlow] Node '${node.id}' of type '${node.constructor.name}' ` +
                    `does not implement toConfig(). Using fallback serialization. ` +
                    `This may lose configuration data. ` +
                    `See: https://docs.backpackflow.dev/serialization#toConfig`
                );
                
                config = {
                    type: node.constructor.name,
                    id: node.id,
                    params: {}
                };
            }
            
            // Check for internal flow (composite nodes)
            const backpackNode = node as any;
            if (backpackNode.internalFlow && currentDepth < maxDepth) {
                // Recursively export internal flow
                config.internalFlow = this._exportFlowRecursive(
                    backpackNode.internalFlow,
                    currentDepth + 1,
                    maxDepth,
                    new Set(visited)  // Clone visited set for each branch
                );
            }
            
            nodes.push(config);
        }
        
        // Extract edges from PocketFlow's internal _successors map
        for (const node of flow.getAllNodes()) {
            const successors = (node as any)._successors as Map<string, BackpackNode>;
            if (successors) {
                for (const [action, targetNode] of successors.entries()) {
                    edges.push({
                        from: node.id,
                        to: targetNode.id,
                        condition: action
                    });
                }
            }
        }
        
        return {
            version: '2.0.0',
            namespace: flow.namespace,
            nodes,
            edges,
            dependencies: {}
        };
    }
    
    /**
     * Validate a flow configuration without instantiating
     * 
     * @param config - Flow configuration
     * @returns Validation result
     */
    validateConfig(config: FlowConfig): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        // Check version
        if (!config.version) {
            errors.push('Missing config version');
        } else if (config.version !== '2.0.0') {
            errors.push(`Unsupported config version: ${config.version}`);
        }
        
        // Check nodes
        if (!config.nodes || config.nodes.length === 0) {
            errors.push('Flow must have at least one node');
        }
        
        // Validate each node
        const nodeIds = new Set<string>();
        for (const nodeConfig of config.nodes || []) {
            // Check required fields
            if (!nodeConfig.type) {
                errors.push(`Node ${nodeConfig.id || 'unknown'} missing type`);
            }
            if (!nodeConfig.id) {
                errors.push(`Node of type ${nodeConfig.type || 'unknown'} missing id`);
            }
            
            // Check for duplicate IDs
            if (nodeIds.has(nodeConfig.id)) {
                errors.push(`Duplicate node ID: ${nodeConfig.id}`);
            }
            nodeIds.add(nodeConfig.id);
            
            // Check if node type is registered
            if (!this.nodeRegistry.has(nodeConfig.type)) {
                errors.push(`Unknown node type: ${nodeConfig.type}`);
            }
        }
        
        // Validate edges
        for (const edge of config.edges || []) {
            if (!edge.from) {
                errors.push('Edge missing "from" field');
            } else if (!nodeIds.has(edge.from)) {
                errors.push(`Edge references unknown source node: ${edge.from}`);
            }
            
            if (!edge.to) {
                errors.push('Edge missing "to" field');
            } else if (!nodeIds.has(edge.to)) {
                errors.push(`Edge references unknown target node: ${edge.to}`);
            }
            
            if (!edge.condition) {
                errors.push(`Edge from ${edge.from} to ${edge.to} missing condition`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Get all registered node types
     * 
     * @returns Array of node type names
     */
    getRegisteredTypes(): string[] {
        return Array.from(this.nodeRegistry.keys());
    }
    
    /**
     * Check if a node type is registered
     * 
     * @param type - Node type name
     * @returns true if registered
     */
    isRegistered(type: string): boolean {
        return this.nodeRegistry.has(type);
    }
    
    // ==================== Query Utilities (PRD-004) ====================
    
    /**
     * Flatten nested node structure (PRD-004)
     * 
     * Recursively traverses all nested flows and returns a flat array of all nodes.
     * Useful for searching, counting, or analyzing the complete node hierarchy.
     * 
     * @param config - Flow configuration
     * @returns Array of all nodes (flattened)
     * 
     * @example
     * ```typescript
     * const config = loader.exportFlow(myFlow);
     * const allNodes = loader.flattenNodes(config);
     * console.log(`Total nodes: ${allNodes.length}`);
     * ```
     */
    flattenNodes(config: FlowConfig): NodeConfig[] {
        const result: NodeConfig[] = [];
        
        for (const node of config.nodes) {
            result.push(node);
            
            // Recursively flatten internal flows
            if (node.internalFlow) {
                result.push(...this.flattenNodes(node.internalFlow));
            }
        }
        
        return result;
    }
    
    /**
     * Flatten all edges across all nesting levels (PRD-004)
     * 
     * @param config - Flow configuration
     * @returns Array of all edges (flattened)
     * 
     * @example
     * ```typescript
     * const allEdges = loader.flattenEdges(config);
     * console.log(`Total edges: ${allEdges.length}`);
     * ```
     */
    flattenEdges(config: FlowConfig): FlowEdge[] {
        const result: FlowEdge[] = [...config.edges];
        
        for (const node of config.nodes) {
            if (node.internalFlow) {
                result.push(...this.flattenEdges(node.internalFlow));
            }
        }
        
        return result;
    }
    
    /**
     * Find node by path (e.g., "agent.search") (PRD-004)
     * 
     * Supports dot-separated paths for nested flows.
     * 
     * @param config - Flow configuration
     * @param path - Node path (dot-separated, e.g., "agent.search")
     * @returns Node config or undefined if not found
     * 
     * @example
     * ```typescript
     * const searchNode = loader.findNode(config, 'agent.search');
     * if (searchNode) {
     *     console.log(`Found: ${searchNode.type}`);
     * }
     * ```
     */
    findNode(config: FlowConfig, path: string): NodeConfig | undefined {
        const [nodeId, ...rest] = path.split('.');
        
        const node = config.nodes.find(n => n.id === nodeId);
        if (!node) return undefined;
        
        // If no more path segments, return this node
        if (rest.length === 0) return node;
        
        // Search in internal flow
        if (node.internalFlow) {
            return this.findNode(node.internalFlow, rest.join('.'));
        }
        
        return undefined;
    }
    
    /**
     * Get all composite nodes (nodes with internal flows) (PRD-004)
     * 
     * @param config - Flow configuration
     * @returns Array of composite nodes
     * 
     * @example
     * ```typescript
     * const composites = loader.getCompositeNodes(config);
     * console.log(`Composite nodes: ${composites.length}`);
     * ```
     */
    getCompositeNodes(config: FlowConfig): NodeConfig[] {
        return this.flattenNodes(config).filter(node => node.internalFlow);
    }
    
    /**
     * Get maximum nesting depth (PRD-004)
     * 
     * @param config - Flow configuration
     * @returns Maximum depth of nested flows
     * 
     * @example
     * ```typescript
     * const depth = loader.getMaxDepth(config);
     * console.log(`Max nesting depth: ${depth}`);
     * ```
     */
    getMaxDepth(config: FlowConfig): number {
        let maxDepth = 0;
        
        for (const node of config.nodes) {
            if (node.internalFlow) {
                const depth = 1 + this.getMaxDepth(node.internalFlow);
                maxDepth = Math.max(maxDepth, depth);
            }
        }
        
        return maxDepth;
    }
}

