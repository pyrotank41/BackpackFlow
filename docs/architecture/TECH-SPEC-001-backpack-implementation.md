# Tech Spec 001: Backpack Implementation

**Related PRD:** [PRD-001: Backpack Architecture](../prds/PRD-001-backpack-architecture.md)  
**Status:** Draft  
**Engineer:** TBD  
**Estimated Effort:** 4 weeks (1 engineer)

---

## 1. Design Decisions

### Decision 1: Error Handling Strategy

**Question (PRD-001, Q1):** Should `.unpack()` throw or return `undefined`?

**Decision:** **Provide both methods** (Hybrid approach)

```typescript
unpack<V>(key: string, nodeId: string): V | undefined;       // Graceful
unpackRequired<V>(key: string, nodeId: string): V;           // Fail-fast
```

**Rationale:** Let developers choose based on whether data is optional or required.

---

### Decision 2: Commit History Size Limit

**Question (PRD-001, Q2):** How large should the commit history grow?

**Decision:** **Circular buffer with 10,000 commits** (configurable)

```typescript
class Backpack {
    private maxHistorySize: number = 10000;
    
    private addToHistory(commit: BackpackCommit): void {
        this._history.push(commit);
        if (this._history.length > this.maxHistorySize) {
            this._history.shift();  // Remove oldest
        }
    }
}
```

**Rationale:**
- 10k commits = ~10MB memory (avg 1KB per commit)
- Covers most debugging scenarios (typical flow = 50-500 commits)
- Configurable via constructor for power users

---

### Decision 3: Rollback Support

**Question (PRD-001, Q3):** Support rollback (undo a pack operation)?

**Decision:** **No rollback in v2.0.** Backpack is immutable-by-default.

**Rationale:**
- Rollback breaks immutability guarantees (critical for debugging)
- If needed, use `getSnapshot(timestamp)` to create a new Backpack from past state
- Can add in v2.1 if users demand it

---

### Decision 4: Namespace Wildcard Matching in Access Control

**Question (PRD-001, Q4):** Support wildcards in `namespaceRead: ['sales.*']`?

**Decision:** **Yes.** Implement glob-style pattern matching.

```typescript
permissions: {
    namespaceRead: ['sales.*'],      // ✅ Matches sales.chat, sales.research
    namespaceWrite: ['reporting.*']  // ✅ Matches reporting.analytics
}
```

**Algorithm:** Use regex-based matching (see Pattern Matching section below).

---

## 2. Class Structure

### Core Classes

```typescript
// Main class
export class Backpack<T extends BaseStorage = BaseStorage> {
    private _items: Map<string, BackpackItem>;
    private _history: BackpackCommit[];
    private _accessControl: AccessControl;
    private maxHistorySize: number;
    
    constructor(initialData?: T, options?: BackpackOptions);
}

// Supporting types
interface BackpackItem { ... }
interface BackpackCommit { ... }
interface AccessControl { ... }
interface BackpackOptions {
    maxHistorySize?: number;
    strictMode?: boolean;  // Throw on access violations vs. log warning
}
```

### Inheritance Hierarchy

```
BaseStorage (interface)
    ↓
Backpack<T extends BaseStorage>
    ↓
[User's custom storage types]
```

---

## 3. Data Structures

### Internal Storage

```typescript
class Backpack<T> {
    // Items: Fast key lookup
    private _items: Map<string, BackpackItem> = new Map();
    
    // History: Circular buffer for time-travel
    private _history: BackpackCommit[] = [];
    
    // Access control: Cache for permission checks
    private _accessControl: Map<string, NodePermissions> = new Map();
    
    // Namespace index: Fast namespace queries
    private _namespaceIndex: Map<string, Set<string>> = new Map();
    //                       namespace -> Set of keys
}
```

**Why these structures?**
- `Map` for O(1) key lookup
- Array for history (chronological, supports snapshot)
- Namespace index for fast `getItemsByNamespace('sales.*')`

---

## 4. Key Algorithms

### Algorithm 1: Pattern Matching (Namespace Wildcards)

```typescript
private matchesPattern(pattern: string, namespace: string): boolean {
    // Exact match
    if (pattern === namespace) return true;
    
    // Wildcard: "sales.*" matches "sales.chat", "sales.research"
    if (pattern.includes('*')) {
        const regex = new RegExp(
            '^' + 
            pattern
                .replace(/\./g, '\\.')      // Escape dots
                .replace(/\*/g, '[^.]+')    // * matches one level
            + '$'
        );
        return regex.test(namespace);
    }
    
    return false;
}
```

**Test Cases:**
- `matchesPattern('sales.*', 'sales.chat')` → `true`
- `matchesPattern('sales.*', 'sales.research.web')` → `false` (only one level)
- `matchesPattern('*.chat', 'sales.chat')` → `true`

---

### Algorithm 2: Access Control Check

```typescript
private checkAccess(
    key: string, 
    nodeId: string, 
    operation: 'read' | 'write'
): boolean {
    const permissions = this._accessControl.get(nodeId);
    if (!permissions) {
        // Default: allow all (opt-in access control)
        return true;
    }
    
    const item = this._items.get(key);
    if (!item) return true;  // Can't deny access to non-existent item
    
    // Check key-based permissions
    const allowedKeys = operation === 'read' 
        ? permissions.read 
        : permissions.write;
    
    if (allowedKeys?.includes(key)) return true;
    
    // Check namespace-based permissions
    const allowedNamespaces = operation === 'read'
        ? permissions.namespaceRead
        : permissions.namespaceWrite;
    
    if (allowedNamespaces && item.metadata.sourceNamespace) {
        for (const pattern of allowedNamespaces) {
            if (this.matchesPattern(pattern, item.metadata.sourceNamespace)) {
                return true;
            }
        }
    }
    
    // Check deny list
    if (permissions.deny?.includes(key)) return false;
    
    // Default: deny if explicit permissions are set
    return false;
}
```

---

### Algorithm 3: Time-Travel (Snapshot) - Implementation Strategy

**The Challenge:** How to reconstruct past states without storing full values in every commit?

**Solution:** Store `previousValue` in commits, with intelligent size limits.

```typescript
interface BackpackCommit {
    commitId: string;
    timestamp: number;
    nodeId: string;
    action: 'pack' | 'unpack';
    key: string;
    valueSummary: string;        // ⚠️ Always truncated (for display)
    previousValue?: any;         // ✅ Full value (for snapshots)
    newValue?: any;              // ✅ Full value (for snapshots)
    valueSize?: number;          // Track memory usage
    metadata: BackpackItemMetadata;
}
```

**Storage Strategy:**

```typescript
// Configuration
private readonly MAX_VALUE_SIZE = 100 * 1024;           // 100KB per value
private readonly MAX_HISTORY_SIZE = 50 * 1024 * 1024;   // 50MB total history
private currentHistorySize = 0;

pack(key: string, value: any, options: PackOptions) {
    const previousItem = this._items.get(key);
    const valueSize = this.estimateSize(value);
    
    // 1. Always store in current state
    this._items.set(key, { key, value, metadata: {...} });
    
    // 2. Decide what to store in history
    let previousValue = undefined;
    let newValue = undefined;
    let storedSize = 0;
    
    if (valueSize < this.MAX_VALUE_SIZE) {
        // ✅ Small value: Store full value in history (enables snapshots)
        previousValue = previousItem?.value;
        newValue = value;
        storedSize = valueSize * 2;  // Store both previous and new
    } else {
        // ⚠️ Large value: Store reference only
        previousValue = previousItem ? { 
            _type: 'large-value-ref',
            key,
            size: this.estimateSize(previousItem.value),
            message: 'Value too large for snapshot (> 100KB)'
        } : undefined;
        
        newValue = { 
            _type: 'large-value-ref',
            key,
            size: valueSize,
            message: 'Value too large for snapshot (> 100KB)'
        };
        
        storedSize = 200;  // Just the reference metadata
    }
    
    // 3. Add to history
    const commit = {
        commitId: generateUUID(),
        action: 'pack',
        key,
        valueSummary: this.truncate(value, 200),
        previousValue,
        newValue,
        valueSize: storedSize,
        metadata: {...}
    };
    
    this._history.push(commit);
    this.currentHistorySize += storedSize;
    
    // 4. Check global memory budget
    if (this.currentHistorySize > this.MAX_HISTORY_SIZE) {
        this.pruneOldCommits();  // ✅ Remove oldest commits
    }
}

private pruneOldCommits() {
    // Simple strategy: Remove oldest 20% of commits
    const targetSize = this.MAX_HISTORY_SIZE * 0.8;
    
    while (this.currentHistorySize > targetSize && this._history.length > 100) {
        const removed = this._history.shift();  // Remove oldest
        this.currentHistorySize -= removed.valueSize;
    }
    
    console.warn(`Pruned old commits. History size: ${this.currentHistorySize} bytes`);
}

private estimateSize(obj: any): number {
    try {
        return JSON.stringify(obj).length;
    } catch (e) {
        return 1000;  // Estimate for circular refs
    }
}
```

**Snapshot Reconstruction:**

### Algorithm 3: Time-Travel (Snapshot)

```typescript
// Base method: Snapshot at timestamp
getSnapshot(timestamp: number): Backpack<T> {
    const relevantCommits = this._history.filter(
        c => c.timestamp <= timestamp
    );
    return this.replayCommits(relevantCommits);
}

// How replay works (the Git checkout equivalent)
private replayCommits(commits: BackpackCommit[]): Backpack<T> {
    const snapshot = new Backpack<T>();
    
    // Replay commits in chronological order
    for (const commit of commits) {
        if (commit.action === 'pack') {
            // ✅ Restore from stored value
            if (commit.newValue && !commit.newValue._ref) {
                snapshot._items.set(commit.key, {
                    key: commit.key,
                    value: commit.newValue,  // ✅ Full value from commit
                    metadata: commit.metadata
                });
            } else {
                // ⚠️ Large value wasn't stored
                // Options:
                // 1. Throw error (can't reconstruct)
                // 2. Use current value (approximation)
                // 3. Mark as unavailable
                
                snapshot._items.set(commit.key, {
                    key: commit.key,
                    value: { _unavailable: true, reason: 'Value too large for snapshot' },
                    metadata: commit.metadata
                });
            }
        } else if (commit.action === 'delete') {
            snapshot._items.delete(commit.key);
        }
        // 'unpack' is read-only, no state change
    }
    
    return snapshot;
}

// Better UX: Snapshot at specific commit
getSnapshotAtCommit(commitId: string): Backpack<T> {
    const commitIndex = this._history.findIndex(c => c.commitId === commitId);
    if (commitIndex === -1) {
        throw new BackpackError(`Commit ${commitId} not found`);
    }
    
    const relevantCommits = this._history.slice(0, commitIndex + 1);
    return this.replayCommits(relevantCommits);
}

// Best UX: Snapshot before a node ran
getSnapshotBeforeNode(nodeId: string): Backpack<T> {
    // Find first commit by this node
    const firstCommitIndex = this._history.findIndex(c => c.nodeId === nodeId);
    if (firstCommitIndex === -1) {
        throw new BackpackError(`No commits found for node ${nodeId}`);
    }
    
    // Get all commits BEFORE this node
    const relevantCommits = this._history.slice(0, firstCommitIndex);
    return this.replayCommits(relevantCommits);
}

// Helper: Replay commits to create snapshot
private replayCommits(commits: BackpackCommit[]): Backpack<T> {
    const snapshot = new Backpack<T>();
    
    for (const commit of commits) {
        if (commit.action === 'pack') {
            snapshot._items.set(commit.key, {
                key: commit.key,
                value: commit.previousValue || commit.valueSummary,  // Use stored value
                metadata: commit.metadata
            });
        } else if (commit.action === 'delete') {
            snapshot._items.delete(commit.key);
        }
        // 'unpack' is read-only, no state change
    }
    
    return snapshot;
}
```

**Optimization:** For frequent snapshots, maintain checkpoints every N commits.

---

### Algorithm 4: Diff (State Comparison)

```typescript
interface BackpackDiff {
    added: string[];      // Keys that didn't exist before
    modified: string[];   // Keys that changed values
    deleted: string[];    // Keys that were removed
    details: Record<string, {
        before: any;
        after: any;
        changedBy: string;  // nodeId that made the change
    }>;
}

diff(snapshot1: Backpack<T>, snapshot2: Backpack<T>): BackpackDiff {
    const diff: BackpackDiff = {
        added: [],
        modified: [],
        deleted: [],
        details: {}
    };
    
    const keys1 = new Set(snapshot1._items.keys());
    const keys2 = new Set(snapshot2._items.keys());
    
    // Find added keys
    for (const key of keys2) {
        if (!keys1.has(key)) {
            diff.added.push(key);
            diff.details[key] = {
                before: undefined,
                after: snapshot2._items.get(key)?.value,
                changedBy: snapshot2._items.get(key)?.metadata.sourceNodeId || 'unknown'
            };
        }
    }
    
    // Find deleted keys
    for (const key of keys1) {
        if (!keys2.has(key)) {
            diff.deleted.push(key);
            diff.details[key] = {
                before: snapshot1._items.get(key)?.value,
                after: undefined,
                changedBy: 'deleted'
            };
        }
    }
    
    // Find modified keys
    for (const key of keys1) {
        if (keys2.has(key)) {
            const val1 = snapshot1._items.get(key)?.value;
            const val2 = snapshot2._items.get(key)?.value;
            
            if (JSON.stringify(val1) !== JSON.stringify(val2)) {
                diff.modified.push(key);
                diff.details[key] = {
                    before: val1,
                    after: val2,
                    changedBy: snapshot2._items.get(key)?.metadata.sourceNodeId || 'unknown'
                };
            }
        }
    }
    
    return diff;
}
```

**Use Case:**
```typescript
const before = backpack.getSnapshotBeforeNode('research-2');
const after = backpack.getSnapshot(Date.now());
const changes = backpack.diff(before, after);

console.log(`research-2 made ${changes.modified.length} changes`);
console.log(`Details:`, changes.details);
```

---

## 5. API Implementation Details

### 5.1 Core API

```typescript
class Backpack<T extends BaseStorage = BaseStorage> {
    
    // Pack: Add/update data
    pack(key: string, value: any, options?: PackOptions): void {
        const item: BackpackItem = {
            key,
            value,
            metadata: {
                sourceNodeId: options?.nodeId || 'unknown',
                sourceNodeName: options?.nodeName || 'unknown',
                sourceNamespace: options?.namespace,
                timestamp: Date.now(),
                version: this.getVersion(key) + 1,
                tags: options?.tags || []
            }
        };
        
        // Store item
        const previousValue = this._items.get(key);
        this._items.set(key, item);
        
        // Update namespace index
        if (item.metadata.sourceNamespace) {
            this.updateNamespaceIndex(key, item.metadata.sourceNamespace);
        }
        
        // Record commit
        this.addToHistory({
            commitId: generateUUID(),
            timestamp: Date.now(),
            nodeId: item.metadata.sourceNodeId,
            action: 'pack',
            key,
            valueSummary: this.summarizeValue(value),
            previousValue
        });
        
        // Emit event (if EventStreamer attached)
        this.emitEvent('BACKPACK_PACK', { key, metadata: item.metadata });
    }
    
    // Unpack: Read data (graceful)
    unpack<V>(key: string, nodeId: string): V | undefined {
        // Check access
        if (!this.checkAccess(key, nodeId, 'read')) {
            if (this.options.strictMode) {
                throw new AccessDeniedError(`Node ${nodeId} cannot read key '${key}'`);
            }
            console.warn(`Access denied: Node ${nodeId} cannot read '${key}'`);
            return undefined;
        }
        
        const item = this._items.get(key);
        
        // Record access
        this.addToHistory({
            commitId: generateUUID(),
            timestamp: Date.now(),
            nodeId,
            action: 'unpack',
            key,
            valueSummary: item ? '[accessed]' : '[not found]'
        });
        
        return item?.value as V | undefined;
    }
    
    // UnpackRequired: Read data (fail-fast)
    unpackRequired<V>(key: string, nodeId: string): V {
        const value = this.unpack<V>(key, nodeId);
        if (value === undefined) {
            throw new BackpackError(`Required key '${key}' not found in Backpack`);
        }
        return value;
    }
}
```

---

### 5.2 Namespace-Aware API

```typescript
class Backpack<T> {
    
    // Get all items from matching namespaces
    unpackByNamespace(pattern: string): Record<string, any> {
        const result: Record<string, any> = {};
        
        for (const [key, item] of this._items) {
            if (item.metadata.sourceNamespace && 
                this.matchesPattern(pattern, item.metadata.sourceNamespace)) {
                result[key] = item.value;
            }
        }
        
        return result;
    }
    
    // Get items with full metadata
    getItemsByNamespace(pattern: string): BackpackItem[] {
        const items: BackpackItem[] = [];
        
        for (const [key, item] of this._items) {
            if (item.metadata.sourceNamespace && 
                this.matchesPattern(pattern, item.metadata.sourceNamespace)) {
                items.push(item);
            }
        }
        
        return items;
    }
}
```

---

## 6. Integration Points

### 6.1 With EventStreamer (PRD-002)

```typescript
class Backpack<T> {
    private eventStreamer?: EventStreamer;
    
    constructor(initialData?: T, options?: BackpackOptions) {
        this.eventStreamer = options?.eventStreamer;
    }
    
    private emitEvent(type: string, payload: any): void {
        if (!this.eventStreamer) return;
        
        this.eventStreamer.emit({
            id: generateUUID(),
            timestamp: Date.now(),
            sourceNode: 'Backpack',
            nodeId: 'backpack-instance',
            type: `BACKPACK_${type}` as StreamEventType,
            payload
        });
    }
}
```

---

### 6.2 With Serialization (PRD-003)

```typescript
class Backpack<T> {
    
    // Serialize to JSON
    toJSON(): BackpackSnapshot {
        return {
            items: Array.from(this._items.entries()),
            history: this._history.slice(-1000),  // Last 1000 commits
            permissions: Object.fromEntries(this._accessControl)
        };
    }
    
    // Deserialize from JSON
    static fromJSON<T>(snapshot: BackpackSnapshot): Backpack<T> {
        const backpack = new Backpack<T>();
        backpack._items = new Map(snapshot.items);
        backpack._history = snapshot.history;
        backpack._accessControl = new Map(Object.entries(snapshot.permissions));
        return backpack;
    }
}
```

---

## 7. Error Handling

### Custom Errors

```typescript
export class BackpackError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BackpackError';
    }
}

export class AccessDeniedError extends BackpackError {
    constructor(message: string) {
        super(message);
        this.name = 'AccessDeniedError';
    }
}
```

---

## 8. Testing Strategy

### Unit Tests (80% coverage target)

```typescript
// tests/storage/backpack.test.ts

describe('Backpack', () => {
    describe('pack/unpack', () => {
        it('should store and retrieve data');
        it('should return undefined for missing keys');
        it('should throw on unpackRequired for missing keys');
        it('should track version numbers');
    });
    
    describe('Access Control', () => {
        it('should allow access with correct permissions');
        it('should deny access without permissions');
        it('should support namespace wildcards');
    });
    
    describe('History', () => {
        it('should record all pack/unpack operations');
        it('should limit history to maxHistorySize');
        it('should support time-travel via getSnapshot');
    });
    
    describe('Namespace Queries', () => {
        it('should match exact namespaces');
        it('should match wildcard patterns');
        it('should handle edge cases (no namespace, invalid pattern)');
    });
});
```

---

## 9. Implementation Phases

### Phase 1: Core Storage (Days 1-3)
- [ ] `Backpack` class skeleton
- [ ] `pack()`, `unpack()`, `unpackRequired()` methods
- [ ] `BackpackItem` and metadata tracking
- [ ] Basic unit tests

### Phase 2: History & Time-Travel (Days 4-6)
- [ ] `BackpackCommit` structure
- [ ] History tracking in `pack()`/`unpack()`
- [ ] `getHistory()` method
- [ ] `getSnapshot(timestamp)` implementation
- [ ] Time-travel tests

### Phase 3: Access Control (Days 7-10)
- [ ] `AccessControl` types
- [ ] `checkAccess()` method
- [ ] Key-based permissions
- [ ] Namespace-based permissions with wildcards
- [ ] Access control tests

### Phase 4: Namespace API (Days 11-13)
- [ ] Namespace index
- [ ] `unpackByNamespace()` method
- [ ] `getItemsByNamespace()` method
- [ ] Pattern matching algorithm
- [ ] Namespace query tests

### Phase 5: Integration & Polish (Days 14-20)
- [ ] EventStreamer integration hooks
- [ ] Serialization (`toJSON`/`fromJSON`)
- [ ] Performance optimization
- [ ] Documentation
- [ ] Integration tests
- [ ] Code review & refinement

---

## 10. Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| `pack()` | < 1ms | Includes history commit |
| `unpack()` | < 0.5ms | Map lookup + access check |
| `unpackByNamespace()` | < 5ms | For 100 items |
| `getSnapshot()` | < 50ms | For 1000 commits |
| Memory | < 10MB | For 10k commits |

---

## 11. Open Implementation Questions

**Q1:** Should namespace index be updated lazily or eagerly?  
**Proposal:** Eagerly on `pack()` to keep queries fast.

**Q2:** How to handle circular references in `pack()`?  
**Proposal:** Use `JSON.stringify` for `valueSummary` - it will throw on circular refs, which is acceptable.

**Q3:** Should we support `unpack()` with no `nodeId` (bypass access control)?  
**Decision:** Yes, but not for backwards compat - for developer convenience. `nodeId` is optional; if omitted, skip access check (useful for debugging/testing).

---

## 12. Code Location

```
src/
└── storage/
    ├── backpack.ts              # Main Backpack class
    ├── types.ts                 # BackpackItem, BackpackCommit, etc.
    ├── access-control.ts        # AccessControl logic
    ├── pattern-matcher.ts       # Namespace wildcard matching
    └── errors.ts                # Custom error classes

tests/
└── storage/
    ├── backpack.test.ts
    ├── access-control.test.ts
    ├── time-travel.test.ts
    └── namespace-queries.test.ts
```

---

**Ready to implement:** ✅  
**Estimated LOC:** ~600 lines of implementation + 400 lines of tests

