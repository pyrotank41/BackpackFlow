# PRD-001: Backpack Architecture

**Status:** Draft  
**Priority:** P0 (Foundation)  
**Target Release:** v2.0.0  
**Dependencies:** None  
**Blocks:** PRD-002 (Telemetry), PRD-003 (Serialization)

---

## 1. Problem Statement

### Current Pain Points

**1.1 The "Junk Drawer" Problem (Context Pollution)**

Currently, `SharedStorage` is a global dictionary where every node can read/write any key. This creates three critical issues:

- **Semantic Chaos:** A node can accidentally read stale data from 5 steps ago
- **State Poisoning:** Failed tool results or guardrail errors "leak" into downstream nodes
- **Source Amnesia:** There's no way to trace where a specific piece of data came from

**Example of the Problem:**

```typescript
// Step 1: ResearchNode adds data
shared.researchResults = "..."

// Step 2: ValidationNode fails
shared.validationError = "Bad data"  

// Step 3: SummaryNode runs
// ❌ PROBLEM: It sees BOTH researchResults AND validationError
// The LLM gets confused by the error message it shouldn't see
```

**1.2 No Access Control**

Any node can `.pack()` sensitive data (API keys, user PII) and any downstream node can accidentally expose it in a prompt.

**1.3 Debugging Nightmare**

When an agent hallucinates, you can't answer:
- "What data was in the context at Step 3?"
- "Which node added this incorrect fact?"
- "Did the LLM see the tool error message?"

---

## 2. Solution: The Backpack Pattern

### Core Concept

Replace the generic `SharedStorage` dictionary with a **scoped, traceable, immutable-by-default** `Backpack` object.

**The Metaphor:**
- A physical backpack has **compartments** (scoped keys)
- You must **explicitly unpack** items to use them (access control)
- Every item has a **tag** showing who packed it (provenance)

### The Git Analogy

**Backpack is "Git for your agent's state."**

Just like Git tracks code changes, Backpack tracks data changes:

```typescript
// Git                           // Backpack
git commit -m "Add feature"  →  backpack.pack('feature', data)
git log                      →  backpack.getHistory()
git checkout abc123          →  backpack.getSnapshotAtCommit('abc123')
git diff                     →  backpack.diff(before, after)
git blame                    →  item.metadata.sourceNodeId
```

**Why this matters:**
- ✅ **Immutability** - History never changes (debugging)
- ✅ **Auditability** - Complete trace of who did what
- ✅ **Time-travel** - Rewind to any previous state
- ✅ **Diffs** - See exactly what changed between steps

If Git makes code development manageable, Backpack makes agent development manageable.

---

## 3. Technical Specification

### 3.1 The `Backpack` Class

```typescript
export class Backpack<T extends BaseStorage = BaseStorage> {
    private _items: Map<string, BackpackItem>;
    private _history: BackpackCommit[];
    private _permissions: AccessControl;
    
    // Core API
    pack(key: string, value: any, options?: PackOptions): void;
    unpack<V>(key: string, nodeId: string): V | undefined;
    peek(key: string): any; // Read without logging access
    
    // Namespace-aware API (v2.0)
    unpackByNamespace(pattern: string): Record<string, any>; // e.g., 'sales.*'
    getItemsByNamespace(pattern: string): BackpackItem[];
    
    // Observability
    getHistory(): BackpackCommit[];
    getSnapshot(timestamp: number): Backpack<T>;
    getSnapshotAtCommit(commitId: string): Backpack<T>;  // NEW - Easier than timestamp
    getSnapshotBeforeNode(nodeId: string): Backpack<T>;  // NEW - "Before node X ran"
    getAccessLog(nodeId: string, type: 'read' | 'write'): string[];
    
    // Debugging Helpers
    diff(snapshot1: Backpack<T>, snapshot2: Backpack<T>): BackpackDiff;  // NEW
    replayFromCommit(commitId: string): Backpack<T>;  // NEW - For replay
    
    // Validation
    validate(schema: z.ZodSchema): ValidationResult;
    
    // Serialization (for PRD-003)
    toJSON(): BackpackSnapshot;
    static fromJSON(snapshot: BackpackSnapshot): Backpack;
}
```

### 3.2 Metadata Tracking (Solving Source Amnesia)

Every item carries provenance:

```typescript
interface BackpackItem {
    key: string;
    value: any;
    metadata: {
        sourceNodeId: string;      // Who added this? (UUID)
        sourceNodeName: string;    // Human-readable name (e.g., "ChatNode")
        sourceNamespace?: string;  // Semantic path (e.g., "sales.research.chat")
        timestamp: number;         // When?
        version: number;           // How many times was this key updated?
        tags?: string[];           // e.g., ["pii", "temporary", "cached"]
    };
}
```

### 3.3 Immutable History (The Commit Log)

Every `.pack()` creates a commit:

```typescript
interface BackpackCommit {
    commitId: string;           // UUID
    timestamp: number;
    nodeId: string;
    action: 'pack' | 'unpack' | 'delete';
    key: string;
    valueSummary: string;       // Truncated for large values
    previousValue?: any;        // For rollback
}
```

**Use Case:** When debugging, you can call `backpack.getSnapshot(timestampAtStep3)` to see exactly what the agent "knew" before it hallucinated.

### 3.4 Scoped Access (Solving Context Pollution)

Nodes must declare what they need:

```typescript
class SummaryNode extends BackpackNode {
    // Define access permissions (supports both key-based and namespace-based)
    readonly permissions = {
        read: ['researchResults', 'userQuery'],    // Can only see these keys
        write: ['summary', 'keyPoints'],           // Can only add these keys
        deny: ['validationError'],                 // Explicitly blocked
        
        // NEW: Namespace-based permissions (v2.0)
        namespaceRead: ['research.*'],             // Can read from any 'research' node
        namespaceWrite: ['summary.*']              // Can write to 'summary' namespace
    };
    
    constructor(params: any) {
        super(params);
        this.namespace = 'sales.summary';  // Set node's namespace
    }
    
    async exec(prepRes: any) {
        // ✅ This works (key-based)
        const data = this.backpack.unpack('researchResults', this.id);
        
        // ✅ This works (namespace-based - can read from research.*)
        const researchData = this.backpack.unpackByNamespace('research.*');
        
        // ❌ This throws AccessDeniedError
        const error = this.backpack.unpack('validationError', this.id);
    }
}
```

### 3.5 Sanitization API (Solving State Poisoning)

**Design Principle:** Quarantine data that would **pollute or confuse** the flow, NOT errors the LLM should handle.

#### When to Quarantine

**✅ Quarantine (Remove from active state):**
1. **Retry failures** - Keep only successful result
2. **Debug/logging data** - Not meant for LLM
3. **Stale data from loops** - Prevent accumulation
4. **Validation errors** - Flow control, not LLM decision

**❌ Don't Quarantine (LLM should know):**
1. **Tool execution errors** - LLM needs to respond gracefully
2. **API failures** - LLM should tell user what went wrong
3. **Missing data** - LLM should ask for clarification
4. **Business logic errors** - LLM should explain to user

#### API

```typescript
// Quarantine: Remove from active state, keep in trace
backpack.quarantine(key: string, options: {
    reason: string;
    nodeId: string;
    keepInTrace?: boolean;  // Default: true (for debugging)
});

// Example: Retry loop
for (let attempt = 0; attempt < 3; attempt++) {
    const result = await callAPI();
    
    if (result.success) {
        backpack.pack('apiResult', result.data);  // ✅ Keep success
        break;
    } else {
        // ✅ Quarantine failed attempts
        backpack.quarantine(`retry_${attempt}`, {
            reason: 'Retry failed, successful attempt follows',
            nodeId: this.id,
            error: result.error
        });
    }
}

// Example: Tool error (DON'T quarantine - LLM should handle)
const toolResult = await executeTool('get_weather');

if (toolResult.error) {
    // ✅ PACK the error (don't quarantine!)
    backpack.pack('toolResult', {
        success: false,
        error: toolResult.error,
        message: 'Weather API temporarily unavailable'
    });
    // LLM will see this and respond: "I couldn't fetch the weather..."
}
```

#### How It Works

```typescript
// Quarantined items are moved to a separate space
class Backpack {
    private _items: Map<string, BackpackItem>;           // Active state
    private _quarantined: Map<string, BackpackItem>;     // Quarantined (not visible to nodes)
    
    quarantine(key: string, options: QuarantineOptions): void {
        const item = this._items.get(key);
        if (item) {
            this._quarantined.set(key, item);
            this._items.delete(key);  // Remove from active state
            
            // Log to history
            this.addToHistory({
                action: 'quarantine',
                key,
                reason: options.reason,
                // ...
            });
        }
    }
    
    // Debugging: View quarantined items
    getQuarantined(): Map<string, BackpackItem> {
        return this._quarantined;
    }
}
```

---

## 4. Migration Strategy

**v2.0 = Breaking Changes Allowed** 🚀

Since this is a major version bump, we can make clean breaks without backwards compatibility.

### Phase 1: Build Backpack Core

**Goal:** Implement the `Backpack` class with all features.

- [ ] Create `Backpack` class in `src/storage/backpack.ts`
- [ ] Implement `pack()`, `unpack()`, `unpackRequired()` methods
- [ ] Add metadata tracking and commit history
- [ ] Implement access control system
- [ ] Add namespace wildcard matching
- [ ] Write comprehensive unit tests

**Outcome:** `Backpack` is production-ready.

---

### Phase 2: Refactor All Nodes

**Goal:** Replace `SharedStorage` with `Backpack` everywhere.

- [ ] Update `AgentNode` to use `Backpack`
  - Replace `shared.key` with `backpack.unpack('key')`
  - Replace `shared.key = value` with `backpack.pack('key', value)`
- [ ] Update `DecisionNode` to use `Backpack`
- [ ] Update `ToolExecutionNode` to use `Backpack`
- [ ] Update `FinalAnswerNode` to use `Backpack`
- [ ] Update `ToolParamGenerationNode` to use `Backpack`
- [ ] Update node signatures: `exec(shared)` → `exec(backpack: Backpack)`

**Outcome:** All built-in nodes use `Backpack`. Old `SharedStorage` pattern removed.

---

### Phase 3: Update Examples & Docs

**Goal:** Update all user-facing content.

- [ ] Update tutorials to use `Backpack` API
- [ ] Update examples in `tutorials/`
- [ ] Add v1 → v2 migration guide to docs
- [ ] Update README with new API examples
- [ ] Create "What's New in v2.0" guide

**Outcome:** Users have clear migration path.

---

## 5. API Examples

### Example 1: Basic Pack/Unpack

```typescript
// Old way (v1.x)
shared.userQuery = "What is AI?";
shared.response = await callLLM(shared.userQuery);

// New way (v2.0)
backpack.pack('userQuery', "What is AI?", {
    tags: ['user-input']
});

const query = backpack.unpack<string>('userQuery', this.id);
const response = await callLLM(query);

backpack.pack('response', response, {
    tags: ['llm-output']
});
```

### Example 2: Time-Travel Debugging (Improved API)

```typescript
// ❌ Old way: Agent hallucinated, but you need to find the timestamp
const history = backpack.getHistory();
const step3Timestamp = history[2].timestamp;  // Manual lookup
const step3State = backpack.getSnapshot(step3Timestamp);

// ✅ Better way: Use commit IDs or node IDs
const history = backpack.getHistory();
console.log(history);
// [
//   { commitId: 'abc123', nodeId: 'research-1', key: 'context', ... },
//   { commitId: 'def456', nodeId: 'research-2', key: 'context', ... },  // 👈 Suspicious!
//   { commitId: 'ghi789', nodeId: 'chat-1', key: 'response', ... }
// ]

// Get state before the suspicious commit
const beforeBadData = backpack.getSnapshotAtCommit('abc123');  // Last good state
const afterBadData = backpack.getSnapshotAtCommit('def456');   // After bad data

// Or use node ID directly
const beforeNode = backpack.getSnapshotBeforeNode('research-2');  // Before node ran
const afterNode = backpack.getSnapshot(Date.now());               // Current state

// Compare the two
const diff = backpack.diff(beforeNode, afterNode);
console.log('What research-2 changed:');
console.log(diff);
// Output:
// {
//   added: ['validationError'],
//   modified: ['context'],
//   deleted: []
// }
```

### Example 3: Replay from Checkpoint (Debugging + Simulation)

```typescript
// ❓ Your Question: "Can we rerun from a specific point?"
// ✅ Answer: YES! Here's how:

// 1. Agent fails at step 5
const result = await flow.run(backpack);
// ❌ Result is bad

// 2. Find where it went wrong
const history = backpack.getHistory();
// Identify that node 'research-2' added bad data

// 3. Get state BEFORE the problem node
const checkpoint = backpack.getSnapshotBeforeNode('research-2');

// 4. Create a new flow starting from that node
const debugFlow = new Flow();
debugFlow.addNode(researchNode2);  // The problematic node
debugFlow.addNode(chatNode);       // Subsequent nodes

// 5. Rerun with the checkpoint state
const debugResult = await debugFlow.run(checkpoint);

// 6. Now you can:
// - Add console.logs to research-2
// - Change its parameters
// - Test different data
// - All without re-running the entire flow!
```

**Use Cases for Replay:**
1. **Bug Fixing:** Rerun only the failing node with debug logs
2. **A/B Testing:** Try different prompts on the same input state
3. **Parameter Tuning:** Test different temperatures/models on same context
4. **Regression Testing:** Ensure fixes don't break other scenarios

---

### Example 4: PII Protection

```typescript
backpack.pack('userEmail', 'user@example.com', {
    tags: ['pii'],
    accessControl: {
        read: ['authentication-node'], // Only this node can read
        write: ['authentication-node']
    }
});

// In a downstream ChatNode
const email = backpack.unpack('userEmail', 'chat-node-123');
// ❌ Throws: AccessDeniedError: chat-node-123 cannot access PII-tagged items
```

---

## 6. Success Criteria

### SC-1: State Sanitization
**Test:** Run a flow where a tool fails. Verify that the error object does NOT appear in the LLM prompt of downstream nodes.

### SC-2: Source Tracing
**Test:** Agent produces wrong answer. Call `backpack.getHistory()` and identify which node added the incorrect data.

### SC-3: Time-Travel Debugging
**Test:** Call `backpack.getSnapshot(timestamp)` and verify it returns the exact state from that point in time.

### SC-4: Access Control
**Test:** Create a node that tries to read a PII-tagged key. Verify it throws `AccessDeniedError`.

### SC-5: Performance
**Test:** Backpack operations add < 5ms overhead per node execution.

---

## 7. Open Questions

**Q1:** Should `.unpack()` throw an error if the key doesn't exist, or return `undefined`?  
**Decision:** **Hybrid approach** - Provide both methods:

```typescript
// Returns undefined (graceful)
unpack<V>(key: string, nodeId: string): V | undefined;

// Throws if missing (fail-fast)
unpackRequired<V>(key: string, nodeId: string): V;
```

**Rationale:**
- **`unpack()`** returns `undefined` for optional data (caching, preferences)
- **`unpackRequired()`** throws for mandatory data (user query, config)
- Developers choose based on their use case
- TypeScript types enforce null-checking for `unpack()`, not `unpackRequired()`

**Example:**
```typescript
// Optional: use unpack()
const cache = backpack.unpack('cachedResult', this.id);
if (cache) return cache;

// Required: use unpackRequired()
const query = backpack.unpackRequired('userQuery', this.id);
// ✅ No null check needed, will throw if missing
```

**Q2:** How large should the commit history grow before we start truncating?  
**Proposal:** Keep last 1000 commits in memory, archive rest to disk.

**Q3:** Should we support "rollback" (undo a pack operation)?  
**Risk:** Breaks immutability guarantees.

**Q4:** Should namespace-based access control support wildcards?  
**Example:** `namespaceRead: ['sales.*']` matches any node in the sales namespace  
**Proposal:** Yes. Implement glob-style matching for namespaces in access control.

---

## 8. Non-Goals (Out of Scope)

- **Persistence:** Backpack state is in-memory only. Saving to disk is handled by separate persistence layer.
- **Distributed State:** This PRD only covers single-process execution. Multi-agent orchestration is a future enhancement.
- **UI/Visualization:** The trace viewer is handled by PRD-002 (Telemetry).

---

**References:**
- Research: "Orchestration Crisis" - State Poisoning & Semantic Chaos
- Master File Section 2.A: "The Backpack (Context Object)"
- Related: PRD-002 (Telemetry needs to observe Backpack commits)

