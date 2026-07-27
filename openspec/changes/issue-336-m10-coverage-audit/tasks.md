# Tasks: M10 Phase 1 — VCS Contract Coverage Audit (issue #336)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~200 (audit.md only) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | `audit.md` complete (table + ranking + fixture debt) | PR 1 | Single read-only doc, no code/tests touched |

## Phase 1: Evidence Gathering

- [x] 1.1 Grep `providers/vcs.contract.test.mjs` for every `describe('verb:...')` block; note fixture-backed vs inline-mock sections (per design D1 line refs: 120/144/154/171/223/240/266/285/364/426/508).
- [x] 1.2 Grep `scripts/vcs/providers.test.mjs` for verbs covered only via inline mocks (partial-coverage source).
- [x] 1.3 Diff the two suites' verb sets against `vcs-contract.md` Required Verbs (21) plus 3 non-contract extras (`capabilities`, `checkRuns`, `projectMergeSettings`); confirm count matches `verb-contract-drift-guard.test.mjs`.
- [x] 1.4 Grep the codebase for each verb's call sites (scripts, gates, dashboards); record as consumers.
- [x] 1.5 Rank blast radius per verb using D3's rule: REQUIRED-gate consumer > mutating write > provider-divergent normalization > call-site fan-out.
- [x] 1.6 Read every `fixtures/*.json` `_provenance` flag (recorded/derived); cross-reference against 1.1/1.2 results.

## Phase 2: Audit Assembly

- [x] 2.1 Populate the 21-verb main table (verb, contract-parity, provenance, consumers/blast radius, Phase-2 priority) plus the 3-verb extras table, per design's example shape.
- [x] 2.2 Write the Phase-2 gap ranking: top 6 candidates ordered by D3's rule, `prReviews` first, with one-line rationale each citing driver (C1–C4).
- [x] 2.3 Write narrative sections: methodology, fixture debt (name all `gitlab-*.json` as derived/unvalidated), staleness caveat.
- [x] 2.4 Add header with current commit SHA and date for measurement-basis pinning.

## Phase 3: Verification

- [x] 3.1 Confirm main table row count equals drift guard's Required Verbs count (21). VERIFIED: 21 main-table rows + 3 extras = 24 total.
- [x] 3.2 Spot-check provenance column: 3 recorded, 3 derived, 3 inline, 3 none rows against actual fixture/test files. VERIFIED.
- [x] 3.3 Confirm every used verb's consumers column lists ≥1 real call site (not "none" unless truly zero-coverage). VERIFIED (only `projectResolve` has zero script consumers, documented as identity/extension-point).
- [x] 3.4 Confirm diff touches only `openspec/changes/issue-336-m10-coverage-audit/audit.md` (no code/spec/provider changes). VERIFIED via `git status`.

## Status: COMPLETE — all 14 tasks done. Deliverable: `openspec/changes/issue-336-m10-coverage-audit/audit.md` (188 lines).

## Rules Applied

- Read-only change; strict TDD not applicable (no runtime surface, no tests to red/green).
- Each audit row must be traceable to grep output / test code / fixture file (cite file:line where practical).
- No fixture remediation, no drift-guard changes, no new test infra — out of scope per proposal.
