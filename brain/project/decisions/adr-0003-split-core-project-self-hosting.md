# ADR-0003 — core/project Split and Self-Hosting

**Status**: Accepted  
**Date**: 2026-06-26

## Context

brain started as internal documentation for a specific project. The mature system has two classes of content with completely different lifecycles:

- **Generic**: applies to any project that adopts brain (methodology, adapters, check-refs engine, harness-contract).
- **Project-specific**: ADRs, domain knowledge, custom business rules.

Mixing them prevents extracting the generic system as a reusable product.

Additionally, brain is the type of system that documents its own construction — it makes sense for it to be self-hosting: using its own system to evolve itself.

## Decision

The `brain/` directory is split into two:

- `brain/core/`: the generic product. **Read-only for the consumer.** Contains generic methodology, generic anti-patterns, and the harness-contract. Improvements to core go upstream first (see `brain/core/methodology/consolidation-protocol.md`). core **never** references `brain/project/`.

- `brain/project/`: the consuming project's own evolution. ADRs, domain knowledge, specific anti-patterns. In the case of the `brain` repo itself, it contains brain's own ADRs.

brain is self-hosting: the `github.com/csrinaldi/brain` repo uses brain to document and evolve brain. Its own ADRs live in `brain/project/decisions/`. Its own SDD uses `openspec/`. This is total dogfooding.

## Consequences

- **Positive**: any project can adopt brain by copying `brain/core/` (or installing it via npm — see ADR-0006).
- **Positive**: ADR numbering is local to each project (brain starts at adr-0001, the consumer starts at adr-0001 — no collision).
- **Negative**: core and project must be actively kept separate. The "core does not reference project" invariant is validated in CI.
- **Negative**: generic improvements require an extra step (upstream-first) before reaching the consuming project.
