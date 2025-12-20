# Documentation Structure

**Last Updated:** December 20, 2025

This document visualizes the complete documentation structure for BackpackFlow.

---

## 📂 Complete Directory Tree

```
docs/
│
├── README.md                       # Main documentation hub
├── STRUCTURE.md                    # This file
│
├── v2.0/                          # ✅ Current Development (Dec 21, 2025)
│   ├── README.md                   # v2.0 documentation index
│   │
│   ├── prds/                       # Product Requirements Documents
│   │   ├── PRD-001-backpack-architecture.md           # ✅ Complete
│   │   ├── PRD-002-telemetry-system.md                # ✅ Complete
│   │   ├── PRD-003-serialization-bridge.md            # ✅ Complete
│   │   ├── PRD-004-composite-nodes.md                 # ✅ Complete
│   │   ├── PRD-005-complete-flow-observability.md     # ✅ Complete
│   │   └── PRD-006-documentation-developer-experience.md  # 📋 Planned v2.1
│   │
│   ├── specs/                      # Technical Specifications
│   │   ├── DECISIONS-AUDIT-v2.0.md          # ⭐ START HERE
│   │   └── TECH-SPEC-001-backpack-implementation.md
│   │
│   ├── guides/                     # Implementation Guides
│   │   ├── git-analogy.md                   # Mental model
│   │   ├── backpack-flow-example.md         # Complete walkthrough
│   │   ├── debugging-workflow.md            # Time-travel debugging
│   │   ├── snapshot-reconstruction.md       # How snapshots work
│   │   ├── memory-management.md             # Size limits & offload
│   │   └── streaming-architecture-diagram.md
│   │
│   └── migration/                  # Upgrade Guides
│       ├── MIGRATION-v1-to-v2.md
│       └── V2-BREAKING-CHANGES.md
│
├── v2.1/                          # 🔮 Future Release (Q1 2026)
│   └── README.md                   # Planned features
│
└── legacy/                        # 📦 Archived (pre-v2.0)
    ├── README.md
    └── PRD-legacy.md               # Original combined PRD
```

---

## 📊 Document Counts by Category

| Category | v2.0 | v2.1 | Legacy | Total |
|----------|------|------|--------|-------|
| **PRDs** | 6 | 0 | 1 | 7 |
| **Tech Specs** | 2 | 0 | 0 | 2 |
| **Guides** | 6 | 0 | 0 | 6 |
| **Migration** | 2 | 0 | 0 | 2 |
| **READMEs** | 1 | 1 | 1 | 3 |
| **Total** | 17 | 1 | 2 | **20** |

---

## 🎯 Navigation Paths

### For New Contributors

```
1. Start → docs/README.md
2. Navigate → docs/v2.0/README.md
3. Read → docs/v2.0/specs/DECISIONS-AUDIT-v2.0.md
4. Understand → docs/v2.0/guides/git-analogy.md
5. Implement → docs/v2.0/specs/TECH-SPEC-001-backpack-implementation.md
```

### For Migrating from v1.x

```
1. Start → docs/v2.0/migration/MIGRATION-v1-to-v2.md
2. Review → docs/v2.0/migration/V2-BREAKING-CHANGES.md
3. Understand → docs/v2.0/prds/PRD-001-backpack-architecture.md
4. Migrate → Follow step-by-step guide
```

### For Understanding Backpack

```
1. Mental Model → docs/v2.0/guides/git-analogy.md
2. Walkthrough → docs/v2.0/guides/backpack-flow-example.md
3. Deep Dive → docs/v2.0/specs/TECH-SPEC-001-backpack-implementation.md
```

---

## 🔗 External References

Documents outside `/docs` that link here:

- **[/ROADMAP.md](../ROADMAP.md)** - Links to all v2.0 PRDs and specs
- **[/README.md](../README.md)** - Links to PRDs in features section

---

## 🎨 Design Principles

### Why Version-Based Structure?

1. **Clear Scope** - Easy to see what belongs to each release
2. **Future-Proof** - v2.1, v3.0 follow same pattern
3. **Historical Record** - Preserves evolution of architectural decisions
4. **Easy Cleanup** - Can archive entire version directories when obsolete

### Why Subdirectories?

- **prds/** - What & Why (for stakeholders)
- **specs/** - How to Build (for engineers)
- **guides/** - Deep Dives & Examples (for learners)
- **migration/** - Upgrade Paths (for existing users)

### Naming Conventions

- **PRDs:** `PRD-NNN-feature-name.md` (uppercase prefix)
- **Tech Specs:** `TECH-SPEC-NNN-topic.md` (uppercase prefix)
- **Guides:** `descriptive-name.md` (lowercase with hyphens)
- **Decisions:** `DECISIONS-AUDIT-vX.Y.md` (versioned)
- **READMEs:** Always `README.md` (uppercase, markdown)

---

## 📋 Maintenance Checklist

When adding new documentation:

- [ ] Place in correct version directory (`v2.0/`, `v2.1/`, etc.)
- [ ] Choose correct subdirectory (`prds/`, `specs/`, `guides/`, `migration/`)
- [ ] Follow naming conventions
- [ ] Update relevant README.md files
- [ ] Update this STRUCTURE.md if adding new categories
- [ ] Update document counts table above
- [ ] Check all internal links are valid

---

## 🔄 Version Lifecycle

```
Planning → v2.X/ (prds, specs)
  ↓
Development → v2.X/ (guides added)
  ↓
Release → docs/vX.Y/ becomes "current"
  ↓
Superseded → Move to legacy/ if no longer relevant
```

**Current Status:**
- **v2.0:** Planning/Development (Active)
- **v2.1:** Planning (Future)
- **legacy:** Archived

---

**Maintained By:** Project maintainers  
**Questions?** Open an issue or discussion on GitHub

