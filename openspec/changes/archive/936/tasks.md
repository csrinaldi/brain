# Tasks: lane branch reconciliation (#936, absorbs #930)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650 (governed: providers ~40, fixtures ~50, fake port ~15, delivery ~70, collect ~25, ship ~90, plan ~2, sweep ~190, cli ~45, day-start(+sweep) ~60, i18n ~60) — excludes `**/*.test.mjs`, `.memory/**`, `openspec/**`, `AGENTS.md` |
| Tier-lite budget | 1000 — 650 is within it, no `size:exception` needed |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split (if ever chained) | PR 1 = D1-D4 + reparent (~300) · PR 2 = the sweep (~350) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (not needed — risk is Medium, single PR expected per design) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | `mrList` shape (#930): `{state, merged}` on both providers, fixtures, contract test, fake port, fake sites in `ship.test.mjs`/`cli.ship.test.mjs` | PR 1 (only PR) | Foundation — every later unit reads `state`/`merged` |
| 2 | `lane/delivery.mjs` — `contentDelivery()` extracted from `surveyDelivery`, wrapper only | PR 1 | No behavior change; `surveyOkRules` stays green untouched |
| 3 | Same-day reparent (step 8), #1050 repro red-first | PR 1 | Depends on unit 2 |
| 4 | R8 reversal + PR lookup moved before push | PR 1 | Depends on units 1, 2 |
| 5 | `lane/sweep.mjs`, wiring into `ship --json`/`day:start`, i18n | PR 1 | Depends on units 1-4 |
| 6 | Tier 2 drafts under `brain-drafts/` | PR 1, last commit | Docs only, never under `brain/**` |

## Phase 1: `mrList` reports merge state additively (#930)

- [x] 1.1 RED: `brain/scripts/vcs/providers/vcs.contract.test.mjs` — widen the happy-fixture shape assertion (currently `['headBranch','number','title']`, ~line 401) to `['headBranch','merged','number','state','title']`; add a "both providers report merged state" case per spec.md's scenario (closed+merged vs closed+unmerged, two branches). Satisfies spec Requirement "`mrList` reports merge state additively".
- [x] 1.2 Update `brain/scripts/vcs/fixtures/{github,gitlab}-mrList-happy.json`: add `state`/`merged_at` (github) and native GitLab `state` values so the fixture's provenance stays real-shaped. Create `brain/scripts/vcs/fixtures/{github,gitlab}-mrList-all.json` (open, merged, closed items, `derived` provenance) per design File Changes.
- [x] 1.3 GREEN: `brain/scripts/vcs/providers/github.mjs:457-460` — `mrList` maps `state: r.state`, `merged: r.merged_at !== undefined ? r.merged_at !== null : null` (D1).
- [x] 1.4 GREEN: `brain/scripts/vcs/providers/gitlab.mjs:621-625` — `mrList` maps `opened→open/false`, `closed→closed/false`, `merged→closed/true`, anything else → `null/null` (D1).
- [x] 1.5 GREEN: add the optional `headBranch` filter (D2) to both providers — GitHub `pulls?state=all&head=<owner>:<branch>&per_page=100` (`owner = project.split('/')[0]`, URL-encoded); GitLab `merge_requests?state=all&source_branch=<enc>&per_page=100`. A full page (100) with `headBranch` set THROWS (fail closed). Unfiltered calls stay byte-identical to today's query. Extend `providers.test.mjs` with argv assertions containing `head=`/`source_branch=` and the full-page-throws case.
- [x] 1.6 Update `brain/scripts/memory/__fixtures__/fake-vcs-port.mjs` `mrList` to honor `state`/`headBranch` args and return `merged`/`state` on every item.
- [x] 1.7 Update the fake `mrList` sites so every returned item carries `state`/`merged` (27 sites in `brain/scripts/memory/lane/ship.test.mjs`, 5 sites in `brain/scripts/memory/cli.ship.test.mjs` — confirm exact counts via `rg -c mrList` before editing, since line-shape changes may add or remove call sites). Existing assertions on `number`/`title`/`headBranch` stay verbatim (spec's "existing consumers unaffected" scenario).
- [x] 1.8 Verify: `node --test brain/scripts/vcs/providers/vcs.contract.test.mjs brain/scripts/vcs/providers.test.mjs brain/scripts/memory/lane/ship.test.mjs brain/scripts/memory/cli.ship.test.mjs` — all green, 1.1 now passes.

## Phase 2: shared fail-closed delivery helper (extraction, no behavior change)

- [x] 2.1 Create `brain/scripts/memory/lane/delivery.mjs` exporting `contentDelivery({ git, root, rev, baseFetched })` — the exact primitive `surveyDelivery` (`ship.mjs:99-119`) already implements, argv-identical, returning `{ status: 'delivered'|'pending'|'unknown', reason: null|'baseStale'|'diffFailed' }`. It imports nothing from `lane/` (D3). Checks only the paths added since `merge-base(origin/main, rev)` (the three-dot diff), never the whole tip tree, all-or-nothing, and never resolves `delivered` on an unreadable precondition.
- [x] 2.2 Create `brain/scripts/memory/lane/delivery.test.mjs`: delivered / pending / unknown (`baseStale` and `diffFailed`) cases, fake git in the `ship.test.mjs` style, argv-identical to `surveyDelivery`.
- [x] 2.3 `ship.mjs`'s `surveyDelivery` becomes a thin wrapper over `contentDelivery`: `delivered→true`, `pending→false`, `unknown→null`, same `reason`. No other line in `ship.mjs` changes. `surveyOkRules` in `ship.test.mjs` stays green without edits.
- [x] 2.4 Verify: `node --test brain/scripts/memory/lane/ship.test.mjs brain/scripts/memory/lane/delivery.test.mjs` — every existing `ship.test.mjs` assertion still passes unedited.

## Phase 3: same-day reparent onto `origin/main` (#1050)

- [x] 3.1 RED: bare-origin integration test (new or extended `collect.integration.test.mjs`/`ship.integration.test.mjs`) reproducing #1050 — ship record X, squash-merge X into `origin/main` on the bare origin with plumbing (`commit-tree` + `update-ref main`, delete the branch ref), keep the local lane ref, collect record Y, ship again. Assert this test FAILS before Phase 3's GREEN task (X still re-listed) — confirm and note the failure reason before proceeding.
- [x] 3.2 Add the "partial or unknown delivery still appends" case to the same file: a partially-delivered tip and a `baseFetched:false` tip both keep appending on the existing tip, unchanged from today.
- [x] 3.3 GREEN: `collect.mjs` step 8 (`:276-282`) — before setting `plan.parent = existingTip`, call `contentDelivery({ git, root, rev: existingTip, baseFetched })`. When `status === 'delivered'`, set `plan.parent = originMainTip` and reset the ref with the existing CAS `update-ref` (`old = existingTip`); otherwise append on `existingTip` exactly as today. Add `reparented: boolean` to `collectLane`'s return.
- [x] 3.4 Verify: 3.1's test now passes (parent is `origin/main`'s tip, the three-dot diff/title lists only Y, X is not re-listed); 3.2's cases stay green; confirm `collected` is still tree-diff based (plan.mjs's `already-on-main` skip is untouched).

## Phase 4: R8 reversal — closed-unmerged is reported, never reopened

- [x] 4.1 RED: `ship.test.mjs` D4 matrix — open PR wins; empty list or newest `merged:true` → create; newest `closed && merged:false` → `closedUnmerged:true`, zero push/create calls; a `null` field or an `mrList` throw → `prLookupFailed`; a foreign `headBranch` in the list is filtered out before "newest" is picked. Also: today's branch with an earlier-today closed-unmerged PR does not reopen (spec scenario "today's closed-unmerged branch also stops reopening").
- [x] 4.2 GREEN: `ship.mjs` — move the `mrList` lookup before the push (currently `:363-384` pushes first); keep only items whose `headBranch` matches; reuse an open item; otherwise the highest-numbered item decides (`closed && merged===false` → `closedUnmerged`, no push/create/reopen; `merged===true` or empty → create). Add `closedUnmerged: boolean` (default `false`) to every outcome return path.
- [x] 4.3 Update R8's code comment (`ship.mjs`, near the old push-then-lookup order) to state the reversal and reference #936, per spec's explicit requirement.
- [x] 4.4 Add `memory.ship.closedUnmerged` (branch + PR number params) to `brain/scripts/i18n/{en,es}.mjs`; wire `shipOutcomeKey()` (`cli.mjs:589`) to return it when `result.closedUnmerged` is true, checked before the existing `nothing`/`prNumberUnknown` branches.
- [x] 4.5 Verify: `node --test brain/scripts/memory/lane/ship.test.mjs brain/scripts/memory/cli.ship.test.mjs` — all green; confirm no push/`mrCreate`/`mrAutoMerge` call happens on any `closedUnmerged` row.

## Phase 5: cross-day sweep + wiring + i18n

- [x] 5.1 Export `slugifyHost` from `brain/scripts/memory/lane/plan.mjs` (currently private, `:60`).
- [x] 5.2 Create `brain/scripts/memory/lane/sweep.mjs` exporting `sweepLanes({ root, project, tier, host, today, git, vcs, ship = shipLane })` per design: fetch `origin main` once (`baseFetched`); list local refs (`for-each-ref refs/heads/memory/`) and remote refs (`ls-remote --heads origin 'refs/heads/memory/*'`, degrading to `remoteListed:false` on failure); filter `^memory/(.+)-(\d{4}-\d{2}-\d{2})$` where group 1 `=== slugifyHost(host)` exactly, skip `date === today`; walk ascending by date, each ref in its own try/catch; dispatch `delivered`→CAS `update-ref -d`, `pending`→`ship({..., collect: noCollect(ref, baseFetched)})`, `unknown`→keep+report. Every git call passes `cwd: root`.
- [x] 5.3 Implement `noCollect(ref, baseFetched)` returning `{ ref, commit: null, collected: 0, skipped: [], duplicates: emptyDuplicates(), baseFetched, skippedWorktrees: [] }` so `collectLane` is never invoked during a sweep re-ship.
- [x] 5.4 Create `brain/scripts/memory/lane/sweep.test.mjs` (unit, git spy, no real repo): host-slug collision (`gandalf` vs `gandalf-rog-...`) is rejected, a suffixed branch name is ignored, today's ref is skipped, another host's ref is ignored, each classification maps to the right row, every git call receives `cwd === root`.
- [x] 5.5 Create `brain/scripts/memory/lane/sweep.integration.test.mjs` on `testTmp` bare origins (never the real `.git`, no live CLI spawn — #1012 guard): one test per sweep table row (delivered→deleted, pending/no-PR→shipped, pending/open-PR→reconciled, pending/closed-unmerged→reported-not-reopened, unknown→kept), plus remote-only (report-only, nothing mutated), plus "a re-shipped prior-day ref never absorbs today's newly collected records", plus "a diverged remote leaves the remote sha unchanged and reports `diverged`, never force-pushes".
- [x] 5.6 Wire `sweepLanes` into `brain/scripts/memory/cli.mjs`'s `ship` op: call it only after today's `shipLane` succeeds and only when not `--dry-run` (D6); add `sweep: null | { remoteListed: boolean, branches: [...] }` to the `--json` outcome (`cli.mjs:531`).
- [x] 5.7 Wire `laneSweepBranchLines(outcome.sweep)` into `brain/scripts/memory/day-start-sweep.mjs`, appended after the existing `laneSweepLine` (unchanged); add `day-start-sweep.test.mjs` cases asserting each of the 8 branch-action keys renders and both catalogs carry the keys.
- [x] 5.8 Add i18n keys to `brain/scripts/i18n/{en,es}.mjs`: `day.memory.laneSweep.branch.{deleted,shipped,reconciled,closedUnmerged,unknown,diverged,failed,remoteOnly}` and `memory.ship.sweep.*` (stderr, non-json); `closedUnmerged`/`unknown`/`diverged`/`failed`/`remoteOnly` render as `warn`. Extend the i18n key-parity test to cover the new keys. Neutral/professional Spanish for the `es` copy.
- [x] 5.9 Verify: `node --test brain/scripts/memory/lane/sweep.test.mjs brain/scripts/memory/lane/sweep.integration.test.mjs brain/scripts/memory/day-start-sweep.test.mjs brain/scripts/memory/cli.ship.test.mjs` plus the i18n parity test — all green.

## Phase 6: Tier 2 drafts + full verification

- [x] 6.1 Verify `openspec/changes/issue-936-lane-branch-reconcile/brain-drafts/adr-0034-l2-auto-merge-note.md` (already exists) still matches the shipped `autoMerge`/tier behavior — no code changed that draft depends on; leave as-is unless a discrepancy is found, in which case update the draft only (never `brain/**`).
- [x] 6.2 Create `openspec/changes/issue-936-lane-branch-reconcile/brain-drafts/vcs-contract-mrlist-row.md` — a Tier 2 draft of `brain/core/methodology/vcs-contract.md`'s `mrList` row (currently `:29`), documenting the additive `state`/`merged` fields and the D2 `headBranch` filter (following the `issue-606-rollup-reports-its-cause/brain-drafts/vcs-contract-prStatusRollup-row.patch` precedent's shape). Never write under `brain/**`.
- [x] 6.3 Full suite: `npm test` green. Grep confirms no `--force`/`--force-with-lease` was added anywhere in `ship.mjs`/`sweep.mjs`/`collect.mjs`; confirm `governance/checks/lane.mjs:15`'s `LANE_BRANCH_RE`, `lane-paths`, `lane-scrub`, and `memory-gate` are byte-for-byte unchanged.
- [x] 6.4 Confirm every proposal Success Criteria item holds: #1050 repro fails-before/passes-after; partial/unknown delivery still appends; each sweep row has a bare-origin assertion including a prior-day ref; a re-shipped prior-day ref never gains today's records; no force-push anywhere and `LANE_BRANCH_RE` is unchanged.

## Commit plan (work-unit commits, STRICT TDD, tests travel with their code, no commit is red)

1. `feat(vcs): mrList reports merge state additively (#930) (#936)` — Phase 1 (1.1-1.8): providers, fixtures, contract test, fake port, fake `ship.test.mjs`/`cli.ship.test.mjs` sites, all in one commit so nothing is left red.
   - Verify: `node --test brain/scripts/vcs/providers/vcs.contract.test.mjs brain/scripts/vcs/providers.test.mjs brain/scripts/memory/lane/ship.test.mjs brain/scripts/memory/cli.ship.test.mjs`
   - Rollback: revert alone; additive shape, no caller depended on the old narrower type.
2. `refactor(memory): extract contentDelivery() as a shared, fail-closed helper (#936)` — Phase 2 (2.1-2.4).
   - Verify: `node --test brain/scripts/memory/lane/ship.test.mjs brain/scripts/memory/lane/delivery.test.mjs`
   - Rollback: revert alone; `surveyDelivery` behavior is unchanged, a pure extraction.
3. `fix(memory): same-day append reparents onto origin/main when the tip is delivered (#936)` — Phase 3 (3.1-3.4), the #1050 fix.
   - Verify: the new bare-origin integration test(s)
   - Rollback: revert alone; `collectLane`'s CAS is unaffected when `contentDelivery` never reports `delivered`.
4. `fix(memory): reverse R8 — a closed-unmerged lane PR is reported, never reopened (#936)` — Phase 4 (4.1-4.5).
   - Verify: `node --test brain/scripts/memory/lane/ship.test.mjs brain/scripts/memory/cli.ship.test.mjs`
   - Rollback: revert alone; restores #920's original R8 push-then-lookup order.
5. `feat(memory): the lane sweep reconciles every unreconciled memory/<host>-* ref (#936)` — Phase 5 (5.1-5.9).
   - Verify: `node --test brain/scripts/memory/lane/sweep.test.mjs brain/scripts/memory/lane/sweep.integration.test.mjs brain/scripts/memory/day-start-sweep.test.mjs brain/scripts/memory/cli.ship.test.mjs`
   - Rollback: revert alone; `sweepLanes` is only called after a successful `shipLane`, so today's ship path is unaffected if reverted.
6. `docs(sdd): issue-936 Tier 2 drafts and closing verification (#936)` — Phase 6 (6.1-6.4).
   - Verify: `npm test`
   - Rollback: revert alone; docs-only, no runtime code.

All commit subjects end `(#936)`, no `Co-Authored-By` or AI-attribution trailers.

## Notes (not tasks)

- Design's Open Questions section is stale — the orchestrator already aligned spec.md with D4 (open-wins-else-highest-numbered) and D5 (today excluded from the sweep, reconciled by today's ship path). If Phase 4 or 5 implementation surfaces a genuine remaining mismatch between spec.md and design.md, stop and report it rather than choosing silently.
- The instruction citing "27 fake `mrList` sites" matches `ship.test.mjs` exactly (confirmed via `rg -c`); `cli.ship.test.mjs` has 5 more. Re-count with `rg -c mrList` before Phase 1 edits in case the file changed since this plan was written.
- The maintainer runbook items in Phase 6 (6.1) and the ADR-0034 L2 note are Tier 2 — the apply agent verifies/creates the draft file only, never edits `brain/core/**` or `brain/project/**` directly.
