# Backpack Memory Management Strategy

**The Challenge:** Balance between snapshot capability and memory usage.

---

## The Problem

```typescript
// Agent runs for 1 hour with 10,000 commits
// Average value size: 50KB
// Memory needed: 10,000 × 50KB × 2 (previous + new) = 1GB!

// ❌ This is too much for in-memory storage
```

---

## ✅ The Solution: Multi-Layer Strategy

### Layer 1: Per-Value Size Limit

**Principle:** Don't store large values in history (they don't compress well anyway).

```typescript
const MAX_VALUE_SIZE = 100 * 1024;  // 100KB

if (valueSize < MAX_VALUE_SIZE) {
    // ✅ Store in history (snapshots work)
    commit.newValue = actualValue;
} else {
    // ⚠️ Store reference only
    commit.newValue = {
        _type: 'large-value-ref',
        key: 'productCatalog',
        size: 5242880,  // 5MB
        message: 'Value too large for snapshot (> 100KB)'
    };
}
```

**Effect:**
- ✅ Small values (< 100KB): Full snapshots work
- ⚠️ Large values (> 100KB): Current value accessible, snapshots limited

---

### Layer 2: Global Memory Budget

**Principle:** Cap total history size, prune oldest commits when exceeded.

```typescript
const MAX_HISTORY_SIZE = 50 * 1024 * 1024;  // 50MB total

pack(key: string, value: any) {
    // Add commit
    this._history.push(commit);
    this.currentHistorySize += commit.valueSize;
    
    // Check budget
    if (this.currentHistorySize > MAX_HISTORY_SIZE) {
        this.pruneOldCommits();  // ✅ Remove oldest 20%
    }
}
```

**Effect:**
- ✅ Memory bounded (never exceeds 50MB)
- ⚠️ Very old snapshots unavailable (pruned)
- ✅ Recent history intact (last ~80% of commits)

---

## How References Work

### Question: "How do you ref to a large object/value?"

**Answer:** The large value IS stored (in `_items`), just NOT in history.

### Visual Explanation

```
┌─────────────────────────────────────────────────────┐
│ Backpack Instance                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  _items (Current State) - ALWAYS FULL VALUES       │
│  ┌───────────────────────────────────────────┐    │
│  │ 'decision' → {                             │    │
│  │   value: "approved",  ✅ 10 bytes          │    │
│  │   metadata: { ... }                        │    │
│  │ }                                          │    │
│  │                                            │    │
│  │ 'productCatalog' → {                       │    │
│  │   value: [/* 5MB array */],  ✅ FULL VALUE │    │
│  │   metadata: { ... }                        │    │
│  │ }                                          │    │
│  └───────────────────────────────────────────┘    │
│                                                     │
│  _history (Commits) - SIZE-LIMITED                 │
│  ┌───────────────────────────────────────────┐    │
│  │ Commit 1: 'decision'                       │    │
│  │   newValue: "approved"  ✅ Stored (10 bytes)│    │
│  │                                            │    │
│  │ Commit 2: 'productCatalog'                 │    │
│  │   newValue: {                              │    │
│  │     _type: 'large-value-ref',  ⚠️ Reference│    │
│  │     size: 5242880                          │    │
│  │   }                                        │    │
│  └───────────────────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘

Access patterns:

1. Current value (always works):
   backpack.unpack('productCatalog')
   → Returns FULL 5MB array from _items ✅

2. Snapshot (limited for large values):
   backpack.getSnapshotAtCommit('abc123')
   → 'decision' = "approved" ✅
   → 'productCatalog' = { _unavailable: true } ⚠️
```

---

## Complete API Examples

### Example 1: Small Value (Snapshots Work)

```typescript
// Pack small value
backpack.pack('decision', 'approved');  // 10 bytes

// Current value
backpack.unpack('decision');  
// ✅ 'approved'

// Snapshot
const snapshot = backpack.getSnapshotAtCommit('abc123');
snapshot.unpack('decision');
// ✅ 'approved' (full snapshot works)
```

---

### Example 2: Large Value (Snapshot Limited)

```typescript
// Pack large value
const hugeCatalog = [/* 5MB of products */];
backpack.pack('productCatalog', hugeCatalog);

// What gets stored:
// _items:
//   'productCatalog' → [FULL 5MB array] ✅
//
// _history:
//   newValue: { _type: 'large-value-ref', size: 5242880 } ⚠️

// Current value (works!)
backpack.unpack('productCatalog');
// ✅ Returns FULL 5MB array

// Snapshot (limited)
const snapshot = backpack.getSnapshotAtCommit('abc123');
snapshot.unpack('productCatalog');
// ⚠️ Returns:
// {
//   _unavailable: true,
//   reason: 'Value too large for snapshot (> 100KB)',
//   size: 5242880,
//   accessCurrentValue: 'Use backpack.unpack() instead'
// }
```

---

### Example 3: Memory Budget Exceeded

```typescript
// Agent runs for 1 hour
for (let i = 0; i < 10000; i++) {
    backpack.pack(`data_${i}`, { /* 50KB */ });
}

// Internally:
// After ~1000 commits (50MB total):
// → pruneOldCommits() triggers
// → Removes oldest 200 commits (20%)
// → Keeps newest 800 commits (40MB)

// Result:
backpack.getHistory().length;
// ✅ ~800 commits (not 10,000)

backpack.getSnapshotAtCommit('very-old-commit');
// ⚠️ Error: Commit pruned (no longer in history)

backpack.getSnapshotAtCommit('recent-commit');
// ✅ Works (recent commits still in history)
```

---

## Configuration Options

### Recommended Defaults (v2.0)

```typescript
interface BackpackOptions {
    maxValueSize?: number;      // Default: 100KB
    maxHistorySize?: number;    // Default: 50MB
    pruneStrategy?: 'oldest' | 'least-accessed' | 'none';  // Default: 'oldest'
    prunePercentage?: number;   // Default: 0.2 (remove 20% when full)
}

// Usage:
const backpack = new Backpack({
    maxValueSize: 200 * 1024,    // 200KB per value
    maxHistorySize: 100 * 1024 * 1024,  // 100MB total
    pruneStrategy: 'oldest'
});
```

---

### Tuning for Different Use Cases

**Case 1: Short-Lived Agent (< 1 minute)**
```typescript
{
    maxValueSize: 1024 * 1024,   // 1MB (larger values OK)
    maxHistorySize: 10 * 1024 * 1024,  // 10MB (small history)
    pruneStrategy: 'none'        // Never prune (short-lived)
}
```

**Case 2: Long-Running Agent (hours)**
```typescript
{
    maxValueSize: 50 * 1024,     // 50KB (stricter)
    maxHistorySize: 50 * 1024 * 1024,  // 50MB
    pruneStrategy: 'oldest'      // Prune oldest commits
}
```

**Case 3: High-Frequency Data (many small commits)**
```typescript
{
    maxValueSize: 10 * 1024,     // 10KB (very strict)
    maxHistorySize: 100 * 1024 * 1024,  // 100MB (larger buffer)
    pruneStrategy: 'least-accessed'  // Keep frequently accessed
}
```

---

## Advanced: Disk Offload (Future: v2.1+)

**Your suggestion:** Offload old commits to disk instead of deleting them.

```typescript
class Backpack {
    private _history: BackpackCommit[];           // Hot (in-memory)
    private _archivedCommitIds: Set<string>;      // Cold (on disk)
    
    private async offloadOldCommits() {
        const toOffload = this._history.splice(0, 200);
        
        // Write to disk (SQLite, file, etc.)
        await fs.writeFile(
            `.backpack/commits-${Date.now()}.json`,
            JSON.stringify(toOffload)
        );
        
        // Track archived IDs
        toOffload.forEach(c => this._archivedCommitIds.add(c.commitId));
    }
    
    async getSnapshotAtCommit(commitId: string): Promise<Backpack> {
        // Check memory first
        let commit = this._history.find(c => c.commitId === commitId);
        
        if (!commit && this._archivedCommitIds.has(commitId)) {
            // ✅ Load from disk
            commit = await this.loadFromArchive(commitId);
        }
        
        if (!commit) {
            throw new Error('Commit not found (pruned or never existed)');
        }
        
        return this.replayCommits([commit]);
    }
}
```

**Pros:**
- ✅ All history preserved (never lose data)
- ✅ Memory still bounded
- ✅ Old snapshots still accessible (slower, but possible)

**Cons:**
- ❌ Disk I/O complexity
- ❌ Async APIs (getSnapshot becomes async)
- ❌ File management overhead
- ❌ Not suitable for browser/edge environments

**Decision for v2.0:** Skip disk offload, implement in v2.1 if users need it.

---

## Comparison: Memory Strategies

| Strategy | Memory Usage | Snapshot Capability | Complexity |
|----------|--------------|-------------------|------------|
| **No Limits** | Unbounded (1GB+) | ✅ Full history | Simple |
| **Per-Value Limit** | Medium (50-100MB) | ✅ Small values<br>⚠️ Large values limited | Medium |
| **Global Budget** | Bounded (50MB) | ✅ Recent history<br>⚠️ Old history pruned | Medium |
| **Hybrid (Recommended)** | Bounded (50MB) | ✅ Recent small values<br>⚠️ Old/large values limited | Medium |
| **Disk Offload** | Bounded (50MB RAM) | ✅ Full history (from disk) | Complex |

---

## Implementation Checklist

### v2.0 (Current)

- [x] Per-value size limit (100KB)
- [x] Global memory budget (50MB)
- [x] Automatic pruning (oldest 20%)
- [x] Large value references
- [x] Configurable limits
- [ ] Snapshot error messages (clear feedback)
- [ ] Memory usage API (`backpack.getMemoryUsage()`)

### v2.1 (Future)

- [ ] Disk offload (SQLite/file-based)
- [ ] Compression (gzip for large values)
- [ ] Smart pruning (least-accessed first)
- [ ] Checkpoint API (save/restore entire state)

---

## Key Takeaways

1. **Large values ARE accessible** - They're in `_items` (current state)
2. **References point to current state** - Not a separate storage
3. **Memory is bounded** - 50MB default (configurable)
4. **Old commits get pruned** - Recent history (80%) always available
5. **Snapshots have limits** - Work for small values, limited for large
6. **Disk offload is possible** - But deferred to v2.1 (complexity vs benefit)

Your suggestion about disk offload is excellent for v2.1! For v2.0, we'll keep it simple with in-memory limits. 🎯

