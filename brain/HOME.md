# brain — Knowledge Base

Entry point for the living documentation of this project.

This repo is **self-hosting**: brain uses itself to document and evolve brain.

---

## Getting started

- [Adoption guide](../docs/adoption.md) — bring brain into a repo (new repo vs existing repo, step by step)

---

## Generic core (`brain/core/`)

Reusable documentation — applies to any project that adopts this system.
`brain/core/` is upstream and treated as read-only here.

### Methodology

- [Consolidation protocol](core/methodology/consolidation-protocol.md) — how generic improvements flow upstream
- [Agent authorities](core/methodology/agent-authorities.md) — what AI agents can and cannot do
- [Harness contract](core/methodology/harness-contract.md) — abstract SDD verbs any harness must implement
- [SDD canonical layout](core/methodology/sdd-layout.md) — normative openspec/changes/** layout: naming, required artifacts, operational artifacts, single-source accessor
- [VCS contract](core/methodology/vcs-contract.md) — abstract VCS verbs any provider (gh/glab) must implement
- [Feature-working-memory contract](core/methodology/feature-working-memory-contract.md) — the resume.md schema + feature-checkpoint/resume verbs
- [Memory record format](core/methodology/memory-format.md) — the brain-owned durable .memory/ record format (schema, union merge, index)
- [Workflow governance](core/methodology/workflow-governance.md) — four invariants, CI gates, enforce-outputs boundary, lockout recovery
- [Reviewer protocol](core/methodology/reviewer-protocol.md) — the cold external reviewer as doctrine: three structural locks against reviewer-as-authorizer, the reviewActors/approvalActors two-key split, four COMMENT-only port verbs, and the brain-review/1 verdict schema

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
- [ADR-0008](project/decisions/adr-0008-adapter-vcs-provider.md) — VCS adapter: explicit provider + verb contract
- [ADR-0009](project/decisions/adr-0009-documentation-language-policy.md) — Documentation language policy: core English, project docs configurable
- [ADR-0010](project/decisions/adr-0010-cli-output-i18n.md) — CLI output i18n: message catalogs with English fallback
- [ADR-0011](project/decisions/adr-0011-feature-scoped-working-memory.md) — Feature-scoped working memory: branch-local resume.md
- [ADR-0012](project/decisions/adr-0012-harness-init-adapter.md) — Harness-init adapter: each harness defines its init
- [ADR-0013](project/decisions/adr-0013-auto-adr-onboarding.md) — Auto-ADR onboarding: bootstrap notices, agent drafts, human signs
- [ADR-0014](project/decisions/adr-0014-workflow-governance.md) — Workflow governance: enforce load-bearing invariants server-side
- [ADR-0015](project/decisions/adr-0015-governance-v3-substrate-ladder.md) — Governance v3: six-level fail-closed gate ladder over observable evidence (L1–L6 + substrate rung ladder)
- [ADR-0016](project/decisions/adr-0016-ci-context-normalization.md) — CI Context Normalization: One Seam Over Provider-Specific Pipeline Evidence
- [ADR-0017](project/decisions/adr-0017-memory-format-owned-by-brain.md) — The Durable Memory Record Format Is Owned By Brain, Not By Engram
- [ADR-0019](project/decisions/adr-0019-harness-port.md) — The SDD_HARNESS port: four environment surfaces, artifacts neutral by design
- [ADR-0020](project/decisions/adr-0020-reviewer-port-verbs-and-two-key-split.md) — External-reviewer VCS port verbs + the reviewActors/approvalActors two-key split

### Project-specific rules

- [check-refs-rules.mjs](project/check-refs-rules.mjs) — prohibited reference rules for this project
- [Anti-patterns (project)](project/anti-patterns/README.md)

---

> Active changes → `openspec/changes/`
> Durable decisions → `brain/project/decisions/`
