# ADR-0009 — Documentation Language Policy

**Status**: Accepted
**Date**: 2026-06-26

## Context

brain is a generic product intended to be adopted by other teams and to go public. Two questions about documentation language arise:

1. In which language is the generic product (`brain/core/**`) written?
2. In which language does a consuming team write its own documentation (`brain/project/**` — ADRs, domain, rules) and its SDD artifacts (`openspec/`)?

Forcing a single language on everything is wrong in both directions: the shipped product needs one canonical language to be universally adoptable, but a consuming team's own ADRs belong to that team and should not be dictated by the upstream product.

## Decision

Documentation language follows the core/project split (ADR-0003):

- **`brain/core/**` → English, always.** Non-negotiable. It is the shipped generic product, read by every consumer; its lingua franca is English. This includes core methodology and core anti-patterns.

- **`brain/project/**` (ADRs, domain, project anti-patterns) and `openspec/` → configurable per project.** Each consuming team writes these in whatever language it prefers. The choice is declared in `brain.config.json`:

  ```json
  { "docs": { "language": "en" } }
  ```

  Added to the schema via additive migration (ADR-0006). Default is `en`, overridable. AI agents and humans read this key to know which language to author project docs in. The brain repo itself sets `en`.

- **GitHub-facing artifacts (issue titles/bodies, PR titles/bodies, commit messages) → English, unconditionally.** They are public-facing regardless of the repo's `docs.language`.

This is a documented convention, not machine-enforced (reliable language detection is out of scope). `docs.language` is the declarative source of truth.

## Consequences

- **Positive**: the shipped product is universally readable (English), while consuming teams keep ownership of their own docs in their own language.
- **Positive**: the rule is mechanical and unambiguous — it falls out of the existing core/project boundary, so there is nothing new to reason about per file.
- **Negative**: contributors to `brain/core/**` whose first language is not English must write core docs in English; the upstream-first flow (ADR-0003) already concentrates that cost in core.
- **Negative**: `docs.language` is advisory — nothing fails a build if a project doc is written in the wrong language. Enforcement, if ever needed, is a future concern.
