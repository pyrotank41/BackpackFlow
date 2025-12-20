# 🎒 BackpackFlow

A TypeScript-first, config-driven LLM framework built on top of [PocketFlow](https://github.com/The-Pocket/PocketFlow-Typescript).

**BackpackFlow** extends PocketFlow with a specific philosophy: **The Code is the Engine, the Config is the Steering Wheel.**

[![npm version](https://badge.fury.io/js/backpackflow.svg)](https://badge.fury.io/js/backpackflow)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

> **⚡ v2.0 "The Observable Agent"** - Build production-ready AI agents with complete observability, Zod-based type safety, and nested flow composition. TypeScript-first, config-driven, and ready for visual builders.

---

## 🚫 The Pain Points (Why BackpackFlow Exists)

Most LLM development hits three major walls:

### 1. **The "Black Box" State**
In many frameworks, context (history, variables) is handled by "magic." You don't know exactly what the LLM can "see" at any given step. Debugging feels like "doing animal experiments."

### 2. **The "No-Code" Wall**
Visual builders are great for demos, but when you need complex loops or custom logic, you hit a wall. You can't "eject" to code easily, and your flow is trapped in the GUI.

### 3. **The Language Barrier**
Python is great for data science, but if you want to build a **web-based tracer** or a **drag-and-drop UI**, you end up duplicating types between your Python backend and React frontend.

---

## 💡 The BackpackFlow Solution

We solve these pain points with a **TypeScript-First, Config-Driven** architecture.

### 1. "Git for Your Agent's State" (Solves Black Box State)

**Think of Backpack as "Git for your agent's memory."**

Just like Git tracks every code change with commits, Backpack tracks every data change in your agent:

```typescript
// Git workflow           // Backpack workflow
git commit              → backpack.pack('data', value)
git log                 → backpack.getHistory()
git checkout abc123     → backpack.getSnapshotAtCommit('abc123')
git diff                → backpack.diff(before, after)
```

**Why "Backpack"?** Because your agent **carries explicit data** from node to node:
- 🎒 Nothing is hidden - if it's not in the Backpack, the agent can't use it
- 🔍 Every item is **tagged** with who packed it, when, and why
- 🚫 Nodes declare **access permissions** - can't accidentally read debug data or PII
- ⏱️ Complete **audit trail** - trace any data back to its source

**The Result:** Instead of debugging "black box" state mutations, you have:

- ✅ **Immutable History** - Every data change is tracked (like Git commits)
- ✅ **Time-Travel Debugging** - Rewind to any previous state (`git checkout`)
- ✅ **Complete Auditability** - Know exactly who changed what, when (`git blame`)
- ✅ **Access Control** - Nodes declare what they can read/write (unlike SharedStore)

**If Git made code development manageable, Backpack makes agent development manageable.**

### 2. Code-First, UI-Ready (Solves the No-Code Wall)

We are building a "bridge" where **Code** and **Config** are interchangeable.

- **The Engine:** You write complex logic in TypeScript Nodes
- **The Steering Wheel:** The framework serializes your Nodes into JSON Config
- **The Result:** Build a **UI Layer** that can visualize and edit your flow, but allows you to "eject" to raw code whenever needed

```mermaid
graph LR
    A[TypeScript Code] -->|Compiles to| B(The Engine)
    A -->|Serializes to| C{JSON Config}
    C -->|Hydrates| B
    C <-->|Syncs with| D[Future Web GUI]
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style D fill:#bbf,stroke:#333,stroke-width:2px
```

### 3. TypeScript-First (Solves the Language Barrier)

Build your backend logic AND your web UI in the same language. Share types, schemas, and validation logic seamlessly.

---

## 📍 Current Version: v2.0.0

**"The Observable Agent"** - Complete rewrite with production-ready observability

- **Architecture**: Git-like state management with immutable history
- **Type Safety**: Full Zod schema validation with type inference
- **Observability**: Automatic event emission and time-travel debugging
- **Composition**: Nested flows with recursive serialization
- **Config-Driven**: Complete JSON serialization for visual builders

👉 **[See Full Roadmap](./ROADMAP.md)** | **[Migration from v1.x](./docs/v2.0/migration/MIGRATION-v1-to-v2.md)**

## ✨ Features

### Core Architecture (v2.0)

#### 🎒 Backpack: Git-Like State Management
[📚 Documentation](./docs/v2.0/prds/PRD-001-backpack-architecture.md)

Think of it as **"Git for your agent's memory"** - every data change is tracked with full history:

- **Immutable History**: Every state change recorded like Git commits
- **Time-Travel Debugging**: Rewind to any previous state to see what the agent "knew"
- **Source Tracking**: Know exactly which node added/modified each piece of data
- **Access Control**: Nodes declare what they can read/write with wildcard support
- **State Quarantine**: Isolate failed operations from downstream nodes

```typescript
// Git workflow           // Backpack workflow
git commit              → backpack.pack('data', value)
git log                 → backpack.getHistory()
git checkout abc123     → backpack.getSnapshot('abc123')
git diff                → backpack.diff(before, after)
```

#### 📡 Event Streaming: Complete Observability
[📚 Documentation](./docs/v2.0/prds/PRD-002-telemetry-system.md)

Automatic event emission for every node lifecycle event - no manual logging needed:

- **5 Event Types**: `NODE_START`, `PREP_COMPLETE`, `EXEC_COMPLETE`, `NODE_END`, `ERROR`
- **Prompt Inspection**: See exact LLM prompts via `PREP_COMPLETE` events
- **Parse Error Visibility**: Inspect raw responses before JSON parsing fails
- **Namespace Filtering**: Subscribe to events with wildcard patterns
- **Event History**: Built-in event storage for post-mortem debugging

#### 🔌 Config-Driven Architecture
[📚 Documentation](./docs/v2.0/prds/PRD-003-serialization-bridge.md)

Bidirectional conversion between TypeScript code and JSON configs:

- **JSON Serialization**: Export complete flows to JSON for storage/transfer
- **Type-Safe Loading**: Zod-validated configs prevent runtime errors
- **Dependency Injection**: Clean handling of non-serializable objects (LLM clients, DBs)
- **Round-Trip Guarantee**: `fromConfig(toConfig())` preserves node identity
- **UI-Ready**: Foundation for drag-and-drop flow builders

#### 🔀 Nested Flows & Composition
[📚 Documentation](./docs/v2.0/prds/PRD-004-composite-nodes.md)

Build complex agents from reusable components with standard patterns:

- **`createInternalFlow()`**: Auto-wiring of namespace, backpack, and events
- **Recursive Serialization**: Complete nested structure in JSON
- **Convenience Methods**: `.onComplete()`, `.onError()` instead of string-based routing
- **FlowAction Enum**: Type-safe routing with standardized actions
- **Query API**: `flattenNodes()`, `findNode()`, `getMaxDepth()` for flow introspection

#### 🔍 Data Contracts & Type Safety
[📚 Documentation](./docs/v2.0/prds/PRD-005-complete-flow-observability.md)

Zod-powered input/output contracts for bulletproof type safety:

- **Explicit Contracts**: Nodes declare expected inputs and outputs with Zod schemas
- **Runtime Validation**: Automatic validation with detailed error messages
- **Type Inference**: Full TypeScript types inferred from schemas
- **Data Mappings**: Edge-level key remapping for flexible composition
- **JSON Schema Export**: Generate schemas for UI form builders

## Project Structure

```
backpackflow/
├── src/                    # Source code
│   ├── pocketflow.ts      # PocketFlow core (ported)
│   └── index.ts           # Main entry point
├── tests/                  # Test files
├── tutorials/              # Learning guides and examples
├── dist/                   # Compiled output
└── docs/                   # Documentation
```

## Installation

```bash
npm install backpackflow
```

## Quick Start

### Basic Chat Node (Original)

```typescript
import { ChatNode } from 'backpackflow/nodes';
import { OpenAIProvider } from 'backpackflow/providers';
import { Flow } from 'backpackflow';

// Create an LLM provider
const llmProvider = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY
});

// Create a chat node
const chatNode = new ChatNode({
    llmProvider,
    systemMessage: 'You are a helpful assistant.'
});

// Use it in a flow
const flow = new Flow(chatNode);
await flow.run(storage);
```

### 🚀 New: Intelligent Agent with Tools (v1.2.0)

```typescript
import { 
    AgentNode, 
    MCPServerManager, 
    createInstructorClient,
    EventStreamer,
    StreamEventType 
} from 'backpackflow';

// 1. Create LLM client (explicit injection)
const instructorClient = createInstructorClient({ provider: 'openai' });

// 2. Set up tool integration (optional)
const mcpManager = new MCPServerManager();
await mcpManager.connectToServers([/* your MCP servers */]);
const availableTools = await mcpManager.discoverTools();

// 3. Create intelligent agent
const salesAgent = new AgentNode({
    llmConfig: {
        instructorClient: instructorClient
    },
    agentName: 'SalesAgent',
    eventStreamer: new EventStreamer(),
    namespace: 'sales_agent'
});

// 4. Set up real-time event streaming (optional)
const eventStreamer = new EventStreamer();
eventStreamer.subscribe('sales_agent', (event) => {
    switch (event.type) {
        case StreamEventType.PROGRESS:
            console.log(`🔄 ${event.nodeId}: ${JSON.stringify(event.content)}`);
            break;
        case StreamEventType.CHUNK:
            process.stdout.write(event.content.chunk); // Real-time response
            break;
        case StreamEventType.FINAL:
            console.log(`✅ Final: ${event.content.content}`);
            break;
    }
});

// 5. Execute with shared storage
const sharedStorage = {
    messages: [{ role: 'user', content: 'Generate a quote for 10A MCB' }],
    available_tools: availableTools,
    tool_manager: mcpManager
};

const result = await salesAgent.exec(sharedStorage);
console.log('Agent response:', result.finalAnswer);
```

### Azure OpenAI Support

```typescript
import { createInstructorClient } from 'backpackflow';

// Azure OpenAI configuration
const azureClient = createInstructorClient({
    provider: 'azure',
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deploymentName: 'gpt-4' // Your deployment name
});

const agent = new AgentNode({
    llmConfig: { instructorClient: azureClient },
    agentName: 'AzureAgent',
    eventStreamer: new EventStreamer(), // Optional streaming
    namespace: 'azure_agent'
});
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Development mode (watch for changes)
npm run dev
```

## 🎓 Learning & Examples

### Featured Example: YouTube Research Agent
**[tutorials/youtube-research-agent/](./tutorials/youtube-research-agent/)** - Production-ready agent showcasing all v2.0 features:

```typescript
class YouTubeResearchAgentNode extends BackpackNode {
    async _exec(input: any) {
        // ✨ Create internal flow with auto-wiring
        const flow = this.createInternalFlow();
        
        const searchNode = flow.addNode(YouTubeSearchNode, { id: 'search' });
        const analysisNode = flow.addNode(DataAnalysisNode, { id: 'analysis' });
        const summaryNode = flow.addNode(BaseChatCompletionNode, { id: 'summary' });
        
        // ✨ Clean routing with convenience methods
        searchNode.onComplete(analysisNode);
        analysisNode.onComplete(summaryNode);
        
        await flow.run({});
    }
}
```

**Features demonstrated:**
- 🔀 Composite nodes with nested flows
- ✅ Zod-based data contracts with type inference
- 📡 Event streaming with hierarchical visualization
- 💾 Complete flow serialization to JSON
- 🎯 Channel-relative outlier detection algorithm

### Additional Tutorials

**Advanced Patterns:**
- **[PocketFlow Cookbook](./tutorials/pocketflow-cookbook-ts/)** - Advanced workflow patterns

**Legacy Examples (v1.x):**
- [Simple Sales Agent](./tutorials/simple-sales-agent/) - Tool integration and streaming
- [Building AI from First Principles](./tutorials/building-ai-from-first-principles/) - Foundational concepts
- [Simple Chatbot](./tutorials/simple-chatbot/) - Basic chatbot implementation

See the `tutorials/` directory for all examples.

## 📋 What's New

### v2.0.0 "The Observable Agent" (Current)

**Major architectural rewrite** with production-grade observability and type safety.

#### 🎯 Core Systems

**Backpack Architecture**
- Git-like state management with immutable commit history
- Time-travel debugging with state snapshots
- Fine-grained access control with namespace wildcards
- State quarantine for isolating failed operations

**Event Streaming**
- 5 standardized event types for complete lifecycle visibility
- Automatic emission - zero manual logging required
- Namespace-based filtering with wildcard support
- Built-in event history for debugging

**Config-Driven Serialization**
- Bidirectional TypeScript ↔ JSON conversion
- Zod-powered validation for type safety
- Dependency injection for non-serializable objects
- Round-trip guarantee for config preservation

**Nested Flows & Composition**
- `createInternalFlow()` with automatic context inheritance
- Recursive serialization for complete flow structure
- `.onComplete()` / `.onError()` convenience methods
- Query utilities for flow introspection

**Zod Data Contracts**
- Explicit input/output declarations on nodes
- Runtime validation with detailed error messages
- Full TypeScript type inference
- Edge-level data mappings for key remapping

#### 🔧 Developer Experience

- **Type Safety**: End-to-end TypeScript with Zod schema validation
- **Observability**: See everything - prompts, responses, state changes, errors
- **Debugging**: Time-travel to any point in execution history
- **Composition**: Build complex agents from simple, reusable nodes
- **UI-Ready**: Complete serialization for visual flow builders

#### 📖 Resources

- [Migration Guide from v1.x](./docs/v2.0/migration/MIGRATION-v1-to-v2.md)
- [v2.0 Completion Summary](./docs/v2.0/V2.0-COMPLETION-SUMMARY.md)
- [Full PRD Documentation](./docs/v2.0/prds/)

---

### Previous Versions

<details>
<summary><b>v1.2.0</b> - Event-Driven Architecture (Legacy)</summary>

- Explicit LLM client injection
- Enhanced event streaming with `StreamEventType` enum
- Azure OpenAI support
- Improved `AgentNode` with better defaults
</details>

<details>
<summary><b>v1.1.0</b> - Event-Driven Streaming (Legacy)</summary>

- `EventStreamer` for centralized event management
- Real-time streaming support
- High-level `AgentNode` orchestration
</details>

<details>
<summary><b>v1.0.x</b> - Initial Release (Legacy)</summary>

- Basic PocketFlow integration
- OpenAI provider integration
- Core node types (Chat, Decision, utilities)
</details>

## 🤝 Join the Community

Want to contribute, get help, or share what you're building? 

👉 **[Join our community](./tutorials/building-ai-from-first-principles/JOIN_COMMUNITY.md)** - Connect with other developers building AI applications

## 🛠️ Contributing

This is a personal side project that I work on as time permits. While contributions are welcome, please understand that development pace may be irregular and APIs may change frequently as the project evolves.

### Want to Help Build v2.0?

We're actively working on three major features. Pick one that matches your interests:

1. **[PRD-001: Backpack Architecture](./docs/prds/PRD-001-backpack-architecture.md)** - State management (no LLM knowledge needed)
2. **[PRD-002: Telemetry System](./docs/prds/PRD-002-telemetry-system.md)** - Observability & event streaming
3. **[PRD-003: Serialization Bridge](./docs/prds/PRD-003-serialization-bridge.md)** - Config system (good for first-time contributors)

👉 **[See the Roadmap](./ROADMAP.md)** for detailed task breakdowns and timelines.

## License

Apache-2.0 - see the [LICENSE](LICENSE) file for details.

Copyright 2024 BackpackFlow 