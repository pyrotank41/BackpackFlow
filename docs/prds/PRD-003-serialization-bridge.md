# PRD-003: Serialization Bridge (Config-Driven Nodes)

**Status:** Draft  
**Priority:** P1 (Enabler for Low-Code)  
**Target Release:** v2.0.0  
**Dependencies:** PRD-001 (Backpack), PRD-002 (Telemetry)  
**Blocks:** Future Web GUI

---

## 1. Problem Statement

### The "No-Code Wall"

**1.1 Code-Only Instantiation**

Currently, every node must be manually instantiated in TypeScript:

```typescript
const chatNode = new ChatNode({
    llmConfig: { model: 'gpt-4' },
    eventStreamer: streamer
});

const flow = new Flow([chatNode, decisionNode, ...]);
```

**Problems:**
- **No UI Integration:** You can't build a drag-and-drop flow builder because flows only exist in code
- **No Portability:** Can't export/import flows as JSON
- **No A/B Testing:** Can't dynamically swap node configs without redeploying code

**1.2 The "Eject" Problem**

Visual builders (n8n, LangFlow) hit the opposite problem:
- Great for simple flows
- When you need custom logic, you're stuck
- Can't "eject to code" and then go back to visual

**1.3 Type Safety Gap**

If we manually write JSON configs, there's no type checking. Easy to deploy broken configs.

---

## 2. Solution: The Serialization Bridge

### Core Concept

Make **Code** and **Config** bidirectionally convertible:

```mermaid
graph LR
    A[TypeScript Node] -->|.toConfig()| B(JSON Config)
    B -->|.fromConfig()| A
    B <-->|Syncs with| C[Web GUI]
    
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style C fill:#bbf,stroke:#333,stroke-width:2px
```

**Key Properties:**
1. **Type-Safe Serialization:** Use Zod schemas to validate configs
2. **Dependency Injection:** Handle complex objects (LLM clients, databases) that can't be JSON-serialized
3. **Round-Trip Guarantee:** `Node.fromConfig(node.toConfig())` produces an identical node

---

## 3. Technical Specification

### 3.1 The Config Schema

Every node exposes a JSON schema:

```typescript
export interface NodeConfig {
    type: string;              // e.g., "ChatNode"
    id?: string;               // Optional: for referencing in flow
    namespace?: string;        // Optional: semantic path (e.g., "sales.research.chat")
    params: Record<string, any>; // Node-specific parameters
    dependencies?: string[];   // Keys for dependency injection
}

export interface FlowConfig {
    version: string;           // Schema version (for migrations)
    nodes: NodeConfig[];
    edges: FlowEdge[];
    dependencies: DependencyManifest;
}
```

**Example:**

```json
{
    "version": "2.0.0",
    "nodes": [
        {
            "type": "ChatNode",
            "id": "chat-1",
            "namespace": "sales.initial-contact",
            "params": {
                "model": "gpt-4",
                "temperature": 0.7,
                "systemPrompt": "You are a helpful assistant"
            },
            "dependencies": ["llmClient", "eventStreamer"]
        },
        {
            "type": "DecisionNode",
            "id": "decision-1",
            "namespace": "sales.routing",
            "params": {
                "decisionKey": "userIntent"
            }
        }
    ],
    "edges": [
        { "from": "chat-1", "to": "decision-1", "condition": "default" }
    ],
    "dependencies": {
        "llmClient": "openai",
        "eventStreamer": "default"
    }
}
```

### 3.2 The `NodeFactory` Pattern

Each node class implements static factory methods:

```typescript
export interface SerializableNode {
    // Serialize to JSON
    toConfig(): NodeConfig;
    
    // Deserialize from JSON
    static fromConfig(
        config: NodeConfig, 
        deps: DependencyContainer
    ): SerializableNode;
    
    // Validation schema
    static configSchema: z.ZodSchema;
}
```

**Implementation Example:**

```typescript
export class ChatNode extends BackpackNode implements SerializableNode {
    static configSchema = z.object({
        type: z.literal('ChatNode'),
        params: z.object({
            model: z.string(),
            temperature: z.number().min(0).max(2).optional(),
            systemPrompt: z.string().optional()
        }),
        dependencies: z.array(z.string()).optional()
    });
    
    // Serialize
    toConfig(): NodeConfig {
        return {
            type: 'ChatNode',
            id: this.id,
            params: {
                model: this.model,
                temperature: this.temperature,
                systemPrompt: this.systemPrompt
            },
            dependencies: ['llmClient', 'eventStreamer']
        };
    }
    
    // Deserialize
    static fromConfig(
        config: NodeConfig, 
        deps: DependencyContainer
    ): ChatNode {
        // Validate
        const validated = ChatNode.configSchema.parse(config);
        
        // Extract dependencies
        const llmClient = deps.get('llmClient');
        const eventStreamer = deps.get('eventStreamer');
        
        // Construct
        return new ChatNode({
            model: validated.params.model,
            temperature: validated.params.temperature,
            systemPrompt: validated.params.systemPrompt,
            llmClient,
            eventStreamer
        });
    }
}
```

### 3.3 Dependency Injection Container

Handle non-serializable objects:

```typescript
export class DependencyContainer {
    private dependencies: Map<string, any>;
    
    register(key: string, instance: any): void {
        this.dependencies.set(key, instance);
    }
    
    get<T>(key: string): T {
        if (!this.dependencies.has(key)) {
            throw new Error(`Dependency '${key}' not found`);
        }
        return this.dependencies.get(key) as T;
    }
    
    // Pre-register common dependencies
    static createDefault(): DependencyContainer {
        const container = new DependencyContainer();
        container.register('eventStreamer', new EventStreamer());
        return container;
    }
}
```

### 3.4 The `FlowLoader`

Orchestrates config-to-flow conversion:

```typescript
export class FlowLoader {
    private nodeRegistry: Map<string, typeof SerializableNode>;
    
    constructor() {
        // Register built-in nodes
        this.register('ChatNode', ChatNode);
        this.register('DecisionNode', DecisionNode);
        this.register('AgentNode', AgentNode);
    }
    
    register(type: string, nodeClass: typeof SerializableNode): void {
        this.nodeRegistry.set(type, nodeClass);
    }
    
    async loadFlow(
        config: FlowConfig, 
        deps: DependencyContainer
    ): Promise<Flow> {
        // 1. Validate schema version
        if (config.version !== '2.0.0') {
            throw new Error('Unsupported config version');
        }
        
        // 2. Instantiate nodes
        const nodeInstances = new Map();
        for (const nodeConfig of config.nodes) {
            const NodeClass = this.nodeRegistry.get(nodeConfig.type);
            if (!NodeClass) {
                throw new Error(`Unknown node type: ${nodeConfig.type}`);
            }
            
            // Validate config against schema
            NodeClass.configSchema.parse(nodeConfig);
            
            // Create instance
            const instance = NodeClass.fromConfig(nodeConfig, deps);
            nodeInstances.set(nodeConfig.id, instance);
        }
        
        // 3. Build flow graph
        const flow = new Flow();
        for (const edge of config.edges) {
            const fromNode = nodeInstances.get(edge.from);
            const toNode = nodeInstances.get(edge.to);
            flow.addEdge(fromNode, toNode, edge.condition);
        }
        
        return flow;
    }
    
    // Export flow to config
    exportFlow(flow: Flow): FlowConfig {
        return {
            version: '2.0.0',
            nodes: flow.getNodes().map(n => n.toConfig()),
            edges: flow.getEdges(),
            dependencies: flow.getDependencyManifest()
        };
    }
}
```

---

## 4. Usage Examples

### Example 1: Load Flow from JSON

```typescript
// Load from file
const configJson = fs.readFileSync('./flows/sales-agent.json', 'utf-8');
const config: FlowConfig = JSON.parse(configJson);

// Setup dependencies
const deps = new DependencyContainer();
deps.register('llmClient', new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
deps.register('eventStreamer', new EventStreamer());

// Load and run
const loader = new FlowLoader();
const flow = await loader.loadFlow(config, deps);

const backpack = new Backpack({ messages: [...] });
await flow.run(backpack);
```

### Example 2: Export Flow to JSON

```typescript
// Build flow in code
const flow = new Flow();
flow.addNode(new ChatNode({ model: 'gpt-4' }));
flow.addNode(new DecisionNode({ decisionKey: 'intent' }));

// Export to config
const loader = new FlowLoader();
const config = loader.exportFlow(flow);

// Save to file
fs.writeFileSync(
    './flows/my-agent.json', 
    JSON.stringify(config, null, 2)
);
```

### Example 3: Dynamic A/B Testing

```typescript
// Production config
const prodConfig = await loadConfig('./flows/prod.json');

// Experimental config (different model)
const expConfig = { ...prodConfig };
expConfig.nodes[0].params.model = 'gpt-4-turbo';

// Route 10% of traffic to experiment
const config = Math.random() < 0.1 ? expConfig : prodConfig;
const flow = await loader.loadFlow(config, deps);
```

### Example 4: Custom Node Registration

```typescript
// Register your custom node
class MyCustomNode extends BackpackNode implements SerializableNode {
    static configSchema = z.object({
        type: z.literal('MyCustomNode'),
        params: z.object({ ... })
    });
    
    toConfig() { ... }
    static fromConfig(config, deps) { ... }
}

const loader = new FlowLoader();
loader.register('MyCustomNode', MyCustomNode);

// Now configs can reference "MyCustomNode"
```

---

## 5. Integration with PRD-001 & PRD-002

### Backpack Serialization

The `Backpack` itself must be serializable for checkpointing:

```typescript
export class Backpack {
    toJSON(): BackpackSnapshot {
        return {
            items: Array.from(this._items.entries()),
            history: this._history,
            permissions: this._permissions
        };
    }
    
    static fromJSON(snapshot: BackpackSnapshot): Backpack {
        const backpack = new Backpack();
        backpack._items = new Map(snapshot.items);
        backpack._history = snapshot.history;
        backpack._permissions = snapshot.permissions;
        return backpack;
    }
}
```

### Telemetry in Config

Event streaming must be configurable:

```json
{
    "dependencies": {
        "eventStreamer": {
            "type": "EventStreamer",
            "config": {
                "bufferSize": 1000,
                "console": true,
                "webhook": "https://api.example.com/events"
            }
        }
    }
}
```

---

## 6. Implementation Plan

### Phase 1: Core Serialization (Week 1)

- [ ] Define `NodeConfig` and `FlowConfig` TypeScript interfaces
- [ ] Create Zod schemas for validation
- [ ] Implement `DependencyContainer` class

### Phase 2: Node Factories (Week 2)

- [ ] Add `toConfig()` and `fromConfig()` to `BackpackNode` base class
- [ ] Implement serialization for built-in nodes:
  - `ChatNode`
  - `AgentNode`
  - `DecisionNode`
  - `ToolExecutionNode`

### Phase 3: Flow Loader (Week 3)

- [ ] Implement `FlowLoader` class
- [ ] Add node registry system
- [ ] Create flow validation logic

### Phase 4: Testing & Examples (Week 4)

- [ ] Create test suite for round-trip serialization
- [ ] Build example flows:
  - `simple-chat.json`
  - `sales-agent.json`
  - `research-pipeline.json`
- [ ] Document custom node registration

---

## 7. Success Criteria

### SC-1: The "No-Code" Test
Write a JSON config representing a 3-node flow. Load it via `FlowLoader.loadFlow()`. Verify it runs correctly.

### SC-2: The "Round-Trip" Test
```typescript
const originalFlow = buildFlowInCode();
const config = loader.exportFlow(originalFlow);
const restoredFlow = await loader.loadFlow(config, deps);

assert.deepEqual(
    originalFlow.toConfig(), 
    restoredFlow.toConfig()
);
```

### SC-3: The "Type Safety" Test
Create an invalid config (e.g., temperature = 5). Verify `fromConfig()` throws a Zod validation error.

### SC-4: The "Custom Node" Test
Register a custom node class. Verify it can be loaded from JSON config.

### SC-5: The "A/B Test" Test
Load two different configs (different model params). Verify both run without code changes.

---

## 8. Open Questions

**Q1:** Should we version the config schema from day 1?  
**Decision:** **Yes.** Even though v1.x had no configs, v2.0 should include versioning to enable future migrations.

**Implementation:**
```typescript
export interface FlowConfig {
    version: '2.0.0';  // ✅ Locked to schema version
    nodes: NodeConfig[];
    edges: FlowEdge[];
}

// FlowLoader validates version
async loadFlow(config: FlowConfig) {
    if (config.version !== '2.0.0') {
        throw new Error(`Unsupported config version: ${config.version}`);
    }
    // ...
}
```

**Future (v2.1+):**
When we need to add breaking changes to the schema, we'll implement a `ConfigMigrator`:
```typescript
class ConfigMigrator {
    migrate(config: FlowConfig): FlowConfig {
        if (config.version === '2.0.0') {
            return this.migrateFrom2_0_to_2_1(config);
        }
        return config;
    }
}
```

**Rationale:** Start with versioning now, implement migration logic only when needed.

**Q2:** How do we handle circular dependencies in the flow graph?  
**Decision:** Flows must be DAGs (directed acyclic graphs). Loader validates and rejects cycles.

**Q3:** Should configs be versioned per-node or per-flow?  
**Proposal:** Per-flow. Individual nodes can evolve, but the flow schema version governs compatibility.

**Q4:** What format for edge conditions? String-based or structured (JSON Logic)?  
**Decision:** **Start with strings in v2.0, add JSON Logic in v2.1.**

### The Problem
When a node completes, it returns an `action` (e.g., "approve", "reject"). The flow needs to know which edge to follow.

### Option A: String-Based (v2.0)
**Simple and readable:**
```json
{
    "edges": [
        { "from": "decision-1", "to": "sales-node", "condition": "go-to-sales" },
        { "from": "decision-1", "to": "support-node", "condition": "go-to-support" }
    ]
}
```

The node's `post()` method returns a string that matches the condition:
```typescript
async post(backpack, prepRes, execRes) {
    if (execRes.intent === 'purchase') return 'go-to-sales';
    if (execRes.intent === 'support') return 'go-to-support';
}
```

✅ **Pros:** Simple, human-readable, easy to debug  
❌ **Cons:** Complex logic must be in code

### Option B: Structured Conditions (v2.1+)
**Powerful but complex:**
```json
{
    "edges": [
        {
            "from": "decision-1",
            "to": "sales-node",
            "condition": {
                "and": [
                    { "==": [{ "var": "intent" }, "purchase"] },
                    { ">": [{ "var": "confidence" }, 0.7] }
                ]
            }
        }
    ]
}
```

Uses [JSON Logic](http://jsonlogic.com/) to evaluate conditions against the node's return value.

✅ **Pros:** Change routing logic without code  
❌ **Cons:** Hard to read, harder to debug

### Recommendation
- **v2.0:** String-based only. Keep it simple.
- **v2.1:** Add optional JSON Logic support for power users.
- **Future:** Consider visual condition builder in the GUI.

### Real-World Example

**Scenario:** A customer service agent that routes based on intent.

**v2.0 Approach (String-based):**
```typescript
// decision-node.ts
class IntentClassifier extends BackpackNode {
    async exec(prepRes: any) {
        const intent = await this.classifyIntent(prepRes);
        return intent;  // Returns: "sales", "support", or "billing"
    }
    
    async post(backpack, prepRes, execRes) {
        // Convert intent to action
        if (execRes === 'sales') return 'route-to-sales';
        if (execRes === 'support') return 'route-to-support';
        return 'route-to-billing';
    }
}
```

```json
// flow.json
{
    "edges": [
        { "from": "classifier", "to": "sales-agent", "condition": "route-to-sales" },
        { "from": "classifier", "to": "support-agent", "condition": "route-to-support" },
        { "from": "classifier", "to": "billing-agent", "condition": "route-to-billing" }
    ]
}
```

**v2.1 Approach (JSON Logic):**
```typescript
// decision-node.ts
class IntentClassifier extends BackpackNode {
    async exec(prepRes: any) {
        return {
            intent: "sales",
            confidence: 0.92,
            vipCustomer: true
        };  // Return structured data
    }
    
    // No post() needed - JSON Logic evaluates the data
}
```

```json
// flow.json
{
    "edges": [
        {
            "from": "classifier",
            "to": "vip-sales-agent",
            "condition": {
                "and": [
                    { "==": [{ "var": "intent" }, "sales"] },
                    { "==": [{ "var": "vipCustomer" }, true] }
                ]
            }
        },
        {
            "from": "classifier",
            "to": "regular-sales-agent",
            "condition": { "==": [{ "var": "intent" }, "sales"] }
        }
    ]
}
```

Notice how JSON Logic lets you add VIP routing **without changing code**—just update the config!

---

## 9. Non-Goals (Out of Scope)

- **Visual Flow Editor:** The actual drag-and-drop GUI is a separate project
- **Config Storage:** Where configs are stored (Git, database, S3) is implementation-specific
- **Hot Reloading:** Swapping configs in a running agent is a future enhancement
- **Config Encryption:** Sensitive params (API keys) should use environment variables, not inline JSON

---

## 10. Security Considerations

### SC-1: No Inline Secrets

Configs must NOT contain API keys or secrets:

```json
{
    "params": {
        "model": "gpt-4",
        "apiKey": "${OPENAI_API_KEY}"  // ✅ Reference env var
    }
}
```

The `FlowLoader` resolves env var references at runtime.

### SC-2: Code Injection Prevention

Config params are data, not code. No `eval()` or dynamic imports:

```json
{
    "params": {
        "systemPrompt": "{{maliciousCode}}"  // ❌ Not executed
    }
}
```

### SC-3: Schema Validation

All configs MUST pass Zod validation before instantiation. Reject invalid configs at load time.

---

**References:**
- Master File Section 2.C: "Implementation Goals (Immediate)"
- Original PRD Section 2.3: "Serialization (The Bridge)"
- Related: PRD-001 (Backpack must be serializable), PRD-002 (EventStreamer in config)

