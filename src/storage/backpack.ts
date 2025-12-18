/**
 * Backpack - Git-like State Management for Agents
 * 
 * Based on:
 * - PRD-001: Backpack Architecture
 * - TECH-SPEC-001: Backpack Implementation
 * - AD-002: Hybrid Error Handling
 * 
 * Version: 2.0.0 - Phase 1: Core Storage
 */

import { v4 as uuidv4 } from 'uuid';
import {
    BaseStorage,
    BackpackItem,
    BackpackItemMetadata,
    BackpackCommit,
    BackpackOptions,
    PackOptions,
    NodePermissions,
    BackpackSnapshot
} from './types';
import {
    BackpackError,
    AccessDeniedError,
    KeyNotFoundError
} from './errors';

/**
 * Backpack - Scoped, traceable state management for agent workflows
 * 
 * Think of it as "Git for your agent's state":
 * - pack() = git commit
 * - getHistory() = git log
 * - getSnapshot() = git checkout
 * - diff() = git diff
 */
export class Backpack<T extends BaseStorage = BaseStorage> {
    // ===== Core Storage =====
    private _items: Map<string, BackpackItem> = new Map();
    
    // ===== History (Phase 2 - placeholder for now) =====
    private _history: BackpackCommit[] = [];
    private maxHistorySize: number;
    
    // ===== Access Control (Phase 3 - placeholder for now) =====
    private _permissions: Map<string, NodePermissions> = new Map();
    private strictMode: boolean;
    private enableAccessControl: boolean;
    
    // ===== Version Tracking =====
    private _versions: Map<string, number> = new Map();  // key -> version number
    
    /**
     * Create a new Backpack instance
     * 
     * @param initialData - Optional initial data to populate the Backpack
     * @param options - Configuration options
     */
    constructor(initialData?: T, options?: BackpackOptions) {
        this.maxHistorySize = options?.maxHistorySize ?? 10000;
        this.strictMode = options?.strictMode ?? false;
        this.enableAccessControl = options?.enableAccessControl ?? true;
        
        // If initial data provided, pack it with system identity
        if (initialData) {
            for (const [key, value] of Object.entries(initialData)) {
                this.pack(key, value, {
                    nodeId: 'system',
                    nodeName: 'Backpack.constructor'
                });
            }
        }
    }
    
    // ===== CORE API (Phase 1) =====
    
    /**
     * Store a value in the Backpack (like "git commit")
     * 
     * @param key - Unique identifier for this value
     * @param value - Any serializable value
     * @param options - Optional metadata overrides
     */
    pack(key: string, value: any, options?: PackOptions): void {
        // Create metadata
        const version = this.getVersion(key) + 1;
        const metadata: BackpackItemMetadata = {
            sourceNodeId: options?.nodeId ?? 'unknown',
            sourceNodeName: options?.nodeName ?? 'unknown',
            sourceNamespace: options?.namespace,
            timestamp: Date.now(),
            version,
            tags: options?.tags ?? []
        };
        
        // Create item
        const item: BackpackItem = {
            key,
            value,
            metadata
        };
        
        // Store previous value for history (Phase 2)
        const previousValue = this._items.get(key)?.value;
        
        // Update storage
        this._items.set(key, item);
        this._versions.set(key, version);
        
        // TODO Phase 2: Record commit to history
        // this.recordCommit('pack', key, item, previousValue);
    }
    
    /**
     * Retrieve a value from the Backpack (returns undefined if not found)
     * 
     * This is the "graceful" version - use for optional data.
     * 
     * @param key - Key to retrieve
     * @param nodeId - Optional node ID for access control (Phase 3)
     * @returns The value, or undefined if not found
     */
    unpack<V = any>(key: string, nodeId?: string): V | undefined {
        const item = this._items.get(key);
        
        if (!item) {
            return undefined;
        }
        
        // TODO Phase 3: Check access control
        // if (nodeId && this.enableAccessControl) {
        //     this.checkAccess(nodeId, key, 'read');
        // }
        
        // TODO Phase 2: Record to history
        // this.recordAccess('unpack', key, nodeId);
        
        return item.value as V;
    }
    
    /**
     * Retrieve a value from the Backpack (throws if not found)
     * 
     * This is the "fail-fast" version - use for mandatory data.
     * AD-002: Hybrid Error Handling
     * 
     * @param key - Key to retrieve
     * @param nodeId - Optional node ID for access control
     * @returns The value (guaranteed to exist)
     * @throws KeyNotFoundError if key doesn't exist
     * @throws AccessDeniedError if access is denied (Phase 3)
     */
    unpackRequired<V = any>(key: string, nodeId?: string): V {
        const value = this.unpack<V>(key, nodeId);
        
        if (value === undefined) {
            throw new KeyNotFoundError(key, nodeId);
        }
        
        return value;
    }
    
    /**
     * Read a value without logging access (for debugging)
     * 
     * @param key - Key to peek at
     * @returns The value, or undefined if not found
     */
    peek<V = any>(key: string): V | undefined {
        const item = this._items.get(key);
        return item ? (item.value as V) : undefined;
    }
    
    /**
     * Check if a key exists in the Backpack
     * 
     * @param key - Key to check
     * @returns True if the key exists
     */
    has(key: string): boolean {
        return this._items.has(key);
    }
    
    /**
     * Get all keys currently in the Backpack
     * 
     * @returns Array of all keys
     */
    keys(): string[] {
        return Array.from(this._items.keys());
    }
    
    /**
     * Get an item with full metadata
     * 
     * @param key - Key to retrieve
     * @returns The full BackpackItem, or undefined if not found
     */
    getItem(key: string): BackpackItem | undefined {
        return this._items.get(key);
    }
    
    /**
     * Get the current version number for a key
     * 
     * @param key - Key to check
     * @returns Version number (0 if key doesn't exist)
     */
    getVersion(key: string): number {
        return this._versions.get(key) ?? 0;
    }
    
    /**
     * Get the count of items in the Backpack
     * 
     * @returns Number of items
     */
    size(): number {
        return this._items.size;
    }
    
    /**
     * Clear all items from the Backpack
     * 
     * Note: This does NOT clear history (use with caution)
     */
    clear(): void {
        this._items.clear();
        this._versions.clear();
    }
    
    // ===== HISTORY API (Phase 2 - Stubs for now) =====
    
    /**
     * Get the full commit history (like "git log")
     * 
     * Phase 2: Will return all commits
     * 
     * @returns Array of commits (newest first)
     */
    getHistory(): BackpackCommit[] {
        return [...this._history];
    }
    
    // ===== ACCESS CONTROL API (Phase 3 - Stubs for now) =====
    
    /**
     * Register permissions for a node
     * 
     * Phase 3: Enable access control
     * 
     * @param nodeId - Node ID
     * @param permissions - Permission configuration
     */
    registerPermissions(nodeId: string, permissions: NodePermissions): void {
        this._permissions.set(nodeId, permissions);
    }
    
    // ===== SERIALIZATION (Future - Stubs for now) =====
    
    /**
     * Serialize the Backpack to JSON
     * 
     * @returns Serialized snapshot
     */
    toJSON(): BackpackSnapshot {
        return {
            items: Array.from(this._items.entries()),
            history: this._history,
            permissions: Object.fromEntries(this._permissions),
            timestamp: Date.now()
        };
    }
    
    /**
     * Deserialize a Backpack from JSON
     * 
     * @param snapshot - Serialized snapshot
     * @returns New Backpack instance
     */
    static fromJSON<T extends BaseStorage = BaseStorage>(
        snapshot: BackpackSnapshot
    ): Backpack<T> {
        const backpack = new Backpack<T>();
        backpack._items = new Map(snapshot.items);
        backpack._history = snapshot.history;
        backpack._permissions = new Map(Object.entries(snapshot.permissions));
        
        // Rebuild version map
        for (const [key, item] of backpack._items) {
            backpack._versions.set(key, item.metadata.version);
        }
        
        return backpack;
    }
}

