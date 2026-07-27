# Design — `brain:metrics` (issue #324, M9)

## Technical Approach

Metrics re-derives verdicts by running the SAME code brain-audit runs, over the same
first-parent merge walk. To make that literal rather than aspirational, the walk is cut
into two shared layers and one private one:

| Layer | Home | Shared with metrics |
|---|---|---|
| **Evidence** — enumerate merges, window anchors (`windowFrom`/`auditedTip`), per-merge parents/numstat/changed-files/body, one `prView` for labels+body | `lib/merge-walk.mjs` (new) | Yes |
| **Verdict** — run the 4 checks, `shouldSkipSize`, `resolvedSkipLine`, reverter exemption (`addedPathsAbsentAt` + `netAddFull`) | `lib/merge-walk.mjs` (new) | Yes |
| **Emission** — `[PASS]/[FAIL]/[SKIP]` lines, `[FAIL-SHA]` dedup + `payloadSignature`, `crossCheckExit` | stays in `brain-audit.mjs` | No |

`[FAIL-SHA]` is an auto-revert *nomination*, not a measurement — metrics never computes it.

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale / trade-off |
|---|---|---|---|---|
| D1 | Extraction site | Shared `lib/merge-walk.mjs` (evidence + verdict) | Inline duplication in metrics; leave in brain-audit | Duplication guarantees the drift the proposal exists to prevent: measurement would stop matching enforcement. Cost: touching safety-critical code. |
| D2 | Failure policy | Shared layer stays **fail-closed** (throws); the *caller* sets policy. Audit → exit 2. Metrics → catch per merge, count in an `uncomputable` column, exit 0 | Metrics inherits exit 2 | A report that dies on one bad merge reports nothing; a report that hides one is a lie. Third option: count it visibly. |
| D3 | `memoryPresence` | Excluded from per-merge gate rows; printed once as a repo-level line | A per-period column | It is repo-global at HEAD — identical for every merge. A column would be a constant masquerading as a series. |
| D4 | Lead time | Issue's **last** `approvedLabel` add at-or-before merge → merge `%cI` | First add | Re-approval after changes is the approval that actually held at merge. Label read from `config.governance.approvedLabel` (default `status:approved`), never hardcoded. |
| D5 | Enforced column | `enforced = raw − size:exception − net-parity skips` **only** | Also subtract `skip:memory-gate` | `skip:memory-gate` is documented (AGENTS.md, workflow-governance.md) but **implemented nowhere** — no `.mjs`, not in `governance.yml`. Subtracting it would invent an exemption. It is reported as label *usage*, with a "documented, not enforced" note. |
| D6 | DETECTION_JOBS | Single column from `prStatusRollup`, header-flagged "current state, not historical" | Raw/enforced split | Never blocking → no exception concept. |
| D7 | Range arg | Positional `[<git-range>]`, mirroring `brain:audit` | `--range=` flag | Sibling-verb consistency; `git log` already accepts `HEAD~30..HEAD`. |
| D8 | Bucketing | New pure `lib/period-bucket.mjs`; `--period=month\|week`, default `month` | Hardcoded month | Monthly is signal at brain's merge rate; weekly exists for bursts. |

## Data Flow

    argv ──→ resolveRange ─┐
    brain.config.json ─────┼──→ collectMergeEvidence ──→ [{sha, at, prNum, numstat, files, body, labels}]
    .memory/records ───────┘              │
                                          ├──→ evaluateMerge ──→ {skip?, results, exempt}
                                          ├──→ labelEvents(issue) ──→ leadTimeCache (Map, 1 call/issue)
                                          └──→ prStatusRollup(pr) ──→ detection conclusions
                                                      │
                             bucketOf(at, period) ──→ rows[] ──→ renderMarkdown | JSON.stringify

`leadTimeCache` is keyed by issue number (many merges → one issue → one API call).

## File Changes

| File | Action | Description |
|---|---|---|
| `brain/scripts/lib/merge-walk.mjs` | Create | Evidence + verdict, extracted verbatim |
| `brain/scripts/lib/period-bucket.mjs` | Create | Pure `bucketOf(iso, period)` → `YYYY-MM` / `YYYY-Www` |
| `brain/scripts/brain-metrics.mjs` | Create | CLI, aggregation, both renderers |
| `brain/scripts/brain-audit.mjs` | Modify | Consumes the walk; emission/exit untouched |
| `brain/scripts/brain-audit.test.mjs` | Modify | **Re-point source-scan drift guards** (lines ~501, ~696, ~859, ~925) at `merge-walk.mjs` |
| `package.json` | Modify | `"brain:metrics": "node ./brain/scripts/brain-metrics.mjs"` |
| `brain/scripts/brain-metrics.test.mjs` | Create | Aggregation, bucketing, renderers, lead-time selection |
| `brain/core/methodology/workflow-governance.md` | Modify | Document the verb + caveats |

**Safety note (blocking for apply):** four drift guards in `brain-audit.test.mjs` `readFileSync` **`./brain-audit.mjs`** by path. Move the code without moving the guards and they pass vacuously — a deleted guard that still reports green. Re-pointing them is part of the extraction commit, not a follow-up.

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit | `bucketOf`, lead-time selection, raw/enforced split, renderers | Pure fns, injected fixtures |
| Contract | Audit output + exit codes byte-identical pre/post extraction | Existing `brain-audit.test.mjs` green, unmodified except guard paths |
| Integration | Full history run + one consumer repo | Manual, per success criteria |

## Migration / Rollout

No migration. Read-only verb, no state.

## Open Questions

- [ ] Default window when no range given: `origin/main..HEAD` (audit parity) or all history? Audit's default yields ~nothing on a fresh clone.
- [ ] Memory-record coverage denominator: all records, or only records since the window start?
- [ ] Should `--json` include per-merge rows, or only bucket aggregates?
