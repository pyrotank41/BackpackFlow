# BackpackFlow Documentation

This directory contains all technical documentation for BackpackFlow.

## 📂 Folder Structure

```
docs/
├── prds/                    # Product Requirements Documents
│   ├── PRD-001-backpack-architecture.md
│   ├── PRD-002-telemetry-system.md
│   ├── PRD-003-serialization-bridge.md
│   └── PRD-legacy.md       # Deprecated original PRD
│
└── architecture/            # Architecture & Design Docs
    ├── streaming-architecture-diagram.md
    └── MIGRATION-v1-to-v2.md
```

## 📋 PRDs (Product Requirements Documents)

Product Requirements Documents define **what** we're building and **why**.

### Active PRDs (v2.0)

1. **[PRD-001: Backpack Architecture](./prds/PRD-001-backpack-architecture.md)**
   - **Status:** Draft
   - **Priority:** P0 (Foundation)
   - **Goal:** Replace SharedStorage with scoped, traceable state management
   - **Key Features:** `.pack()/.unpack()` API, metadata tracking, time-travel debugging

2. **[PRD-002: Telemetry System](./prds/PRD-002-telemetry-system.md)**
   - **Status:** Draft
   - **Priority:** P0 (Foundation)
   - **Goal:** Automatic lifecycle event emission for observability
   - **Key Features:** Lifecycle events, EventStreamer, BackpackNode wrapper

3. **[PRD-003: Serialization Bridge](./prds/PRD-003-serialization-bridge.md)**
   - **Status:** Draft
   - **Priority:** P1 (Enabler)
   - **Goal:** Make nodes instantiable from JSON configs
   - **Key Features:** Config schemas, FlowLoader, dependency injection

### Deprecated

- **[PRD-legacy.md](./prds/PRD-legacy.md)** - Original combined PRD (superseded by PRD-001/002/003)

---

## 🏗️ Architecture Documents

Architecture docs explain **how** the system works internally.

### Conceptual

- **[git-analogy.md](./architecture/git-analogy.md)** 🆕
  - **Backpack is "Git for agent state"**
  - Side-by-side comparison with Git
  - Perfect for understanding the core design

- **[backpack-flow-example.md](./architecture/backpack-flow-example.md)** 🆕
  - Complete walkthrough of a 3-node flow
  - Shows exactly how Backpack replaces SharedStore
  - Step-by-step data flow with examples

### Implementation

- **[TECH-SPEC-001-backpack-implementation.md](./architecture/TECH-SPEC-001-backpack-implementation.md)** 🆕
  - Detailed implementation guide
  - Algorithms, data structures, code patterns
  - For engineers building the Backpack

- **[debugging-workflow.md](./architecture/debugging-workflow.md)** 🆕
  - Real debugging scenarios
  - How to use history, snapshots, and diffs
  - Time-travel debugging in practice

- **[snapshot-reconstruction.md](./architecture/snapshot-reconstruction.md)** 🆕
  - How snapshots work (like `git checkout`)
  - Why we store full values in commits
  - Memory vs CPU trade-offs

- **[memory-management.md](./architecture/memory-management.md)** 🆕
  - Per-value size limits (100KB default)
  - Global memory budget (50MB default)
  - How references to large values work
  - Future: Disk offload strategy

### Migration

- **[MIGRATION-v1-to-v2.md](./architecture/MIGRATION-v1-to-v2.md)**
  - Guide for migrating from v1.2.0 to v2.0
  - EventStreamer refactoring details
  - Breaking changes strategy

- **[streaming-architecture-diagram.md](./architecture/streaming-architecture-diagram.md)**
  - Visual diagrams of the event streaming system
  - How nodes communicate via events

---

## 📚 Additional Resources

- **[ROADMAP.md](../ROADMAP.md)** - v2.0 release plan and timeline
- **[README.md](../README.md)** - Project overview and quick start
- **[tutorials/](../tutorials/)** - Learning guides and examples
- **[tasks/](../tasks/)** - Task definitions and work items

---

## 🤝 Contributing to Docs

When creating new documentation:

1. **PRDs** → Place in `docs/prds/` with naming: `PRD-NNN-feature-name.md`
2. **Architecture** → Place in `docs/architecture/` with descriptive name
3. **Guides** → Create `docs/guides/` if needed for how-to content
4. **Update this README** → Add links to new documents

---

**Last Updated:** December 17, 2025

