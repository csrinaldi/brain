# brain — Knowledge Base

Entry point for the living documentation of this project.

This repo is **self-hosting**: brain uses itself to document and evolve brain.

---

## Generic core (`brain/core/`)

Reusable documentation — applies to any project that adopts this system.
`brain/core/` is upstream and treated as read-only here.

### Methodology

- [Consolidation protocol](core/methodology/consolidation-protocol.md) — how generic improvements flow upstream
- [Agent authorities](core/methodology/agent-authorities.md) — what AI agents can and cannot do
- [Harness contract](core/methodology/harness-contract.md) — abstract SDD verbs any harness must implement

### Anti-patterns (generic)

- [Anti-patterns index](core/anti-patterns/README.md)
  - [config.yaml seq/map mixed](core/anti-patterns/config-yaml-seq-map-mezclados.md)
  - [git diff does not show untracked](core/anti-patterns/git-diff-no-ve-untracked.md)
  - [AI writes brain without human gate](core/anti-patterns/ia-escribe-brain-sin-gate.md)
  - [AI promotes its own artifacts](core/anti-patterns/ia-promueve-sus-propios-artefactos.md)
  - [Self-updating installers are not innocuous](core/anti-patterns/instaladores-autoactualizantes-no-inocuos.md)

---

## Project knowledge (`brain/project/`)

Decisions, domain, and methodology specific to this project.

See [`brain/project/README.md`](project/README.md) for directory conventions.

### Architecture decisions

- [ADR-0001](project/decisions/adr-0001-arquitectura-3-capas-harness-reemplazable.md) — 3-layer architecture with replaceable harness
- [ADR-0002](project/decisions/adr-0002-memoria-git-based-dos-capas.md) — Git-based team memory in two layers
- [ADR-0003](project/decisions/adr-0003-split-core-project-self-hosting.md) — core/project split and self-hosting
- [ADR-0004](project/decisions/adr-0004-adapter-memoria-memory-backend.md) — Memory adapter: MEMORY_BACKEND selector
- [ADR-0005](project/decisions/adr-0005-adapter-harness-sdd-harness.md) — Harness adapter: SDD_HARNESS selector
- [ADR-0006](project/decisions/adr-0006-distribucion-installer-versionado.md) — Distribution: versioned installer via git tags
- [ADR-0007](project/decisions/adr-0007-config-vcs-agnostica-y-checkrefs.md) — VCS-agnostic config and check-refs engine
- [ADR-0009](project/decisions/adr-0009-documentation-language-policy.md) — Documentation language policy: core English, project docs configurable

### Project-specific rules

- [check-refs-rules.mjs](project/check-refs-rules.mjs) — prohibited reference rules for this project
- [Anti-patterns (project)](project/anti-patterns/README.md)

---

> Active changes → `openspec/changes/`
> Durable decisions → `brain/project/decisions/`
