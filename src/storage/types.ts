/**
 * Backpack Type Definitions
 * 
 * Based on:
 * - PRD-001: Backpack Architecture
 * - TECH-SPEC-001: Backpack Implementation
 * 
 * Version: 2.0.0
 */

// ===== Core Types =====

/**
 * Base storage interface that Backpack extends
 */
export interface BaseStorage {
    [key: string]: any;
}

/**
 * A single item stored in the Backpack with full provenance metadata
 */
export interface BackpackItem {
    key: string;
    value: any;
    metadata: BackpackItemMetadata;
}

/**
 * Metadata tracking for each Backpack item (PRD-001 §3.2)
 */
export interface BackpackItemMetadata {
    sourceNodeId: string;           // Who added this? (UUID)
    sourceNodeName: string;          // Human-readable name (e.g., "ChatNode")
    sourceNamespace?: string;        // Semantic path (e.g., "sales.research.chat")
    timestamp: number;               // When was this added? (Date.now())
    version: number;                 // How many times was this key updated?
    tags?: string[];                 // e.g., ["pii", "temporary", "cached"]
}

/**
 * A commit record in the Backpack history (like git commit)
 */
export interface BackpackCommit {
    commitId: string;                // UUID
    timestamp: number;               // When did this happen?
    nodeId: string;                  // Who made this change?
    nodeName: string;                // Human-readable node name
    namespace?: string;              // Node's namespace
    action: 'pack' | 'unpack' | 'quarantine';  // What action was taken?
    key: string;                     // Which key was affected?
    newValue?: any;                  // New value (for pack)
    previousValue?: any;             // Previous value (for pack updates)
    valueSummary: string;            // Human-readable summary (for display)
}

/**
 * Options when packing a value
 */
export interface PackOptions {
    nodeId?: string;                 // Override source node ID
    nodeName?: string;               // Override source node name
    namespace?: string;              // Override namespace
    tags?: string[];                 // Add tags (e.g., ["pii", "temporary"])
}

/**
 * Access control permissions for a node
 */
export interface NodePermissions {
    read?: string[];                 // Keys this node can read
    write?: string[];                // Keys this node can write
    deny?: string[];                 // Keys explicitly blocked
    namespaceRead?: string[];        // Namespace patterns (e.g., ['sales.*'])
    namespaceWrite?: string[];       // Namespace patterns for writing
}

/**
 * Configuration options for Backpack
 */
export interface BackpackOptions {
    maxHistorySize?: number;         // Max commits to keep (default: 10000)
    strictMode?: boolean;            // Throw on access violations vs. log warning
    enableAccessControl?: boolean;   // Enable/disable access control (default: true)
}

/**
 * Serialized snapshot of Backpack state
 */
export interface BackpackSnapshot {
    items: Array<[string, BackpackItem]>;  // Map entries as array
    history: BackpackCommit[];
    permissions: Record<string, NodePermissions>;
    timestamp: number;
    commitId?: string;                     // If snapshot is from a specific commit
}

/**
 * Diff between two Backpack snapshots
 */
export interface BackpackDiff {
    added: string[];                      // Keys added in snapshot2
    removed: string[];                    // Keys removed from snapshot1
    modified: Array<{                     // Keys with different values
        key: string;
        oldValue: any;
        newValue: any;
    }>;
}

/**
 * Result of Backpack validation
 */
export interface ValidationResult {
    valid: boolean;
    errors?: Array<{
        key: string;
        message: string;
    }>;
}

// ===== Node Context Types =====

/**
 * Context passed to BackpackNode instances
 */
export interface NodeContext {
    namespace: string;                   // Full namespace path
    backpack: any;                       // Backpack instance (typed as any to avoid circular dep)
    eventStreamer?: any;                 // EventStreamer instance
}

/**
 * Node configuration
 */
export interface NodeConfig {
    id: string;                          // Node ID
    type?: string;                       // Node type (for serialization)
    namespace?: string;                  // Optional namespace override
    params?: Record<string, any>;        // Node-specific parameters
}

// ===== Flow Types =====

/**
 * Flow configuration
 */
export interface FlowConfig {
    namespace?: string;                  // Parent namespace
    nodes: NodeConfig[];                 // Node configurations
    edges?: FlowEdge[];                  // Routing edges
}

/**
 * Flow edge (routing between nodes)
 */
export interface FlowEdge {
    from: string;                        // Source node ID
    to: string;                          // Target node ID
    condition: string;                   // Action string (v2.0) or JSON Logic (v2.1)
}

