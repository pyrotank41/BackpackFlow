/**
 * BackpackFlow v2.0 - Serialization Types
 * 
 * PRD-003: Serialization Bridge
 * Enable config-driven nodes and flows
 */

/**
 * Node configuration schema
 */
export interface NodeConfig {
    type: string;                      // Node class name (e.g., "ChatNode")
    id: string;                        // Unique node ID in the flow
    params: Record<string, any>;       // Node-specific parameters
    dependencies?: string[];           // Keys for dependency injection
}

/**
 * Flow edge configuration
 */
export interface FlowEdge {
    from: string;                      // Source node ID
    to: string;                        // Target node ID
    condition: string;                 // Condition/action string (e.g., "default", "error")
}

/**
 * Flow configuration schema
 */
export interface FlowConfig {
    version: string;                   // Schema version (e.g., "2.0.0")
    namespace?: string;                // Flow namespace
    nodes: NodeConfig[];               // Node configurations
    edges: FlowEdge[];                 // Edge configurations
    dependencies?: DependencyManifest; // Dependency metadata
}

/**
 * Dependency manifest (metadata about dependencies)
 */
export interface DependencyManifest {
    [key: string]: string;             // key -> provider type (e.g., "llmClient" -> "openai")
}

/**
 * Serializable Node interface
 * 
 * Nodes implementing this interface can be serialized to/from JSON
 */
export interface SerializableNode {
    /**
     * Serialize node to configuration
     */
    toConfig(): NodeConfig;
}

/**
 * Static methods for serializable nodes (TypeScript limitation workaround)
 */
export interface SerializableNodeClass {
    /**
     * Deserialize node from configuration
     */
    fromConfig(config: NodeConfig, context: any, deps?: any): SerializableNode;
    
    /**
     * Validation schema (optional - can use Zod, JSON Schema, etc.)
     */
    configSchema?: any;
}

/**
 * Serialization error
 */
export class SerializationError extends Error {
    constructor(message: string, public cause?: Error) {
        super(message);
        this.name = 'SerializationError';
    }
}

/**
 * Validation error
 */
export class ValidationError extends SerializationError {
    constructor(message: string, public errors: any[], cause?: Error) {
        super(message, cause);
        this.name = 'ValidationError';
    }
}

/**
 * Dependency resolution error
 */
export class DependencyError extends SerializationError {
    constructor(message: string, public dependencyKey: string, cause?: Error) {
        super(message, cause);
        this.name = 'DependencyError';
    }
}

