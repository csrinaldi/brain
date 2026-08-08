# Archive Report: Governance Doctrine Tiers (#358 Q5)

**Date Archived**: 2026-08-01  
**Change ID**: issue-358-q5-doctrine-tiers  
**Issue**: #358 (Q5)  
**Status**: Phases 1-3 complete, verified PASS, archived

## Executive Summary

Governance doctrine tiers (lite / standard / regulated) introduce a declared axis orthogonal to the detected rung ladder. This change specifies the tier invariants, defines the three-tier matrix, and implements phases 1-3 (tier module, consumer surfaces, tiered parameters). Phases 4-6 (evidence tiering, promotions, documentation) are deliberately deferred. Phase 4 is blocked on #328; Phase 5 depends on Phase 4; Phase 6 is deferred post-Phase-4. The change is fully verified and archived for future phases.

## What Was Delivered

### Specifications Created

1. **New Capability: `governance-tiers`** (`openspec/specs/governance-tiers/spec.md`)
   - 11 tier invariants (REQ-TIER-1 through REQ-TIER-11) defining the declared doctrine axis
   - Three tiers: `lite`, `standard`, `regulated` with a single ordinal order
   - A never-tiered core (6 gates) that remain `required` at every tier
   - Position tiering vs. evidence tiering distinction
   - Proportionality bounds on which gates may tier
   - Fail-closed on unknown tiers and unmapped gates

2. **Modified Capability: `governance-v3`** (`openspec/specs/governance-v3/spec.md`)
   - REQ-L4-2: Tier-scoped artefact requirements (lite requires spec only; standard/regulated require spec + design)
   - REQ-L5-1 (renamed REQ-L5-1'): Evidence-tiered approver distinctness
     - lite: distinct act (timestamp-ordered approval)
     - standard: distinct act + distinct actor
     - regulated: distinct act + distinct actor + no prior commits
   - REQ-L6-2 (renamed REQ-L6-1'): Evidence-tiered brain-writes review
     - lite: agent-authorship exclusion
     - standard: approved review from non-author, non-bot human
     - regulated: standard evidence + CODEOWNERS enhancement

### Implementation (Phases 1-3)

**Phase 1** — Tier module (commit `db674bb`)
- `brain/scripts/vcs/governance-tiers.mjs`: pure module with tier definitions, gate matrix, resolution functions
- Tests: monotonicity, never-tiered invariant, no off/disabled policies, proportionality bounds, unknown tier fail-closed
- Config migration: `governance.tier: "standard"` at version 0.9.0

**Phase 2** — Consumer surfaces (commit `90156e9`)
- `governance-checks.mjs`: `checkContexts(tier)`, `requiredJobs(tier)` derived from matrix
- `run-check.mjs`: tier-aware diff-size check, honors `size:exception` per tier
- `brain-protect.mjs`: arms tier-scoped required jobs
- `brain-governance-status.mjs`: reports tier (declared) × rung (detected) cross-product

**Phase 3** — Tiered parameters (commit `6169909`)
- Diff budget tiered: lite=1000, standard=400, regulated=200
- Artefact requirements tier-scoped in `phase-order-check.mjs`
- Removed duplicate 400-line literals from `.github/workflows/governance.yml` and `pre-push` hook
- Override labels (`override:*`) tier-scoped: honored at lite/standard, refused at regulated
- **CRITICAL fix** (commit `ac1d058`): Rung-2 (`brain-audit.mjs`, `release.yml`) and rung-3 audit paths now tier-aware; `lib/merge-walk.mjs` accepts explicit tier context

### Deferred Phases

**Phase 4 — Evidence tiering** (blocked on #328)
- Implementation of REQ-L5-1'/REQ-L6-1' evidence forms
- Actor-check: distinct-act evidence at lite requires unreadable label-add event (blocked)
- Brain-writes-reviewed: agent-authorship exclusion at lite (blocked)
- Unblocks: #329 promotion of both gates

**Phase 5 — Promotions** (depends on Phase 4)
- Promote actor-check to required at all tiers
- Promote brain-writes-reviewed to required at all tiers
- Fail-close phase-order's uncomputable-diff branch (ADR-0015 precondition)
- Note: brain.config.json already declares `"tier": "lite"` (committed pre-archive)

**Phase 6 — Documentation**
- `workflow-governance.md`: tier axis, matrix, tier × rung composition
- `adoption.md`: tier selection guidance for adopters
- `KNOWN-LIMITATIONS.md`: unexercised tiers at n=0 external adopters, regulated unsupported on GitLab

## Test Results

**Verification Report**: PASS (re-verified after CRITICAL fix)
- Targeted test suite (77/77 passed):
  - `merge-walk.test.mjs`: lite 900-line diff passes; regulated + 260-line `size:exception` fails
  - `governance-tiers.test.mjs`: monotonicity, never-tiered core, matrix total
  - `brain-check.test.mjs`: tier-scoped budget, legacy fallback
  - `brain-audit.test.mjs`, `brain-metrics.test.mjs`: tier-aware audit paths
- Full suite: 2219 total, 2216 passed, 3 pre-existing unrelated failures (no regressions)

## Source of Truth Updates

The following main specs now incorporate tier-scoped requirements:

- `openspec/specs/governance-tiers/spec.md` — NEW capability
- `openspec/specs/governance-v3/spec.md` — MODIFIED: REQ-L4-2, REQ-L5-1, REQ-L6-2 now tier-scoped

## Commits

| Commit | Phase | Summary |
|--------|-------|---------|
| `db674bb` | 1 | feat(governance): implement tier module (phase 1) |
| `90156e9` | 2 | feat(governance): derive consumer surfaces from tier matrix (phase 2) |
| `6169909` | 3 | feat(governance): tier-scoped diff budget and artefacts (phase 3) |
| `ac1d058` | 3 (fix) | fix(governance): make rung-2/3 audit path tier-aware |
| `0b6cb78` | 3 (meta) | docs: record commit SHAs on tasks.md |

**Clean tree verified**: `git status --porcelain` shows no Q5-touched files remaining.

## Artifacts Archived

- ✅ `proposal.md` — Governance Doctrine Tiers proposal
- ✅ `spec.md` — Spec delta (governance-tiers + governance-v3 modifications)
- ✅ `design.md` — Design rationale and alternatives
- ✅ `tasks.md` — Phase breakdown and task checklist (Phases 1-3 complete, Phases 4-6 deferred)
- ✅ `verify-report.md` — Verification report (PASS)
- ✅ `brain-drafts/adr-0026-governance-doctrine-tiers.md` — ADR draft
- ✅ `brain-drafts/HOME-entry-adr-0026.md` — ADR indexing

## Key Decisions Ratified

1. **Artefact set for standard** (REQ-L4-2): all four artefacts required (proposal + spec + design + tasks)
2. **Brain's own tier**: `lite` (commit `7e2d8f1`, already shipped in `brain.config.json`)
3. **Lite diff budget**: 1000 (with 400 kept as convention for downstream consumers)
4. **ADR-0026 promotion**: Already shipped (status: Accepted, commits `e8f9e93`, restored `b9e3723`)

## Known Deviations (Pre-Existing)

- REQ-TIER-2 core gate: `override:*` tier-scoping implemented (Phase 3)
- REQ-TIER-2 core gate: evidence-form evidence tiering deferred (Phase 4, blocked on #328)
- REQ-L5-1'/REQ-L6-1': Evidence forms not yet implemented (Phase 4)
- Untested brain-protect.mjs tier composition (design §4.2) — deferred for later review
- Untiered `400` literals in M3 reviewer code — known pre-existing deviations

## Blockers for Future Phases

- **Phase 4 blocked on #328**: Distinct-act evidence form requires observable label-add event
- **Phase 5 depends on Phase 4**: Actor-check and brain-writes-reviewed evidence tiers must ship first
- **GitHub API limitation for regulated tier**: Rung 3 (auto-correct) is GitHub-only; regulated tier unsupported on GitLab

## SDD Cycle Summary

| Phase | Status | Commit(s) |
|-------|--------|-----------|
| Proposal | Complete | (pre-archive) |
| Spec | Complete | (main specs updated) |
| Design | Complete | (archived) |
| Tasks | Complete (Phases 1-3) | `0b6cb78` |
| Apply | Complete (Phases 1-3) | `db674bb`, `90156e9`, `6169909`, `ac1d058` |
| Verify | PASS | (verify-report.md) |
| Archive | Complete | (this report, 2026-08-01) |

The change has completed phases 1-3 of the 6-phase implementation plan. Phases 4-6 are tracked as separate work items pending resolution of #328 and completion of evidence tiering.
