/**
 * BackpackFlow v2.0 - Serialization Types
 * 
 * PRD-003: Serialization Bridge
 * PRD-005: Complete Flow Observability (Data Contracts with Zod)
 * 
 * Enable config-driven nodes and flows with full observability
 */

import { z } from 'zod';

/**
 * Data Contract (PRD-005 Issue #3 - Zod Implementation)
 * 
 * A record of Zod schemas defining the shape and validation rules
 * for data flowing through the Backpack.
 * 
 * Benefits:
 * - Type inference: TypeScript types derived from schemas
 * - Runtime validation: Automatic, detailed error messages
 * - Composability: Reuse schemas across nodes
 * - JSON Schema export: Generate OpenAPI docs, UI forms
 * - Single source of truth: Schema = Type = Validation
 * 
 * Example:
 * ```typescript
 * static inputs: DataContract = {
 *     searchQuery: z.string().describe('YouTube search query'),
 *     maxResults: z.number().optional().default(50)
 * };
 * 
 * static outputs: DataContract = {
 *     searchResults: z.array(YouTubeVideoSchema)
 * };
 * ```
 */
export type DataContract = Record<string, z.ZodType<any>>;

/**
 * Node configuration schema
 * 
 * NOTE: In runtime, inputs/outputs are Zod schemas (DataContract).
 * In serialized form (JSON), they are JSON Schema (Record<string, any>).
 * Use zodToJsonSchema() to convert between them.
 */
export interface NodeConfig {
    type: string;                      // Node class name (e.g., "ChatNode")
    id: string;                        // Unique node ID in the flow
    params: Record<string, any>;       // Node-specific parameters
    dependencies?: string[];           // Keys for dependency injection
    inputs?: Record<string, any>;      // Input contract as JSON Schema (PRD-005)
    outputs?: Record<string, any>;     // Output contract as JSON Schema (PRD-005)
    internalFlow?: FlowConfig;         // Nested flow for composite nodes (PRD-004)
}

/**
 * Key mapping for data transformation between nodes (PRD-005 Issue #4)
 * 
 * Maps output keys from source node to input keys for target node
 * 
 * Example:
 * ```typescript
 * {
 *   "searchResults": "dataToAnalyze",  // Source key -> Target key
 *   "query": "originalQuery"
 * }
 * ```
 */
export interface EdgeMappings {
    [sourceKey: string]: string;       // sourceKey -> targetKey
}

/**
 * Flow edge configuration
 */
export interface FlowEdge {
    from: string;                      // Source node ID
    to: string;                        // Target node ID
    condition: string;                 // Condition/action string (e.g., "default", "error")
    mappings?: EdgeMappings;           // Optional key remapping (PRD-005 Issue #4)
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
 * Export options for flow serialization (PRD-004)
 */
export interface ExportOptions {
    /**
     * Maximum depth for nested flow serialization
     * 
     * - 0: Export only top-level flow (no nested flows)
     * - 1: Export one level of nesting
     * - 10: Default (export up to 10 levels deep)
     * - Infinity: Export all nested flows
     */
    depth?: number;
    
    /**
     * Include sensitive data (API keys, tokens, etc.)
     * Default: false (mask with ***)
     */
    includeSensitive?: boolean;
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

/**
 * Contract validation error (PRD-005 Issue #3 - Zod Implementation)
 * 
 * Thrown when a node's input contract validation fails.
 * Contains detailed Zod validation errors with paths to invalid fields.
 */
export class ContractValidationError extends Error {
    constructor(
        message: string,
        public nodeId: string,
        public violations: Array<{ key: string; errors: string[] }>
    ) {
        super(message);
        this.name = 'ContractValidationError';
    }
}

