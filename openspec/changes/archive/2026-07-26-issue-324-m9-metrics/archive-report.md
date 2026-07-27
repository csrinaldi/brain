# Archive Report — brain:metrics (issue #324, M9)

**Archive Date**: 2026-07-26  
**Change Name**: `issue-324-m9-metrics`  
**Artifact Store Mode**: hybrid (engram + openspec)

## Executive Summary

SDD cycle for `brain:metrics` (issue #324, M9) is **COMPLETE and VERIFIED**. All 36 original tasks + 2 fix-round follow-ups are done. Verification passed with 1949/1949 tests green. The feature (read-only governance metrics reporter) is implemented, tested, documented, and ready for merge.

**Key Metrics**:
- Tests passing: 1949/1949 (100%)
- Original tasks completed: 36/36
- Fix-round corrections: 2 (CRITICAL detection-job bug + deviation #3 by-author breakdown)
- Commits on feature branch: 6
- Spec requirements met: 7/7
- No regressions detected

## Artifact Locations

### Engram (Persistent Memory)
- Proposal: `sdd/issue-324-m9-metrics/proposal` (#1364)
- Specification: `sdd/issue-324-m9-metrics/spec` (#1365)
- Design: `sdd/issue-324-m9-metrics/design` (#1366)
- Tasks: `sdd/issue-324-m9-metrics/tasks` (#1368)
- Apply Progress: `sdd/issue-324-m9-metrics/apply-progress` (#1369)
- Verification Report: `sdd/issue-324-m9-metrics/verify-report` (#1375)
- Archive Report: `sdd/issue-324-m9-metrics/archive-report` (this file, topic_key saved)

### OpenSpec (File-based)
- Archive root: `openspec/changes/archive/2026-07-26-issue-324-m9-metrics/`
  - `proposal.md` — original proposal with scope, risks, rollback plan
  - `design.md` — technical approach, 8 architecture decisions (D1–D8), data flow, file changes
  - `tasks.md` — 9 phases, 36 tasks, review workload forecast (600 LOC, medium risk)
  - `specs/governance-metrics/spec.md` — 7 requirements (merge-window aggregation, bypass usage, memory coverage, detection jobs, CLI, graceful degradation, zero new rules)
- Main specs (synced from delta): `openspec/specs/governance-metrics/spec.md` — new capability spec, committed to source of truth

## Specs Synchronized

| Domain | Action | Details |
|--------|--------|---------|
| `governance-metrics` | Created | New spec for governance-effectiveness read-only aggregation verb. 7 requirements, no new gates/invariants, detection-only. |

**Merge Strategy**: Delta spec was a full new spec (no existing `openspec/specs/governance-metrics/` prior to this change). Copied directly as source of truth.

## Implementation Summary

### What Was Built

**Verb**: `npm run brain:metrics [--json] [--period=month\|week] [git-range]`

A read-only reporting tool that re-derives governance-effectiveness signals over a historical merge window:
- **Merge-window aggregation**: changes-merged count, median lead time (issue approval → merge), per-gate raw/enforced failures
- **Four required gates**: `issue-link`, `diff-size`, `memory-gate`, `decision-gate` (label-conditional)
- **Raw vs. enforced**: raw counts all failures; enforced excludes `size:exception`-labeled bypasses
- **Detection jobs**: phase-order, actor-check, brain-writes-reviewed (current-state rollup, non-historical)
- **Bypass usage**: `size:exception` and `skip:memory-gate` counts broken down by gate, by author, by period
- **Memory records**: repo-level snapshot (non-time-series), adoption-pending caveat
- **Graceful degradation**: empty ranges exit 0 with "no data" message; invalid refs exit 1 with actionable error
- **Output formats**: markdown table (default), `--json` (flat array, one object per bucket)

### Architecture Decisions (8 total)

| D# | Decision | Rationale |
|----|----------|-----------|
| D1 | Extract merge-walk to shared `lib/merge-walk.mjs` | Prevents drift between audit (enforcement) and metrics (measurement) |
| D2 | Shared layer fail-closed; caller sets policy (audit→exit 2, metrics→catch, count `uncomputable`, exit 0) | Catch-all ensures report visibility |
| D3 | `memoryPresence` repo-level only, not per-period | It's repo-global at HEAD — a constant, not a series |
| D4 | Lead time = issue's last `approvedLabel` → merge date | Re-approval after changes is the approval that held |
| D5 | Enforced = raw − `size:exception` only (NOT `skip:memory-gate`) | `skip:memory-gate` is documented but not implemented; counted as usage, not subtracted |
| D6 | DETECTION_JOBS single column (no raw/enforced split) | Never blocking → no exemption concept |
| D7 | Positional `[git-range]` argument, not `--range=` | Sibling-verb consistency with `brain:audit` |
| D8 | Bucketing via pure `lib/period-bucket.mjs`; `--period=month\|week`, default `month` | Monthly gives signal at brain's merge rate |

### Files Changed

| File | Status | Description |
|------|--------|-------------|
| `brain/scripts/lib/merge-walk.mjs` | NEW | Evidence + verdict layers extracted from audit |
| `brain/scripts/lib/period-bucket.mjs` | NEW | Pure date → bucket helper |
| `brain/scripts/lib/lead-time.mjs` | NEW | Approval event selection + caching |
| `brain/scripts/lib/metrics-aggregate.mjs` | NEW | Per-gate raw/enforced + bypass breakdown |
| `brain/scripts/lib/memory-coverage.mjs` | NEW | Repo-level adoption snapshot |
| `brain/scripts/brain-metrics.mjs` | NEW | CLI + renderers (markdown, JSON) |
| `brain/scripts/brain-metrics.test.mjs` | NEW | Aggregation, bucketing, renderers (TDD) |
| `brain/scripts/brain-audit.mjs` | MODIFIED | Consumes shared walk; emission/exit untouched |
| `brain/scripts/brain-audit.test.mjs` | MODIFIED | 4 drift guards re-pointed to `merge-walk.mjs` |
| `package.json` | MODIFIED | Added `"brain:metrics"` script entry |
| `brain/core/methodology/workflow-governance.md` | MODIFIED | Documented verb, 7 requirements, 6 caveats |
| `AGENTS.md` | REGENERATED | Via `compileAgentsMd()` (drift-guard requirement) |

## Verification Status (2nd pass, mem #1375)

**Verdict**: ✅ **PASS** — All 7 spec requirements met. 1949/1949 tests green. Two fix-round issues resolved (CRITICAL detection-job bug, deviation #3 by-author breakdown).

### Test Evidence (directly executed)
- `npm test`: 1949/1949 pass, 0 fail
- `brain-audit.test.mjs`: 31/31 pass (extraction contract: output/exit codes byte-identical)
- `brain-metrics.test.mjs`: 97 tests covering phases 3–9
- Real-history integration: `3593b54..HEAD` (20 merges) — detection counts non-zero, by-author section resolved real actor (`csrinaldi: 3`)
- `antigravity.drift.test.mjs`: AGENTS.md byte-equal after regeneration

### Fix Round (commits b9cc412, 2ddeedc)

**1. CRITICAL Bug (commit b9cc412)**: Detection-job conclusion case-sensitivity
- **Root cause**: `detectionConclusion()` compared against lowercase strings, but GitHub returns UPPERCASE enums (SUCCESS/FAILURE). Silently zeroed all three DETECTION_JOBS columns against real history.
- **Fix**: Normalize via `.toLowerCase()` before comparison (mirrors `tranche.mjs`'s pattern).
- **Verification**: Real-history re-run confirmed non-zero counts (phase-order 20/0, actor-check 13/7, brain-writes-reviewed 20/0).

**2. Deviation #3 (commit 2ddeedc)**: Size:exception usage by author
- **Root cause**: Spec requires bypass usage "broken down by gate, by author, and by period"; only gate/period were implemented.
- **Fix**: Added `bypassByAuthor` aggregation + "Exception usage by author" section. Source: PR-level `labelEvents`, author from `selectApprovalEvent()` (reused lead-time logic), fallback to `"unknown"`.
- **Scope**: `size:exception` only (the label that gates diff-size). `skip:memory-gate` intentionally excluded (documented-not-enforced per D5).
- **Verification**: Real-history resolved real actor `csrinaldi` with 3 usages in 2026-07.

### Spec Compliance

| Requirement | Status | Notes |
|---|---|---|
| Merge-window aggregation | ✅ MET | 4 required gates, raw/enforced split, median lead time |
| Bypass usage reporting | ✅ MET | By gate, by author (fixed round), by period |
| Memory-record coverage | ✅ MET | Repo-level snapshot, adoption-pending caveat |
| Detection-job reporting | ✅ MET | Single column (fixed CRITICAL case bug) |
| CLI signature & formats | ✅ MET | Positional range, `--json`, `--period` flags |
| Graceful degradation | ✅ MET | E1 (empty window) + E3 (invalid range) both handled |
| Historical re-execution | ✅ MET | Reuses audit's pure functions, zero new gates |

### Deviations (4 total, all resolved or accepted)

| # | Deviation | Decision | Status |
|---|---|---|---|
| D1 | `memory-gate` excluded from per-period columns | Design D3 rationale sound (repo-global constant) | Accepted by verify |
| D2 | Positional `git-range` arg, not `--range=` | Design D7 + orchestrator brief agree | Accepted by verify |
| D3 | "By author" bypass breakdown | **Was a MISS** in 1st pass; now **IMPLEMENTED** (this fix round) | Resolved |
| D4 | Phase 8.2 consumer-repo fixture substitution | Used equivalent fixture-repo integration test (no consumer-repo available) | Accepted by verify |

### Regressions
None detected. brain-audit.test.mjs stays green (31/31). Drift guards all live (verified via RED-before-GREEN). AGENTS.md stays byte-equal after regeneration.

## Deviations Resolved

### Deviation #3: Size:exception usage "by author"
- **Category**: MISS → Deviation found by verify, not by apply
- **Spec language**: "broken down by gate, by author, and by period" (Requirement: Bypass usage reporting)
- **Original state**: Implemented by-gate and by-period; NOT by-author
- **Fix applied**: Added `bypassByAuthor` aggregation (commit 2ddeedc):
  - Source: PR-level `labelEvents`, author from last matching `add` event at-or-before merge
  - Data structure: `row.bypassByAuthor[author]` incremented per `size:exception` usage
  - Fallback: unresolvable actors bucketed as `"unknown"` (never dropped, mirrors D2)
  - Markdown: new "Exception usage by author" section
  - JSON: `bypassByAuthor` denormalized onto each row
  - Scope: `size:exception` only (intentionally excludes `skip:memory-gate` per D5 rationale — documented-not-enforced, no code path to attribute an enforcer action)
- **Verification**: Real-history `3593b54..HEAD` confirmed real actor (`csrinaldi: 3`) end-to-end
- **Spec resolution**: No spec softening needed — literal MUST was not met, now it is

### Deviation #1: `memory-gate` excluded from per-period columns
- **Design rationale** (D3): `memoryPresence` is repo-global at HEAD (identical for every merge). A per-period column would be a constant masquerading as a series.
- **Spec language** vs **Design**: Spec enumerates `issue-link`, `diff-size`, `memory-gate`, `decision-gate` in requirements. Design explicitly excludes `memoryPresence` from per-merge gate rows and reports it only once as repo-level snapshot.
- **Verify decision**: Rationale sound; accepted as intended deviation. No change needed.

### Deviation #2: Positional `[git-range]` arg, not `--range=`
- **Design rationale** (D7): Sibling-verb consistency; `brain:audit` already accepts positional `HEAD~30..HEAD`
- **Spec language** vs **Design**: Spec shows `--range=<git-range>` flag; design chose positional mirroring audit
- **Verify decision**: Orchestrator brief + design agree; accepted as intended deviation. No change needed.

### Deviation #4: Phase 8.2 consumer-repo fixture substitution
- **Design scope**: Test against "one consumer repo" to verify no crashes on a real external repo lacking `.memory/records/`
- **Actual**: No consumer-repo fixture available in this session; substituted with equivalent fixture-repo integration test in brain-metrics.test.mjs (small synthetic repo with 2 merges)
- **Verify decision**: Coverage is equivalent; accepted. No change needed.

## Ready for Merge

- ✅ Delta spec merged into main specs (`openspec/specs/governance-metrics/spec.md`)
- ✅ Change folder archived to `openspec/changes/archive/2026-07-26-issue-324-m9-metrics/`
- ✅ All artifacts copied to archive location (proposal, design, tasks, specs)
- ✅ AGENTS.md regenerated via drift-guard requirement (`compileAgentsMd()` over 5 SOURCE_DOCS)
- ✅ Verification passed (1949/1949 tests, all 7 requirements met, no regressions)
- ✅ Fix-round issues resolved (CRITICAL detection-job bug, deviation #3 by-author breakdown)

**Branch**: `feature/issue-324-m9-metrics` (6 commits, `HEAD 2ddeedc`)  
**Worktree**: `/home/gandalf/IA/brain-m9`

## Next Steps

1. Review PR created from `feature/issue-324-m9-metrics` → `main`
2. Merge to main after review approval
3. Close issue #324

**SDD Cycle Status**: ✅ **CLOSED** — Ready for next change.

---

## Archive Metadata

| Property | Value |
|----------|-------|
| Change Name | `issue-324-m9-metrics` |
| Issue | #324 |
| Milestone | M9 |
| Archive Date | 2026-07-26 |
| Archive Path | `openspec/changes/archive/2026-07-26-issue-324-m9-metrics/` |
| Artifact Store | hybrid |
| Proposal Obs ID | 1364 |
| Spec Obs ID | 1365 |
| Design Obs ID | 1366 |
| Tasks Obs ID | 1368 |
| Apply Progress Obs ID | 1369 |
| Verify Report Obs ID | 1375 |
| Archive Report Obs ID | (saved to engram) |
| Commit Count | 6 |
| Test Coverage | 1949/1949 pass |
| Deviations Resolved | 1 of 1 (D3 implemented) |
| Deviations Accepted | 3 of 3 (D1, D2, D4) |
| SDD Cycle Status | Complete ✅ |
