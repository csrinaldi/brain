# ADR-0025 — Release Audit Gate Ordering and Substrate Enforcement

**Status**: Accepted  
**Date**: 2026-07-25  — Cristian Rinaldi

## Context

The L2 release audit gate (Rung 2 of the substrate ladder contract, ADR-0015) was designed as the primary fail-closed guarantee for repositories where branch protection (Rung 1) is unavailable or incomplete.

However, release pipeline triggers that fire on tag creation events execute *after* the release tag has already been created and published to the VCS host. When the release audit fails (`exit 1`), the pipeline cannot undo or un-publish the tag that triggered it — rendering the fail-closed guarantee inert at the outcome level. Furthermore, historical non-squash merge commits predating governance policy lacked issue-closing keywords (`Closes #N`), causing release audits to fail permanently across subsequent releases.

## Decision

1. **Audit-Then-Tag Order**: The L2 release gate (`release.yml`) MUST execute `brain-audit` and verify all governance invariants *before* a git release tag is created or published. Running `brain-audit` on tag push (`on: push: tags`) post-facto is demoted from an enforcing guarantee to an advisory check because a failing audit cannot undo an existing tag.
2. **Audit Baseline Pinning**: `brain-audit` uses `governance.auditBaseline` in `brain.config.json` (pinned to `v1.0.0`) to skip pre-1.0 legacy merge commits from issue-link enforcement, preventing false-red audits across releases.
3. **Substrate Probing**: `detectSubstrate` evaluates Rung 2 as enforcing ONLY when `release.yml` implements the pre-tag audit guarantee.

## Consequences

- **Positive**: Rung 2 becomes a genuine fail-closed release gate. Release pipelines execute `brain-audit` *prior* to tag creation (e.g. via manual dispatch or pre-release pipeline), guaranteeing that release tags are
  created and pushed to the VCS host only when `brain-audit` exits 0.
- **Positive**: Configuring `governance.auditBaseline` (pinned to `v1.0.0`) skips legacy merge commits from `issueLink` failures, eliminating false-red audit reports across VCS hosts.
- **Positive**: `detectSubstrate` reports Rung 2 enforcement status accurately across supported VCS providers without overstating guarantees.
- **Negative / Trade-off**: Maintainers must generate release tags through the audit-then-tag release pipeline (e.g. manual dispatch or `brain:ship`) rather than pushing un-audited tags directly to the VCS remote.

## References

- [ADR-0015](adr-0015-governance-v3-substrate-ladder.md) — Governance v3 substrate ladder.
- [Issue #210](https://github.com/csrinaldi/brain/issues/210) — `release.yml` audit-gate ordering defect.
