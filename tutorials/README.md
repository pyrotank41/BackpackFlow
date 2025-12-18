# BackpackFlow v2.0 Tutorials

Learn BackpackFlow v2.0 through hands-on examples! This tutorial demonstrates how to build intelligent agents with full observability, state management, and debugging capabilities.

## 🚀 Quick Start

```bash
# Run the research agent tutorial
npm run tutorial:research-agent

# Or with a custom query
npm run tutorial:research-agent "How does machine learning work?"
```

## 📖 Tutorial: Research Agent

**File:** `v2.0-research-agent.ts`

A complete example showcasing a **nested agent architecture** - one of the key patterns in BackpackFlow v2.0.

### What You'll Learn

✅ **Nested Flow Pattern** - Build an agent that contains an internal workflow  
✅ **Namespace Composition** - Automatic hierarchical paths (`main.agent.chat`, `main.agent.research`)  
✅ **Backpack State Management** - Git-like versioning for your agent's state  
✅ **Access Control** - Permission-based data access between nodes  
✅ **Namespace Queries** - Filter data by patterns (`*.research.*`)  
✅ **Execution History** - Complete audit trail of every operation  
✅ **Time-Travel Debugging** - Snapshot and replay at any point  
✅ **Automatic Metadata** - Every operation tracked with nodeId, nodeName, namespace  

### Architecture

```
Main Flow
└─ ResearchAgentNode (main.agent)
   └─ Internal Flow
      ├─ ChatNode (main.agent.chat)         ← Analyzes query intent
      ├─ ResearchNode (main.agent.research) ← Gathers information
      ├─ SynthesisNode (main.agent.synthesis) ← Creates summary
      └─ DirectAnswerNode (main.agent.directAnswer) ← Quick responses
```

### Output Includes

- **8 Feature Demonstrations** covering all v2.0 capabilities
- Namespace hierarchy visualization
- Pattern-based queries (`main.agent.*`)
- Complete execution trace with commits
- Access control permission matrix
- Time-travel snapshot with state comparison
- Research results with confidence scores
- Flow statistics and metrics

## 🎯 Key Concepts

### 1. BackpackNode (Base Class)

All nodes extend `BackpackNode` which provides automatic metadata injection:

```typescript
class ChatNode extends BackpackNode {
    static namespaceSegment = "chat";  // ← Define node's identity
    
    async exec(prepRes: any) {
        // Automatic metadata: nodeId, nodeName, namespace
        this.pack('analysis', {
            intent: 'research',
            confidence: 0.9
        });
        
        return result;
    }
}
```

### 2. Nested Flow Pattern

Build complex agents by composing flows inside nodes:

```typescript
class ResearchAgentNode extends BackpackNode {
    static namespaceSegment = "agent";
    
    async exec(prepRes: any) {
        // Create internal flow that inherits parent namespace
        const internalFlow = new Flow({
            namespace: this.namespace,  // "main.agent"
            backpack: this.backpack     // Share same state
        });
        
        // Add internal nodes
        const chat = internalFlow.addNode(ChatNode, { id: 'chat' });
        // → chat.namespace becomes "main.agent.chat" ✅
        
        const research = internalFlow.addNode(ResearchNode, { id: 'research' });
        // → research.namespace becomes "main.agent.research" ✅
        
        // Define routing
        chat.on('needs_research', research);
        
        // Execute internal workflow
        await internalFlow.run(chat, prepRes);
        
        return { agentCompleted: true };
    }
}
```

### 3. Backpack (State + History)

Git-like state management with full traceability:

```typescript
// Automatic tracking with every pack()
this.pack('key', value);
// ✅ Includes nodeId, nodeName, namespace, timestamp, version

// Query by namespace pattern
const allResearch = this.unpackByNamespace('*.research.*');

// Time-travel debugging
const snapshot = flow.backpack.toJSON();
const pastState = flow.backpack.getSnapshotAtCommit(commitId);
const diff = flow.backpack.diff(pastState, currentState);
```

### 4. Access Control

Permission-based data access between nodes:

```typescript
// Register permissions for a node
flow.backpack.registerPermissions('research', {
    read: ['userQuery', 'chatAnalysis'],
    write: ['researchSources', 'researchMetadata'],
    namespaceRead: ['main.agent.chat.*'],
    namespaceWrite: ['main.agent.research.*']
});

// Automatic enforcement
const data = this.unpack('userQuery'); // ✅ Allowed by permissions
const blocked = this.unpack('secretKey'); // ❌ Access denied
```

## 📊 Example Output

When you run the tutorial, you'll see:

```
════════════════════════════════════════════════════════════════
🚀 BackpackFlow v2.0 - Nested Agent Architecture
════════════════════════════════════════════════════════════════

📥 Query: "search for TypeScript best practices"

🤖 Research Agent starting...
   🤖 [Chat] Analyzing query...
      → Intent: research_required (90% confidence)
   🔍 [Research] Gathering sources...
      → Found 3 sources (avg relevance: 95%)
   📝 [Synthesis] Creating summary...
      → Synthesis complete (confidence: 88%)

✅ Research Agent completed!

════════════════════════════════════════════════════════════════
📊 v2.0 FEATURES DEMONSTRATION
════════════════════════════════════════════════════════════════

1️⃣  Namespace Hierarchy (Nested Flow Pattern)
   main.agent
      ├─ main.agent.chat (2 items)
      ├─ main.agent.research (2 items)
      └─ main.agent.synthesis (1 items)

2️⃣  Namespace Queries (Pattern Matching)
   🔍 Pattern: "main.agent.*"
   📦 Matches: 5 items

... (8 feature demonstrations total)
```

## 🎓 Learning Path

1. **Read the code** in `v2.0-research-agent.ts`
   - Start with `ResearchAgentNode` to see the nested flow pattern
   - Look at how `ChatNode`, `ResearchNode`, etc. use `BackpackNode`
   - Notice the automatic namespace composition

2. **Run the tutorial** with different queries
   ```bash
   npm run tutorial:research-agent "your custom query"
   ```

3. **Explore the documentation**
   - [PRD-001: Backpack Architecture](../docs/v2.0/prds/PRD-001-backpack-architecture.md)
   - [TECH-SPEC-001: Implementation Guide](../docs/v2.0/specs/TECH-SPEC-001-backpack-implementation.md)
   - [Implementation Progress](../docs/v2.0/IMPLEMENTATION-PROGRESS.md)

4. **Build your own agent**
   - Extend `BackpackNode` for custom nodes
   - Use `Flow` to compose nodes with automatic namespaces
   - Leverage Backpack for state + observability

## 🔧 Customization Ideas

Try modifying the tutorial to:

- Add new node types (e.g., `ValidationNode`, `CacheNode`)
- Implement different routing strategies
- Add more complex access control rules
- Create deeper nested flows (agent → sub-agent → task)
- Integrate real APIs for research
- Add persistence/serialization
- Build a multi-agent system

## 📚 v1.x Archive

Previous tutorials (v1.x) have been moved to `archive-v1.x/`:
- Building AI from first principles
- PocketFlow cookbook
- Simple chatbot
- Simple sales agent
- Node templates

These are kept for reference but use the legacy v1.x API.

## 🤝 Contributing

Want to add more tutorials? We'd love to see examples of:
- Multi-agent collaboration
- Real-world API integrations
- Advanced debugging scenarios
- Complex workflow patterns
- Custom observability tools

## 📝 License

Apache License 2.0 - see [LICENSE](../LICENSE)

---

**Ready to start?** Run `npm run tutorial:research-agent` and explore the code! 🚀

