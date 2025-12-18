# BackpackFlow v2.0 Tutorials

Welcome to the BackpackFlow v2.0 tutorials! These examples demonstrate the new features and capabilities of BackpackFlow.

## 🆕 v2.0 Tutorials

### Research Agent Tutorial

A complete example showcasing all v2.0 features through a **nested agent architecture**:
- **ResearchAgentNode** - High-level agent with internal workflow
- **Nested Flow Pattern** - Agent containing ChatNode, ResearchNode, SynthesisNode
- **Namespace Inheritance** - Internal flow inherits parent namespace
- **BackpackNode** with automatic metadata injection
- **Flow** with namespace composition  
- **Backpack** for state management with history
- **Access Control** between nodes with permissions
- **Namespace Queries** for filtering data by patterns
- Time-travel debugging capabilities

**Run it:**
```bash
# Default query
npm run tutorial:research-agent

# Custom query
npm run tutorial:research-agent "How does machine learning work?"

# Or directly with ts-node
npx ts-node tutorials/v2.0-research-agent.ts "your query here"
```

**What you'll see:**
- 🤖 Intelligent query analysis
- 🔍 Simulated research process
- 📝 Summary synthesis
- 📊 Complete execution trace
- 📂 Namespace hierarchy
- 💾 Backpack state inspection
- ⏰ Time-travel snapshot demo

**Output includes:**
- **Nested architecture**: `main.agent` → `main.agent.chat`, `main.agent.research`, etc.
- **8 feature demonstrations**: Namespace hierarchy, queries, history, metadata, access control, time-travel, output, statistics
- Automatic metadata: nodeId, nodeName, namespace in every pack()
- Full execution history with complete audit trail
- Access control permissions matrix
- Flow statistics and Backpack contents
- Serialization snapshot for time-travel debugging

## 📚 Legacy Tutorials (v1.x)

Previous tutorials have been moved to `tutorials/legacy/`:
- Building AI from first principles
- PocketFlow cookbook
- Simple chatbot
- Simple sales agent
- Node templates

These use the v1.x API and are kept for reference.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the v2.0 tutorial:**
   ```bash
   npm run tutorial:research-agent
   ```

3. **Explore the code:**
   - Open `tutorials/v2.0-research-agent.ts`
   - See how BackpackNode, Flow, and Backpack work together
   - Notice the automatic namespace composition
   - Check out the execution tracing

## 🎯 Key Concepts Demonstrated

### BackpackNode
```typescript
class ChatNode extends BackpackNode {
    static namespaceSegment = "chat";  // ← Node identity
    
    async exec(prepRes: any) {
        this.pack('data', value);  // ← Automatic metadata injection
        return result;
    }
}
```

### Flow (Namespace Composer)
```typescript
// Main flow
const mainFlow = new Flow({ namespace: 'main' });
const agent = mainFlow.addNode(ResearchAgentNode, { id: 'agent' });
// → agent.namespace = "main.agent"

// Inside ResearchAgentNode.exec() - nested flow
const internalFlow = new Flow({
    namespace: this.namespace,  // "main.agent"
    backpack: this.backpack
});
const chat = internalFlow.addNode(ChatNode, { id: 'chat' });
// → chat.namespace = "main.agent.chat"  ✅ Hierarchical!
```

### Backpack (State + History)
```typescript
// Automatic tracking
this.pack('key', value);  // Includes nodeId, nodeName, namespace

// Query by namespace
const data = this.unpackByNamespace('research-agent.*');

// Time-travel
const snapshot = flow.backpack.toJSON();
const restored = Backpack.fromJSON(snapshot);
```

## 📖 Documentation

For complete documentation, see:
- [PRD-001: Backpack Architecture](../docs/v2.0/prds/PRD-001-backpack-architecture.md)
- [TECH-SPEC-001: Implementation Guide](../docs/v2.0/specs/TECH-SPEC-001-backpack-implementation.md)
- [Implementation Progress](../docs/v2.0/IMPLEMENTATION-PROGRESS.md)

## 🤝 Contributing

Want to add a tutorial? We'd love to see examples of:
- Multi-agent systems
- Custom node types
- Complex workflows
- Real API integrations
- Advanced debugging scenarios

## 📝 License

MIT License - see [LICENSE](../LICENSE)

