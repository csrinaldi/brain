# ADR-0025 — Release Audit Gate Ordering and Substrate Enforcement

**Status**: Draft (Pending Tier 2 Human Review & Signature)  
**Date**: 2026-07-25  

## Context

`<TODO: Human signature / rationale review>`

## Decision

1. **Audit-Then-Tag Order**: The L2 release gate (`release.yml`) MUST execute `brain-audit` and verify all governance invariants *before* a git release tag is created or published. Running `brain-audit` on tag push (`on: push: tags`) post-facto is demoted from an enforcing guarantee to an advisory check because a failing audit cannot undo an existing tag.
2. **Audit Baseline Pinning**: `brain-audit` uses `governance.auditBaseline` in `brain.config.json` (pinned to `v1.0.0`) to skip pre-1.0 legacy merge commits from issue-link enforcement, preventing false-red audits across releases.
3. **Substrate Probing**: `detectSubstrate` evaluates Rung 2 as enforcing ONLY when `release.yml` implements the pre-tag audit guarantee.

## Consequences

`<TODO: Human signature / consequence assessment>`

## References

- [ADR-0015](adr-0015-governance-v3-substrate-ladder.md) — Governance v3 substrate ladder.
- [Issue #210](https://github.com/csrinaldi/brain/issues/210) — `release.yml` audit-gate ordering defect.
