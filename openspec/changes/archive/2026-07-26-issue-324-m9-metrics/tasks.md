# Tasks: brain:metrics (issue #324, M9)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~600 (extraction ~250, metrics ~350) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Extraction + guard re-point + metrics + docs | PR 1 (single) | All design decisions locked; extraction is safety-critical so review it first within the PR |

## Phase 1: Extraction (Foundation)

- [ ] 1.1 Create `brain/scripts/lib/merge-walk.mjs`: move evidence layer (enumerate merges, `windowFrom`/`auditedTip`, per-merge parents/numstat/changed-files/body, `prView`) verbatim from `brain-audit.mjs`.
- [ ] 1.2 Add verdict layer to `lib/merge-walk.mjs`: 4 checks, `shouldSkipSize`, `resolvedSkipLine`, reverter exemption (`addedPathsAbsentAt` + `netAddFull`). Shared layer stays fail-closed (throws) per D2.
- [ ] 1.3 Modify `brain-audit.mjs` to import and consume `lib/merge-walk.mjs`; keep emission (`[PASS]/[FAIL]/[SKIP]`, `[FAIL-SHA]` dedup, `payloadSignature`, `crossCheckExit`) local, unchanged.
- [ ] 1.4 RED→GREEN: run existing `brain-audit.test.mjs` unmodified against the refactor; confirm output/exit codes are byte-identical (contract test from design's Testing Strategy).

## Phase 2: Safety Guard Re-point (BLOCKING, before any metrics code lands)

- [ ] 2.1 Update the 4 literal-path drift guards in `brain-audit.test.mjs` (~L501, ~L696, ~L859, ~L925) to `readFileSync` `lib/merge-walk.mjs` instead of `brain-audit.mjs`, matching which layer (evidence vs verdict) each guard actually inspects.
- [ ] 2.2 Verify each re-pointed guard still fails when its guarded condition is reintroduced (temporarily break each guarded invariant locally, confirm RED, revert) — proves the guard isn't vacuously green post-move.

## Phase 3: Metrics Aggregator Core

- [ ] 3.1 Create `brain/scripts/lib/period-bucket.mjs`: pure `bucketOf(iso, period)` → `YYYY-MM` / `YYYY-Www`.
- [ ] 3.2 RED: write `brain-metrics.test.mjs` cases for `bucketOf` (month/week boundaries).
- [ ] 3.3 GREEN: implement `bucketOf`.
- [ ] 3.4 RED: write tests for lead-time selection — last `approvedLabel` add at-or-before merge → merge `%cI`; label from `config.governance.approvedLabel` (default `status:approved`); "N/A" fallback when no matching label event exists.
- [ ] 3.5 GREEN: implement `leadTimeCache` (Map keyed by issue number) and lead-time selection in `brain-metrics.mjs`.
- [ ] 3.6 RED: write tests for raw/enforced split — `enforced = raw − size:exception − net-parity skips` only; `skip:memory-gate` counted as label usage but never subtracted (D5).
- [ ] 3.7 GREEN: implement per-gate raw/enforced aggregation for `issue-link`, `diff-size`, `memory-gate`, `decision-gate` (label-conditional: only PRs labeled `decision`).
- [ ] 3.8 RED/GREEN: implement per-merge fail-closed catch — metrics catches evaluation errors per merge, tallies an `uncomputable` column, never throws to exit 2 (D2).

## Phase 4: CLI Integration

- [ ] 4.1 Create `brain/scripts/brain-metrics.mjs`: positional `[<git-range>]` arg (D7), `--json`, `--period=month|week` (default `month`).
- [ ] 4.2 RED: write tests for markdown table renderer (default output) and JSON renderer (flat array, one object per period bucket, superset of table data — scenario H2).
- [ ] 4.3 GREEN: implement both renderers.
- [ ] 4.4 Add `"brain:metrics": "node ./brain/scripts/brain-metrics.mjs"` to `package.json`.
- [ ] 4.5 Manual check: `npm run brain:metrics`, `npm run brain:metrics -- HEAD~30..HEAD --json`, `npm run brain:metrics -- --period=week` all produce expected shapes.

## Phase 5: Memory Records Coverage

- [ ] 5.1 RED: write tests for repo-level memory coverage — total records, records with `issue` populated, coverage % as single snapshot (not time series), "adoption pending" label present (scenario H3-adjacent requirement).
- [ ] 5.2 RED: write test for E2 — missing/unreadable `.memory/records/` reports 0% coverage with both unavailability and adoption-pending caveats stated, report still completes.
- [ ] 5.3 GREEN: implement coverage computation and its single repo-level output line, printed once (not per period bucket, per D3/memoryPresence precedent).

## Phase 6: Bypass Usage + Detection Jobs Reporting

- [ ] 6.1 RED: write tests for bypass usage breakdown — `size:exception` and `skip:memory-gate` counts by gate, by author, by period (scenario H3: 4 weekly buckets show a rising trend).
- [ ] 6.2 GREEN: implement bypass usage aggregation.
- [ ] 6.3 RED: write tests for DETECTION_JOBS (`phase-order`, `actor-check`, `brain-writes-reviewed`) — single pass/fail count column per job, no raw/enforced split, header-flagged "current state, not historical" (D6).
- [ ] 6.4 GREEN: implement detection-job reporting from `prStatusRollup`.

## Phase 7: Edge Cases & Graceful Degradation

- [ ] 7.1 RED: write test for E1 — zero merges in range prints "no data for this range" message, exits 0.
- [ ] 7.2 RED: write test for E3 — invalid `--range`/positional ref prints actionable error naming the invalid range, suggests `brain:audit`-style range syntax, exits non-zero.
- [ ] 7.3 GREEN: implement both guards in `brain-metrics.mjs` argv/range resolution.
- [ ] 7.4 Regression test: confirm skip/exception resolution in metrics matches `brain-audit`'s skip resolution exactly (same `resolvedSkipLine`/`shouldSkipSize` calls via shared lib — no divergent copy).

## Phase 8: Integration Verification

- [ ] 8.1 Run `npm run brain:metrics` over brain's own history (2026-06-01 to 2026-07-26) with default period; manually verify counts/lead-time/bypass numbers are defensible against known merges.
- [ ] 8.2 Run against one sample consumer repo (per design's Testing Strategy); confirm no crashes, sane output shape, `memoryPresence` caveats behave correctly when that repo lacks `.memory/records/`.
- [ ] 8.3 Re-run scenario H1 (monthly report, one row per month, all 4 required gates present) and scenario "Re-execution matches brain-audit's own verdict" (a historical merge brain-audit marked failing `issue-link` reproduces the same failure) as explicit acceptance checks.

## Phase 9: Documentation

- [ ] 9.1 Update `brain/core/methodology/workflow-governance.md` (per design's File Changes table) to document the `brain:metrics` verb, its four required-gate columns, and detection-job reporting.
- [ ] 9.2 Document caveats explicitly: lead-time is an issue-approval proxy (not PR-review time); `memoryPresence`/coverage is repo-global, not per-period; `skip:memory-gate` is reported as label usage but is documented-not-enforced (D5) and never subtracted from `enforced`.
- [ ] 9.3 Note in docs that metrics introduces zero new gates/invariants and persists nothing between runs (point-in-time only).

## Rollback

Read-only verb, no state, no schema migration. Revert is a plain file/script revert; no data cleanup needed.
