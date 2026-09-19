# Apply progress — issue-936-lane-branch-reconcile (absorbs #930)

Batch 1: Phases 1-3, tasks 1.1-3.4. Batch 2 (this run): Phases 4-6, tasks
4.1-6.4. **All 6 phases / all task-list items are now complete.**

Strict TDD Mode is active. Test runner: `node --test <files>` (full suite
`npm test`).

## Commits (work-unit, one per phase, all in `fix/issue-936-fixmemory-the-lane-sweep-must-revisit-un`)

| SHA | Subject |
|---|---|
| `6c92282c` | `feat(vcs): mrList reports merge state additively (#930) (#936)` |
| `a1631811` | `refactor(memory): extract contentDelivery() as a shared, fail-closed helper (#936)` |
| `2dc606ba` | `fix(memory): same-day append reparents onto origin/main when the tip is delivered (#936)` |
| `5951f635` | `fix(memory): reverse R8 — a closed-unmerged lane PR is reported, never reopened (#936)` |
| `3f0cf17a` | `feat(memory): the lane sweep reconciles every unreconciled memory/<host>-* ref (#936)` |
| `2dfe5e44` | `docs(sdd): issue-936 Tier 2 drafts and closing verification (#936)` |

No `Co-Authored-By` or AI-attribution trailer on any commit. `.memory/index.jsonl`
(hook-modified) was never staged or committed.

## Tasks completed

### Phase 1 — `mrList` reports merge state additively (#930)
- [x] 1.1 RED — widened `vcs.contract.test.mjs`'s happy-fixture shape assertion to `['headBranch','merged','number','state','title']`; added the "both providers report merged state" scenario.
- [x] 1.2 Updated `github-mrList-happy.json`/`gitlab-mrList-happy.json` with `state`/`merged_at` (github) and native `state` (gitlab); created `github-mrList-all.json`/`gitlab-mrList-all.json` (open, merged, closed items, `derived` provenance).
- [x] 1.3 GREEN — `github.mjs#mrList` maps `state: r.state`, `merged: r.merged_at !== undefined ? r.merged_at !== null : null` (D1).
- [x] 1.4 GREEN — `gitlab.mjs#mrList` maps `opened→open/false`, `closed→closed/false`, `merged→closed/true`, else `null/null` (D1), via a new `mapGitlabMrState()` helper.
- [x] 1.5 GREEN — optional `headBranch` filter (D2) on both providers: GitHub `...&head=<owner>:<branch>&per_page=100`, GitLab `...&source_branch=<enc>&per_page=100`; both THROW on a full (100-item) page when `headBranch` is set. Unfiltered calls are byte-identical to the pre-#930 query (verified by dedicated argv tests). Extended `providers.test.mjs` with argv assertions (`head=`/`source_branch=`) and full-page-throws cases for both providers.
- [x] 1.6 Updated `fake-vcs-port.mjs#mrList` to accept `{ headBranch }`, filter by it when present, and default `state`/`merged` to `null` when a script omits them.
- [x] 1.7 Updated the fake `mrList` sites — see **Deviation 1** below.
- [x] 1.8 Verify green: `node --test vcs.contract.test.mjs providers.test.mjs ship.test.mjs cli.ship.test.mjs` → 414/414 (was 400/400 baseline).

### Phase 2 — shared fail-closed delivery helper (extraction, no behavior change)
- [x] 2.1 Created `brain/scripts/memory/lane/delivery.mjs` exporting `contentDelivery({ git, root, rev, baseFetched })`, argv-identical to the pre-#936 `surveyDelivery`, imports nothing from `lane/` (D3).
- [x] 2.2 Created `delivery.test.mjs` (7 unit tests): delivered / pending / unknown (`baseStale`, `diffFailed`), plus an argv-identity test.
- [x] 2.3 `ship.mjs#surveyDelivery` is now a thin wrapper over `contentDelivery` (`delivered→true`, `pending→false`, `unknown→null`, same `reason`). No other line in `ship.mjs` changed in this phase.
- [x] 2.4 Verify green: `ship.test.mjs` (40) + `delivery.test.mjs` (7) = 47/47, every pre-existing `ship.test.mjs` assertion unedited and passing (`surveyOkRules` untouched).

### Phase 3 — same-day reparent onto `origin/main` (#1050)
- [x] 3.1 RED — added `#1050 repro` to `ship.integration.test.mjs` (ship X, squash-merge X into `origin/main` with plumbing + delete the remote branch ref, collect Y, ship again). Confirmed RED for the right reason: `secondParent` was the pre-squash commit, not `origin/main`'s tip (assertion diff showed the two different SHAs).
- [x] 3.2 Added two more cases to the same file: "a partially-delivered tip still appends on the existing tip" and "a stale/unfetchable base keeps appending on the existing tip" — both were confirmed to ALREADY PASS pre-fix (proving today's append behavior is preserved for `pending`/`unknown`) and stayed green post-fix.
- [x] 3.3 GREEN — `collect.mjs` step 8 now calls `contentDelivery({ git, root, rev: existingTip, baseFetched })` before deciding `plan.parent`. `status === 'delivered'` → `plan.parent = originMainTip`, `reparented = true`; otherwise `plan.parent = existingTip` (today's behavior), `reparented = false`. `collectLane`'s return gains `reparented: boolean` on every path (see **Deviation 2**).
- [x] 3.4 Verify green: `ship.test.mjs` + `delivery.test.mjs` + `ship.integration.test.mjs` + `collect.integration.test.mjs` + `cli.ship.test.mjs` = 95/95. `plan.mjs`'s `already-on-main` skip and `collected`'s tree-diff basis are untouched (no edits to `plan.mjs` in this phase).

### Phase 4 — R8 reversal: closed-unmerged is reported, never reopened
- [x] 4.1 RED — extended `ship.test.mjs`'s D4 matrix: open PR wins over a higher-numbered closed one; a foreign `headBranch` is filtered out before "newest" is picked; the highest-numbered match closed+unmerged ⇒ `closedUnmerged:true`, zero push/create/arm; closed+merged (or empty) ⇒ create; a null `state`/`merged` field ⇒ `prLookupFailed`; `mrList` throwing (and every other pre-existing throw test) now proven to happen BEFORE any push. All confirmed RED (10 failing assertions) against the pre-Phase-4 `ship.mjs`.
- [x] 4.2 GREEN — `ship.mjs`: extracted `decidePr()` (the D4 lookup+decision, `mrList({project, state:'all', headBranch: branch})`, run BEFORE the divergence-gated push) and `createPr()` (the pre-#936 `mrCreate`+rescan sequence, now only reached on `action:'create'`/`'reuse'`). Added `closedUnmerged: boolean` (default `false`) to every one of `shipLane`'s outcome return paths (dry-run, `tip===null`, `delivered:true`, the new `closedUnmerged` early-return, and both `reconciled:true` returns).
- [x] 4.3 Updated the code comment at the old push-then-lookup call site (and `decidePr()`'s own docstring) to state the R8 reversal, its rationale, and reference `#936`/`#920`.
- [x] 4.4 Added `memory.ship.closedUnmerged` (branch + PR number params) to `en.mjs`/`es.mjs`; wired `shipOutcomeKey()` in `cli.mjs` to return `"closedUnmerged"` when `result.closedUnmerged` is true, checked before `prNumberUnknown`/`nothing`; the ship op's outcome-key call site now also passes `branch`.
- [x] 4.5 Verify green: `ship.test.mjs` (44) + `cli.ship.test.mjs` (43, including a new end-to-end closed-unmerged CLI test) + `ship.integration.test.mjs` (9, including a rewritten M1 scenario — Deviation 3) = 96/96. Confirmed zero push/`mrCreate`/`mrAutoMerge` calls on every `closedUnmerged` row.

### Phase 5 — cross-day sweep + wiring + i18n
- [x] 5.1 Exported `slugifyHost` from `plan.mjs` (was private).
- [x] 5.2 Created `brain/scripts/memory/lane/sweep.mjs` exporting `sweepLanes({ root, project, tier, host, today, git, vcs, ship = shipLane })` — fetches `origin main` once, lists local (`for-each-ref`) and remote (`ls-remote --heads`, degrading to `remoteListed:false`) `memory/*` refs, filters by an exact `slugifyHost(host)` match (no suffix tolerance, `SWEEP_BRANCH_RE`) and excludes today, walks ascending by date, classifies each via `contentDelivery` and dispatches: `delivered`→CAS `update-ref -d`, `pending`→`ship({..., collect: noCollect(ref, baseFetched)})` (mapped to `shipped`/`reconciled`/`closedUnmerged`/`diverged`/`unknown`(`prLookupFailed`)/`failed`), `unknown`→kept+reported, remote-only→fetched into `refs/remotes/origin/<b>` and reported as `remoteOnly` (D7, nothing mutated). Every git call passes `{ cwd: root }`.
- [x] 5.3 `noCollect(ref, baseFetched)` returns the exact shape design specifies; `collectLane` is never called during a sweep re-ship (proven both by a direct unit assertion and by the integration suite's "never absorbs today's records" test).
- [x] 5.4 Created `sweep.test.mjs` (14 unit tests, git-spy only): host-slug collision rejected, suffixed name ignored, today skipped, another host ignored, ascending date order, every one of the 8 row actions mapped correctly, `where:'both'` produces exactly one row, and every git call asserted `cwd === root`. Confirmed RED first by temporarily removing `sweep.mjs` (`ERR_MODULE_NOT_FOUND`-shaped failure).
- [x] 5.5 Created `sweep.integration.test.mjs` (8 tests) on real `testTmp()` bare origins: delivered→deleted, pending/no-PR→shipped, pending/open-PR→reconciled, pending/closed-unmerged→closedUnmerged (proven stable across a 3rd run too), unknown (one real git call faked, `baseStale`), remote-only→`remoteOnly` (nothing local created, remote sha unchanged), a diverged remote→`diverged` (remote sha unchanged, no force), and "a re-shipped prior-day ref never absorbs today's newly collected records" (asserted via the pushed branch's own `ls-tree`).
- [x] 5.6 Wired `sweepLanes` into `cli.mjs`'s `ship` op: called only after `shipLane` succeeds and only when `!dryRun` (D6), reusing the same bound `vcs`/`memoryRoot`; added `sweep: null | { remoteListed, branches }` to the `--json` outcome.
- [x] 5.7 Added `laneSweepBranchLines(sweep)` to `day-start-sweep.mjs` (pure, mirrors `laneSweepLine`'s contract: `[]` on a `null`/shapeless sweep, one `{level,key,params}` per row, `deleted`/`shipped`/`reconciled`→`ok`, the other 5 actions→`warn`). 11 new `day-start-sweep.test.mjs` cases (one per action plus edge cases) confirm each of the 8 `day.memory.laneSweep.branch.*` keys renders and both catalogs carry both that key and the matching `memory.ship.sweep.*` key. Confirmed RED first (renamed the export, re-ran, `ERR_TEST_FAILURE`). Also wired the same function into `day-start.mjs`'s step-5 block (design.md's own File Changes table lists this file; **Deviation 4** below), with a new source-guard test in `day-start.test.mjs` mirroring the existing `laneSweepLine` guard (never a literal `sweep.outcome` re-derivation).
- [x] 5.8 Added `day.memory.laneSweep.branch.{deleted,shipped,reconciled,closedUnmerged,unknown,diverged,failed,remoteOnly}` and `memory.ship.sweep.{same 8}` to `en.mjs`/`es.mjs` (neutral/professional Spanish); wired the ship op's non-`--json` stderr output to print one `memory.ship.sweep.<action>` line per sweep row (same "always on stderr" discipline as `pushed`/`prExisting`/`armed`). The repo's own generic `coverage.test.mjs` parity test (both-directions `en`⇄`es` key coverage) covers the new keys with no per-key edits needed — verified green.
- [x] 5.9 Verify green: `sweep.test.mjs` (14) + `sweep.integration.test.mjs` (8) + `day-start-sweep.test.mjs` (32) + `cli.ship.test.mjs` (43) + `i18n/coverage.test.mjs` (part of 62) = all green.

### Phase 6 — Tier 2 drafts + full verification
- [x] 6.1 Verified `brain-drafts/adr-0034-l2-auto-merge-note.md` — its content (the repo's `allow_auto_merge:false` observation) depends on nothing Phases 1-5 changed (auto-merge's own call/behavior is untouched); left as-is, no discrepancy found.
- [x] 6.2 Created `brain-drafts/vcs-contract-mrlist-row.md` — a factual before/after draft of `vcs-contract.md`'s `mrList` row documenting D1 (`state`/`merged`) and D2 (`headBranch` filter, fail-closed on a full filtered page), following the `vcs-contract-prStatusRollup-row.patch` precedent's shape (current text → proposed text → rationale). No write under `brain/**`.
- [x] 6.3 `npm test` → **6149/6149 pass**. `rg -n "force" ship.mjs sweep.mjs collect.mjs` shows zero `--force`/`--force-with-lease` occurrences (only a `refusing to force-push` error-message string and unrelated doc comments). `git diff --stat origin/main -- brain/scripts/governance/` is EMPTY — `governance/checks/lane.mjs`'s `LANE_BRANCH_RE`, `lane-paths.mjs`, `lane-scrub.mjs`, and every `memory-gate`-named check are byte-for-byte unchanged.
- [x] 6.4 Confirmed and checked off every proposal Success Criteria item: the #1050 repro (Phase 3, `ship.integration.test.mjs`); partial/unknown delivery still appends (Phase 3's own two cases); every sweep row has a bare-origin assertion including a prior-day ref (Phase 5's `sweep.integration.test.mjs`, all 8 rows); a re-shipped prior-day ref never gains today's records (Phase 5's dedicated test); no force-push anywhere and `LANE_BRANCH_RE` unchanged (6.3 above).

## Full suite

`npm test` → **6149/6149 pass** (final run, after Phase 6's commit). Also green after each of Phases 4/5/6 individually via their scoped verify commands, and after Phase 3 (6109/6109, recorded in batch 1).

## TDD Cycle Evidence

| Task | Test file | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1-1.5 (github) | `vcs.contract.test.mjs`, `providers.test.mjs` | Unit/Contract | ✅ 400/400 (baseline) | ✅ Written, confirmed failing (shape diff + ENOENT on missing `-all` fixture) | ✅ Passed | ✅ closed+merged / closed+unmerged / missing-field / full-page-throw / byte-identical-unfiltered cases | ➖ None needed |
| 1.3-1.5 (gitlab) | same | Unit/Contract | ✅ (same baseline) | ✅ Written, confirmed failing | ✅ Passed | ✅ opened/closed/merged/locked mapping + full-page-throw + byte-identical-unfiltered | ➖ None needed |
| 1.6-1.7 (fake port) | `fake-vcs-port.mjs` consumed by `cli.ship.test.mjs`; 2 literal sites in `ship.test.mjs` | Unit/Integration | ✅ 27/5 baseline (see Deviation 1) | N/A — additive default, not independently red-tested (existing suites are the safety net) | ✅ 27/27 `cli.ship.test.mjs` green after the change | ➖ Single (default-null path is the only new branch) | ➖ None needed |
| 2.1-2.2 (delivery.mjs) | `delivery.test.mjs` | Unit | ✅ N/A (new file) | ✅ Written first; confirmed RED by temporarily moving `delivery.mjs` aside — `ERR_MODULE_NOT_FOUND` style failure via `node --test` (module resolution failure), then restored | ✅ 7/7 passed | ✅ delivered (empty diff, empty second diff) / pending (non-empty second diff) / unknown×2 (baseStale, each diff failing) / argv-identity | ➖ None needed |
| 2.3 (surveyDelivery wrapper) | `ship.test.mjs` (`surveyOkRules`, unedited) | Unit | ✅ 40/40 pre-existing | N/A — pure extraction/refactor, approval-style: pre-existing tests are the approval suite | ✅ 40/40 still passing, unedited | N/A | ✅ doc comment rewritten to state the extraction |
| 3.1 (#1050 repro) | `ship.integration.test.mjs` | Integration (bare origin) | ✅ 6/6 pre-existing in that file | ✅ Written first; confirmed RED — `secondParent` (pre-squash commit) ≠ `originMainTip`, then a second RED iteration for `diverged` (stale remote branch, fixed by deleting it in the fixture, per design's own documented caveat) | ✅ Passed | N/A — one scenario, exactly what spec.md's own scenario names | ➖ None needed |
| 3.2 (partial/unknown append) | `ship.integration.test.mjs` | Integration (bare origin) | ✅ same file | ✅ Written; confirmed these ALREADY PASS pre-fix (approval-style: proving no regression) | ✅ Still passing post-fix | ✅ 2 cases: partial delivery, unfetchable base | ➖ None needed |
| 3.3 (collect.mjs step 8) | `collect.integration.test.mjs`, `ship.integration.test.mjs`, `ship.test.mjs` | Integration + Unit | ✅ 95/95 combined | (implementation for 3.1/3.2's already-written RED/approval tests) | ✅ 95/95 passed | N/A | ➖ None needed — comment added, no extraction needed |
| 4.1-4.2 (decidePr D4 matrix) | `ship.test.mjs` | Unit | ✅ 34/44 baseline (pre-existing tests kept green throughout) | ✅ Written first, confirmed 10/44 failing for the right reasons (missing `closedUnmerged` field, stale mrList-args shape, push-before-lookup ordering) | ✅ 44/44 passed | ✅ open-wins-over-closed / foreign-branch-filtered / closed-unmerged-newest / closed-merged-newest / null-field-fails-closed / mrList-throw-before-push | ➖ None needed |
| 4.4 (i18n + shipOutcomeKey) | `cli.ship.test.mjs` (new closedUnmerged e2e test) | Integration (real CLI subprocess, `testTmp` fixture root, fake vcs module) | ✅ 42/43 pre-existing | ✅ Written first — failed on `parsed.closedUnmerged` being `undefined` before the `shipOutcomeKey`/i18n wiring landed | ✅ 43/43 passed, including a 3-run "reported on every run" assertion | N/A | ➖ None needed |
| 4.5 (ship.integration M1 supersession) | `ship.integration.test.mjs` | Integration (bare origin) | ✅ 8/9 pre-existing | ✅ The pre-existing M1 test failed for a NEW, correct reason under D4's reordering (Deviation 3) — rewritten test then confirmed its own new RED/GREEN cycle | ✅ 9/9 passed | ➖ Single scenario, rewritten | ✅ `recordingVcs()`/`recordingVcsThrowOnce()` both gained `state`/`merged` tracking |
| 5.1-5.3 (sweep.mjs, noCollect) | `sweep.test.mjs` | Unit | ✅ N/A (new file) | ✅ Confirmed RED by temporarily moving `sweep.mjs` aside (`ERR_MODULE_NOT_FOUND`-shaped failure), then restored | ✅ 14/14 passed | ✅ filters (slug collision/suffix/today/other-host), ascending order, all 8 row actions, `where:'both'` dedup | ➖ None needed |
| 5.4-5.5 (sweep table, bare origin) | `sweep.integration.test.mjs` | Integration (bare origin, real git) | ✅ N/A (new file) | ✅ Iterative — each of the first 6 tests initially failed on a missing `addCandidate()` call (an empty-collect test-authoring bug, not a `sweep.mjs` bug), fixed and re-confirmed GREEN for the right reason each time | ✅ 8/8 passed | ✅ delivered/pending-no-PR/pending-open-PR/closed-unmerged(×3 runs)/unknown/remote-only/diverged/never-absorbs-today | ➖ None needed |
| 5.6 (cli.mjs sweep wiring) | `cli.ship.test.mjs` (unmodified, ran against real sweep) | Integration | ✅ 43/43 pre-existing, now exercising a REAL `sweepLanes()` call on every non-dry-run case | N/A — wiring only, existing suite is the safety net (no prior-day refs exist in any fixture, so every real sweep call is a no-op, proven by all 43 staying green unmodified) | ✅ 43/43 passed | N/A | ➖ None needed |
| 5.7-5.8 (laneSweepBranchLines, i18n) | `day-start-sweep.test.mjs`, `day-start.test.mjs`, `i18n/coverage.test.mjs` | Unit + source guard | ✅ 21/21 + 3/3 + 62/62 pre-existing | ✅ Confirmed RED by renaming the `laneSweepBranchLines` export, re-running (`ERR_TEST_FAILURE`), then restored | ✅ 32/32 (day-start-sweep) + 4/4 (day-start) + 62/62 (i18n) passed | ✅ all 8 actions × ok/warn level, null-sweep, empty-branches, no-PR, multi-row ordering | ➖ None needed |
| 6.1-6.4 (drafts, invariants) | `npm test` (full suite), `rg`, `git diff --stat` | Full suite + source guard | ✅ 6149/6149 | N/A — verification-only tasks, no new production code | ✅ 6149/6149, zero `--force`, zero `governance/**` diff | N/A | ➖ None needed |

### Test Summary
- **Total tests added this batch (Phase 4-6)**: 10 (Phase 4, `ship.test.mjs` D4 matrix + closedUnmerged assertions on 5 existing tests) + 1 (Phase 4, `cli.ship.test.mjs` closedUnmerged e2e) + 14 (Phase 5, `sweep.test.mjs`) + 8 (Phase 5, `sweep.integration.test.mjs`) + 11 (Phase 5, `day-start-sweep.test.mjs`) + 1 (Phase 5, `day-start.test.mjs`) = **45 new tests**
- **Total tests added across both batches**: 26 (batch 1) + 45 (batch 2) = **71 new tests**
- **Full suite**: 6149/6149 (was 6109/6109 after batch 1; +40 net new top-level `test()` cases — the remainder of the 45 are sub-assertions inside existing/rewritten tests, e.g. the `for (const action of BRANCH_ACTIONS)` loop in `day-start-sweep.test.mjs`)
- **Layers used**: Unit (`sweep.test.mjs`, `ship.test.mjs`, `day-start-sweep.test.mjs`), Integration (`sweep.integration.test.mjs`, `ship.integration.test.mjs`, `cli.ship.test.mjs` — bare-origin/real-CLI-subprocess, no live remote), source guard (`day-start.test.mjs`, `chunk-boundary.test.mjs`)
- **Approval tests** (refactoring/wiring-only): Phase 5.6's `cli.ship.test.mjs` (43/43 unmodified, now exercising a real `sweepLanes()` no-op on every case)
- **Pure functions created**: `decidePr()`/`createPr()` (ship.mjs, replacing `findOrCreatePr()`), `sweepLanes()`/`noCollect()`/`sweepRemoteOnly()`/`sweepLocal()` (sweep.mjs), `laneSweepBranchLines()` (day-start-sweep.mjs)

## Deviations from design/tasks

1. **Task 1.7's "27/5 mrList sites" count.** `rg -c mrList` counts LINES containing the string `mrList`, not data-bearing fake return items. Re-counted by inspection: `ship.test.mjs` has exactly **2** real object-literal sites returning `{number, title, headBranch}` (lines ~489, ~632 pre-edit); `cli.ship.test.mjs` has exactly **1** (`{ number: 999, title: 't', headBranch: ... }`, via the committed `fake-vcs-port.mjs` seam). I updated the 2 literal sites in `ship.test.mjs` to also carry `state`/`merged` for shape realism (not required for any test to pass — `findOrCreatePr` in `ship.mjs` doesn't read those fields until Phase 4). I did **not** edit `cli.ship.test.mjs`'s inline script object, because `fake-vcs-port.mjs`'s `mrList` (task 1.6) now defaults `state`/`merged` to `null` when a script omits them — the existing script objects keep working unchanged, which is exactly spec's "existing consumers unaffected" scenario.

2. **`reparented` on the "nothing new" early-return path in `collect.mjs`.** Design's pseudocode computes `reparented = d.status==='delivered'` unconditionally, but doesn't address the pre-existing "nothing new, `update-ref` never called" early return. Since NO commit is minted and the ref's own tip never moves on that path, `reparented: false` is reported there even when the delivery decision was `delivered` — the ref state genuinely did not change, so claiming `reparented: true` would be a false observable.

3. **The pre-#936 M1 `ship.integration.test.mjs` test is SUPERSEDED, not merely updated, by D4's reordering.** D4 moves the PR lookup BEFORE the push (needed so a `closedUnmerged` decision can forbid the push itself). The pre-#936 M1 audit finding was specifically that a push could land durably even though a LATER `mrList` lookup then failed — a partial effect. With the lookup now first, an `mrList` outage on a first-time-create run means NOTHING pushes at all; the pre-existing test's own assertion (`the push already landed even though mrList failed`) is no longer true and would be testing a state that can no longer occur for this exact scenario shape. I rewrote the test (renamed, same fixture/fake, new assertions: origin left completely untouched after the failed run, the retry then does a genuine push) rather than deleting it, since it still proves a real, valuable invariant (an mrList outage never strands the local ref's content, a retry always recovers cleanly) — just a stronger one than before. This is a superset guarantee, not a behavior regression: no code path exists post-#936 where M1's original partial-push-then-failed-lookup shape can happen for a first-time create, since the lookup is now unconditionally first.

4. **`day-start.mjs`/`day-start.test.mjs` wiring, not explicitly named in task 5.7's own bullet text.** Task 5.7 names `day-start-sweep.mjs` and its own test file; design.md's File Changes table separately lists `brain/scripts/day-start.mjs` as "Modify", and its architecture diagram states `day-start-sweep: laneSweepLine (unchanged) + laneSweepBranchLines(outcome.sweep)` as one consumed unit. I treated the File Changes table as authoritative over the task bullet's shorter description and wired `laneSweepBranchLines()` into `day-start.mjs`'s existing step-5 block too, adding one new source-guard test (mirroring the existing `laneSweepLine` guard: never a literal `sweep.outcome` re-derivation, confirmed by the same regex-based check already protecting that block). This is a design-following completion, not a contradiction — flagged here per the "stop and report" instruction's spirit, though no stop was warranted since design.md was unambiguous on this point.

5. **`chunk-boundary.test.mjs`'s line-number allowlist pin was bumped twice** (673, then 703) as `cli.mjs` grew across Phase 4's `closedUnmerged`/`branch` param addition and Phase 5's sweep wiring — an unrelated pre-existing regression pin (`collectChunkObservations`'s real-importer-vs-allowlist test, R3/#955) that tracks an exact source line. Both bumps are mechanical (comment updated to explain why), not a behavior change.

No spec/design contradiction was found that required stopping at any point in this batch. Design's Open Questions note (D4/D5 resolution) was already resolved before batch 1 began, per that section's own dated note.

## Files changed (this batch, Phases 4-6)

| File | Action |
|---|---|
| `brain/scripts/memory/lane/ship.mjs` | Modified — `decidePr()`/`createPr()` replace `findOrCreatePr()`, D4 lookup moved before push, `closedUnmerged` on every outcome path |
| `brain/scripts/memory/lane/ship.test.mjs` | Modified — D4 matrix (6 new tests + 2 rewritten), `closedUnmerged` assertions added to 5 existing tests |
| `brain/scripts/memory/cli.mjs` | Modified — `shipOutcomeKey()` gains the `closedUnmerged` check, `branch` param threaded, `sweepLanes()` wired in (D6), per-branch stderr lines |
| `brain/scripts/memory/cli.ship.test.mjs` | Modified — new closedUnmerged e2e test, R11 fixture gains `state`/`merged` |
| `brain/scripts/memory/lane/ship.integration.test.mjs` | Modified — `recordingVcs()`/`recordingVcsThrowOnce()` gain `state`/`merged`, the M1 test rewritten (Deviation 3) |
| `brain/scripts/i18n/en.mjs` | Modified — `memory.ship.closedUnmerged`, `day.memory.laneSweep.branch.*` (8), `memory.ship.sweep.*` (8) |
| `brain/scripts/i18n/es.mjs` | Modified — same keys, neutral/professional Spanish |
| `brain/scripts/memory/chunk-boundary.test.mjs` | Modified — line-number pin bumped twice (673, 703) |
| `brain/scripts/memory/lane/plan.mjs` | Modified — `slugifyHost` exported |
| `brain/scripts/memory/lane/sweep.mjs` | Created — `sweepLanes()`, `noCollect()`, `sweepRemoteOnly()`, `sweepLocal()` |
| `brain/scripts/memory/lane/sweep.test.mjs` | Created — 14 unit tests |
| `brain/scripts/memory/lane/sweep.integration.test.mjs` | Created — 8 bare-origin integration tests |
| `brain/scripts/memory/day-start-sweep.mjs` | Modified — `laneSweepBranchLines()` added |
| `brain/scripts/memory/day-start-sweep.test.mjs` | Modified — 11 new tests |
| `brain/scripts/day-start.mjs` | Modified — wires `laneSweepBranchLines()` into step 5 (Deviation 4) |
| `brain/scripts/day-start.test.mjs` | Modified — 1 new source-guard test |
| `openspec/changes/issue-936-lane-branch-reconcile/brain-drafts/vcs-contract-mrlist-row.md` | Created — Tier 2 draft |
| `openspec/changes/issue-936-lane-branch-reconcile/proposal.md` | Modified — Success Criteria checked off |

Batch 1's files changed (Phases 1-3) are unchanged from the prior record:
`brain/scripts/vcs/providers/{github,gitlab}.mjs`, their fixtures,
`providers.test.mjs`, `vcs.contract.test.mjs`, `fake-vcs-port.mjs`,
`lane/delivery.mjs` (created), `lane/delivery.test.mjs` (created),
`lane/collect.mjs`, `lane/ship.integration.test.mjs` (3 tests added in batch 1).

## Workload / PR boundary

- Mode: single PR (per tasks.md's Review Workload Forecast: `400-line budget risk: Medium`, `Chained PRs recommended: No`, `Decision needed before apply: No`).
- Current work unit: the whole change, Phases 1-6 (commits `6c92282c`, `a1631811`, `2dc606ba`, `5951f635`, `3f0cf17a`, `2dfe5e44`).
- Boundary: starts at `origin/main` `25c15102` (rebased onto `c3628036` before this batch). Ends after Phase 6's commit. Each commit is independently revertible per its own documented rollback note in tasks.md's Commit plan.
- **Governed diff size** (additions+deletions, excluding `**/*.test.mjs`, `.memory/**`, `openspec/**`, `AGENTS.md`), measured via `git diff --numstat origin/main HEAD` with those pathspecs excluded:
  - Whole branch (Phases 1-6): **844 lines** (767 additions, 77 deletions) — within the tier-lite 1000-line budget, no `size:exception` needed.
  - This batch alone (Phases 4-6, `2dc606ba..HEAD`): **518 lines** (497 additions, 21 deletions).
- No chaining decision was ever required — risk stayed `Medium`/single-PR throughout, matching the forecast.

## Remediation (cold review)

A cold review after Phase 6 raised one WARNING against `cli.mjs`'s `ship`
op (D6/#936 wiring): `sweepLanes()` ran inside the SAME outer `try` as
today's successful `shipLane()` call, and the comment above it claiming
"never throws by construction" was true only of `sweepLanes()`'s own
per-branch loop, not its pre-loop code (the shared `fetch`,
`listLocalBranches`, `listRemoteBranches`, `slugifyHost`). Had any of
those ever thrown, the outer `catch` would have reported today's
already-successful ship as `memory.ship.failed` / exit 1.

### Fix
`brain/scripts/memory/cli.mjs`'s `ship` op now wraps the `sweepLanes()`
call in its own `try/catch`, isolated from `shipLane`'s outer try. A
throw there is caught and mapped to a fail-closed marker,
`sweep = { failed: true, reason }`, which:
- leaves `result` (today's ship outcome) and `process.exit(0)` untouched
- is surfaced on `--json` as `sweep.failed`/`sweep.reason`
- prints one `memory.ship.sweepFailed` line on stderr (same "always on
  stderr" discipline as `pushed`/`prExisting`/`armed`/the per-branch sweep
  lines)
- is surfaced by `laneSweepBranchLines()` (day-start-sweep.mjs) as exactly
  one `warn` line, `day.memory.laneSweep.sweepFailed`, checked BEFORE the
  `Array.isArray(sweep.branches)` guard so it never silently falls through
  to `[]`

### RED — test-only injection seam
Since `defaultGit()` and `slugifyHost()` never actually throw today (both
audited — `defaultGit` collapses every spawn failure to a `status`
object; `slugifyHost` is a total function on `String(host ?? '')`), there
was no existing seam (including `BRAIN_VCS_TEST_MODULE`) that could force
`sweepLanes()`'s pre-loop code to throw without spawning a second live
entrypoint. Added `BRAIN_MEMORY_SWEEP_FORCE_THROW` (test-only, mirrors the
existing `BRAIN_MEMORY_HEAL_FORCE_THROW` seam in the same file): throws
immediately before `sweepLanes()` is called, exercising cli.mjs's own
isolation of that call directly.

- `cli.ship.test.mjs` — new test: `BRAIN_MEMORY_SWEEP_FORCE_THROW=1` against
  the plain "nothing to ship" fixture. Confirmed RED first (`parsed.sweep`
  had no `failed` key — the throw propagated to the outer catch, but this
  fixture's own shape meant the assertion failed on `undefined !== true`
  rather than a raw exit-1 crash, still proving the isolation did not
  exist yet). GREEN after the fix: exit 0, `parsed.pushed === false`,
  `parsed.sweep.failed === true`, `parsed.sweep.reason` names the seam,
  stderr matches `sweep failed`.
- `day-start-sweep.test.mjs` — new test: `laneSweepBranchLines({failed:
  true, reason})` renders exactly one `warn` line,
  `day.memory.laneSweep.sweepFailed`, with `params.reason` intact.
  Confirmed RED first (0 lines, not 1 — the pre-fix function only checked
  `Array.isArray(sweep.branches)`, absent on this shape).
- Both `en.mjs`/`es.mjs` gained `day.memory.laneSweep.sweepFailed` and
  `memory.ship.sweepFailed` (neutral/professional Spanish); the repo's own
  `i18n/coverage.test.mjs` parity test covers both without per-key edits.

### Safety net (before this batch's edits)
`cli.ship.test.mjs` 28/28, `day-start-sweep.test.mjs` 32/32,
`day-start.test.mjs` 4/4, `lane/sweep.test.mjs` 14/14,
`lane/sweep.integration.test.mjs` 8/8, `i18n/coverage.test.mjs` 48/48 — all
green before any production edit.

### GREEN
`cli.ship.test.mjs` (29) + `day-start-sweep.test.mjs` (33) = 62/62.
Combined with `day-start.test.mjs`, `lane/sweep.test.mjs`,
`lane/sweep.integration.test.mjs`, `i18n/coverage.test.mjs`,
`cli.heal-duplicates.test.mjs` = 144/144.

### Side effect: chunk-boundary.test.mjs pin bump
Isolating the `sweepLanes()` call added lines to `cli.mjs` before the
`collectChunkObservations` import site (line 703 → 732) — the same
mechanical, pre-existing regression pin (`#955`) noted as **Deviation 5**
in the prior batch, bumped again for the same reason (source line grew).
Comment updated to explain why; no behavior change.

### Full suite
`npm test` → **6151/6151 pass** (final run, after this commit).

### TDD Cycle Evidence (this batch)

| Task | Test file | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| sweep isolation (cli.mjs) | `cli.ship.test.mjs` | Integration (real CLI subprocess) | ✅ 28/28 pre-existing | ✅ Written first; confirmed failing (`parsed.sweep.failed` was `undefined`) | ✅ 29/29 passed | ➖ Single scenario — spec names one shape (a throw before the loop); the existing per-branch-action tests in `sweep.test.mjs`/`sweep.integration.test.mjs` already cover the loop's own internal isolation | ➖ None needed |
| laneSweepBranchLines fail-closed row | `day-start-sweep.test.mjs` | Unit | ✅ 32/32 pre-existing | ✅ Written first; confirmed failing (0 lines, not 1) | ✅ 33/33 passed | ➖ Single — one new input shape, mirrors the existing null/shapeless-sweep test's own single-case treatment | ➖ None needed |
| i18n keys + chunk-boundary pin | `i18n/coverage.test.mjs`, `chunk-boundary.test.mjs` | Source guard | ✅ 48/48 + 15/15 pre-existing | N/A — structural (new catalog keys, one line-number literal bump) | ✅ 48/48 + 15/15 passed | ➖ None needed | ➖ None needed |

**Total tests added this batch**: 2 (1 `cli.ship.test.mjs`, 1
`day-start-sweep.test.mjs`).
**Pure functions changed**: `laneSweepBranchLines()` (added a `sweep.failed`
branch, checked first).

## Status

**6/6 phases complete (all 32 task-list items, 1.1 through 6.4), plus the
cold-review remediation above. Ready for `sdd-verify`.**
