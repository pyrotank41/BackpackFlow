# v2.0 Breaking Changes

**Release:** v2.0.0 "The Observable Agent"  
**Status:** Planned  
**Breaking Changes:** YES (Major version bump)

---

## Philosophy: Clean Break, No Technical Debt

v2.0 is a major rewrite of BackpackFlow's core architecture. We're taking advantage of semantic versioning to make **breaking changes** that eliminate technical debt and set a solid foundation for the future.

**No backwards compatibility layer.** Users can stay on v1.x until ready to migrate.

---

## 🔴 Breaking Changes Summary

### 1. SharedStorage → Backpack

**What Changed:** State management completely rewritten.

**v1.x (Old):**
```typescript
const shared = { messages: [], userQuery: "Hello" };
await node.exec(shared);
const response = shared.response;  // Direct property access
```

**v2.0 (New):**
```typescript
const backpack = new Backpack();
backpack.pack('messages', []);
backpack.pack('userQuery', "Hello");
await node.run(backpack);
const response = backpack.unpack('response');  // Explicit API
```

**Why:** Scoped access, metadata tracking, time-travel debugging.

---

### 2. Node Signature Change

**What Changed:** Node execution method signature.

**v1.x:**
```typescript
class MyNode extends Node {
    async exec(shared: SharedStorage) {
        const query = shared.userQuery;
        shared.response = await callLLM(query);
    }
}
```

**v2.0:**
```typescript
class MyNode extends BackpackNode {
    async exec(prepRes: any) {
        const query = this.backpack.unpackRequired('userQuery');
        const response = await callLLM(query);
        this.backpack.pack('response', response);
    }
}
```

**Why:** Backpack is now a class property, not passed as parameter.

---

### 3. EventStreamer Event Schema

**What Changed:** Event structure completely redesigned.

**v1.x:**
```typescript
interface StreamEvent {
    namespace: string;
    type: StreamEventType;
    content: any;  // Untyped
    timestamp: Date;
}
```

**v2.0:**
```typescript
interface BackpackEvent {
    id: string;               // NEW - UUID
    timestamp: number;        // CHANGED - Unix epoch
    sourceNode: string;       // NEW - Node class name
    nodeId: string;           // CHANGED - Required
    namespace?: string;       // CHANGED - Optional
    runId: string;            // NEW - Flow correlation ID
    type: StreamEventType;    // EXPANDED - More event types
    payload: Record<string, any>;  // RENAMED from 'content'
}
```

**Why:** Better traceability, structured payloads, flow correlation.

---

### 4. Event Subscription API

**What Changed:** Subscription now supports wildcards.

**v1.x:**
```typescript
streamer.subscribe('sales_agent', (event) => { ... });
// Exact namespace match only
```

**v2.0:**
```typescript
streamer.subscribe('sales.*', (event) => { ... });
// ✅ Wildcard matching
streamer.subscribe('*.chat', (event) => { ... });
// ✅ Pattern matching
```

**Why:** Flexible event filtering for complex flows.

---

### 5. Node Constructor Changes

**What Changed:** Nodes now require EventStreamer and Backpack.

**v1.x:**
```typescript
const node = new ChatNode({
    model: 'gpt-4'
});
```

**v2.0:**
```typescript
const node = new ChatNode({
    model: 'gpt-4',
    eventStreamer: new EventStreamer(),  // NEW - Required
    namespace: 'sales.chat'              // NEW - Optional
});
```

**Why:** Enable automatic observability and namespace organization.

---

## ✅ What's NOT Breaking

### These Stay the Same:

1. **LLM Client Injection** - Already explicit in v1.2.0 ✅
2. **MCP Integration** - Tool discovery API unchanged ✅
3. **Flow Graph Structure** - Still DAG-based ✅
4. **TypeScript-First** - No language changes ✅

---

## 📚 Migration Guide

See [MIGRATION-v1-to-v2.md](./architecture/MIGRATION-v1-to-v2.md) for detailed migration steps.

### Quick Checklist

- [ ] Replace `SharedStorage` with `Backpack` throughout codebase
- [ ] Update node signatures: `exec(shared)` → `exec(prepRes)` + use `this.backpack`
- [ ] Update EventStreamer event handlers for new schema
- [ ] Add `eventStreamer` to node constructors
- [ ] (Optional) Add namespaces to nodes for better organization
- [ ] Update tests to use new APIs

---

## 🎯 Why These Breaking Changes?

### Problems in v1.x

1. **"Junk Drawer" State** - Any node could mutate any key
2. **No Observability** - Couldn't trace where data came from
3. **Debugging Nightmare** - No way to time-travel or snapshot state
4. **No Access Control** - Nodes could accidentally leak sensitive data

### Solutions in v2.0

1. ✅ **Scoped Access** - Nodes declare what they can read/write
2. ✅ **Metadata Tracking** - Every item tagged with source/timestamp
3. ✅ **Time-Travel Debugging** - `getSnapshot(timestamp)` shows historical state
4. ✅ **Access Control** - Namespace-based permissions prevent leaks
5. ✅ **Automatic Telemetry** - Lifecycle events emitted without boilerplate

---

## 📅 Timeline

**Current Version:** v1.2.0 (Stable)  
**Next Release:** v2.0.0 (In Development)

**v1.x Support:**
- v1.2.0 remains available on npm as `backpackflow@1`
- Security patches only (no new features)
- Maintained until v2.1.0 is stable

**v2.0 Beta:**
- Beta releases: `npm install backpackflow@beta`
- Stable release when all 3 PRDs are complete

---

## ❓ Questions?

- **Issue Tracker:** [GitHub Issues](https://github.com/pyrotank41/Backpackflow/issues)
- **Discord:** [Join Community](./tutorials/building-ai-from-first-principles/JOIN_COMMUNITY.md)
- **Docs:** [Full Documentation](./README.md)

---

**TL;DR:** v2.0 is a major rewrite with breaking changes. Stay on v1.x until ready. Migration guide provided. The changes are worth it. 🚀

