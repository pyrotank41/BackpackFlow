/**
 * BackpackFlow v2.0 - Flow Loader
 * 
 * PRD-003: Config-Driven Flow Loading
 * 
 * Orchestrates loading flows from JSON configuration.
 */

import { Flow } from '../flows/flow';
import { BackpackNode, NodeContext } from '../nodes/backpack-node';
import { DependencyContainer } from './dependency-container';
import { 
    FlowConfig, 
    NodeConfig, 
    SerializableNode, 
    SerializableNodeClass,
    SerializationError,
    ValidationError 
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
        
        // 3. Instantiate nodes and add to flow
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
                
                // Add node to flow (which handles namespace composition)
                const node = flow.addNode(entry.nodeClass as any, nodeConfig);
                nodeInstances.set(nodeConfig.id, node);
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
            
            // Setup edge using PocketFlow's .on() method
            fromNode.on(edge.condition, toNode);
        }
        
        return flow;
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
     * Export flow to configuration
     * 
     * @param flow - Flow instance
     * @returns Flow configuration
     */
    exportFlow(flow: Flow): FlowConfig {
        const nodes: NodeConfig[] = [];
        const edges: any[] = [];
        
        // Extract nodes
        for (const node of flow.getAllNodes()) {
            if ('toConfig' in node && typeof (node as any).toConfig === 'function') {
                const config = (node as any).toConfig();
                nodes.push(config);
            } else {
                // Fallback: basic config
                nodes.push({
                    type: node.constructor.name,
                    id: node.id,
                    params: {}
                });
            }
        }
        
        // Extract edges (from PocketFlow's node graph)
        // Note: This requires access to node._next_nodes which is internal
        // For now, we'll create a basic structure
        
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
}

