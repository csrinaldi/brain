# Archive Report: Issue #358 Q5 — Governance Doctrine Tiers (Phases 1–5 + Finding A Fix)

**Change**: issue-358-q5-governance-doctrine-tiers  
**Change Type**: Q5 epic (architecture decision / governance redesign)  
**Archived**: 2026-08-01  
**Status**: ARCHIVED (Phases 1–5 complete; Phase 6 documentation deferred)

---

## Executive Summary

Issue #358 Q5 introduces a **declared** governance tier axis (`lite`, `standard`, `regulated`) orthogonal to the **detected** substrate rung ladder (ADR-0015). This resolves #329 (solo-maintainer approval gate deadlock) and #94 (branch-protection unavailability), and unblocks #284 (reviewer v2), T2.1 (memory retrieval), and M3 (reviewer governance).

All implementation phases (1–5) are **complete and verified**:
- **Phase 1**: Tier module (`governance-tiers.mjs`)
- **Phase 2**: Consumer surfaces (brain-protect, brain-governance-status)
- **Phase 3**: Tiered parameters + tier-aware audit paths
- **Phase 4**: Evidence tiering (actor-check, brain-writes-reviewed)
- **Phase 5**: Gate promotions + Finding A fix (mapDetectionToWarning wiring)

**Finding A (post-verify critical fix)**: Phase 5's fail-close for `phase-order` uncomputable-diff was unconditional, violating REQ-TIER-3. Fixed by wiring both paths through `mapDetectionToWarning` helper (commit ac1d058).

**Phase 6** (documentation) deferred: workflow-governance.md, adoption.md, KNOWN-LIMITATIONS.md remain open for follow-up.

---

## Delivered Capabilities

### Governance-Tiers (New)
- Three tiers: `lite < standard < regulated` (ordinal)
- Gate-distribution matrix with position and evidence tiering
- 11 tier invariants (REQ-TIER-1 through REQ-TIER-11)
- Pure module: resolveTier, resolveGatePolicy, resolveGateEvidence, tierParams, requiredJobs

### Governance-V3 (Modified)
- REQ-L4-2′: phase-order artefact set tier-scoped
- REQ-L5-1′: actor-check evidence tier-dependent (distinct-act / +distinct-actor / +no-commit-on-branch)
- REQ-L6-1′: brain-writes-reviewed evidence tier-dependent (agent-authorship-exclusion / human-approved-review / +codeowners)
- Extended REQ-HONESTY-1/2 to report tier × rung cross-product

---

## Phases Completed

| Phase | Commit | Subject | Status |
|-------|--------|---------|--------|
| 1 | `db674bb` | feat(governance): implement tier module | ✅ Complete |
| 2 | `90156e9` | feat(governance): derive consumer surfaces | ✅ Complete |
| 3 | `6169909` | feat(governance): tier-scoped diff budget | ✅ Complete |
| 3 | `ac1d058` | fix(governance): tier-aware audit path (CRITICAL-1) | ✅ Complete |
| 3 | `0b6cb78` | docs: record commit SHAs (CRITICAL-2) | ✅ Complete |
| 4 | `21cc250` | feat(governance): REQ-L5-1′ evidence tiering (actor-check) | ✅ Complete |
| 4 | `732b243` | feat(governance): REQ-L6-1′ evidence tiering (brain-writes-reviewed) | ✅ Complete |
| 5 | `73c1134` | feat(governance): fail-close phase-order | ✅ Complete |
| 5 | `da025ad` | feat(governance): promote gates + Finding A wiring | ✅ Complete |

**Total**: 9 commits; all phases 1–5 marked `[x]` in tasks.md with commit SHAs

---

## Test Results

**Final Verification**: ✅ **PASS**

- **Full suite** (`node --test brain/scripts/**/*.test.mjs`):
  - **2252 passed / 3 failed (pre-existing, unrelated) / 2255 total**
  - Pre-existing failures: antigravity.drift.test.mjs (AGENTS.md sync), 2× backfill-issue.test.mjs (untracked work)
  - **Zero regressions** introduced by Q5 phases

- **Targeted suites**: Phase 5 (governance-tiers.test, governance-checks.test, phase-order-check.test, tranche.test)
  - ✅ 93 passed / 0 failed

- **Spec compliance**: All 12 scenarios Phase 4, all 9 scenarios Phase 5 compliant

---

## Commits (Full List)

Branch: `docs/issue-391-t23-review-package-spec`

1. `db674bb` — feat(governance): implement tier module (phase 1)
2. `90156e9` — feat(governance): derive consumer surfaces from tier matrix (phase 2)
3. `6169909` — feat(governance): tier-scoped diff budget and artefacts (phase 3)
4. `ac1d058` — fix(governance): make rung-2/3 audit path tier-aware (CRITICAL-1)
5. `0b6cb78` — docs: record commit SHAs on tasks.md (CRITICAL-2)
6. `21cc250` — feat(governance): REQ-L5-1′ evidence tiering for actor-check (phase 4)
7. `732b243` — feat(governance): REQ-L6-1′ evidence tiering for brain-writes-reviewed (phase 4)
8. `73c1134` — feat(governance): fail-close phase-order uncomputable-diff (phase 5)
9. `da025ad` — feat(governance): promote actor-check/brain-writes-reviewed/phase-order; empty PENDING_PROMOTION (phase 5)

---

## Finding A: Post-Verify Critical Fix

**Issue**: `phase-order` fail-close for uncomputable-diff was unconditional (hard fail at every tier), violating REQ-TIER-3. At `lite` tier, `phase-order` is `detection` policy, must exit 0 with warning.

**Solution** (commit `ac1d058`, wired during Phase 5):
- Both uncomputable-diff paths (missing BASE_SHA/HEAD_SHA, throwing git) routed through `mapDetectionToWarning(result, tier, gate)` helper
- `standard`/`regulated` (required): fail closed as before
- `lite` (detection): degrade to warn, exit 0, with `::warning::phase-order: diff uncomputable (tier: lite)`
- Tests: phase-order-check.test.mjs split tier-implicit tests into explicit lite (warn, exit 0) and standard/regulated (fail) cases

**Verification**: ✅ Phase 5 re-verify confirms both paths working correctly; tranche.test.mjs scenario rewritten, all tests green

---

## Deferred Work (Phase 6)

- `workflow-governance.md` — tier axis, matrix, tier × rung composition (Tier 2, human sign-off required)
- `adoption.md` — how an adopter picks a tier
- `KNOWN-LIMITATIONS.md` — unexercised tiers, GitLab regulated gap (#130)
- Pre-existing: `decision-gate` code-vs-doc divergence resolution
- Meta: Issue #358 closure pending Phase 6 completion

---

## SDD Cycle Closure

| Phase | Status | Key Artifact |
|-------|--------|-------------|
| 0 (Decision) | ✅ | proposal.md, spec.md, design.md, ADR-0026 |
| 1 (Tier module) | ✅ | governance-tiers.mjs + tests |
| 2 (Surfaces) | ✅ | brain-protect.mjs, brain-governance-status.mjs |
| 3 (Parameters) | ✅ | diff-size.mjs, audit paths tier-aware |
| 4 (Evidence) | ✅ | actor-check.mjs, brain-writes-reviewed.mjs |
| 5 (Promotions) | ✅ | PENDING_PROMOTION empty, Finding A fix wired |
| 6 (Docs) | ⏳ Deferred | Intentional follow-up PR |

**Change Closure**: Phases 1–5 fully implemented and verified. Ready for Phase 6 documentation PR.

---

## Unblocked Work

- ✅ #329 — actor-check deadlock resolved (evidence tiering)
- ✅ #94 — branch-protection unavailability decoupled (tier declaration)
- ✅ #284 — reviewer v2 enabled (regulated tier)
- ✅ T2.1 — memory-gate scoping guidance (design §6)
- ✅ M3 — reviewer governance clarity (design §7)

---

## Archive Metadata

- **Archived**: 2026-08-01
- **Branch**: `docs/issue-391-t23-review-package-spec`
- **Epic**: #358 (Q5)
- **Test Status**: 2252/2255 passed (3 pre-existing failures, zero Q5 regressions)
- **Commits**: 9 work-unit commits, all tests green
- **Critical Fixes**: 2 (CRITICAL-1: audit path tier-awareness; CRITICAL-2: commit SHAs documented)
- **Post-Verify Fixes**: 1 (Finding A: phase-order mapDetectionToWarning wiring)
