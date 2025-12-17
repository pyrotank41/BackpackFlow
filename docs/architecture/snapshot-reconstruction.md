# How Snapshot Reconstruction Works

**The Question:** If we only store summaries in history, how do we do `git checkout`?

**The Answer:** We store full values in commits (not just summaries).

---

## The Problem

```typescript
// What we DON'T want (can't reconstruct):
_history = [
    { key: 'data', valueSummary: '"Version 1"' },  // ❌ Summary only
    { key: 'data', valueSummary: '"Version 2"' }   // ❌ Summary only
]

// ❓ How do we get Version 1 back?
// Answer: WE CAN'T! Summaries don't contain enough information.
```

---

## The Solution: Store Full Values

```typescript
// What we DO (can reconstruct):
_history = [
    {
        key: 'data',
        valueSummary: '"Version 1"',              // ⚠️ For display
        previousValue: undefined,                 // ✅ No previous (first commit)
        newValue: { full: "Version 1 data" }      // ✅ Full value stored!
    },
    {
        key: 'data',
        valueSummary: '"Version 2"',              // ⚠️ For display
        previousValue: { full: "Version 1 data" }, // ✅ Full previous value
        newValue: { full: "Version 2 data" }      // ✅ Full new value
    }
]

// ✅ Now we can reconstruct any version!
```

---

## Step-by-Step: How `getSnapshot()` Works

### Example Flow

```typescript
// Agent makes 3 changes:
backpack.pack('data', { version: 1, content: 'Hello' });      // Commit abc123
backpack.pack('data', { version: 2, content: 'World' });      // Commit def456
backpack.pack('data', { version: 3, content: 'Goodbye' });    // Commit ghi789
```

### State After 3 Commits

**Current State (_items):**
```typescript
_items = {
    'data': {
        value: { version: 3, content: 'Goodbye' },  // ✅ Only current version
        metadata: { ... }
    }
}
```

**History (_history):**
```typescript
_history = [
    {
        commitId: 'abc123',
        timestamp: 1000,
        key: 'data',
        valueSummary: '{ "version": 1, "content": "Hello" }',  // For logs
        previousValue: undefined,                              // No previous
        newValue: { version: 1, content: 'Hello' },           // ✅ FULL VALUE
        metadata: { ... }
    },
    {
        commitId: 'def456',
        timestamp: 2000,
        key: 'data',
        valueSummary: '{ "version": 2, "content": "World" }',  // For logs
        previousValue: { version: 1, content: 'Hello' },      // ✅ FULL PREVIOUS
        newValue: { version: 2, content: 'World' },           // ✅ FULL NEW
        metadata: { ... }
    },
    {
        commitId: 'ghi789',
        timestamp: 3000,
        key: 'data',
        valueSummary: '{ "version": 3, "content": "Goodbye" }',
        previousValue: { version: 2, content: 'World' },      // ✅ FULL PREVIOUS
        newValue: { version: 3, content: 'Goodbye' },         // ✅ FULL NEW
        metadata: { ... }
    }
]
```

### Reconstruct Version 1 (Git Checkout Equivalent)

```typescript
// User wants to see state at commit abc123
const snapshot = backpack.getSnapshotAtCommit('abc123');

// How it works:
function getSnapshotAtCommit(commitId: string): Backpack {
    // 1. Find all commits up to and including this one
    const commits = this._history.filter(c => c.timestamp <= targetTimestamp);
    // commits = [abc123]  (only first commit)
    
    // 2. Create empty Backpack
    const snapshot = new Backpack();
    
    // 3. Replay commits
    for (const commit of commits) {
        if (commit.action === 'pack') {
            snapshot._items.set(commit.key, {
                key: commit.key,
                value: commit.newValue,  // ✅ Use stored full value
                metadata: commit.metadata
            });
        }
    }
    
    // 4. Return snapshot
    return snapshot;
}

// Result:
snapshot._items = {
    'data': {
        value: { version: 1, content: 'Hello' },  // ✅ Version 1 reconstructed!
        metadata: { ... }
    }
}
```

### Reconstruct Version 2

```typescript
const snapshot = backpack.getSnapshotAtCommit('def456');

// Replay commits [abc123, def456]:
// Step 1: Apply abc123
snapshot._items.set('data', { version: 1, content: 'Hello' });

// Step 2: Apply def456 (overwrites)
snapshot._items.set('data', { version: 2, content: 'World' });

// Result:
snapshot._items = {
    'data': { value: { version: 2, content: 'World' } }  // ✅ Version 2!
}
```

---

## Visual Diagram

```
Timeline:
─────────────────────────────────────────────────────────────
   t=1000          t=2000          t=3000
   abc123          def456          ghi789
   v1: Hello       v2: World       v3: Goodbye
   ↓               ↓               ↓
   
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Commit 1     │ │ Commit 2     │ │ Commit 3     │
├──────────────┤ ├──────────────┤ ├──────────────┤
│ newValue:    │ │ previousValue│ │ previousValue│
│  v1: Hello   │ │  v1: Hello   │ │  v2: World   │
│              │ │ newValue:    │ │ newValue:    │
│              │ │  v2: World   │ │  v3: Goodbye │
└──────────────┘ └──────────────┘ └──────────────┘
     │                 │                 │
     │                 │                 │
     └─────────────────┴─────────────────┘
                       │
                  _history[]
                       
─────────────────────────────────────────────────────────────

Reconstruct at t=2000 (def456):
  1. Replay abc123 → { v1: Hello }
  2. Replay def456 → { v2: World }  ✅ Result
  
Reconstruct at t=3000 (ghi789):
  1. Replay abc123 → { v1: Hello }
  2. Replay def456 → { v2: World }
  3. Replay ghi789 → { v3: Goodbye }  ✅ Result
```

---

## Memory Trade-offs

### Option 1: Store Full Values (Recommended for v2.0)

```typescript
_history = [
    { previousValue: { /* 10KB */ }, newValue: { /* 10KB */ } },
    { previousValue: { /* 10KB */ }, newValue: { /* 10KB */ } },
    // ...1000 commits
]

// Memory: 1000 commits × 20KB = 20MB
```

**Pros:**
- ✅ Snapshots are instant
- ✅ Simple implementation
- ✅ Reliable (always works)

**Cons:**
- ❌ Uses more memory

---

### Option 2: Size-Limited Storage (Practical Approach)

```typescript
const MAX_VALUE_SIZE = 100 * 1024;  // 100KB

pack(key: string, value: any) {
    const size = JSON.stringify(value).length;
    
    if (size < MAX_VALUE_SIZE) {
        // ✅ Small: Store full value
        commit.newValue = value;
    } else {
        // ⚠️ Large: Store reference only
        commit.newValue = { _ref: 'too-large', size };
    }
}
```

**Pros:**
- ✅ Caps memory usage
- ✅ Works for most cases (small values)

**Cons:**
- ⚠️ Large values can't be reconstructed
- ⚠️ Need fallback strategy

---

### Option 3: Delta Compression (Future: v2.1+)

```typescript
_history = [
    { newValue: { /* 10KB full */ }, isDelta: false },  // Base
    { delta: { field: 'updated' }, basCommit: 'abc123' },  // Delta
    { delta: { field: 'changed' }, baseCommit: 'def456' }  // Delta
]

// Memory: 1 full + 999 deltas × 100 bytes = 10KB + 100KB = 110KB
```

**Pros:**
- ✅ Very memory efficient
- ✅ Like Git pack files

**Cons:**
- ❌ Complex implementation
- ❌ Slower reconstructions
- ❌ Overkill for v2.0

---

## Comparison with Git

### Git's Approach

```bash
# Git stores full objects in .git/objects/
$ git cat-file -p abc123
Hello World  # ✅ Full snapshot stored

# Later, Git compresses with pack files
$ git gc
# Creates deltas between similar objects
```

### Backpack's Approach (v2.0)

```typescript
// Store full values up to size limit
if (size < 100KB) {
    commit.newValue = fullValue;  // ✅ Like Git objects
} else {
    commit.newValue = reference;  // ⚠️ Reference only
}

// Future: v2.1 could add delta compression (like git gc)
```

---

## Implementation Recommendation

### For v2.0: Simple and Reliable

```typescript
interface BackpackCommit {
    valueSummary: string;         // ⚠️ For display (always truncated)
    previousValue?: any;          // ✅ For snapshots (full value, optional)
    newValue?: any;               // ✅ For snapshots (full value, optional)
    valueSize?: number;           // Track memory
}

// Store full values for values < 100KB
// Store reference for values > 100KB
// Accept that huge values can't be reconstructed
```

**Why:**
- ✅ Handles 99% of use cases (most values are < 100KB)
- ✅ Simple to implement
- ✅ Predictable memory usage
- ✅ Can optimize later (v2.1: delta compression)

---

## Example: Small vs Large Values

### Small Value (< 100KB)

```typescript
backpack.pack('decision', 'approved');

// Stored in history:
{
    valueSummary: '"approved"',
    newValue: 'approved',  // ✅ Full value (6 bytes)
    valueSize: 6
}

// Snapshot works perfectly:
const snapshot = backpack.getSnapshotAtCommit('abc123');
console.log(snapshot.unpack('decision'));  // ✅ 'approved'
```

### Large Value (> 100KB)

```typescript
backpack.pack('productCatalog', { /* 500KB of data */ });

// Stored in history:
{
    valueSummary: '[Object] [truncated 500KB]',
    newValue: { _ref: 'too-large', size: 512000 },  // ⚠️ Reference only
    valueSize: 512000
}

// Snapshot has limitation:
const snapshot = backpack.getSnapshotAtCommit('abc123');
console.log(snapshot.unpack('productCatalog'));
// ⚠️ { _unavailable: true, reason: 'Value too large for snapshot' }

// But current value still works:
backpack.unpack('productCatalog');  // ✅ Full value from _items
```

---

## Key Takeaway

**Question:** "How can we do `git checkout` if we don't store full values?"

**Answer:** "We DO store full values - in the `newValue` and `previousValue` fields of each commit."

- ✅ `valueSummary` is for display (logs, debugging)
- ✅ `newValue`/`previousValue` are for snapshots (reconstruction)
- ✅ Size limits prevent memory explosion
- ✅ Works like Git's object storage

This is why Backpack truly is "Git for agent state"! 🎯

