# Migration Guide: v1.2.0 → v2.0.0

## EventStreamer Changes

### Current Implementation (v1.2.0)

Your current `EventStreamer` is already well-structured! Here's what you have:

```typescript
// ✅ Good: Already extends EventEmitter
export class EventStreamer extends EventEmitter {
    
    // ✅ Good: Singleton pattern
    static getInstance(): EventStreamer;
    
    // ✅ Good: Has namespace support
    emitEvent(namespace: string, eventType: StreamEventType, content: any, nodeId?: string): void;
    
    // ✅ Good: Subscribe to namespace
    subscribe(namespace: string, callback: (event: StreamEvent) => void): void;
}
```

### What Needs to Change for v2.0

#### 1. Expand `StreamEventType` Enum

**Current (v1.2.0):**
```typescript
export enum StreamEventType {
    PROGRESS = 'progress',
    CHUNK = 'chunk',
    METADATA = 'metadata',
    FINAL = 'final',
    ERROR = 'error'
}
```

**v2.0 (Add lifecycle events):**
```typescript
export enum StreamEventType {
    // Lifecycle (Automatic) - NEW!
    NODE_START = 'node_start',
    PREP_COMPLETE = 'prep_complete',
    EXEC_COMPLETE = 'exec_complete',
    NODE_END = 'node_end',
    ERROR = 'error',  // ✅ Already exists
    
    // Backpack Operations (Automatic) - NEW!
    BACKPACK_PACK = 'backpack_pack',
    BACKPACK_UNPACK = 'backpack_unpack',
    
    // Custom (Manual inside exec) - EXISTING
    PROGRESS = 'progress',  // ✅ Keep
    CHUNK = 'chunk',        // ✅ Keep (rename to STREAM_CHUNK?)
    METADATA = 'metadata',  // ✅ Keep
    FINAL = 'final',        // ✅ Keep
    
    // Generic
    CUSTOM = 'custom'       // NEW - for custom events
}
```

#### 2. Enhance Event Schema

**Current (v1.2.0):**
```typescript
export interface StreamEvent {
    namespace: string;
    type: StreamEventType;
    content: any;          // ⚠️ Too loose
    timestamp: Date;
    nodeId?: string;
}
```

**v2.0 (Add more metadata):**
```typescript
export interface BackpackEvent {
    id: string;             // NEW - UUID for tracking
    timestamp: number;      // CHANGE - Unix epoch (more portable than Date)
    sourceNode: string;     // NEW - Node class name
    nodeId: string;         // CHANGE - Make required
    namespace?: string;     // CHANGE - Make optional (for backwards compat)
    runId: string;          // NEW - Correlation ID for entire flow
    type: StreamEventType;
    payload: Record<string, any>; // CHANGE - Rename from 'content', add typing
}
```

#### 3. Add Wildcard Pattern Matching

**Current (v1.2.0):**
```typescript
// ❌ Only exact namespace match
subscribe(namespace: string, callback: (event: StreamEvent) => void): void {
    this.on(`${namespace}:*`, callback);
}
```

**v2.0 (Support patterns):**
```typescript
// ✅ Support wildcards
subscribe(pattern: string | '*', callback: (event: BackpackEvent) => void): void {
    // Store pattern for later matching
    this.subscriptions.set(pattern, callback);
}

// Internal: Match patterns
private matches(pattern: string, event: BackpackEvent): boolean {
    if (pattern === '*') return true;
    if (pattern === event.nodeId) return true;
    if (pattern === event.namespace) return true;
    
    // Wildcard matching: "sales.*" matches "sales.chat"
    if (pattern.includes('*') && event.namespace) {
        const regex = new RegExp(
            '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]+') + '$'
        );
        return regex.test(event.namespace);
    }
    
    return false;
}
```

#### 4. Add Event Buffer (for debugging)

**Current (v1.2.0):**
```typescript
// ❌ No event history
```

**v2.0 (Add buffer):**
```typescript
export class EventStreamer extends EventEmitter {
    private eventBuffer: BackpackEvent[] = [];
    private maxBufferSize: number = 10000;
    
    emit(event: BackpackEvent): void {
        // Add to buffer first
        this.eventBuffer.push(event);
        if (this.eventBuffer.length > this.maxBufferSize) {
            this.eventBuffer.shift();  // Remove oldest
        }
        
        // Then emit to subscribers
        // ...
    }
    
    // NEW: Query historical events
    getEvents(filter?: EventFilter): BackpackEvent[] {
        return this.eventBuffer.filter(event => {
            if (filter?.nodeId && event.nodeId !== filter.nodeId) return false;
            if (filter?.type && event.type !== filter.type) return false;
            if (filter?.runId && event.runId !== filter.runId) return false;
            return true;
        });
    }
}
```

#### 5. Change Emission Method Signature

**Current (v1.2.0):**
```typescript
// Multiple parameters
emitEvent(namespace: string, eventType: StreamEventType, content: any, nodeId?: string): void {
    const event: StreamEvent = { namespace, type: eventType, content, timestamp: new Date(), nodeId };
    this.emit(`${namespace}:${eventType}`, event);
    this.emit(`${namespace}:*`, event);
}
```

**v2.0 (Single event object):**
```typescript
// Single parameter - full event object
emit(event: BackpackEvent): void {
    // BackpackNode constructs the full event before calling
    this.addToBuffer(event);
    
    const handlers = this.getMatchingHandlers(event);
    for (const handler of handlers) {
        try {
            const result = handler(event);
            if (result instanceof Promise) {
                result.catch(err => this.handleError(err));
            }
        } catch (err) {
            this.handleError(err);
        }
    }
}
```

---

## Summary: What to Keep vs. Change

### ✅ Keep (Already Good)

1. **Extends EventEmitter** - Perfect foundation
2. **Singleton pattern** - Good for global event bus
3. **Namespace support** - Already there, just needs enhancement
4. **Subscribe/unsubscribe methods** - Good API shape

### 🔄 Enhance (v2.0)

1. **Event schema** - Add more metadata fields
2. **Event types** - Add lifecycle events
3. **Pattern matching** - Add wildcard support (`sales.*`)
4. **Event buffer** - Add history for debugging
5. **Emission** - Change from `emitEvent(...)` to `emit(event)`

### ➕ Add New (v2.0)

1. **`getEvents(filter)`** - Query historical events
2. **`toJSON()`** - Export for visualization
3. **Wildcard matching logic** - Pattern matching algorithm
4. **Error handling** - Isolate subscriber errors

---

## Estimated Refactoring Effort

- **Time:** 1-2 days
- **Risk:** Low (backwards compatible if we keep old methods)
- **Lines of Code:** ~50 new lines, ~20 modified lines

---

## Breaking Changes Strategy (v2.0)

**v2.0 = Major Version = Breaking Changes Allowed**

We're making a clean break from v1.x. No backwards compatibility layer needed.

### What Users Need to Do

**v1.x Code:**
```typescript
const shared = {
    messages: [...],
    userQuery: "Hello"
};

await node.exec(shared);
console.log(shared.response);  // Node mutated shared object
```

**v2.0 Code:**
```typescript
const backpack = new Backpack({
    messages: [...]
});

backpack.pack('userQuery', "Hello");
await node.run(backpack);

const response = backpack.unpack('response');  // Explicit access
```

### Migration Checklist

- [ ] Replace `shared: SharedStorage` with `backpack: Backpack`
- [ ] Replace `shared.key` with `backpack.unpack('key')`
- [ ] Replace `shared.key = value` with `backpack.pack('key', value)`
- [ ] Update EventStreamer subscriptions (new event schema)
- [ ] Update node constructors (new params)

Users can stay on v1.x until ready to migrate. Clean break.

