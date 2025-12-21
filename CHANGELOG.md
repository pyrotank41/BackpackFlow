# Changelog

All notable changes to BackpackFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2025-12-21 (Planned)

### 🎉 Major Release - Complete Rewrite

This is a **major breaking release** that transforms BackpackFlow from a simple flow orchestrator into a production-ready, fully observable, config-driven LLM framework.

### ✨ Added

#### PRD-001: Backpack Architecture (175 tests)
- **Git-like State Management** - Complete history, time-travel debugging, and state snapshots
- **Core Storage** - Scoped key-value storage with automatic metadata tracking
- **History & Time-Travel** - Full audit trail with `getSnapshotAtCommit()`, `diff()`, and `replay()`
- **Access Control** - Key-based and namespace-based permissions with wildcards
- **Namespace Query API** - Filter data by patterns (`sales.*`, `*.chat`)
- **Graph-Assigned Namespaces** - Automatic namespace composition for nodes in flows
- **BackpackNode Base Class** - New base class with helper methods and automatic metadata injection
- **Flow Class** - Orchestrates nodes with shared Backpack and namespace composition

#### PRD-002: Telemetry System (28 tests)
- **EventStreamer** - Type-safe event emission with wildcard pattern matching
- **Lifecycle Events** - `NODE_START`, `PREP_COMPLETE`, `EXEC_COMPLETE`, `NODE_END`, `ERROR`
- **Backpack Events** - `BACKPACK_PACK`, `BACKPACK_UNPACK` with access control tracking
- **Event History** - Circular buffer with configurable size
- **Event Filtering** - Query by type, namespace, node ID, or run ID
- **Statistics API** - Track total events, unique nodes, namespaces, and runs
- **Observable Demo** - Complete observability tutorial (`v2.0-observable-agent.ts`)

#### PRD-003: Serialization Bridge (34 tests)
- **Config-Driven Nodes** - Serialize/deserialize nodes to/from JSON
- **FlowLoader** - Load and export entire flows from JSON configurations
- **DependencyContainer** - Dependency injection for non-serializable objects
- **Config Validation** - Validate flow configs before loading
- **Version Support** - Config versioning for future migrations
- **Example Nodes** - `SimpleChatNode` and `SimpleDecisionNode` with full serialization

### 🔧 Changed

- **BREAKING:** Replaced `SharedStore` with `Backpack` - Complete new API
- **BREAKING:** Nodes should now extend `BackpackNode` instead of `BaseNode` for v2.0 features
- **BREAKING:** Namespace structure changed to hierarchical composition
- **BREAKING:** Flow instantiation now requires `FlowConfig`
- Updated tutorials to demonstrate v2.0 features
- Reorganized documentation into versioned structure (`docs/v2.0/`, `docs/v2.1/`)

### 📚 Documentation

- Added comprehensive PRDs for all 3 core systems
- Added technical specifications and implementation guides
- Added decision audit trail (`DECISIONS-AUDIT-v2.0.md`)
- Added v2.0 completion summary with use cases
- Added CI/CD setup guide for npm publishing
- Reorganized tutorials into `v2.0/` and `archive-v1.x/`
- Created new observable agent demo

### 🚀 CI/CD

- Added GitHub Actions workflow for automatic npm publishing
- Added CI workflow for testing on PRs and main branch
- Tests run on Node 18 and Node 20
- All 237 tests must pass before publishing

### 📊 Statistics

- **Total Tests:** 237 passing (100% success rate)
- **Code Coverage:** ~4,550 lines of production code
- **Implementation Time:** 1 day (December 18, 2025)
- **Breaking Changes:** Yes (major version bump)

### 🎯 Migration Guide

See [docs/v2.0/migration/MIGRATION-v1-to-v2.md](./docs/v2.0/migration/MIGRATION-v1-to-v2.md) for detailed migration instructions.

**Key Changes:**
1. Replace `SharedStore` with `Backpack`
2. Extend `BackpackNode` instead of `BaseNode`
3. Update node instantiation to use `Flow.addNode()`
4. Update namespace definitions (use `namespaceSegment` static property)
5. Pass `EventStreamer` for observability (optional)

### 💡 Use Cases

v2.0 enables powerful new use cases:
- 🐛 **Debug Production Agents** - Time-travel through execution history
- 📊 **Build Observability Dashboards** - Real-time event streaming
- 🎨 **Visual Flow Editors** - Config-driven node serialization
- 🧪 **A/B Testing** - Swap configs without code changes
- 🤖 **Multi-Agent Systems** - Namespace isolation and access control

---

## [1.3.0] - 2024-12-XX

### Added
- Decision node with turn limiting to prevent infinite loops
- Configuration API improvements

### Changed
- Improved error handling in decision nodes
- Updated storage demo examples

---

## [1.2.1] - 2024-11-XX

### Added
- Clean configuration API separation
- Improved conversational agent examples

---

## [1.2.0] - 2024-11-XX

### Added
- Conversational sales agent tutorial
- Enhanced storage capabilities

---

## [1.1.0] - 2024-10-XX

### Added
- Initial PocketFlow integration
- Basic storage system
- Simple agent examples

---

## [1.0.0] - 2024-09-XX

### Added
- Initial release
- Core flow orchestration
- Basic node system
- OpenAI integration

---

[2.0.0]: https://github.com/pyrotank41/Backpackflow/compare/v1.3.0...v2.0.0
[1.3.0]: https://github.com/pyrotank41/Backpackflow/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/pyrotank41/Backpackflow/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/pyrotank41/Backpackflow/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/pyrotank41/Backpackflow/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/pyrotank41/Backpackflow/releases/tag/v1.0.0



