# BackpackFlow v1.x Archive

This folder contains legacy tutorials from BackpackFlow v1.x. These tutorials use the old API and are kept for historical reference.

## ⚠️ Notice

**These tutorials are for v1.x (legacy) and will NOT work with v2.0.**

For current tutorials using the latest v2.0 features, see the main tutorials folder:
- [v2.0 Research Agent Tutorial](../v2.0-research-agent.ts)
- [v2.0 Tutorial README](../README.md)

## 📁 Contents

### Building AI from First Principles
**Path:** `building-ai-from-first-principles/`

A comprehensive course on building AI agents from scratch:
- **01-foundations/** - Core concepts and basic implementations
- **02-research-agent/** - Building a research agent
- **03-and-beyond/** - Advanced topics

### PocketFlow Cookbook
**Path:** `pocketflow-cookbook-ts/`

Collection of practical examples:
- **agent/** - Basic agent patterns
- **mcp/** - Model Context Protocol integration
- **simple-chat/** - Chat implementations
- **streaming/** - Streaming responses
- **structured-output/** - Structured data handling
- **workflow/** - Complex workflows

### Simple Examples
- **simple-chatbot/** - Basic chatbot implementation
- **simple-sales-agent/** - Sales agent with Azure integration
- **storage-demo.ts** - Storage system demo

### Templates
**Path:** `templates/`

Node and tutorial templates for v1.x development.

## 🔄 Migration to v2.0

If you want to migrate v1.x code to v2.0, see:
- [v2.0 Breaking Changes](../../docs/v2.0/migration/BREAKING-CHANGES.md)
- [Migration Guide](../../docs/v2.0/migration/MIGRATION-GUIDE.md)

Key differences in v2.0:
- `SharedStorage` → `Backpack` with history + namespaces
- `BaseNode` → `BackpackNode` with auto metadata
- Imperative chaining → Config-driven flows
- No built-in observability → Native tracing + time-travel

## 📚 Full Documentation Archive

For comprehensive v1.x documentation, see:
- `README-ARCHIVE.md` - Original tutorials README with all details
- Original documentation in each tutorial folder

## 🚀 Start with v2.0 Instead

We recommend starting with v2.0 tutorials for new projects:

```bash
cd ..
npm run tutorial:research-agent
```

The v2.0 tutorial demonstrates:
- ✅ Nested agent architecture
- ✅ Automatic namespace composition
- ✅ Built-in observability
- ✅ Time-travel debugging
- ✅ Access control
- ✅ Complete execution tracing

---

**This is a historical archive.** For current best practices, use v2.0! 🚀



