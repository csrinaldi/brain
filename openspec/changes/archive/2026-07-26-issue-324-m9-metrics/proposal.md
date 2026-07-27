---
status: draft
issue: 324
sequence: 313
milestone: M9
artifact_store: hybrid
---

# Proposal — `brain:metrics`, measure governance effectiveness (issue #324)

## Intent

The governance system (4 required gates, ADRs, memory records) is *asserted* to work; nothing
measures it. M9 closes that gap: a read-only verb that turns brain's own git history into
defensible numbers — lead time, which gates actually fire, how often they are bypassed.
Without it, "governance works" is a claim, and erosion (a rising `size:exception` rate) stays
invisible until it is already the norm.

## Scope

### In Scope
- `brain/scripts/brain-metrics.mjs` + `npm run brain:metrics`; markdown table by default,
  `--json` flag, optional `[<git-range>]` arg mirroring `brain:audit`.
- **Lead time**: issue `status:approved` label-add `at` (`labelEvents`) → merge-commit date.
  Median + p90 per bucket.
- **Gate failures by gate**: re-execute the pure checks (`diffSize`, `issueLink`,
  `adrPresence`, `memoryPresence`) per historical merge; DETECTION_JOBS (phase-order,
  actor-check, brain-writes-reviewed) read from `prStatusRollup` on the merge commit.
- **Two columns per gate**: raw failures (all) vs. enforced failures (excluding
  `size:exception` / `skip:memory-gate` / audit exemptions). Raw shows erosion, enforced
  shows effectiveness.
- **Bypass usage**: `size:exception` and `skip:memory-gate` counts over the window.
- **Memory-record adoption**: total records, records with `issue` populated, coverage %,
  explicitly labelled "adoption pending".
- Extract brain-audit's merge walk into a shared lib so audit and metrics share one traversal.
- Plain-English stdout, no i18n routing (matches `brain-audit` / `brain-governance-status`).

### Out of Scope
- Any new gate, invariant, threshold, or CI failure condition. Detection-only.
- New port verbs; timestamped `prReviews` / `prStatusRollup` (blocked — see Risks).
- Backfilling the `issue` field on existing `.memory/records/*.jsonl`.
- Dashboards, trend storage, cross-repo aggregation.

## Capabilities

### New Capabilities
- `governance-metrics`: read-only aggregation of governance signals over a merge window.

### Modified Capabilities
- None. Zero new invariants — M9 measures the system that already exists.

## Approach

**Re-derive, don't query.** `prStatusRollup` / `commitStatus` report the *current*
post-merge state, so a gate that failed and was then fixed reads green — historical accuracy
requires re-running the same pure check functions brain-audit runs. Those functions already
*are* the merge blocker, so measurement and enforcement cannot diverge by construction.

brain-audit's merge walk currently lives inside its CLI IIFE, not behind an export, so it is
extracted to a shared lib consumed by both scripts; audit's output and exit codes must stay
byte-identical. Metrics then aggregates where audit prints per-line PASS/FAIL. One small new
pure helper does period bucketing (none exists today).

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `brain/scripts/brain-metrics.mjs` | New | Entrypoint, aggregation, markdown/JSON rendering |
| `brain/scripts/lib/merge-walk.mjs` | New | Merge traversal extracted from brain-audit's CLI IIFE |
| `brain/scripts/lib/period-bucket.mjs` | New | Pure date → bucket helper |
| `brain/scripts/brain-audit.mjs` | Modified | Consumes the extracted walk; behavior unchanged |
| `package.json` | Modified | `brain:metrics` script entry |
| `brain/core/methodology/workflow-governance.md` | Modified | Document the verb and its measurement caveats |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `memoryPresence` is repo-global, not per-merge — its "failure rate" is a constant, not a series | High | Report it as repo-level coverage, never as a per-merge gate column; state the caveat in output |
| Lead time measures *issue* approval, not PR-review approval (`prReviews` carries no timestamp) | High | Name the column explicitly; print the proxy definition in the report header |
| Extracting the walk regresses brain-audit's fail-closed exits / skip machinery | Med | Pure extraction, zero behavior change; existing `brain-audit.test.mjs` must stay green |
| Re-executing checks is O(merges × git calls) + one `prView` per merge | Med | Reuse audit's single-pass reads; accept precision over speed at M9's scale |
| `labelEvents` unavailable or rate-limited → missing lead times | Med | Report measurable coverage (N of M merges), never fabricate or silently drop |
| Numbers get read as a team scorecard | Low | Every table prints its denominator and exclusions |

## Rollback Plan

Delete `brain-metrics.mjs` and its npm script; revert the brain-audit extraction commit.
The verb is read-only — no state, no migration, no downstream consumer to unwind.

## Dependencies

None. All required vcs verbs (`prView`, `labelEvents`, `prStatusRollup`) exist on main.
Independent of #336 (M10 P1) and #317 (M10 P2). Sequence source: `docs/inbox/seam-contract-coverage-roadmap.md` (#313).

## Open Questions (for design)

- Bucketing granularity: weekly or monthly? Default window (all history vs. last N buckets)?
- Do DETECTION_JOBS get the same raw/enforced split, or a single column (they never block)?
- Is `brain:metrics` ever run in CI (as a reporting job), or human-invoked only?

## Success Criteria

- [ ] `npm run brain:metrics` completes on brain's full history and on one consumer repo.
- [ ] Every gate row shows raw and enforced counts, and they differ where exception labels exist.
- [ ] A sampled lead-time value is reproducible by hand from `labelEvents` + `git log`.
- [ ] `--json` output is a superset of the markdown table.
- [ ] Memory-record coverage is reported with the "adoption pending" caveat.
- [ ] brain-audit's output and exit codes are unchanged after the walk extraction.
