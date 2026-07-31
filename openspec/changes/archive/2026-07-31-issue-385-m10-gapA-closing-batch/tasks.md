---
status: archived
issue: 385
epic: 335
artifact_store: hybrid
topic_key: sdd/issue-385-m10-phase2-rank6-batch/tasks
---

# Tasks — whoami / commitStatus / repoCloneUrl / patSetupUrl / projectResolve Contract-Parity Coverage (M10 Phase 2, final Gap-A batch, Issue #385)

STRICT TDD MODE ACTIVE. Delivery decision: SINGLE PR, work-unit commits. Naming: "issue #385, M10 Phase 2 — final Gap-A batch" (NOT rank-6). Test-only, additive. Zero production files modified.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~360 (design.md Size forecast: ~240 test file + ~110 fixtures + ~10 doc) |
| 400-line budget risk | Medium — inside budget but not comfortably |
| Chained PRs recommended | No |
| Delivery strategy | single-pr |
| All 40 tasks | [x] COMPLETE |

## Phase Completion

- [x] **Phase 1 (6 tasks):** Fixture Evidence — 10 fixtures created, provenance-checked
- [x] **Phase 2 (3 tasks):** PROVIDERS registration — whoami/commitStatus glue
- [x] **Phase 3 (9 tasks):** Per-verb contract tests (whoami, commitStatus, projectResolve, repoCloneUrl, patSetupUrl)
- [x] **Phase 4 (7 tasks):** Divergence-lock tests (commitStatus two-field read, neutral/skipped collapse, selection asymmetry, host-default divergence, host-parameter divergence, URL-encoding defect)
- [x] **Phase 5 (7 tasks):** Documentation update (vcs-contract.md rows + enum section)
- [x] **Phase 6 (4 tasks):** Follow-up issue filings (#386, #387, #388)
- [x] **Phase 7 (4 tasks):** Full suite verification + PR opened

See Engram #1762 for complete task breakdown and detailed checkpoints.
