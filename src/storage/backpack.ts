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
    BackpackSnapshot,
    BackpackDiff
} from './types';
import {
    BackpackError,
    AccessDeniedError,
    KeyNotFoundError,
    InvalidCommitError
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
    
    // ===== Telemetry (Phase PRD-002) =====
    private eventStreamer?: any;  // EventStreamer instance (optional)
    private runId: string;
    
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
        this.eventStreamer = options?.eventStreamer;
        this.runId = options?.runId ?? uuidv4();
        
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
     * @throws AccessDeniedError if node doesn't have write permission (strictMode)
     */
    pack(key: string, value: any, options?: PackOptions): void {
        const nodeId = options?.nodeId ?? 'unknown';
        
        // Phase 3: Check write access
        if (this.enableAccessControl && nodeId !== 'unknown') {
            if (!this.checkAccess(nodeId, key, 'write', options?.namespace)) {
                if (this.strictMode) {
                    throw new AccessDeniedError(nodeId, key, 'write');
                }
                console.warn(`Access denied: Node '${nodeId}' cannot write key '${key}'`);
                return; // Silently fail in non-strict mode
            }
        }
        
        // Create metadata
        const version = this.getVersion(key) + 1;
        const metadata: BackpackItemMetadata = {
            sourceNodeId: nodeId,
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
        
        // Store previous value for history
        const previousValue = this._items.get(key)?.value;
        
        // Update storage
        this._items.set(key, item);
        this._versions.set(key, version);
        
        // Phase 2: Record commit to history
        this.recordCommit('pack', key, item, previousValue);
        
        // PRD-002: Emit BACKPACK_PACK event
        this.emitPackEvent(key, item);
    }
    
    /**
     * Retrieve a value from the Backpack (returns undefined if not found)
     * 
     * This is the "graceful" version - use for optional data.
     * 
     * @param key - Key to retrieve
     * @param nodeId - Optional node ID for access control
     * @returns The value, or undefined if not found (or if access denied in graceful mode)
     */
    unpack<V = any>(key: string, nodeId?: string): V | undefined {
        const item = this._items.get(key);
        
        if (!item) {
            // PRD-002: Emit BACKPACK_UNPACK event (not found)
            this.emitUnpackEvent(key, nodeId ?? 'unknown', false, 'Key not found');
            return undefined;
        }
        
        // Phase 3: Check access control
        if (nodeId && this.enableAccessControl) {
            if (!this.checkAccess(nodeId, key, 'read')) {
                // PRD-002: Emit BACKPACK_UNPACK event (access denied)
                this.emitUnpackEvent(key, nodeId, false, 'Access denied');
                
                if (this.strictMode) {
                    throw new AccessDeniedError(nodeId, key, 'read');
                }
                // Graceful mode: log warning and return undefined
                console.warn(`Access denied: Node '${nodeId}' cannot read key '${key}'`);
                return undefined;
            }
        }
        
        // PRD-002: Emit BACKPACK_UNPACK event (success)
        this.emitUnpackEvent(key, nodeId ?? 'unknown', true);
        
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
     * @throws AccessDeniedError if access is denied
     */
    unpackRequired<V = any>(key: string, nodeId?: string): V {
        // Check access BEFORE checking existence (security first)
        const item = this._items.get(key);
        
        // Phase 3: Check access control (even if not found - don't leak existence)
        if (nodeId && this.enableAccessControl && item) {
            if (!this.checkAccess(nodeId, key, 'read')) {
                // PRD-002: Emit BACKPACK_UNPACK event (access denied)
                this.emitUnpackEvent(key, nodeId, false, 'Access denied');
                throw new AccessDeniedError(nodeId, key, 'read');
            }
        }
        
        // Now check existence
        if (!item) {
            // PRD-002: Emit BACKPACK_UNPACK event (not found)
            this.emitUnpackEvent(key, nodeId ?? 'unknown', false, 'Key not found');
            throw new KeyNotFoundError(key, nodeId);
        }
        
        // PRD-002: Emit BACKPACK_UNPACK event (success)
        this.emitUnpackEvent(key, nodeId ?? 'unknown', true);
        
        return item.value as V;
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
    
    // ===== HISTORY API (Phase 2) =====
    
    /**
     * Record a commit to history (private helper)
     * 
     * @param action - Type of action (pack, unpack, quarantine)
     * @param key - Key affected
     * @param item - Current BackpackItem (for pack operations)
     * @param previousValue - Previous value (for pack updates)
     */
    private recordCommit(
        action: 'pack' | 'unpack' | 'quarantine',
        key: string,
        item: BackpackItem,
        previousValue?: any
    ): void {
        const commit: BackpackCommit = {
            commitId: uuidv4(),
            timestamp: Date.now(),
            nodeId: item.metadata.sourceNodeId,
            nodeName: item.metadata.sourceNodeName,
            namespace: item.metadata.sourceNamespace,
            action,
            key,
            // Deep clone values to prevent mutation affecting history
            newValue: this.deepClone(item.value),
            previousValue: previousValue !== undefined ? this.deepClone(previousValue) : undefined,
            valueSummary: this.summarizeValue(item.value)
        };
        
        // Add to history
        this._history.push(commit);
        
        // Enforce circular buffer (maxHistorySize)
        if (this._history.length > this.maxHistorySize) {
            this._history.shift(); // Remove oldest
        }
    }
    
    /**
     * Deep clone a value (for history immutability)
     * 
     * @param value - Value to clone
     * @returns Deep cloned value
     */
    private deepClone(value: any): any {
        if (value === null || value === undefined) {
            return value;
        }
        
        // Use JSON serialization for simple deep cloning
        // Note: This won't handle functions, symbols, or circular references
        // but those shouldn't be in Backpack data anyway
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            // If serialization fails, return the value as-is
            // (better than throwing - allows non-serializable values)
            console.warn('Backpack: Could not deep clone value, storing reference');
            return value;
        }
    }
    
    /**
     * Create a human-readable summary of a value
     * 
     * @param value - Value to summarize
     * @returns String summary
     */
    private summarizeValue(value: any): string {
        if (value === undefined) return 'undefined';
        if (value === null) return 'null';
        
        const type = typeof value;
        
        if (type === 'string') {
            return value.length > 50 
                ? `"${value.substring(0, 50)}..."` 
                : `"${value}"`;
        }
        
        if (type === 'number' || type === 'boolean') {
            return String(value);
        }
        
        if (Array.isArray(value)) {
            return `Array(${value.length})`;
        }
        
        if (type === 'object') {
            const keys = Object.keys(value);
            return `{ ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''} }`;
        }
        
        return String(value);
    }
    
    /**
     * Get the full commit history (like "git log")
     * 
     * @returns Array of commits (newest first)
     */
    getHistory(): BackpackCommit[] {
        return [...this._history].reverse(); // Newest first
    }
    
    /**
     * Get commits for a specific key
     * 
     * @param key - Key to get history for
     * @returns Array of commits for this key
     */
    getKeyHistory(key: string): BackpackCommit[] {
        return this._history
            .filter(commit => commit.key === key)
            .reverse(); // Newest first
    }
    
    /**
     * Get a snapshot at a specific commit (like "git checkout <commit>")
     * 
     * @param commitId - Commit ID to reconstruct state from
     * @returns New Backpack instance with state at that commit
     * @throws InvalidCommitError if commit ID not found
     */
    getSnapshotAtCommit(commitId: string): Backpack<T> {
        // Find the commit index
        const commitIndex = this._history.findIndex(c => c.commitId === commitId);
        
        if (commitIndex === -1) {
            throw new InvalidCommitError(commitId);
        }
        
        // Create new Backpack and replay commits up to this point
        const snapshot = new Backpack<T>(undefined, {
            maxHistorySize: this.maxHistorySize,
            strictMode: this.strictMode,
            enableAccessControl: false // Don't enforce access control on snapshots
        });
        
        // Replay all commits up to and including the target commit
        for (let i = 0; i <= commitIndex; i++) {
            const commit = this._history[i];
            
            if (commit.action === 'pack') {
                // Reconstruct the item at this point in time
                snapshot._items.set(commit.key, {
                    key: commit.key,
                    value: commit.newValue,
                    metadata: {
                        sourceNodeId: commit.nodeId,
                        sourceNodeName: commit.nodeName,
                        sourceNamespace: commit.namespace,
                        timestamp: commit.timestamp,
                        version: snapshot.getVersion(commit.key) + 1,
                        tags: []
                    }
                });
                
                snapshot._versions.set(commit.key, snapshot.getVersion(commit.key) + 1);
            }
        }
        
        return snapshot;
    }
    
    /**
     * Get a snapshot before a specific node ran
     * 
     * @param nodeId - Node ID to get state before
     * @returns Backpack snapshot, or undefined if node not found in history
     */
    getSnapshotBeforeNode(nodeId: string): Backpack<T> | undefined {
        // Find first commit by this node
        const commitIndex = this._history.findIndex(c => c.nodeId === nodeId);
        
        if (commitIndex === -1) {
            return undefined;
        }
        
        // If this is the first commit, return empty backpack
        if (commitIndex === 0) {
            return new Backpack<T>(undefined, {
                maxHistorySize: this.maxHistorySize,
                strictMode: this.strictMode,
                enableAccessControl: false
            });
        }
        
        // Otherwise, get snapshot at the previous commit
        const previousCommit = this._history[commitIndex - 1];
        return this.getSnapshotAtCommit(previousCommit.commitId);
    }
    
    /**
     * Compare two Backpack snapshots (like "git diff")
     * 
     * @param before - Earlier snapshot
     * @param after - Later snapshot
     * @returns Diff showing changes
     */
    static diff<T extends BaseStorage = BaseStorage>(
        before: Backpack<T>,
        after: Backpack<T>
    ): BackpackDiff {
        const beforeKeys = new Set(before.keys());
        const afterKeys = new Set(after.keys());
        
        const added: string[] = [];
        const removed: string[] = [];
        const modified: Array<{ key: string; oldValue: any; newValue: any }> = [];
        
        // Find added keys
        for (const key of afterKeys) {
            if (!beforeKeys.has(key)) {
                added.push(key);
            }
        }
        
        // Find removed keys
        for (const key of beforeKeys) {
            if (!afterKeys.has(key)) {
                removed.push(key);
            }
        }
        
        // Find modified keys
        for (const key of beforeKeys) {
            if (afterKeys.has(key)) {
                const oldValue = before.peek(key);
                const newValue = after.peek(key);
                
                // Simple comparison (could be enhanced with deep equality)
                if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                    modified.push({ key, oldValue, newValue });
                }
            }
        }
        
        return { added, removed, modified };
    }
    
    /**
     * Replay all commits from a specific commit onwards
     * 
     * Creates a new Backpack with state at the commit, then replays subsequent commits.
     * Useful for debugging/simulation.
     * 
     * @param commitId - Commit to start from
     * @returns New Backpack with replayed state
     */
    replayFromCommit(commitId: string): Backpack<T> {
        // Get snapshot at this commit
        const snapshot = this.getSnapshotAtCommit(commitId);
        
        // Find commit index
        const commitIndex = this._history.findIndex(c => c.commitId === commitId);
        
        // Replay subsequent commits
        for (let i = commitIndex + 1; i < this._history.length; i++) {
            const commit = this._history[i];
            
            if (commit.action === 'pack') {
                snapshot.pack(commit.key, commit.newValue, {
                    nodeId: commit.nodeId,
                    nodeName: commit.nodeName,
                    namespace: commit.namespace
                });
            }
        }
        
        return snapshot;
    }
    
    // ===== ACCESS CONTROL API (Phase 3) =====
    
    /**
     * Register permissions for a node
     * 
     * @param nodeId - Node ID
     * @param permissions - Permission configuration
     */
    registerPermissions(nodeId: string, permissions: NodePermissions): void {
        this._permissions.set(nodeId, permissions);
    }
    
    /**
     * Check if a node has access to a key
     * 
     * Algorithm from TECH-SPEC-001 §Algorithm 2
     * 
     * @param nodeId - Node requesting access
     * @param key - Key being accessed
     * @param operation - Type of operation (read/write)
     * @param namespace - Optional namespace for write operations
     * @returns True if access is granted
     */
    private checkAccess(
        nodeId: string,
        key: string,
        operation: 'read' | 'write',
        namespace?: string
    ): boolean {
        // If access control is disabled, allow all
        if (!this.enableAccessControl) {
            return true;
        }
        
        const permissions = this._permissions.get(nodeId);
        
        // If no permissions registered, default to allow (opt-in)
        if (!permissions) {
            return true;
        }
        
        // Check deny list first (highest priority)
        if (permissions.deny?.includes(key)) {
            return false;
        }
        
        // Check key-based permissions
        const allowedKeys = operation === 'read' 
            ? permissions.read 
            : permissions.write;
        
        if (allowedKeys?.includes(key)) {
            return true;
        }
        
        // For namespace-based permissions
        const allowedNamespaces = operation === 'read'
            ? permissions.namespaceRead
            : permissions.namespaceWrite;
        
        if (allowedNamespaces) {
            // For reads, check the existing item's namespace
            if (operation === 'read') {
                const item = this._items.get(key);
                if (item && item.metadata.sourceNamespace) {
                    for (const pattern of allowedNamespaces) {
                        if (this.matchesPattern(pattern, item.metadata.sourceNamespace)) {
                            return true;
                        }
                    }
                }
            }
            
            // For writes, check the namespace being written
            if (operation === 'write' && namespace) {
                for (const pattern of allowedNamespaces) {
                    if (this.matchesPattern(pattern, namespace)) {
                        return true;
                    }
                }
            }
        }
        
        // Default: deny if explicit permissions are set but no match
        return false;
    }
    
    /**
     * Check if a namespace matches a wildcard pattern
     * 
     * Algorithm from TECH-SPEC-001 §Algorithm 1
     * 
     * Patterns:
     * - Exact match: "sales.chat" matches "sales.chat"
     * - Wildcard: "sales.*" matches "sales.chat" but not "sales.chat.web"
     * - Wildcard: "*.chat" matches "sales.chat"
     * 
     * @param pattern - Pattern with optional wildcards
     * @param namespace - Namespace to test
     * @returns True if namespace matches pattern
     */
    private matchesPattern(pattern: string, namespace: string): boolean {
        // Exact match
        if (pattern === namespace) {
            return true;
        }
        
        // No wildcard - no match
        if (!pattern.includes('*')) {
            return false;
        }
        
        // Convert glob pattern to regex
        // Escape regex special chars except *
        const regexPattern = '^' + 
            pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars
                .replace(/\*/g, '[^.]+')                 // * matches one level (no dots)
            + '$';
        
        const regex = new RegExp(regexPattern);
        return regex.test(namespace);
    }
    
    /**
     * Get all permissions registered
     * 
     * @returns Map of nodeId to permissions
     */
    getPermissions(): Map<string, NodePermissions> {
        return new Map(this._permissions);
    }
    
    /**
     * Clear permissions for a specific node
     * 
     * @param nodeId - Node ID to clear permissions for
     */
    clearPermissions(nodeId: string): void {
        this._permissions.delete(nodeId);
    }
    
    // ===== NAMESPACE QUERY API (Phase 4) =====
    
    /**
     * Get all values from items matching a namespace pattern
     * 
     * Usage:
     * ```typescript
     * const salesData = backpack.unpackByNamespace('sales.*');
     * // Returns: { key1: value1, key2: value2, ... }
     * ```
     * 
     * @param pattern - Namespace pattern (supports wildcards: 'sales.*', '*.chat')
     * @param nodeId - Optional node ID for access control
     * @returns Record of key-value pairs matching the pattern
     */
    unpackByNamespace(pattern: string, nodeId?: string): Record<string, any> {
        const result: Record<string, any> = {};
        
        for (const [key, item] of this._items.entries()) {
            const namespace = item.metadata.sourceNamespace;
            
            // Skip items without namespace
            if (!namespace) {
                continue;
            }
            
            // Check if namespace matches pattern
            if (!this.matchesPattern(pattern, namespace)) {
                continue;
            }
            
            // Check access control if nodeId provided
            if (nodeId && this.enableAccessControl) {
                if (!this.checkAccess(nodeId, key, 'read', namespace)) {
                    continue; // Skip denied items silently
                }
            }
            
            // Add to result (deep clone to prevent mutation)
            result[key] = this.deepClone(item.value);
        }
        
        return result;
    }
    
    /**
     * Get all items (with metadata) matching a namespace pattern
     * 
     * Usage:
     * ```typescript
     * const salesItems = backpack.getItemsByNamespace('sales.*');
     * // Returns: [{ key, value, metadata }, ...]
     * ```
     * 
     * @param pattern - Namespace pattern (supports wildcards: 'sales.*', '*.chat')
     * @param nodeId - Optional node ID for access control
     * @returns Array of BackpackItems matching the pattern
     */
    getItemsByNamespace(pattern: string, nodeId?: string): BackpackItem[] {
        const items: BackpackItem[] = [];
        
        for (const [key, item] of this._items.entries()) {
            const namespace = item.metadata.sourceNamespace;
            
            // Skip items without namespace
            if (!namespace) {
                continue;
            }
            
            // Check if namespace matches pattern
            if (!this.matchesPattern(pattern, namespace)) {
                continue;
            }
            
            // Check access control if nodeId provided
            if (nodeId && this.enableAccessControl) {
                if (!this.checkAccess(nodeId, key, 'read', namespace)) {
                    continue; // Skip denied items silently
                }
            }
            
            // Add to result (deep clone to prevent mutation)
            items.push({
                key: item.key,
                value: this.deepClone(item.value),
                metadata: { ...item.metadata }
            });
        }
        
        return items;
    }
    
    /**
     * Get all unique namespaces currently in the Backpack
     * 
     * Useful for debugging and discovery
     * 
     * @returns Array of unique namespace strings
     */
    getNamespaces(): string[] {
        const namespaces = new Set<string>();
        
        for (const item of this._items.values()) {
            if (item.metadata.sourceNamespace) {
                namespaces.add(item.metadata.sourceNamespace);
            }
        }
        
        return Array.from(namespaces).sort();
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
    
    // ===== EVENT EMISSION (PRD-002: Telemetry) =====
    
    /**
     * Emit BACKPACK_PACK event
     */
    private emitPackEvent(key: string, item: BackpackItem): void {
        if (!this.eventStreamer) return;
        
        try {
            // Import StreamEventType dynamically to avoid circular dependencies
            const { StreamEventType } = require('../events/types');
            
            const payload = {
                key,
                valueSummary: this.truncateValue(item.value),
                metadata: {
                    sourceNodeId: item.metadata.sourceNodeId,
                    sourceNodeName: item.metadata.sourceNodeName,
                    sourceNamespace: item.metadata.sourceNamespace,
                    timestamp: item.metadata.timestamp,
                    version: item.metadata.version,
                    tags: item.metadata.tags
                }
            };
            
            this.eventStreamer.emit(
                StreamEventType.BACKPACK_PACK,
                payload,
                {
                    sourceNode: item.metadata.sourceNodeName,
                    nodeId: item.metadata.sourceNodeId,
                    namespace: item.metadata.sourceNamespace,
                    runId: this.runId
                }
            );
        } catch (error) {
            // Silently fail - telemetry should never break execution
            console.warn('Failed to emit BACKPACK_PACK event:', error);
        }
    }
    
    /**
     * Emit BACKPACK_UNPACK event
     */
    private emitUnpackEvent(
        key: string,
        requestingNodeId: string,
        accessGranted: boolean,
        reason?: string
    ): void {
        if (!this.eventStreamer) return;
        
        try {
            // Import StreamEventType dynamically to avoid circular dependencies
            const { StreamEventType } = require('../events/types');
            
            const payload = {
                key,
                requestingNodeId,
                accessGranted,
                reason
            };
            
            // Get metadata for node identification
            const item = this._items.get(key);
            const sourceNode = item?.metadata.sourceNodeName ?? 'Backpack';
            const namespace = item?.metadata.sourceNamespace;
            
            this.eventStreamer.emit(
                StreamEventType.BACKPACK_UNPACK,
                payload,
                {
                    sourceNode,
                    nodeId: requestingNodeId,
                    namespace,
                    runId: this.runId
                }
            );
        } catch (error) {
            // Silently fail - telemetry should never break execution
            console.warn('Failed to emit BACKPACK_UNPACK event:', error);
        }
    }
    
    /**
     * Truncate large values for event payloads
     */
    private truncateValue(value: any, maxLength: number = 200): string {
        const str = JSON.stringify(value);
        if (str.length <= maxLength) {
            return str;
        }
        return str.slice(0, maxLength) + '... (truncated)';
    }
}

