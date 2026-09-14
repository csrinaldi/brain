---
status: in-progress
issue: 881
---

# Apply progress — issue-881-ui-server-canvas

## Chain ruling (2026-09-14, supersedes the stacked-to-main text tasks.md
## carried before this run)

Delivery is **feature-branch-chain** on the tracker `feature/brain-ui`, not
stacked-to-main. PR 1 (#964) is squash-merged into the tracker as
`8d074e44`. PR *n* targets the tracker once PR *n-1* is merged into it, or
targets PR *n-1*'s branch directly while still open. The tracker PR (#970,
draft) is the only PR in the chain that targets `main`, and it closes #881
once every child PR has landed on the tracker. `tasks.md`'s own header was
rewritten to this ruling in commit `12f1a63a`.

## Slices delivered so far

**PR 1 / A1 — the server serves the read model.** All 7 tasks (T1–T7)
complete. Squash-merged into the tracker as `8d074e44`.

**PR 2 / A2 — the server notices.** All 8 tasks (T1–T8) complete this run.
Branch `feat/issue-881-slice-2-stream`, on top of `8d074e44`.

PR 3 (B1) and PR 4 (B2) are not started.

## PR 1 / A1 — tasks done, with commit SHAs

| Task | What | Commit |
|---|---|---|
| — | docs(sdd): planning artifacts (explore, proposal, spec, design, tasks) | `743794c9` |
| T1a/T1b | `forge-cache.mjs` + test — the cache-only port (D1) | `be277a3c` |
| T2a/T2b | `diff.mjs` + test — section-level diff (Q5) | `5c2589cb` |
| T3a/T3b | `server.mjs` core (`createUiServer`, `listen`/`close`, `GET /`, `GET /api/snapshot`) + `static/index.html` placeholder + test | `43aea8c7` |
| T4a/T4b | 405 method-guard test (production code already present from T3b — see deviation below) | `37d47f8b` |
| T5a/T5b | `parseArgs`, `EADDRINUSE`, `package.json` (`brain:ui`, `engines.node>=22`) + test | `23661264` |
| T6 | Verify: full suite + `brain:repo:check` green | (no separate commit — verified before the T5 commit) |
| T7 | `npm run memory:save` — `rec-b9a5a16c68582663` | (folded into the T5 commit's docs(memory) counterpart at the time) |

### PR 1 RED/GREEN evidence

- **T1a/T1b** (forge-cache): RED — `forge-cache.test.mjs` failed with
  `ERR_MODULE_NOT_FOUND` (no `forge-cache.mjs`). GREEN — 3/3 passing after
  implementing `createForgeCache()`.
- **T2a/T2b** (diff): RED — `diff.test.mjs` failed with `ERR_MODULE_NOT_FOUND`
  (no `diff.mjs`). GREEN — 4/4 passing after implementing `diffSections()`.
- **T3a/T3b** (server core): RED — `server.test.mjs` failed with
  `ERR_MODULE_NOT_FOUND` (no `server.mjs`). GREEN — 7/7 passing after
  implementing `createUiServer`, `parseArgs`, `main`, and adding
  `static/index.html`.
- **T4a/T4b** (405 guard): the production method-check was already written
  as part of T3b's `handleRequest` (D7's "method check runs before routing"
  is one code path with the routing itself, implemented up front). Honest
  RED was reproduced by temporarily reverting the guard in the working tree
  (never committed), confirming the two new T4a assertions fail, restoring
  it, and confirming green (`9/9`). The committed diff for this task pair is
  test-only.
- **T5a/T5b** (argv/EADDRINUSE/package.json): same situation for
  `parseArgs`/`main`/`EADDRINUSE`, already implemented in T3b. 13/14 T5a
  assertions passed immediately against the T4 commit's code; the one
  genuinely RED assertion (`package.json` `brain:ui`/`engines.node`) went
  GREEN after adding both keys.

### PR 1 test counts

- Focused (`brain/scripts/ui/*.test.mjs` as of PR 1): 21/21 passing, run 5×
  consecutively with no flake (forge-cache 3, diff 4, server 14).
- Full suite at PR 1: 5362/5362 passing.

### PR 1 deviations

1. **T4/T5 RED sequencing** — see RED/GREEN evidence above; every assertion
   was still proven to exercise real production logic.
2. **SIGINT/SIGTERM lifecycle** — deferred to PR 2 (no watcher/poller to
   stop yet in PR 1); delivered this run as PR 2's T5a/T5b.
3. **Scope** — no file outside `brain-slice-scope/1`'s PR 1 `files` list was
   touched.

---

## PR 2 / A2 — tasks done, with commit SHAs

| Task | What | Commit |
|---|---|---|
| — | docs(sdd): tasks.md delivery header follows the tracker ruling | `12f1a63a` |
| T1a/T1b | `watcher.mjs` + test — directory watchers, debounce, worktree re-scan | `33907049` |
| T2a/T2b | `poller.mjs` + test — three lanes, pause/resume/once | `2609ddd9` |
| — | `fix(ui)`: `poller.close()` leak (found via T3's SSE tests, see below) | `c2352550` |
| T3a/T3b, T4a/T4b, T6 | SSE hub (`GET /api/stream`) + POST `/api/poll/*` + the R881-10 route guard | `1b343af8` |
| T5a/T5b | SIGINT/SIGTERM lifecycle, `--interval`/`--no-poll` | `cc952458` |
| T7 | Verify: full suite + `brain:repo:check` green | (folded into the T8 commit) |
| T8 | `npm run memory:save` — `rec-56e5504ba47fdf96` | (this commit) |

### PR 2 RED/GREEN evidence

- **T1a/T1b** (watcher): RED — `watcher.test.mjs` failed with
  `ERR_MODULE_NOT_FOUND` (no `watcher.mjs`), confirmed by moving the
  just-written `watcher.mjs` aside and running the suite. GREEN — 8/8
  passing on the first restore, stable across 4 consecutive runs.
- **T2a/T2b** (poller): RED — `poller.test.mjs` failed with
  `ERR_MODULE_NOT_FOUND` (same move-aside technique). GREEN — 6/6 passing
  on the first restore, including the 30-simulated-tick Q1/D2 budget test,
  stable across 4 consecutive runs.
- **T3a/T4a/T6** (SSE + POST controls + route guard, one combined server.mjs
  edit): RED — `git stash push -- brain/scripts/ui/server.mjs` reverted
  production code to the PR 1 shape while keeping the new tests; the file
  failed to even load (`SyntaxError: ... does not provide an export named
  'KNOWN_ROUTES'`), the strongest form of RED since every new test depends
  on the same module. GREEN after `git stash pop` — 23/23 (later 26/26 once
  T5's tests were added), stable across 3 consecutive runs. One test bug was
  found and fixed along the way (a double `res.body.getReader()` call in the
  first draft of the `close()` test) — not a production defect.
- **T5a/T5b** (signals, `--interval`/`--no-poll`): RED — 4 of 26 tests failed
  cleanly (`parseArgs` default-shape mismatch, the two new argv assertions,
  and the SIGINT/SIGTERM test timing out on `waitUntil` since no handler was
  registered yet — the test's `finally` block still closed the server, so
  the RED run exited in 1.35s with no leaked process). GREEN — 26/26 after
  implementing the argv extensions and the signal handlers, stable across 4
  consecutive runs.

### A genuine bug found via the SSE tests, not just a test bug

While building T3's SSE tests, the FULL `server.test.mjs` file (all 22
individual subtests passing) never let `node --test` exit — the process
hung until manually killed. Isolated with `--test-timeout` per test: every
individual assertion passed, but the file-level wrapper timed out waiting
for something to let the event loop drain. Root cause: `poller.close()`
only cleared the *currently scheduled* timer. If a tick was still in flight
when `close()` ran (a normal race in several PR 1 tests that never pass
`vcs` and therefore always run a real, if inert, poller against
`noForgeVcs`), that tick's own `.finally()` called `scheduleNext()` *after*
`close()` had already returned, arming a brand-new real `setTimeout` with no
one left to clear it — a leaked handle that would keep a real `brain:ui`
process (and any test importing it) alive for up to a full poll interval
after "shutdown." Fixed with a `closed` flag `scheduleNext()` checks
alongside `paused`, set once by `close()` and never cleared (`c2352550`).
Confirmed fixed: the same full run that previously hung completed in
~330ms across 4 consecutive runs afterward, and `poller.test.mjs`/
`watcher.test.mjs` still pass 6/6 and 8/8 with no regression.

### PR 2 test counts

- Focused new files: `watcher.test.mjs` 8/8, `poller.test.mjs` 6/6,
  `server.test.mjs` 26/26 (14 from PR 1 + 12 new this PR) — each run 3-4×
  consecutively with no flake.
- Full suite (`GIT_CONFIG_GLOBAL=/dev/null npm test`): **5389/5389 passing,
  0 failing.**
- `npm run brain:repo:check`: green before every commit.

### PR 2 deviations from tasks.md / design.md

1. **`parseWorktrees` duplicated, not reused.** Design's Q3/D4 explicitly
   names `memory/lane/collect.mjs:115-129`'s `parseWorktrees()` as a seam to
   reuse ("re-exported, not re-written: the single-accessor rule"), but that
   function is not exported, and `collect.mjs` is outside this run's
   `brain-slice-scope/1` file fence (`server.mjs`/`watcher.mjs`/`poller.mjs`
   plus PR 1's shipped files only — the hard constraint governing this apply
   run). `watcher.mjs` carries its own ~15-line copy of the same porcelain
   stanza grammar (`worktree <path>` / `bare`), documented inline as a
   deliberate duplication with the reason. If PR 3 or a follow-up touches
   `collect.mjs` anyway, exporting `parseWorktrees` there and importing it
   here would close this gap.
2. **Body lane's "least-recently-refreshed" fallback only rounds out an
   already-nonempty batch — it never fires alone.** Design's Q1 prose reads
   as "the body lane always spends up to B=5 per tick," but spec.md's own
   R881-4 S1 acceptance scenario ("N unchanged issues cost nothing on the
   next poll") is unconditional: zero issueView calls, not "some smaller
   number." Read literally, an always-fire least-recently-refreshed lane
   would violate R881-4 S1 on the very first steady tick after cold start
   (everything is tied at "just refreshed," so the fallback would still
   pick 5). Implemented so priority (c) only rounds out a batch that
   priority (a) or (b) already started; when neither has anything, the body
   lane costs nothing that tick. The 30-simulated-tick test still hits the
   design's exact `2 + min(P,10) + B` figure on every tick where something
   plausibly moved (a real repo's steady state), and the dedicated R881-4 S1
   test proves the zero-cost case spec.md asks for. Spec is the acceptance
   criteria; this reading is chosen because the literal design reading and
   the spec scenario cannot both hold, and spec wins ties per this run's
   brief.
3. **`resume()` does not itself poll.** Read literally, R881-4 S2 only
   requires that pausing stops the timer and that "poll now" (`once()`)
   still works; it does not require `resume()` to trigger an immediate poll.
   Implemented so `resume()` re-arms the regular interval only — the
   process that has *never* polled (`start()`) fetches immediately because
   the page needs data, but a paused-then-resumed poller already has
   whatever it last held, and immediate polling on resume would be a second,
   undocumented behavior. Noted as a design gap worth closing explicitly if
   a future slice's UX disagrees.
4. **Commit shape** — tasks.md's plan effectively separates T3
   (SSE hub) from T4 (POST controls) as two units; they land in one commit
   here (`1b343af8`) because both live inside `handleRequest`'s single
   method-check-then-route function, and no cohesive intermediate diff
   exists that adds the SSE route without also touching the same `Allow`
   header logic the POST routes need. `git stash`-based RED evidence was
   produced for the combined unit instead of two separate RED cycles.
5. **`refs` frame test added beyond the literal per-task list** — T3a's
   prose bundles the `refs` frame assertion into the "committed-tier change"
   scenario; implemented as a separate, narrower test
   (`R881-2 S2 (refs)`) so each test asserts one thing. No behavior gap:
   both the section-diff path and the refs path are covered.
6. **Scope** — no file outside `brain-slice-scope/1`'s PR 2 `files` list
   (`watcher.mjs`, `poller.mjs`, `server.mjs`) plus their `*.test.mjs`
   siblings was touched, except the one-line `poller.mjs` bugfix (already
   in scope) and `tasks.md`/`apply-progress.md` bookkeeping.

## PR 2 / A2 — review round (2026-09-14, fresh-context review → REVISE)

A fresh-context review of the branch (`feat/issue-881-slice-2-stream`, 8
commits ahead of `origin/feature/brain-ui` at review time) returned REVISE
with three findings, all verified against the code. Fixed as a targeted
follow-up on the same branch, STRICT TDD (failing test first where the
defect was live code, mutation-proof where the defect was a missing test):

1. **BLOCKER — async `'error'` on a live `fs.watch` handle crashed the
   process.** `watcher.mjs`'s `watchDir()` only caught the *synchronous*
   throw at registration; a live `FSWatcher` firing `'error'` later (late
   `ENOSPC`/`EPERM`, watched path removed) is an uncaught exception with no
   listener registered — violates R881-9 / design Q3 ("a watcher failure is
   a said state, never a crash"). RED reproduced with an injected `_watch`
   returning an `EventEmitter`: `emit('error', ...)` on a live handle
   crashed the test (`error: 'ENOSPC: no space left'`). Fixed by
   registering an `'error'` listener on every live handle (guarded by
   `typeof handle.on === 'function'` so existing plain-object test doubles
   are unaffected) that records the failure in the same `{path, reason}`
   shape the synchronous case uses and closes that handle so it cannot fire
   again. Commit `94fc678`.

2. **MAJOR — the negative assertion design.md D7 promises was missing.**
   D7 says the test "asserts after a `POST /api/poll/pause` that no file
   under the served root, no git ref and no forge stub call changed";
   `server.test.mjs`'s R881-5 S2 only checked the 405 matrix and the
   `{paused}` JSON. Added a test using the `snapshotTree()` walker pattern
   from `status/snapshot.test.mjs` (before/after deep-equal over the whole
   fixture tree) plus a `countedWriteVerbs()` helper (extends
   `readOnlyWriteVerbs` with a call count) across pause/resume/once,
   asserting zero write-verb calls while allowing `once`'s legitimate
   reads. The fixture root has no `.git` (`snapshot-tree.mjs` never runs
   `git init`), so the git-ref leg is skipped with a stated reason — also a
   structural no-op since `servePollControl` never calls `run('git', ...)`.
   Proven by mutation: `servePollControl` was temporarily made to write a
   marker file under the root, the tree-snapshot assertion went red exactly
   on that file, then reverted (`server.mjs` has no diff from before the
   mutation). Commit `5f4e57eb`.

3. **Hardening from the mutation results.** Mutation-testing the earlier
   `poller.close()` leak fix (`c2352550`) found that removing `closed =
   true` did not turn any existing test red — it made `node --test` HANG
   instead, because those tests use the real timer pair, so the leaked
   `scheduleNext()` after `close()` arms a real, uncleared timer. A CI job
   with no per-test timeout would sit there, not fail. Added a test using
   the poller's own injected `_setTimeout`/`_clearTimeout` seam: `start()`
   a tick, `close()` while it is still in flight (a controlled gate holds
   `issueList`), let it settle, assert `scheduler.pending() === 0`. Proven
   by the same mutation: removing `closed = true` turns this test red in
   under a millisecond, then reverted (`poller.mjs` has no diff from before
   the mutation). Commit `f74890ba`.

**Carried to PR 3 as a follow-up, accepted as minor:** the `parseWorktrees`
duplication (deviation 1 above) is not resolved by this round — the two
copies (`watcher.mjs`'s and `memory/lane/collect.mjs`'s) already diverge on
the `prunable` field: `collect.mjs`'s stanza parser tracks it, `watcher.mjs`'s
copy does not (it only needs `path`/`bare` for this slice's re-scan). PR 3
should export `parseWorktrees` from `collect.mjs` and import it in
`watcher.mjs` instead of carrying a second, narrower copy of the same
grammar.

## What PR 3 (B1) needs to know

- `createUiServer`'s route table is now final for the server-side surface
  PR 3 depends on: `GET /`, `GET /api/snapshot`, `GET /api/stream`, `POST
  /api/poll/{pause,resume,once}` — `KNOWN_ROUTES` in `server.mjs` pins the
  set.
- PR 3 ships `change-route.mjs` (`GET /api/change/{issue}`) as a NEW route;
  it will need the same method-check-before-routing treatment and its own
  `KNOWN_ROUTES` entry, plus an R881-10 S3 guard update.
- The SSE frame shapes are: `event: sync` (`{generatedAt, snapshot, meta}`),
  `event: section` (`{name, section, generatedAt, cause}`), `event: refs`
  (`{worktree, head, at}`), `event: status` (`{project, watcher, poller}`
  via `buildMeta()`). PR 4's `app.js` (B2) is the first consumer.
- `diffSections(previous, next)` (PR 1's `diff.mjs`) is what turns a
  recompute into `section` frames; nothing in PR 3 needs to touch it.
- `watcher.mjs`'s `resolveGitCommonDir` and `poller.mjs`'s three lanes are
  process-internal; PR 3 has no reason to import either directly (it ships
  pure `lib/*.mjs` parsers plus one new IO route).

## Cold review of PR #971 rev 1 (2026-09-14) — REVISE → fixed

`judgment:cold-1` (blocker, R881-3): `rescanWorktrees()` set `watchedWorktrees`
unconditionally after `watchDir()`, so a worktree whose watch failed once was
never retried on later rescans and stayed silently invisible. Fixed by only
recording a worktree as watched when `handles.has(absPath)` is true after
`watchDir()`, and by having `closeWatch()` also clear `watchedWorktrees` (so
the async handle-error path from `94fc6788` re-enables retry too). RED: a
`_watch` double throwing `ENOENT` once for alpha's `logs/` kept
`attempts.get(alphaLogs)` at 1 and alpha in `failed` after a second rescan.
GREEN after the fix. Mutation check: restoring the unconditional `set()` on
watchedWorktrees turned exactly this test red (9/10), reverted. Commit
`f253e5ca`.

## Second cold review of PR #971 (head 342e46cc, 2026-09-14) — REVISE → fixed

`judgment:cold-1` (blocker, `poller.mjs:122`): `const reviewTargets =
previousIssues === null ? prNumbers : pickReviewTargets(prNumbers)` bypassed
the review-lane cap on the cold-start tick — with 50 open PRs, `prReviews`
was called 50 times, not `min(50,10)=10`. The header comment
(`poller.mjs:6-8`) promises "every tick, capped at 10 PRs" with no
cold-start exception for the review lane, unlike the body lane, which IS
documented uncapped on cold start (`poller.mjs:9-11`). The existing
steady-tick budget test uses `PR_COUNT=3`, under the cap, so it could not
distinguish capped from uncapped. RED: new test
`judgment:cold-1 — the review lane is capped at REVIEW_CAP on the very
first (cold-start) tick...` (`poller.test.mjs`) with 50 PRs asserted 10
`prReviews` calls on the cold tick — got 50. Fixed by always routing
through `pickReviewTargets()` (it already no-ops when `P <= REVIEW_CAP`,
so small forges are unaffected). GREEN after the fix, plus a round-robin
assertion that all 50 PRs are read at least once within 5 consecutive
ticks. Mutation check: restoring the ternary turned exactly this one test
red (7 pass / 1 fail), reverted. Also corrected `design.md`'s cold-start
budget row (`1 + I + 1 + P` → `2 + min(P,10) + I`) — same numeric total
(95) for this repo's `I=90`/`P=3` example, since `P=3` is under the cap.
Commit `41ab8729`.

`judgment:cold-2` (correction, `server.mjs:195`): `listen()`'s
`onListening` callback ran `await recomputeCurrent()` with no try/catch and
no `.catch()` — the only unprotected call site into `buildSnapshot`
(`handleRequest`'s `.catch` and `recomputeAndBroadcast`'s try/catch already
cover the others). A throw there became an unhandled rejection: `listen()`'s
outer `Promise` never settled and the `httpServer` stayed bound to the port
forever. Added the `_recomputeCurrent` seam to `createUiServer` (default:
the real `buildSnapshot({ root, now: _now(), vcs: forgeVcs, project })`,
reusing the existing `recomputeCurrent()` wrapper every call site already
goes through) and forwarded it through `main()`'s `deps` the same way
`deps.vcs`/`deps.forgeSource` already are. RED: two new tests —
`judgment:cold-2 — a throwing startup recompute rejects listen()...`
(direct on `server.listen()`, `failureType: unhandledRejection` before the
fix) and `judgment:cold-2 — main() exits 2 with the message...` (through
the CLI). Fixed by wrapping the startup recompute in try/catch: on
failure, `httpServer.close()` first (releasing the port), then reject
`listen()`'s promise with the original error; `main()` now treats any
`listen()` rejection the same exit-code class as `EADDRINUSE` (D15's own
framing) instead of letting the error escape uncaught. GREEN after the
fix, including a check that a second, independent server can bind the
exact port number the failed server had been holding. Mutation check:
removing the try/catch turned exactly these two tests red (27 pass / 2
fail), with the file-level run itself timing out from the same
leaked-listener symptom the finding describes — reverted. Commit
`28647280`.

`brain:repo:check` green on every commit; tree clean after each.
