# Backpack Flow Example: Complete Walkthrough

**Scenario:** Sales agent processes user query through research → decision → response

---

## Initial State

```typescript
// User starts the flow
const backpack = new Backpack();
backpack.pack('userQuery', "Get a quote for 10A MCB", {
    nodeId: 'user-input',
    nodeName: 'UserInput'
});

// Backpack contents:
{
    userQuery: {
        value: "Get a quote for 10A MCB",
        metadata: {
            sourceNodeId: 'user-input',
            sourceNodeName: 'UserInput',
            timestamp: 1734567890000,
            version: 1
        }
    }
}
```

---

## Step 1: ResearchNode Executes

### 1.1 PrepPhase

```typescript
async prep(backpack: Backpack) {
    // Node tries to unpack
    const query = this.backpack.unpackRequired('userQuery', this.id);
    
    // Backpack checks:
    // ✅ Does key 'userQuery' exist? YES
    // ✅ Does this node have read permission? YES (in permissions.read)
    // ✅ Return value: "Get a quote for 10A MCB"
    
    // History logged:
    // { action: 'unpack', key: 'userQuery', nodeId: 'research-node-123', timestamp: ... }
    
    return query;
}
```

### 1.2 Exec Phase

```typescript
async exec(prepRes: string) {
    // Query: "Get a quote for 10A MCB"
    const results = await searchDatabase(prepRes);
    
    return {
        productName: "10A Miniature Circuit Breaker",
        price: 24.99,
        stock: 150,
        specs: "..."
    };
}
```

### 1.3 Post Phase

```typescript
async post(backpack: Backpack, prepRes: string, execRes: any) {
    // Pack the results
    this.backpack.pack('researchResults', execRes, {
        nodeId: this.id,
        nodeName: 'ResearchNode',
        namespace: 'sales.research',
        tags: ['research-data']
    });
    
    // Backpack now contains:
    {
        userQuery: { ... },  // Still there!
        researchResults: {
            value: {
                productName: "10A MCB",
                price: 24.99,
                stock: 150,
                specs: "..."
            },
            metadata: {
                sourceNodeId: 'research-node-123',
                sourceNodeName: 'ResearchNode',
                sourceNamespace: 'sales.research',
                timestamp: 1734567891000,
                version: 1,
                tags: ['research-data']
            }
        }
    }
    
    // History logged:
    // { action: 'pack', key: 'researchResults', nodeId: 'research-node-123', ... }
    
    return 'default';  // Continue to DecisionNode
}
```

---

## Step 2: DecisionNode Executes

### 2.1 Prep Phase

```typescript
async prep(backpack: Backpack) {
    // Node declares permissions:
    // read: ['researchResults', 'userQuery']
    // write: ['decision', 'confidence']
    
    // Try to unpack
    const results = this.backpack.unpack('researchResults', this.id);
    
    // Backpack checks:
    // ✅ Key exists? YES
    // ✅ Node has read permission? YES
    // ✅ Return value: { productName: "10A MCB", price: 24.99, ... }
    
    // What if node tried to read something else?
    // const debug = this.backpack.unpack('debug_info', this.id);
    // ❌ Access denied! Not in permissions.read
    
    return results;
}
```

### 2.2 Exec Phase

```typescript
async exec(prepRes: any) {
    // Analyze: Stock is good, price is reasonable
    const analysis = await analyzeResults(prepRes);
    
    return {
        decision: 'approved',
        confidence: 0.95,
        reasoning: 'Product available, price normal'
    };
}
```

### 2.3 Post Phase

```typescript
async post(backpack: Backpack, prepRes: any, execRes: any) {
    // Pack decision
    this.backpack.pack('decision', execRes.decision, {
        nodeId: this.id,
        nodeName: 'DecisionNode',
        namespace: 'sales.decision'
    });
    
    this.backpack.pack('confidence', execRes.confidence, {
        nodeId: this.id,
        nodeName: 'DecisionNode',
        namespace: 'sales.decision'
    });
    
    // Backpack now contains:
    {
        userQuery: { ... },          // Still there
        researchResults: { ... },    // Still there
        decision: {
            value: 'approved',
            metadata: {
                sourceNodeId: 'decision-node-456',
                sourceNodeName: 'DecisionNode',
                sourceNamespace: 'sales.decision',
                timestamp: 1734567892000,
                version: 1
            }
        },
        confidence: {
            value: 0.95,
            metadata: { ... }
        }
    }
    
    return 'default';  // Continue to ResponseNode
}
```

---

## Step 3: ResponseNode Executes

### 3.1 Prep Phase

```typescript
async prep(backpack: Backpack) {
    // Node permissions:
    // read: ['userQuery', 'researchResults', 'decision', 'confidence']
    // write: ['finalAnswer']
    
    // Gather all needed data
    const query = this.backpack.unpack('userQuery', this.id);
    const results = this.backpack.unpack('researchResults', this.id);
    const decision = this.backpack.unpack('decision', this.id);
    const confidence = this.backpack.unpack('confidence', this.id);
    
    return { query, results, decision, confidence };
}
```

### 3.2 Exec Phase

```typescript
async exec(prepRes: any) {
    // Build final response
    const prompt = `
        User asked: ${prepRes.query}
        Product info: ${JSON.stringify(prepRes.results)}
        Decision: ${prepRes.decision}
        Confidence: ${prepRes.confidence}
        
        Generate a professional quote.
    `;
    
    const response = await callLLM(prompt);
    return response;
}
```

### 3.3 Post Phase

```typescript
async post(backpack: Backpack, prepRes: any, execRes: string) {
    this.backpack.pack('finalAnswer', execRes, {
        nodeId: this.id,
        nodeName: 'ResponseNode',
        namespace: 'sales.response',
        tags: ['final-output']
    });
    
    // Final Backpack state:
    {
        userQuery: { ... },
        researchResults: { ... },
        decision: { ... },
        confidence: { ... },
        finalAnswer: {
            value: "Quote for 10A MCB: $24.99...",
            metadata: {
                sourceNodeId: 'response-node-789',
                sourceNodeName: 'ResponseNode',
                sourceNamespace: 'sales.response',
                timestamp: 1734567893000,
                version: 1,
                tags: ['final-output']
            }
        }
    }
    
    return undefined;  // Flow ends
}
```

---

## Complete History Log

After the flow completes, `backpack.getHistory()` shows:

```javascript
[
    {
        commitId: 'abc123',
        timestamp: 1734567890000,
        nodeId: 'user-input',
        action: 'pack',
        key: 'userQuery',
        valueSummary: '"Get a quote for 10A MCB"',  // ⚠️ Truncated for display
        metadata: {
            sourceNodeId: 'user-input',
            sourceNodeName: 'UserInput',
            sourceNamespace: 'input',  // ✅ Namespace IS tracked!
            timestamp: 1734567890000,
            version: 1
        }
    },
    {
        commitId: 'def456',
        timestamp: 1734567890100,
        nodeId: 'research-node-123',
        action: 'unpack',
        key: 'userQuery',
        valueSummary: '[accessed]',  // ⚠️ Just a marker, full value NOT stored in commit
        metadata: {
            sourceNodeId: 'user-input',  // Original source
            sourceNamespace: 'input'
        }
    },
    {
        commitId: 'ghi789',
        timestamp: 1734567891000,
        nodeId: 'research-node-123',
        action: 'pack',
        key: 'researchResults',
        valueSummary: '{ "productName": "10A MCB", "price": 24.99, ... } [truncated]',  // ⚠️ Truncated
        previousValue: undefined,  // ✅ Full value stored for snapshots (if needed)
        metadata: {
            sourceNodeId: 'research-node-123',
            sourceNodeName: 'ResearchNode',
            sourceNamespace: 'sales.research',  // ✅ Namespace tracked
            timestamp: 1734567891000,
            version: 1,
            tags: ['research-data']
        }
    },
    {
        commitId: 'jkl012',
        timestamp: 1734567891100,
        nodeId: 'decision-node-456',
        action: 'unpack',
        key: 'researchResults',
        valueSummary: '[accessed]',  // ⚠️ Marker only
        metadata: {
            sourceNodeId: 'research-node-123',  // Who originally packed this
            sourceNamespace: 'sales.research'
        }
    },
    {
        commitId: 'mno345',
        timestamp: 1734567892000,
        nodeId: 'decision-node-456',
        action: 'pack',
        key: 'decision',
        valueSummary: '"approved"',
        metadata: {
            sourceNodeId: 'decision-node-456',
            sourceNodeName: 'DecisionNode',
            sourceNamespace: 'sales.decision',  // ✅ Namespace tracked
            timestamp: 1734567892000,
            version: 1
        }
    },
    {
        commitId: 'pqr678',
        timestamp: 1734567892001,
        nodeId: 'decision-node-456',
        action: 'pack',
        key: 'confidence',
        valueSummary: '0.95',
        metadata: {
            sourceNodeId: 'decision-node-456',
            sourceNodeName: 'DecisionNode',
            sourceNamespace: 'sales.decision',  // ✅ Namespace tracked
            timestamp: 1734567892001,
            version: 1
        }
    },
    // ... more entries for ResponseNode
]
```

### Key Points About History Storage:

1. **`valueSummary`** - Display only (truncated to ~200 chars)
2. **`previousValue`** - Optional, full value stored for snapshots
3. **`metadata.sourceNamespace`** - YES, namespace is tracked!
4. **For `unpack`** - Only logs access, doesn't store value again

---

## Storage Strategy Explained

### Where Full Values Are Stored

```typescript
class Backpack {
    private _items: Map<string, BackpackItem>;    // ✅ Full values stored here
    private _history: BackpackCommit[];           // ⚠️ Summaries stored here
}
```

### Why Two Locations?

**Problem:** If we store full values in every commit, memory explodes:
- 1000 commits × 1KB per value = 1MB just for history!
- Time-travel snapshots would be slow (deep copying large objects)

**Solution:** Store full values once, summaries in history:

```typescript
// When packing
pack(key: string, value: any) {
    const largeObject = {
        productCatalog: [/* 10,000 products */],
        specifications: [/* huge data */]
    };
    
    // ✅ Full value: Stored in _items (single copy)
    this._items.set(key, {
        key,
        value: largeObject,  // Full 500KB object
        metadata: { ... }
    });
    
    // ⚠️ Summary: Stored in _history (tiny)
    this._history.push({
        action: 'pack',
        key,
        valueSummary: '{ "productCatalog": [Array(10000)], ... } [500KB truncated]',
        previousValue: undefined  // or previous full value for snapshots
    });
}
```

### When Do We Need Full Values in History?

**For Snapshots:**

```typescript
getSnapshot(timestamp: number): Backpack {
    // Need to rebuild state from commits
    // Option 1: Store previousValue in commits (memory heavy)
    // Option 2: Replay from _items + commit log (current approach)
    
    // Current approach: We don't store full values in commits
    // Instead, we replay the commit sequence
}
```

### Example: Large vs Small Values

**Small Value (Store Summary):**
```javascript
{
    key: 'decision',
    valueSummary: '"approved"',  // Full value fits in summary
    metadata: { ... }
}
```

**Large Value (Truncate Summary):**
```javascript
{
    key: 'productCatalog',
    valueSummary: '[Array(10000)] { id: 1, name: "MCB", ... } [truncated 498KB]',
    metadata: { ... }
}
```

### Accessing Full Values

```typescript
// From current state
const product = backpack.unpack('productCatalog');  
// ✅ Returns full 500KB object from _items

// From history (for display)
const history = backpack.getHistory();
console.log(history[5].valueSummary);  
// ⚠️ Shows truncated: "[Array(10000)] ..."

// From snapshot (time-travel)
const snapshot = backpack.getSnapshotAtCommit('abc123');
const product = snapshot.unpack('productCatalog');
// ✅ Returns full object (reconstructed from commits)
```

### Visual: Where Data Lives

```
┌─────────────────────────────────────────────────────────────┐
│ Backpack Instance                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  _items (Active State)                                      │
│  ┌───────────────────────────────────────────────────┐    │
│  │ 'userQuery' → {                                    │    │
│  │   value: "Get a quote for 10A MCB",  ✅ FULL      │    │
│  │   metadata: { namespace: 'input', ... }            │    │
│  │ }                                                  │    │
│  │                                                    │    │
│  │ 'researchResults' → {                              │    │
│  │   value: { productName: "...", ... }, ✅ FULL     │    │
│  │   metadata: { namespace: 'sales.research', ... }   │    │
│  │ }                                                  │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
│  _history (Commit Log)                                      │
│  ┌───────────────────────────────────────────────────┐    │
│  │ [                                                  │    │
│  │   {                                                │    │
│  │     action: 'pack',                                │    │
│  │     key: 'userQuery',                              │    │
│  │     valueSummary: '"Get a quote..."', ⚠️ SUMMARY  │    │
│  │     metadata: { namespace: 'input' } ✅ TRACKED   │    │
│  │   },                                               │    │
│  │   {                                                │    │
│  │     action: 'unpack',                              │    │
│  │     key: 'userQuery',                              │    │
│  │     valueSummary: '[accessed]', ⚠️ MARKER ONLY    │    │
│  │     metadata: { namespace: 'input' }               │    │
│  │   },                                               │    │
│  │   {                                                │    │
│  │     action: 'pack',                                │    │
│  │     key: 'researchResults',                        │    │
│  │     valueSummary: '{ "product"... [truncated]',   │    │
│  │     metadata: { namespace: 'sales.research' }      │    │
│  │   }                                                │    │
│  │ ]                                                  │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Memory Usage:**
- **_items:** ~1MB (current state, full values)
- **_history:** ~20MB (10k commits × 2KB average with full values)
- **Total:** ~21MB

**Wait, how do snapshots work then?**

Good question! For snapshots to work, we DO store full values:

```typescript
{
    valueSummary: '"Hello"',          // ⚠️ For display (truncated)
    previousValue: { /* full v1 */ }, // ✅ For snapshots (full value)
    newValue: { /* full v2 */ }       // ✅ For snapshots (full value)
}
```

**See:** [snapshot-reconstruction.md](./snapshot-reconstruction.md) for complete explanation.

**Trade-off:**
- More memory (store full values in commits)
- But enables time-travel debugging (like Git)
- Size limits prevent explosion (values > 100KB stored as references)

---

## Key Differences from SharedStore

### v1.x SharedStore (❌ Problems)

```typescript
// ❌ Direct mutation, no tracking
shared.researchResults = data;

// ❌ Anyone can read anything
const x = shared.someRandomKey;

// ❌ No history
// Can't see who added what, when

// ❌ "Cleanup" loses data
shared.researchResults = null;
```

### v2.0 Backpack (✅ Benefits)

```typescript
// ✅ Explicit API, automatic metadata
backpack.pack('researchResults', data, { nodeId, nodeName, namespace });

// ✅ Access control enforced
// Only nodes with permission can read

// ✅ Complete history
backpack.getHistory();  // See everything

// ✅ Nothing is lost
// All data stays in Backpack for debugging
// Downstream nodes only see what they declare
```

---

## Debugging Scenario

**Problem:** ResponseNode produces wrong answer.

### Step 1: Check History

```typescript
const history = backpack.getHistory();
console.table(history);

// See that DecisionNode read 'researchResults'
// and wrote 'decision' with value 'approved'
```

### Step 2: Time-Travel

```typescript
// What did DecisionNode see?
const beforeDecision = backpack.getSnapshotBeforeNode('decision-node-456');
const results = beforeDecision.unpack('researchResults');

console.log('DecisionNode received:', results);
// Ah! Price was $24.99, but stock was actually 0!
// ResearchNode had wrong data!
```

### Step 3: Check Access

```typescript
// What did ResponseNode read?
const reads = backpack.getAccessLog('response-node-789', 'read');
console.log(reads);
// ['userQuery', 'researchResults', 'decision', 'confidence']

// Did it accidentally read 'debug_info'?
// No - access control prevented it
```

---

## Summary: How Backpack Works

1. **Within a Node:**
   - Node uses `this.backpack.unpack()` to read data
   - Node uses `this.backpack.pack()` to write data
   - Access control is checked automatically
   - Metadata is tracked automatically

2. **Across Nodes:**
   - Backpack travels through the flow
   - Each node declares what it reads/writes
   - Data persists (no accidental deletion)
   - Complete audit trail

3. **For Debugging:**
   - History shows all operations
   - Snapshots enable time-travel
   - Access logs show what was actually read
   - Nothing is ever truly lost

**vs SharedStore:** Direct property access, no tracking, no control, no history.

