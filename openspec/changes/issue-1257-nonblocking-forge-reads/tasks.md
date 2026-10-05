---
status: draft
issue: 1257
---

# Tasks — nonblocking-forge-reads (issue 1257)

Strict TDD: every phase is RED → GREEN → REFACTOR. A RED task names the test and the reason it fails; a GREEN task makes exactly that test pass with the least code; a REFACTOR task changes no behavior and keeps the suite green. Test runner: `npm test` (`node --test "brain/scripts/**/*.test.mjs" "test/**/*.e2e.test.mjs"`); a single file runs with `node --test <path>`. Requirement and decision numbers refer to `spec.md` and `design.md`.

## Phase 1 — The event-loop probe and the forge threads (R1257-9, D63)

- [x] 1.1 RED — `ui/test-support/blocking-forge-adapter.mjs` and the probe in `ui/server.test.mjs`, "An HTTP request waits on a forge read today". The adapter's factory takes `{sab}`; its `issueList` stores 1 in the "blocked" slot, notifies, then `Atomics.wait`s on the release slot with a deadlock guard of a few seconds, and records `'ok'` or `'timed-out'` in a result slot. The test picks a free port, starts `main(['--port', n])` with `_resolveForgeSource` returning the adapter built in-thread and `_forgeThreadResolve` naming the same module with `workerData: {sab}`, and starts a helper worker that waits for "blocked", requests `GET /`, and on the response stores and notifies the release slot. Assert the response is 200 and the result slot reads `'ok'`. **Expected failure today:** `main()` ignores `_forgeThreadResolve` and runs the adapter on the server's thread, so no request is answered while it waits, and the result slot reads `'timed-out'`.
- [x] 1.2 RED — `ui/forge-thread.test.mjs`: a verb round-trip through a worker; a rejected call carries the adapter's error message; a failed resolution rejects every call with its reason; `close()` terminates the worker; the `Atomics` proof that `GET /` on a bare `node:http` server is answered while the thread's adapter blocks; and a blocked closed thread does not delay a second thread's `issueList`. Fails: the module does not exist.
- [x] 1.3 GREEN — `ui/forge-thread.mjs` (`createForgeThread({resolve, _Worker})` → `{port, close}`) and `ui/forge-thread-worker.mjs` (loads `resolve.module`'s `resolve.export` once with `workerData`, serves `{id, verb, args}` in order). The default `resolve` is `getVcs` from `vcs/cli.mjs`. 1.2 passes.
- [x] 1.4 GREEN — `main()` keeps `resolveForgeSource` for the project and the halt reason, builds an `open` and a `closed` thread with `deps._forgeThreadResolve` (default: the production resolver), and passes their ports to `createUiServer` as `forgeSource` and `closedForgeSource`. `close()` terminates both. The probe from 1.1 passes unchanged.
- [x] 1.5 REFACTOR — Name the message shapes once in `forge-thread.mjs`; confirm `vcs/lib/exec.mjs` and `vcs/cli.mjs` are untouched.

## Phase 2 — The `issueList` port carries `state` and `body` (R1257-1 to R1257-5, D53, D54, R12)

- [x] 2.1 RED — `axes/vcs/contract.test.mjs`: the six-key lock; the happy fixtures' expected arrays gain `state: null, body: null`; new derived fixtures `vcs/fixtures/{github,gitlab}-issueList-state.json` (entries 911–915 for `state`, 921–924 for `body`) with one assertion per outcome, including `null` ≠ `''` for both fields and the R12 pair (absent key → `null`, JSON `null` → `''`). Fails on the key list.
- [x] 2.2 RED — `vcs/providers.test.mjs`: `state=closed` reaches both endpoints and still paginates; `updatedSince` adds `since`/`sort`/`direction` on GitHub and `updated_after`/`order_by`/`sort` on every GitLab page; an absent `updatedSince` adds none of them. Fails on the missing query parameters.
- [x] 2.3 GREEN — `github.mjs` and `gitlab.mjs`: `state`, `body` and `updatedSince` mapped inside each adapter as in D53, with a private `mapGitlabIssueState` beside `mapGitlabMrState`. 2.1 and 2.2 pass; `vcs/verb-contract-drift-guard.test.mjs` passes unmodified.
- [x] 2.4 REFACTOR — Keep the two adapters' mapping lines parallel in order and naming. Confirm the brain-draft row matches the code (`brain-drafts/vcs-contract.issueList-row.md`) and that the diff holds no path under `brain/core/` (R1257-4).

## Phase 3 — The forge cache keeps one list per state (R1257-10, D57)

- [x] 3.1 RED — `ui/forge-cache.test.mjs`: "The cache keeps one list per state" and "A closed miss is not the open list". Fails: the port ignores `state` and returns the open list.
- [x] 3.2 GREEN — `store.issueList` becomes a `Map`; `port.issueList({state = 'open'})` and `setIssueList(value, state = 'open')`. Update the existing `setIssueList` tests for the state key.
- [x] 3.3 REFACTOR — The miss reasons stay in one place beside the existing ones (`forge-cache.mjs:14-21`).

## Phase 4 — The poller: open-lane bodies, `forgeLoad`, the early recompute (R1257-8, R1257-9, R1257-11, D58, D64, D66)

- [x] 4.1 RED — `ui/poller.test.mjs`: "The open lane reads no body it already has", "The fallback is capped", "The cold start is capped too". Fails: the body buckets read every number on the cold tick.
- [x] 4.2 GREEN — Replace the body lane with the null-body fallback (`BODY_CAP` per tick, ascending, uncached only). Remove `pickBodyTargets`, `pendingBodyRefresh`, `lastBodyRefreshTick`, `NEW_BODY_CAP` and the cold-start uncapped read; remove `rowsEqual` and `previousIssues` if nothing else reads them. Replace the body-bucket tests whose mechanism is gone.
- [x] 4.3 RED — Every open-lane and lane-independent `forgeLoad` scenario of R1257-8: open pending, complete, failed after complete; forge halted; paused before any load; closed disabled without a closed port. Fails: `state()` has no `forgeLoad`.
- [x] 4.4 GREEN — `forgeLoad: {open, closed}` in the poller, shaped as in the spec's Fixed values, exposed by `state()`.
- [x] 4.5 RED — "The graph lands before the reviews": `onTick` is called once with `forgeLoad.open.state` `'complete'` before a held `prReviews` settles. Fails: `onTick` fires only in `runTick`'s `finally`.
- [x] 4.6 GREEN — The early `onTick(state())` on the open list's first landing (D66).
- [x] 4.7 REFACTOR — Update the header comment of `poller.mjs` (the three-lane narrative now describes a removed body lane).

## Phase 5 — The closed lane (R1257-10, D56)

- [x] 5.1 RED — `ui/poller.test.mjs`: "The closed lane does not delay the open lane", "First run full, second run incremental", "A reopened issue leaves the closed set", "Periodic full re-list", "A closed-lane failure is contained", and the closed `forgeLoad` scenarios (pending, complete after a full list, a delta keeps it complete, failed after complete keeps the data, failed with no data). Fails: `createPoller` ignores `closedVcs`.
- [x] 5.2 GREEN — `runClosed()` under its own single flight, started by `tick()` and never awaited, calling `onTick` itself when it settles outside a tick; full then delta with `updatedSince = lastClosedOkStart − CLOSED_SINCE_OVERLAP_MS`; every `CLOSED_FULL_EVERY_RUNS`-th run full; the merge and the reopen removal; `cache.setIssueList(rows, 'closed')`.
- [x] 5.3 GREEN — `createUiServer` passes `closedForgeSource` to the poller as `closedVcs`.
- [x] 5.4 REFACTOR — Share the single-flight helper between `runRemotes` and `runClosed` only if it reads more simply than two copies.

## Phase 6 — The snapshot (R1257-6, R1257-7, R1257-8, R1257-9, D55, D58, D64, D65, D67, D68)

- [x] 6.1 RED — `status/snapshot.test.mjs`: "No body read when the list carries bodies", "A null body falls back to `issueView`", "An empty body is read, not re-fetched", "Node state comes from the port". Fails: `readForge` calls `issueView` per row and hardcodes `state: 'open'`. Update the existing fakes that assert `blockedBy` or `BLOCKED` so their rows carry `state:'open'` and a `body`.
- [x] 6.2 GREEN — `readForge` takes `body` and `state` from the row; `issueView` only when `body === null`.
- [x] 6.3 RED — `pending(reason)` in `status/report.mjs`; pending `graph`, `prs` and `reviews` while `forgeLoad.open` is pending; "CLI complete" and "CLI failed". Fails: no `pending`, no `forgeLoad` section.
- [x] 6.4 GREEN — `buildSnapshot({forgeLoad, closed})`: the `forgeLoad` section (server value passed in, or derived with `at = generatedAt` in the CLI) and the pending sections with the spec's wording.
- [x] 6.5 RED — "The graph survives a closed failure", "A closed row without a body is unresolved, not dropped silently", and `closedIssues` pending, `failed` with data and `disabled`. Fails: no `closedIssues` section.
- [x] 6.6 GREEN — The closed read and the `closedIssues` section (D68), shaped by `forgeLoad.closed` as in the spec's Fixed values.
- [x] 6.7 RED — `status/snapshot-cli.test.mjs`: `--no-closed` parses and reaches `buildSnapshot({closed:false})`, and "`--no-closed` disables the closed read"; byte-identical `--json` for a fixed `--now`. Fails: unknown argument.
- [x] 6.8 GREEN — `--no-closed` in `snapshot-cli.mjs`; `renderSnapshotText` gains a `forge load` line and a `closed issues` line.
- [x] 6.9 REFACTOR — The loading and disabled reasons live in one constant table in `snapshot.mjs`.

## Phase 7 — Loading is not failure, on the page (R1257-9, D65)

- [x] 7.1 RED — `ui/lib/banners.test.mjs`: "Loading is not failure" (no `sections` band for pending sections; one `loading` band naming them). Fails: `failedSections` lists them.
- [x] 7.2 GREEN — `failedSections` skips `pending:true`; `degradationBands` adds the `loading` band before the `sections` band.
- [x] 7.3 RED — "A pending graph shows no empty board" through `installDom`. If it already passes because the view renders the section's `reason`, record that and skip 7.4.
- [x] 7.4 GREEN — Only if 7.3 failed: route a pending section's `reason` through the view in `app.js`, with `el()` and `textContent`.

## Phase 8 — The server end to end (R1257-8, R1257-9, D64)

- [x] 8.1 RED — `ui/server.test.mjs`: "The first snapshot is served while a forge call is held", "The stream syncs while a forge call is held" (a GUARD: it passes on the parent, only the snapshot and probe tests are red for R11), "Closed issues loading", "The snapshot mirrors the poller". Fails: `computeSnapshot` does not pass `forgeLoad` to `buildSnapshot`.
- [x] 8.2 GREEN — `computeSnapshot` passes `forgeLoad: poller.state().forgeLoad`; the server's cache port serves the closed list when `forgeLoad.closed` allows it.
- [x] 8.3 REFACTOR — Remove any now-dead branch for "the first forge poll has not completed" that a pending section replaces; keep the cache miss reason itself.

## Phase 9 — Verification

- [x] 9.1 `npm test` passes in full.
- [x] 9.2 `npm run brain:repo:check` and `npm run brain:change:verify` pass.
- [x] 9.3 The diff contains no path under `brain/core/`, and neither `brain/scripts/vcs/cli.mjs` nor `brain/scripts/vcs/lib/exec.mjs`.
- [x] 9.4 Measure the gated diff against the forecast below and record it. **Measured: 859 gated lines** (forecast ~520; budget 1000), over 9 work-unit commits before the artifacts commit (10 with it).
- [x] 9.5 (17.1 s, 12 pages, 1119 rows; recorded in D55) Measure the closed-list cost: `time gh api --paginate 'repos/csrinaldi/brain/issues?state=closed&per_page=100' --jq length`, and record it in `design.md`'s D55.
- [x] 9.6 (ENOBUFS found by the real smoke; fixed. `forgeLoad.closed` reached `complete` and `closedIssues.ok` was true about 14 s after start.) Manual check: `npm run brain:ui`, then load `/` at once; the page answers immediately, the loading band names the pending sections, and the graph fills in after the open list lands.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~520 gated (~420 added, ~100 removed; `*.test.mjs` excluded) |
| Governance tier budget (`lite`) | 1000 |
| 400-line budget risk | Medium (over 400, well under the `lite` 1000) |
| Chained PRs recommended | No |
| Suggested split | None. If the measured diff exceeds 1000, split Phases 1 and 7–8 (threads, loading states) from Phases 2–6 (port, cache, lanes, snapshot) |
| Delivery strategy | ask-on-risk |
| Chain strategy | Not applicable to this change. #1199 depends on it and starts after it merges, or stacks on its branch |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: not applicable
400-line budget risk: Medium

## Micro-decisions during apply

Record technical agreements made during implementation here. They are promoted at merge time; see `brain/core/methodology/consolidation-protocol.md`.

- A body that is not a string (`null` or `undefined`) takes the `issueView` fallback, in the poller and in `readForge`. The adapters only emit `null`, so this equals the spec for every conforming port and keeps older test fakes working.
- `main()` runs the live port in forge threads when `_forgeThreadResolve` is given or when `_resolveForgeSource` is not injected (production). A test that injects `_resolveForgeSource` alone gets its stub used as given, so no test can reach the production resolver and spawn a real `gh` in a thread.
- `createUiServer` passes `forgeLoad` to `buildSnapshot` only when no `vcs` was injected. An injected `vcs` is read directly and never loads, so there `forgeLoad` is derived as the CLI derives it.
- The forgeLoad `at` is the run's start time (the `_now()` read when the tick or closed run begins), the same clock `lastOkAt` uses.
- The closed lane's periodic full re-list that fails sets `fullOverdue`, so the next run is full again instead of waiting another 60 runs.
- Pending sections reach the page through `saidUnavailable` in `app.js` (lanes, roadmap and reviews views), which says the section's own sentence instead of `... could not be computed: <reason>`.
- `forgeLoad` for a snapshot built with no port is `uncomputable(<no port reason>)`.
- Spec scenario "A closed row without a body" uses the body `Part of #878` and expects `parent: 878`, but the prose grammar reads only a line-initial `Parent: #N`. The test uses `Parent: #878 (the epic)`; the contract fixtures keep `Part of #878` as an opaque string.
