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

## Third cold review of PR #971 (head e23123e1, 2026-09-14) — REVISE → fixed, plus an adversarial sweep

Two blockers and one correction, all fixed on the same branch, plus one more
fix found during the mandated sweep for the same defect class.

`judgment:cold-3` (blocker, `server.mjs:87-93`, `sendEvent`/`broadcast`):
`ServerResponse.write()` after the response has ended does NOT throw
synchronously — it emits an async `'error'` event
(`ERR_STREAM_WRITE_AFTER_END`), and an `EventEmitter` with no `'error'`
listener throws out of `.emit()`, crashing the whole process. `sendEvent()`
wrote to every client in `clients` with no error handler at all; `broadcast()`
had no per-client try/catch. The only removal path was `req.on('close', ()
=> clients.delete(res))` — asynchronous, not guaranteed to have run before
the next `recomputeAndBroadcast()` iterated `clients`, and
`recomputeAndBroadcast`'s own try/catch does not catch an `EventEmitter`
`'error'` (it is not thrown into that call stack). Fixed by adding
`registerClient()`/`dropClient()`: every client entering `clients` gets a
`res.on('error', () => dropClient(res))` listener, and `sendEvent()` now
skips a client whose `res.writableEnded || res.destroyed` and wraps the
write itself in try/catch, dropping the client on any failure — one dead
client never stops the broadcast loop for the others. Test-only seams
`_clients`/`_registerClient` were added to `createUiServer`'s return value
so a test can inject a fake, `EventEmitter`-shaped dead `res` (its `write()`
schedules an async `'error'` via `queueMicrotask`, matching Node's own
documented behaviour) without racing a real socket teardown against a real
broadcast. RED: `node --test`'s own uncaught-exception reporter —
`"A resource generated asynchronous activity after the test ended... Error:
write after end"` — confirming this is a real process crash, not a
benign-looking assertion failure. GREEN after adding the error handler and
the write guard. Mutation check: removing `res.on('error', ...)` from
`registerClient()` and the try/catch + `writableEnded`/`destroyed` guard
from `sendEvent()` reproduced the exact same uncaught-exception crash;
restored. Commit `3a461fd6`.

`judgment:cold-4` (blocker, `poller.mjs:86-107`, `pickBodyTargets`): with 90
open issues, a single tick where all 90 issues' labels change at once (a
bulk label rename, one ordinary GitHub action) made `pickBodyTargets()`
fetch `issueView` for all 90. `changed` was never capped — only `newNumbers`
was capped at `NEW_BODY_CAP=20`, and `rest` only ever took whatever budget
remained after `changed`, which could itself already exceed the intended
`B=5` steady-state budget with no ceiling. `design.md`'s Q1/D2 stated the
body lane costs `≤ B` calls with `B=5` steady state and a worst bounded case
of `2 + 10 + 5 = 17` calls/tick — this implementation had no upper bound at
all once more than `BODY_CAP` issues changed in one tick. Fixed by adding a
persistent, insertion-ordered `pendingBodyRefresh` set: every number whose
fast-lane row changed is added to it (numbers leave it once their body is
actually fetched, or once they leave the open-issue set); each tick,
`changed` is sliced off the FRONT of that set up to
`BODY_CAP + NEW_BODY_CAP = 25` minus however much `newNumbers` already used,
so the tick's grand total (new + changed + LRU rest) never exceeds 25 no
matter how many issues changed at once. Overflow is never dropped — it
stays in `pendingBodyRefresh` and drains oldest-first on later ticks.
Corrected `design.md`'s worst-bounded-case row from `2 + 10 + 5 = 17` to
`2 + 10 + 25 = 37` calls/tick (2,220/h, 44% of the 5,000/h ceiling — still
well under budget), with a dated correction note explaining the original
figure only ever accounted for the (already-broken) `B=5` ceiling. RED: new
test `judgment:cold-4` (`poller.test.mjs`) — 90 issues, a steady cold-start
tick, then every one of the 90 issues' labels moving on tick 2 — asserted
`issueView` calls on tick 2 `<= 25`; got 90. Fixed → GREEN, plus an
assertion that every one of the 90 changed issues is refreshed within
`ceil(90/25) = 4` ticks of the mass change (drains via 3 further ticks after
the saturated tick 2: 25 + 25 + 25 + 15 = 90). Mutation check: removing the
cap on `changed` (`const changed = [...pendingBodyRefresh];` with no
`.slice()`) reproduced exactly the RED failure (90 calls on tick 2, over the
25 bound); restored. Confirmed the existing Q1/D2 30-tick budget test (one
label moves per tick, well under the cap) still asserts the same
`2 + min(P,10) + 5 = 10` calls/tick — the fix is a no-op for that case since
`pendingBodyRefresh` fully drains every tick when only 1 issue changes.
Commit `986d079a`.

`judgment:cold-5` (correction, `server.mjs:319`, `main`): `main()` attached
`proc.on('SIGINT'/'SIGTERM', ...)` with no matching removal, tied to the
real `process` whenever `deps.process` was not overridden. Five `main()`
calls in `server.test.mjs` (the `--no-poll` composition test, the unknown-
argument test, the EADDRINUSE test, the `judgment:cold-2` exit-2 test, and
the "main succeeds" test) ran against the real process with no fake, each
leaking two listeners; the listener itself also outlived a caller's own
`server.close()` whenever no signal ever fired, which is the common case in
this file's tests (only the dedicated SIGINT/SIGTERM test ever emits a
signal). Fixed by wrapping `server.close` once, right after the listeners
are attached in `main()`: the wrapped `close()` removes both listeners
(`proc.off(...)`) before delegating to the original `close()`, so whichever
path closes the server — a real signal via `shutdown()`, or a caller/test
closing it directly — the listeners come off too. All five `main()` calls
in `server.test.mjs` that do not themselves assert on signal handling now
pass a fresh `makeFakeProcess()` double (an `EventEmitter` with a no-op
`exit()`), so the real process is never touched by this test file except
through the one test that deliberately exercises real signal semantics
(that one keeps its own local `fakeProcess`, already an `EventEmitter`).
RED: new test `judgment:cold-5` — `main()` against a fake process, assert
one `SIGINT`/`SIGTERM` listener each after start, `result.close()` directly
(no signal), assert zero listeners after — failed `1 !== 0` before the fix.
GREEN after wrapping `close()`. Mutation check: removing the `server.close`
wrapper (leaving only the original `proc.on(...)` calls) reproduced the
exact same `1 !== 0` failure; restored. Commit `ddbab09e`.

**Adversarial sweep** (same defect class: an unhandled `EventEmitter`
`'error'`, or a loop over an external count with no bound), reading
`server.mjs`, `poller.mjs`, and `watcher.mjs` once more end to end:

- **Fixed** — `httpServer`'s own `'error'` event (`server.mjs`): `listen()`'s
  `once('error', onError)` listener is removed the moment `'listening'`
  fires (`onListening` calls `httpServer.removeListener('error', onError)`),
  so a live `httpServer` had ZERO `'error'` listeners for its entire
  post-bind lifetime. A post-bind failure (`EMFILE` on `accept()` is the
  documented Node case) would have crashed the process the same way
  `judgment:cold-3` did, one level up the object hierarchy. Fixed with a
  persistent baseline `httpServer.on('error', (err) => { lastServerError =
  err; })` attached once at server construction, alongside test-only seams
  `_httpServer`/`_lastServerError`. RED: `node --test`'s uncaught-exception
  reporter (`failureType: 'uncaughtException'`, `error: 'EMFILE: too many
  open files'`) when the baseline listener was temporarily removed and a
  post-bind `'error'` was emitted on the live server. GREEN after adding the
  listener; the server stays alive and answers `/api/snapshot` normally
  right after. Commit `bfe71787`.
- **Checked, sound** — each `fs.watch` handle (`watcher.mjs:127-132`):
  already carries a `handle.on('error', ...)` listener from the first
  fresh-context review round (commit `94fc6788`); a failed handle is
  recorded and closed, never left to throw. No sibling gap found.
- **Checked, sound** — `httpServer`'s `'clientError'` event: unlisted by
  design. Node's documented default behaviour for an http `Server` with no
  `'clientError'` listener is to write `HTTP/1.1 400 Bad Request` (or 431)
  and destroy the offending socket itself — there is nothing this server
  needs to add, and adding a listener would only change that safe default.
- **Checked, sound** — per-request `req`/`res` on the four one-shot routes
  (`/`, `/api/snapshot`, `/api/poll/*`): each writes and ends its response
  exactly once, synchronously within `handleRequest`, which is already
  wrapped in `.catch((err) => sendInternalError(res, err))` at the
  `http.Server`'s own request-handler callback. Unlike the SSE `clients` set
  (a long-lived response accumulating many writes over the life of a
  connection that can go stale at any point), there is no window here where
  a stale `res` accumulates repeat writes — the request/response pair is
  born and dies in one handler invocation.
- **Checked, sound** — the poller's per-item review/body fetches
  (`poller.mjs`'s two `Promise.all(...map(async (n) => { try {...} catch
  {...} }))` blocks): already wrap each item's fetch in its own try/catch,
  so one item's rejection cannot crash the tick or stop the others (R881-9).
- **Checked, sound** — `watcher.mjs`'s `rescanWorktrees()` and
  `listChangeDirs()` loops: bounded by the actual number of linked
  worktrees / `openspec/changes/issue-*/` directories on disk, which are
  operator-controlled repository state, not an external, adversarial,
  or unboundedly large count the way open issues/PRs are.
- **Checked, sound** — the poller's own scheduling (`scheduleNext()`/
  `runTick()`): a tick already in flight is never overlapped by
  `scheduleNext()`, which only runs from `tick().finally(...)` after the
  current tick has fully settled — no unbounded backlog can accumulate.

Full local verification this round (actual, measured, not assumed):
`node --test brain/scripts/ui/*.test.mjs` = 59/59 green, run 3 times
identically (447ms/458ms/548ms). Full `npm test` = 5400/5400 green (one
run, ~32s). `brain:repo:check` green on every commit; tree clean after each.
Commits this round, in order: `3a461fd6` (cold-3), `986d079a` (cold-4 +
`design.md` correction), `bfe71787` (sweep: httpServer error), `ddbab09e`
(cold-5).

## Fourth cold review of PR #971 (head d666fc29, 2026-09-14) — REVISE → fixed, and proven against the real forge

One blocker, fixed on the same branch, then proven against `csrinaldi/brain`
with a real, running `brain:ui` process (not a stub) — the first time this
slice's poller has ever actually reached GitHub.

`judgment:cold-6` (blocker, `server.mjs:399-407`, the real entry-point
guard): the guard resolved `project` via `originIdentity()` but never
resolved a `forgeSource`, so `main(process.argv.slice(2), { project })`
always ran with `deps.forgeSource` undefined. `main()` built `createUiServer`
with `forgeSource: deps.forgeSource ?? null`, and `createUiServer` wired the
poller with `vcs: forgeSource ?? noForgeVcs`, whose four verbs each throw
`"no forge port was supplied to the poller"`. Every real `npm run brain:ui`
invocation therefore ticked forever against a throwing port:
`poller.state().lastError` was permanently that message, and `prs`,
`reviews`, and every issue's body stayed `{ok:false}` in production —
forever, since the poller never called anything else. The comment above the
guard (`"vcs is deliberately never resolved here (D1) — the real CLI entry
always runs with an empty forge-cache until the poller fills it"`) was a
stale leftover from before the poller (PR 2 / A2) existed: it correctly
described PR 1's behaviour and was never updated once PR 2 added a poller
that needed a real port to fill anything. No test exercised the entry guard
or asserted `main()` wires a live port when `deps.forgeSource` is omitted —
every existing `main()` test either passed `--no-poll` or never checked
`prs`/`graph` at all.

Fixed with `resolveForgeSource({ _getVcs, _originIdentity })` in
`server.mjs`, mirroring `status/snapshot-cli.mjs:54-69` exactly: dynamic
-imports `vcs/cli.mjs`'s `getVcs()` and `vcs/lib/repo.mjs`'s
`originIdentity()`, and degrades every failure mode (no origin remote, no
provider configured, `getVcs()` throwing) to `{ok:false, reason}` — never a
throw. `main()` calls it whenever `deps.forgeSource` is omitted AND polling
was requested (`--no-poll` still means no forge resolution is attempted at
all, R881-4 S2's existing contract, unchanged). On `{ok:true}`, the resolved
port and project are handed to `createUiServer` so the poller's first tick
fills the cache exactly as PR 2 designed. On `{ok:false}`, `main()` prints
`✗ forge: <reason> — polling paused; tree sections still served` on stderr,
and `createUiServer` gets a new `forgeUnavailable` option: `computeSnapshot`
overrides the three forge sections (`graph`/`prs`/`reviews`) of every
computed snapshot to `{ok:false, reason: forgeUnavailable}` — the REAL
reason, not the generic `"the first forge poll has not completed"`
`forge-cache.mjs` would otherwise report forever (that message is true but
useless to an operator who will never see it become false). `poller.mjs`
gained a new `initialError` option: when set, `paused` is forced `true`
regardless of `enabled`, and `lastError`/`lastPolledAt` are set immediately
from `_now()` — so `start()` is a no-op and no tick ever runs against
`noForgeVcs`, matching the required behaviour ("no tick runs against a
throwing port") exactly. The stale D1 comment on the entry guard is
rewritten to say what is true now: `project` is still resolved there
cheaply (one local `git` call, matching `snapshot-cli.mjs`'s own pattern),
but the forge PORT is resolved inside `main()`, not the guard, and a
resolution failure degrades to a paused, said state rather than silence.

RED: two new `main()` integration tests in `server.test.mjs` — one asserts
that a `_resolveForgeSource` stub returning `{ok:true, vcs, project:'o/r'}`
actually serves the poller (`prs.ok`/`graph.ok` true after `POST
/api/poll/once`); the other asserts that `{ok:false, reason:'no VCS
token'}` reaches stderr, all three forge sections of `/api/snapshot`, and
the poller's own `state().lastError`/`paused`. Both failed before the fix —
the first because `prs.ok` stayed `false` (the poller only ever saw
`noForgeVcs`), the second because `main()` never called anything and never
printed the line. Also RED (by construction, before the fix existed at
all): three new unit tests for `resolveForgeSource` itself (a throwing
`_getVcs` degrades to `{ok:false, reason}`; a resolving one yields
`{ok:true, vcs, project}`; no origin remote short-circuits to `{ok:false,
reason}` without ever calling `_getVcs`) and one new `poller.mjs` unit test
for `createPoller({ initialError })` (`paused: true`, `lastError`/
`lastPolledAt` set immediately, `start()` a no-op, the port never called) —
each confirmed RED by temporarily reverting its half of the implementation
(`poller.mjs`'s `initialError` wiring: 9/10 pass, 1 fail; the whole
`server.mjs` change before `resolveForgeSource` existed: import-time
`SyntaxError`, 0/38 pass) and GREEN after restoring.

Five pre-existing `main()` call sites in `server.test.mjs` that do not pass
`--no-poll` (EADDRINUSE, `judgment:cold-2`'s exit-2 test, "main succeeds on
a free port", the D15 SIGINT/SIGTERM test, `judgment:cold-5`) now inject a
`noRealForgeResolution()` stub via `_resolveForgeSource` — `main()`'s new
default (a REAL `resolveForgeSource`) would otherwise run a real dynamic
import against `vcs/cli.mjs` on every `node --test` invocation, and — once
the poller's first tick fired — a real `gh` subprocess, on every single run
of this file. None of those five tests assert anything about forge/poller
state, so the stub is a pure hermeticity fix, not a behaviour change.

Mutation check: reverting `main()`'s resolution block to the literal
pre-fix line, `forgeSource: deps.forgeSource ?? null` (no resolution
attempted, `resolveForgeSource` itself left intact and still exported)
reproduced exactly: the two new `main()` integration tests red (test 37 —
`prs.ok` stays `false`; test 38 — no stderr line, no reason in
`/api/snapshot`, `paused` stays the interval-driven default rather than
carrying the reason), while the three `resolveForgeSource` unit tests
stayed green (they call the function directly, not through `main()`) —
36/38 pass, 2 fail. Restored: 38/38 green.

**Proven against the real forge**, not a stub — `csrinaldi/brain`, this
machine's own `gh` and token, worktree `/home/gandalf/IA/brain-issue-881`:
`GIT_CONFIG_GLOBAL=/dev/null timeout 120 npm run brain:ui -- --port 0
--interval 5000` (no `--no-poll`), server reported listening on an
OS-assigned port with no `✗ forge:` line on stderr (resolution succeeded).
After ~15s, `GET /api/snapshot`: `graph.ok: true` with **89 nodes**,
`prs.ok: true` with **3 open PRs**, `reviews.ok: true` with **3 review
rows**. The SSE stream's first (`sync`) frame carried `meta.project:
"csrinaldi/brain"` and `meta.poller: {paused: false, lastError: null,
lastOkAt: <a real timestamp>, forgeAsOf: {issues, bodies, reviews: all set}}`
— the poller had actually ticked against the real forge, not `noForgeVcs`.
`POST /api/poll/pause` then returned `paused: true`. Server killed by PID
(never `pkill -f`) once the check completed; `ps aux` confirmed no orphaned
`node ./brain/scripts/ui/server.mjs` process survived (the `npm run`
wrapper spawns a child `sh -c` and a grandchild `node` process under a
different PID than `npm`'s own — both were found via `ps aux` and killed
explicitly).

Full local verification this round (actual, measured, not assumed):
`node --test brain/scripts/ui/*.test.mjs` = 66/66 green, run 3 times
identically. Full `npm test` = 5407/5407 green (one run, ~31s).
`brain:repo:check` green before the commit; tree clean after. Commit this
round: `79cb3bf` (judgment:cold-6 fix + tests + real-forge proof, all in
one commit — the mutation and real-forge verification were done against
the working tree before committing, not as separate commits). No push, no
PR (per task instructions) — branch `feat/issue-881-slice-2-stream` is
ahead of its last-pushed state (origin still at `d666fc29`).

## Fifth cold-review round (PR #971, head `8f45c327`)

**Verdict**: REVISE, one blocker — `judgment:cold-7`.

**Finding (verbatim, reproduced)**: started a watcher on a fresh git root,
created `openspec/changes/issue-999-test/` after `start()` (fires the
`CHANGES_ROOT` watch, kind `'tree'`, one recompute), then wrote to
`tasks.md` inside that new directory 600 ms later — zero further
recomputes. `watcher.mjs`'s `onFire()` only special-cased
`kind === 'worktrees'` (calls `rescanWorktrees()`, `watcher.mjs:160`); a
`CHANGES_ROOT` event ran no equivalent re-sync, so `listChangeDirs()` +
`watchDir()` (`watcher.mjs:243`) only ran once, inside `start()`. Any
change dir created after the watcher starts — the normal case for
`/sdd-new` on a long-lived server — was watched only at its parent's
granularity: no edit to any file inside it ever fired a recompute again.
Contradicted `design.md:228` ("a change dir appearing or disappearing →
re-sync children", the same contract worktrees get at
`watcher.mjs:217-233`) and R881-3 (`openspec/changes/**`).

**Fix**: `rescanChangeDirs()` added to `watcher.mjs`, mirroring
`rescanWorktrees()`: opens a watch for every change dir now present and
not yet watched, closes the watches of dirs that vanished, records
failures per label as before, and retries a failed dir on the next
`CHANGES_ROOT` event — never marks a failed dir as watched (the
`judgment:cold-1` round-1 rule, now shared by both resync paths). The
`CHANGES_ROOT` directory's own `watchDir()` call changed `kind` from
`'tree'` to `'changes'` so `onFire()` can special-case it exactly like
`kind === 'worktrees'`. `start()`'s old manual "loop over
`listChangeDirs()`" was replaced by a `rescanChangeDirs()` call, so the
tracking map (`watchedChangeDirs`) is populated correctly at boot too —
symmetric with `rescanWorktrees()` already being called at the end of
`start()`.

`watchDir()` and `closeWatch()` were generalized to take a
`trackingId`/`trackingMap` pair instead of a worktree-only
`worktreeId`/`watchedWorktrees` pair, so the "clear the tracking entry on
close (including an async `handle.on('error', ...)` close), so a failed
child is retried on the next rescan, never left permanently marked
watched" bookkeeping is shared by both `rescanWorktrees()` and
`rescanChangeDirs()` instead of duplicated.

**Considered and rejected**: a single generic `resyncChildren(rootKind)`
function folding both resync loops (worktrees' `git worktree list
--porcelain` + parse, changes' `readdirSync` + filter) into one body, per
the review's stated preference. Rejected because it would require
touching the already-working, already-tested `rescanWorktrees()` body —
net diff growth for no functional gain — under this PR's tight remaining
diff budget (889/1000 counted lines before this round). The shared
`trackingId`/`trackingMap` primitive in `watchDir()`/`closeWatch()`
captures the actual duplicated risk (the async-error/retry bookkeeping)
without that cost; the two `rescan*()` functions stay separate, thin, and
symmetrical.

**Test first (RED)**: two new tests in `watcher.test.mjs` — (1) create a
change dir after `start()`, fire the `CHANGES_ROOT` event via the injected
`_watch` double, assert the new dir is watched, then write `tasks.md`
inside it and fire that dir's event, assert a second debounced recompute
(previously zero, ever); (2) remove an existing change dir, fire the
`CHANGES_ROOT` event, assert its handle is closed (`closesByPath` bumps,
`state().watched` count drops by one). Both failed before the fix — RED
confirmed with `GIT_CONFIG_GLOBAL=/dev/null node --test
brain/scripts/ui/watcher.test.mjs` (10 pass / 2 fail). After the fix: 12/12
green (GREEN confirmed).

**Mutation**: removed the `if (entry.kind === 'changes') rescanChangeDirs();`
line from `onFire()` — reproduced red on exactly the two new tests (5 and
6), all ten other `watcher.test.mjs` tests stayed green. Restored; 12/12
green again.

**Sweep of the class** — every watched root's children, enumerated from
`start()`:

| Watched root | Children are | Re-sync needed? |
|---|---|---|
| `<root>/` | files (`brain.config.json`) | No — dir-granularity watch is complete |
| `<root>/brain/` | files (`brain/HOME.md`) | No |
| `<root>/brain/project/decisions/` | files (one `.md` per ADR — verified: `ls brain/project/decisions` returns only `.md` files) | No |
| each `ANTI_PATTERN_DIRS` entry | files (verified: `brain/core/anti-patterns`, `brain/project/anti-patterns` each list only `.md` files) | No |
| `<root>/.memory/records/` | files, flat (verified: `ls .memory/records` returns only `*.jsonl` files, no subdirectories) | No |
| `<root>/openspec/changes/` | **directories** (one per change) | **Yes — fixed this round** (`rescanChangeDirs()`, test named above) |
| each `<root>/openspec/changes/issue-*/` | files (`spec.md`, `tasks.md`, …) | No — dir-granularity watch is complete |
| `<git-common>/` | files (`HEAD`, `packed-refs`, `ORIG_HEAD`, `MERGE_HEAD`) | No |
| `<git-common>/logs/` | file (`HEAD` reflog) | No |
| `<git-common>/worktrees/` | **directories** (one per linked worktree) | Already fixed (`rescanWorktrees()`, PR 2/A2 original work) — unaffected by this round except the shared `trackingId`/`trackingMap` generalization |
| each `<git-common>/worktrees/<n>/logs/` | file (`HEAD` reflog) | No |

Every watched-root class with directory children now re-syncs on its own
event; every class with file children was already complete at
dir-granularity. No further sibling found.

**Files changed**: `brain/scripts/ui/watcher.mjs` (`rescanChangeDirs()`
added; `watchDir()`/`closeWatch()` generalized to `trackingId`/
`trackingMap`; `CHANGES_ROOT`'s own watch `kind` changed `'tree'` →
`'changes'`; `onFire()` gained the `kind === 'changes'` branch; `start()`'s
manual change-dir loop replaced by a `rescanChangeDirs()` call; top-of-file
comment updated), `brain/scripts/ui/watcher.test.mjs` (2 new tests, per
above).

**Verification**: `GIT_CONFIG_GLOBAL=/dev/null node --test
brain/scripts/ui/*.test.mjs` = 68/68 green, run 3 times identically (was
66/66 before this round's 2 new tests). `GIT_CONFIG_GLOBAL=/dev/null npm
test` = 5409/5409 green, one full run (~31s; was 5407/5407 before this
round). `brain:repo:check` green before the commit; tree clean after.
Counted diff (excluding `.test.mjs`, `openspec/`, `.memory/`) against
`origin/feature/brain-ui...HEAD`: **926 / 1000**. Commit this round:
`67b0bec` (judgment:cold-7 fix + tests + sweep). No push, no PR (per task
instructions) — branch `feat/issue-881-slice-2-stream` is ahead of its
last-pushed state (origin still at `d666fc29`).

## Sixth round — pre-push cold review of PR #971 (head `3fe0e510`), a second `evidence-reader-empty-on-failure` instance found in `listChangeDirs()`

A fresh-context review before push (PR #971) found `listChangeDirs()`
(`watcher.mjs:203-209`) still caught `readdirSync` errors and returned
`[]` — the same "genuinely empty" vs. "could not be read" collapse
`brain/core/anti-patterns/evidence-reader-empty-on-failure.md` names, and
the same class already fixed once for `activeWorktrees()` in PR 2. Its
claimed mirror `activeWorktrees()` (`watcher.mjs:238-242`) calls
`recordFailure('<git-common>/worktrees', err)` on the same kind of
failure; `listChangeDirs()` recorded nothing at all. Since the fifth
round wired `listChangeDirs()` into `rescanChangeDirs()` on every
`openspec/changes/` event, one transient `EMFILE`/`EACCES` on a live
server made `current = new Set([])` and closed every watched change dir
as "vanished", with `state().ok === true` and `failed === []` — a said
state that lied. Recovery needed another root event to succeed, and an
edit inside a now-unwatched dir could never fire one. Reproduced:
`_readdir` throwing `EMFILE` on one rescan closed two previously-watched
change dirs (`issue-1-a`, `issue-2-b`) with the handle count dropping and
`state().failed` empty. Violates R881-9.

**Fix**: `listChangeDirs()` now catches internally, calls
`recordFailure(CHANGES_ROOT, err)`, and returns `null` — never `[]` —
so the sentinel cannot be mistaken for a real (if empty) listing.
`rescanChangeDirs()` checks for `null` first and returns immediately,
skipping reconciliation entirely and leaving every currently-watched
change dir untouched; on a later successful read it clears the stale
`CHANGES_ROOT` failure entry before reconciling. `start()` already only
reaches `listChangeDirs()` through `rescanChangeDirs()`, so the startup
path is covered by the same fix with no separate change.

**Test first (RED)**: one new test in `watcher.test.mjs` — start with two
change dirs watched, arm a `readdirSync`-shaped spy to throw `EMFILE` on
the changes root, fire the `CHANGES_ROOT` event, assert both change-dir
handles are still open, `state().failed` carries an `openspec/changes`
entry with the EMFILE message, and `state().ok` is `false`; then disarm
the spy, fire the root event again, and assert the failure entry is
gone and `state().ok` is `true`. RED confirmed against the pre-fix code
(`git stash` of the production change, run the suite): `issue-1-a stays
open` failed — `1 !== undefined` (the handle really was closed). GREEN
after the fix: 13/13 in `watcher.test.mjs`.

**Mutation**: restored `catch { return []; }` in place of the fixed
`listChangeDirs()` body (production code only, test unchanged) —
reproduced red on exactly the new test (`a CHANGES_ROOT rescan that
cannot read the dir keeps every currently-watched change dir open, then
recovers`), all 12 other `watcher.test.mjs` tests stayed green. Restored
the fix; 13/13 green again.

**Sweep of every `catch` in `watcher.mjs`, `poller.mjs`, `server.mjs`,
`forge-cache.mjs`** (`rg -n 'catch' <files>`):

| Site | Behavior | Verdict |
|---|---|---|
| `watcher.mjs:144` `watchDir()` | `recordFailure(label, err)` | said failure — OK |
| `watcher.mjs:152` `closeWatch()` | `catch { /* best effort */ }`, already-deleted handle | commented, OK |
| `watcher.mjs:203-209` `listChangeDirs()` | was `catch { return []; }` | **fixed this round** |
| `watcher.mjs:264` `activeWorktrees()` | was `recordFailure(...); return []` | **fixed in `f132056` (round 7)** — see below |
| `watcher.mjs:283` gitCommonDir resolution | `recordFailure('<git-common>', err)` | said failure — OK |
| `poller.mjs:160,170` per-PR/per-issue fetch | `catch { /* previous value stays cached (R881-9) */ }` | commented, preserves last-good value, does not overwrite with empty — OK |
| `poller.mjs:177` fast-lane tick | `catch (err) { lastError = ... }` | said failure via `lastError`, no cache setter ran — OK |
| `server.mjs:108` `sendEvent()` | drops one dead client, commented | OK |
| `server.mjs:171` ref-head lookup | `catch { head = null }` | explicit said-unknown, broadcast as `head: null` — OK |
| `server.mjs:175` `recomputeAndBroadcast()` | `catch { /* leaves current at its last good value */ }` | commented, preserves prior state — OK |
| `server.mjs:186` `handleRequest(...).catch(...)` | reports to the client via `sendInternalError` | fail-loud to the caller — OK |
| `server.mjs:274` startup recompute | closes the listener and rejects with the original error | fail-loud — OK |
| `server.mjs:290` client shutdown | `catch { /* best effort */ }`, commented | OK |
| `server.mjs:362` `resolveForgeSource()` | returns `{ok:false, reason}` | explicit said state — OK |
| `server.mjs:416` `main()` listen failure | prints the error, exits 2 | fail-loud — OK |
| `server.mjs:483` CLI-guard project resolution | `catch { /* degrades to uncomputable forge sections, never a crash */ }`, `project` stays `null` | commented, explicit said-unknown feeding a `?? null` default — OK |
| `forge-cache.mjs` | no `catch` blocks in this file | N/A |

Only `listChangeDirs()` matched the anti-pattern; every other catch site
either rethrows, records a said failure, or preserves the prior known
value with a comment explaining why. No further sibling found.

**Discrepancy found and NOT fixed this round (reported, not silently
patched)**: the task brief describing this round asserted `listChangeDirs()`
should be fixed "exactly as `activeWorktrees()`/`rescanWorktrees()` do." That
premise does not fully hold on inspection:

1. `activeWorktrees()` records the failure but still returns `[]`, the
   same ambiguous-empty sentinel `listChangeDirs()` used to return.
   `rescanWorktrees()` does not check for a "could not read" signal at
   all — it diffs `activeWorktrees()`'s result directly against
   `watchedWorktrees`, so a `git worktree list --porcelain` failure
   (transient `EMFILE`/process spawn failure, etc.) closes every
   currently-watched linked worktree exactly the way the pre-fix
   `listChangeDirs()` did, even though the failure IS recorded in
   `state().failed`. Recording the failure does not stop the
   reconciliation from running on the empty list.
2. `activeWorktrees()`'s `recordFailure('<git-common>/worktrees', err)`
   entry is never cleared on a later successful call — there is no
   `failed = failed.filter(...)` for that label anywhere in the
   success path, unlike the `CHANGES_ROOT` entry this round's fix
   clears explicitly in `rescanChangeDirs()`.

Both were real, untested gaps in `rescanWorktrees()` /
`activeWorktrees()`, not something this round introduced or was asked to
fix — the task scope and diff budget were specific to `listChangeDirs()`.
Recorded here as a follow-up finding; **fixed in round 7, commit
`f132056`** — `activeWorktrees()` now returns the same `null`-on-failure
sentinel `listChangeDirs()` returns, `rescanWorktrees()` skips
reconciliation on it, and the `<git-common>/worktrees` failure entry
clears on the next successful call (see "Seventh round" below).

**Files changed**: `brain/scripts/ui/watcher.mjs` (`listChangeDirs()`
returns `null` on failure and records it; `rescanChangeDirs()` skips
reconciliation on `null` and clears the failure entry on success),
`brain/scripts/ui/watcher.test.mjs` (one new test, one new `readdirSync`-
shaped spy helper `readdirThrowsFor()`).

**Verification**: `GIT_CONFIG_GLOBAL=/dev/null node --test
brain/scripts/ui/*.test.mjs` = 69/69 green, run 3 times identically (was
68/68 before this round's 1 new test). `GIT_CONFIG_GLOBAL=/dev/null npm
test` = 5410/5410 green, one full run (~31s; was 5409/5409 before this
round). `brain:repo:check` green before the commit; tree clean after.
Counted diff (excluding `.test.mjs`, `openspec/`, `.memory/`) against
`origin/feature/brain-ui...HEAD`: **947 / 1000** (was 926/1000 before
this round; this round's production delta in `watcher.mjs` is +24/-3
lines). Commit this round: `fc964900`. No push, no PR (per task
instructions) — branch `feat/issue-881-slice-2-stream` stays ahead of
its last-pushed state (origin still at `3fe0e510` before this round's
two commits).

## Seventh round — the `activeWorktrees()`/`rescanWorktrees()` follow-up finding, fixed in `f132056`

The sixth round's follow-up finding is fixed: `activeWorktrees()`
(`watcher.mjs:264`) recorded a `git worktree list` failure via
`recordFailure('<git-common>/worktrees', err)` but still returned `[]`,
and `rescanWorktrees()` diffed that empty list against `watchedWorktrees`
with no "could not read" check, so a failed `git worktree list
--porcelain` closed every linked-worktree watch as "vanished" — same
class as `fc964900`, same R881-9 violation. Its failure entry also never
cleared on a later success.

**Fix**: `activeWorktrees()` now returns `null` on failure (after
recording it), mirroring `listChangeDirs()`. `rescanWorktrees()` checks
for `null` first and returns immediately, skipping reconciliation and
leaving every current watch untouched, and clears the stale
`<git-common>/worktrees` failure entry on a later successful read
before reconciling.

**Test first (RED)**: one new test in `watcher.test.mjs` — start with
two linked worktrees (`alpha`, `beta`) watched, arm `_run` to throw
`ENOSPC` on the next `git worktree list` call, fire the
`<git-common>/worktrees` event, assert both worktree handles are still
open, `state().failed` carries a `<git-common>/worktrees` entry with
the ENOSPC message, and `state().ok` is `false`; then disarm `_run`,
fire the event again, and assert the failure entry is gone and
`state().ok` is `true`. RED confirmed against the pre-fix code: `alpha
stays open` failed — `1 !== undefined` (the handle really was closed).
GREEN after the fix: 14/14 in `watcher.test.mjs`.

**Mutation**: restored `catch { ...; return []; }` in `activeWorktrees()`
(production code only, test unchanged) — reproduced red on exactly the
new test (`a <git-common>/worktrees/ rescan that cannot list worktrees
keeps every currently-watched worktree open, then recovers`), all 13
other `watcher.test.mjs` tests stayed green. Restored the fix; 14/14
green again.

**Files changed**: `brain/scripts/ui/watcher.mjs` (`activeWorktrees()`
returns `null` on failure and records it; `rescanWorktrees()` skips
reconciliation on `null` and clears the failure entry on success),
`brain/scripts/ui/watcher.test.mjs` (one new test).

**Verification**: `GIT_CONFIG_GLOBAL=/dev/null node --test
brain/scripts/ui/*.test.mjs` = 70/70 green, run 3 times identically (was
69/69 before this round's 1 new test). `GIT_CONFIG_GLOBAL=/dev/null npm
test` = 5411/5411 green, one full run (~31s; was 5410/5410 before this
round). `brain:repo:check` green before the commit; tree clean after.
Counted diff (excluding `.test.mjs`, `openspec/`, `.memory/`) against
`origin/feature/brain-ui...HEAD`: **954 / 1000** (was 947/1000 before
this round; this round's production delta in `watcher.mjs` is +9/-2
lines). Commit this round: `f132056` (fix). No push, no PR (per task
instructions) — branch `feat/issue-881-slice-2-stream` stays ahead of
its last-pushed state (origin still at `3fe0e510`).

## Eighth round — `activeWorktrees()`'s `basename(path)` id collision, fixed in `7459836`

Targeted fix from the cold review of PR #971 on head `f21f649a` (REVISE,
one blocker), reproduced by the reviewer on a real repo: `activeWorktrees()`
(`watcher.mjs:267`) derived each linked worktree's tracking id as
`basename(s.path)`. `git worktree add /tmp/a/foo -b br1` then `git worktree
add /tmp/b/foo -b br2` land distinct admin dirs (`.git/worktrees/foo`,
`.git/worktrees/foo1`), but `git worktree list --porcelain` reports both
paths ending in `foo` with no id field, so both stanzas got id `foo`. In
`rescanWorktrees()`, the first worktree claimed `watchedWorktrees.set('foo',
A)`; the second hit `watchedWorktrees.has('foo')` and was skipped forever —
`.git/worktrees/foo1/logs` was never watched, so a commit in the second
worktree was invisible for the server's lifetime. Violates R881-3 "a commit
in a linked worktree is seen" (spec.md:64-66). The header comment at
`watcher.mjs:26-34` claimed the basename assumption was "confirmed against
this very repo's own linked worktrees" — true only absent a collision; it
was never actually exercised against two worktrees sharing a leaf name.

**Id source chosen**: kept `git worktree list --porcelain` for the path
list — this PR's file scope (`server.mjs`/`watcher.mjs`/`poller.mjs` only,
per the existing deviation note) excludes `collect.mjs`'s `parseWorktrees()`,
so switching to a porcelain-free admin-dir listing would have meant
reshaping `parseWorktreeStanzas()` and every `_run`-based test fixture with
no budget benefit. Instead, the id is resolved per-path by reading that
worktree's own `.git` file (`gitdir: <git-common>/worktrees/<id>`) — git's
own metadata, written once when the worktree is created, never a path
guess. A worktree whose `.git` file is unreadable or whose path is gone is
a said failure (`recordFailure()`, labelled `<git-common>/worktrees
(<path>)`) and is skipped, not silently dropped from the rest of the list —
the `evidence-reader-empty-on-failure` rule again, consistent with the
`null`-on-whole-list-failure contract `f132056` established for the
`git worktree list` call itself (unchanged this round).

**Test first (RED)**: one new test in `watcher.test.mjs` — two linked
worktrees whose paths share the leaf name `foo` (`.../a/foo`, `.../b/foo`),
admin ids `foo` and `foo1`, each given a real `.git` file via a new
`writeWorktreeGitFile()` fixture helper. After `start()`: assert both
`worktrees/foo/logs` and `worktrees/foo1/logs` are watched, then fire an
event on `foo1/logs` and assert it schedules a debounce and fires exactly
one recompute. RED confirmed against the pre-fix code: `the second "foo"
worktree (admin id foo1) is ALSO watched` failed — `false !== true` (only
`foo` was watched, `foo1` was silently skipped). GREEN after the fix:
15/15 in `watcher.test.mjs`. The four other worktree-fixture tests
(`alphaPath`/`betaPath`) were updated to also write real `.git` files via
the same helper, since `activeWorktrees()` no longer trusts `basename()`
and needs a readable `.git` file to resolve an id at all.

**Mutation**: restored `parseWorktreeStanzas(stdout).slice(1).filter((s) =>
!s.bare).map((s) => ({ path: s.path, id: basename(s.path) }))` in place of
the fixed `activeWorktrees()` body (production code only, test unchanged)
— reproduced red on exactly the new test (`two worktrees whose paths share
a leaf name ("foo") are both watched under their own admin-dir ids`), all
14 other `watcher.test.mjs` tests stayed green. Restored the fix; 15/15
green again.

**Files changed**: `brain/scripts/ui/watcher.mjs` (`activeWorktrees()`
resolves each worktree's id from its own `.git` file instead of
`basename(path)`; header comment at lines 26-34 rewritten to state the
collision risk instead of a false "confirmed" claim; `_readFile` injectable
added, defaulting to `readFileSync`), `brain/scripts/ui/watcher.test.mjs`
(one new `writeWorktreeGitFile()` fixture helper, one new test, four
existing worktree tests updated to write real `.git` files).

**Verification**: `GIT_CONFIG_GLOBAL=/dev/null node --test
brain/scripts/ui/*.test.mjs` = 71/71 green, run 3 times identically (was
70/70 before this round's 1 new test). `GIT_CONFIG_GLOBAL=/dev/null npm
test` = 5412/5412 green, one full run (~31s; was 5411/5411 before this
round). `brain:repo:check` green before the commit; tree clean after.
Counted diff (excluding `.test.mjs`, `openspec/`, `.memory/`) against
`origin/feature/brain-ui...HEAD`: **977 / 1000** (was 954/1000 before this
round; this round's production delta in `watcher.mjs` is +23 lines, no
deletions — the whole file is new relative to `origin/feature/brain-ui`,
so `git diff --numstat` reports its full line count each round, not just
the round's own delta). Commit this round: `7459836` (fix). No push, no PR
(per task instructions) — branch `feat/issue-881-slice-2-stream` stays
ahead of its last-pushed state (origin still at `3fe0e510`).

## Ninth round — a linked worktree's `.git` file was still a Tier boundary violation; the id now comes from `<git-common>/worktrees/*/gitdir`, fixed in `d8a311d6` + `fcbb4e60`

Targeted fix from a fresh-context review before push, round 8 of PR #971
(head `3223fbd5`). Two findings:

1. (Blocking) `activeWorktrees()` (`watcher.mjs:284`, the eighth round's
   own fix) read `join(s.path, '.git')` — a file under the LINKED
   WORKTREE'S OWN ROOT. R881-3 (`spec.md:54-60`) is an allow-list of what
   the watcher may read, and a worktree path was never on it. The eighth
   round's fix traded a path-basename guess for a read that stayed inside
   the letter of "committed tier" in spirit (git-written metadata) but not
   in the spec's actual text, and the code was silent on that gap.
2. `_readFile` was injectable but never overridden in `watcher.test.mjs` —
   the "malformed/unreadable `.git` file is a said failure, the other
   worktree stays watched" behaviour had no committed test.

**Fix chosen**: git stores, for every linked worktree, a `<git-common>/
worktrees/<id>/gitdir` file whose one line is `<worktree-path>/.git`. Build
the path→id map by listing `<git-common>/worktrees/` (an `_readdir`
already-injectable seam) and reading each entry's `gitdir` file — never
anything under the worktree's own path. Every read now stays inside
`<git-common>/`, which is git's own metadata, never a working tree. A
`gitdir` that is missing, unreadable, or malformed is a said failure
(`recordFailure()`, label `<git-common>/worktrees/<id>/gitdir`) for that
one admin entry and is skipped, not silently dropped from the rest of the
scan. A porcelain path left unmatched after every admin entry is read is
said too (same generic `<git-common>/worktrees` label, message naming the
path) — never silently dropped. Dropped the `_readFile`-of-`<worktree>/
.git` path entirely and the now-unused `basename` import; `_readFile`
itself stays, reused for the admin-dir `gitdir` reads.

**Fixture change**: `writeWorktreeGitFile()` now writes `<git-common>/
worktrees/<id>/gitdir` (content `<path>/.git\n`) instead of `<worktree>/
.git`, and no longer creates the worktree's own directory at all — nothing
under a worktree path is read anymore, so nothing needs to exist there.
`makeGitCommonFixture()` no longer pre-creates `worktrees/alpha/logs` and
`worktrees/beta/logs` unconditionally: under the new `_readdir`-based
resolution those phantom admin dirs (no `gitdir` file) would surface as
spurious read failures in every test that reuses the fixture without
actually wanting alpha/beta as worktrees — including the exact-array
`state().failed` assertion at the `fs.watch` ENOSPC test, which would have
broken. `makeGitCommonFixture()` now creates an empty `worktrees/` dir;
`writeWorktreeGitFile()` populates it per test.

**RED/GREEN evidence**: updated `writeWorktreeGitFile()` and
`makeGitCommonFixture()` first, production code untouched — 5 tests failed
red (`false !== true` continuity — `_watch.calls.some(...)` for
`alphaLogs`/`betaLogs`/`foo1Logs` and the two retry/rescan assertions),
because the fixture no longer wrote `<worktree>/.git` and production still
read it. Added two new tests (also red under old production: a malformed
`gitdir` and an unmatched porcelain path). Rewrote `activeWorktrees()` and
removed the now-redundant clear-on-recover line in `rescanWorktrees()`
(that responsibility moved into `activeWorktrees()` itself, since it now
also records failures for the *mismatch* case, not just the list-command
case) — GREEN: 17/17 in `watcher.test.mjs`.

**Mutation**: dropped the `recordFailure(label, err)` call in the
`gitdir`-read catch block, so a malformed/unreadable `gitdir` was silently
skipped instead of said — reproduced red on exactly the new "a worktree
whose gitdir file is malformed is a said failure" test, all 16 other
`watcher.test.mjs` tests stayed green. Restored the fix; 17/17 green
again. Run against the final (diff-tightened) shape of `activeWorktrees()`.

**Diff-budget correction**: the first shape of this fix (commit
`d8a311d6`) grew `watcher.mjs` by a net +28 production lines — over the
"~15 lines" ceiling — and pushed the counted diff to **1005/1000**, over
budget. A same-session follow-up commit (`fcbb4e60`) tightened it: dropped
a redundant `anyGitdirReadFailed`-style guard that existed only to avoid a
second, more generic failure entry alongside a specific `gitdir`-read
failure for the same worktree — the tests assert failure presence via
`.some()`, never array-length or entry-count, so recording both a specific
`.../gitdir` failure and the generic "no admin entry matches" failure for
the same unmatched path costs no coverage — and trimmed the JSDoc/comments
to state the same facts more tersely. Net production growth from the
eighth round's baseline is now **+10 lines**; counted diff is
**987/1000**.

**Source guard**: `rg -n "join\(s\.path|\.path, '\.git'" brain/scripts/
ui/watcher.mjs` returns no matches, confirmed after both commits.

**Spec alignment**: R881-3 (`spec.md:54-60`) previously enumerated `.git/
HEAD` and `.git/worktrees/*/HEAD` — stale even before this round, since the
watcher (design.md Q3) watches `logs/` reflogs, not `HEAD` files directly,
and never read `worktrees/*/gitdir` at all until now. Rewrote the list to
what the watcher actually reads: the git common dir's own metadata
(`HEAD`, `logs/`, `worktrees/*/HEAD`, `worktrees/*/logs/`,
`worktrees/*/gitdir`), `openspec/changes/**`, `.memory/records/**`; kept
the "no working-tree content, not even a linked worktree's own `.git`
file" sentence. `design.md`'s Q3 table (`Watched directory | Catches`)
enumerates directories `fs.watch` is bound to, not the smaller set of
files the watcher additionally *reads* synchronously during a rescan
(`gitdir` is read, never watched) — it did not duplicate R881-3's stale
wording and needed no matching edit this round.

**Verification**: `GIT_CONFIG_GLOBAL=/dev/null node --test
brain/scripts/ui/*.test.mjs` = 73/73 green, 3 identical runs (was 71/71
before this round's 2 new tests). `GIT_CONFIG_GLOBAL=/dev/null npm test` =
5414/5414 green, one full run (~31s; was 5412/5412 before this round).
`brain:repo:check` green before each commit; tree clean after. Counted
diff (excluding `.test.mjs`, `openspec/`, `.memory/`) against
`origin/feature/brain-ui...HEAD`: **987/1000** (was 977/1000 before this
round). Commits this round: `d8a311d6` (fix), `fcbb4e60` (diff-tightening
refactor), plus this docs commit. No push, no PR (per task instructions) —
branch `feat/issue-881-slice-2-stream` stays ahead of its last-pushed
state.

## Tenth round — seventh cold review of PR #971 (head `bf41ec05`, 2026-09-14): two Tier-boundary blockers, fixed in `b8030800` + `b2edf7dc`

Between the ninth round and this one, `bf41ec05` dropped the `HEAD` entries
from R881-3's list that the watcher never reads (a pre-push fresh review
caught the self-contradiction). The cold review on that head then found:

**cold-1 (blocker, `watcher.mjs`)**: a repository that has never had a
linked worktree has no `<git-common>/worktrees/` directory until the first
`git worktree add`. `start()`'s watch on it and `activeWorktrees()`'s
readdir both failed with ENOENT, `state()` showed two failed entries, and
nothing could repair it: only the `<git-common>/` watch could notice the
directory appearing, and `onFire()` rescanned worktrees only for
`kind === 'worktrees'`. The first worktree ever created in the life of a
long-running server was invisible. Fix: ENOENT on the admin dir is "no
worktrees yet", a fact, not a read failure (any other error keeps the
`null` contract of `f1320560`); the common dir's own event opens the
worktrees watch when the directory exists and runs the rescan. Test: a
fixture WITHOUT `worktrees/` starts `ok`, then `worktrees/alpha/{logs/,gitdir}`
appears, the common-dir event fires, and an event on `alpha/logs/` reaches
the callback. RED before, GREEN after; mutation: removing the
open-on-common-dir-event call turns exactly that test red.

**cold-2 (blocker, `server.mjs`)**: the branch name of a worktree was
resolved with `git -C <worktree> rev-parse --abbrev-ref HEAD`, and strace
shows `git -C` opens `<worktree>/.git` first — the file R881-3 forbids by
name. Fix: `git --git-dir <git-common>/worktrees/<id> rev-parse
--abbrev-ref HEAD` for a linked worktree, and a plain `git rev-parse
--abbrev-ref HEAD` with no `--git-dir` flag (default cwd) for the primary —
correct, not an oversight, because the primary checkout's own `.git`
directory already IS the common dir, so no separate `--git-dir` is needed;
the watcher hands the server the worktree's admin id. strace on
this repository's own linked worktree: every `openat` is under
`/home/gandalf/IA/brain/.git/`, none under `/home/gandalf/IA/brain-issue-881/`.
The refs-frame tests now assert the exact argv; mutation: restoring `-C`
turns exactly those two tests red.

**Spec**: R881-3 regains `worktrees/*/HEAD`, "read by `git --git-dir` for
the branch name, never through the worktree" (`5c8a2890`); the watcher
itself still watches `logs/`, not `HEAD`.

**Budget**: the counted diff reached 1000 after cold-1 and closed at
985 after cold-2 by trimming `watcher.mjs`'s header comment (27 lines of
prose to a shorter version that keeps every citation); the non-comment
diff of that trim is empty, checked by the pre-push review.

**Verification**: `GIT_CONFIG_GLOBAL=/dev/null node --test
brain/scripts/ui/*.test.mjs` = 75/75, three identical runs (was 73/73);
`GIT_CONFIG_GLOBAL=/dev/null npm test` = 5416/5416; `brain:repo:check`
green before each commit. Counted diff 985/1000. Pre-push fresh review of
these commits: APPROVE on the code, with this entry as its one finding.

---

## PR 3 / B1 (partial) — the pure page logic, `ui/lib/**` only (2026-09-15)

Branch `feat/issue-881-slice-3-lib`, on top of `1d2c6f09` (= PR 1 `8d074e44`
+ PR 2 squash-merged into the tracker `feature/brain-ui` as `origin/feature/
brain-ui`, plus `origin/main`). This run's scope, set by the orchestrator
for exactly this reason (see "Scope decision" below): the six pure modules
`design.md`'s D8 module map lists under `ui/lib/**` (T1–T6), plus the two
cross-cutting guard/property tests (T8/T9). `change-route.mjs` (T7) —
tasks.md's other PR 3 file, the one that does IO (`_read`/`_run`) — is
explicitly OUT of this run and deferred to a follow-up apply batch.

### Scope decision: why `change-route.mjs` was left out, not a budget cut

Unlike every earlier round in this file, this was not a diff-budget
split — the counted diff at the end of this run is 472/1000, with ~530
lines of headroom still open. The split is structural: design.md's D8
table draws `lib/` as "pure, imported by the browser AND by node:test" —
`layout.mjs`, `spec-cards.mjs`, `tasks-list.mjs`, `blame.mjs`,
`resume-view.mjs`, `colour.mjs`. `change-route.mjs` sits OUTSIDE that
directory in the same table, described as "the drawer's IO (injected
`_read`/`_run`)" — it is not one of the modules `static/app.js` imports
directly (PR 4's job), and it is the one file in tasks.md's PR 3 file list
that is not "the pure page logic" by the design's own words. The
orchestrator's task order named five modules explicitly and "whatever
provenance/shaping module the design names" for the sixth — resolved here
as `blame.mjs`, the only other `lib/` entry in D8's table, whose job (Q2)
is exactly shaping git-blame porcelain into provenance-carrying per-line
attribution.

### T1–T6 — tasks done, with commit SHAs

| Task | What | Commit |
|---|---|---|
| — | docs(sdd): correct the tenth round's claim about the primary checkout's branch resolution (exception A, cold review of #971 rev on `f46782f6`) | `b902a811` |
| — | refactor(ui): `watcher.mjs` imports `parseWorktrees` from `memory/lane/collect.mjs` instead of a diverging copy (exception B, carried from PR 2's review) | `727e026a` |
| T1a/T1b | `layout.mjs` + test — DFS back-edge reversal, longest-path layering, 4-sweep barycentre ordering, coordinates | `f5a00d8f` |
| T2a/T2b | `colour.mjs` + test — exhaustive roadmap-state/node-status → CSS-class map | `381d0aef` |
| T3a/T3b | `spec-cards.mjs` + test — `spec.md`'s requirement/scenario grammar | `81504af5` |
| T4a/T4b | `tasks-list.mjs` + test — `tasks.md`'s checklist grammar, attribution injected | `5d3cc9f3` |
| T5a/T5b | `blame.mjs` + test — pure `git blame --porcelain` parser | `2c03b5d8` |
| T6a/T6b | `resume-view.mjs` + test — shapes parsed `resume.md` frontmatter | `125e3f23` |
| T8/T9 | source-guard test + A3 provenance property test (scoped to T1–T6's modules) | `c71313cd` |
| T7a/T7b | **deferred** — `change-route.mjs`, out of this run's scope (see above) | — |
| T10 | Verify: full suite + `brain:repo:check` green | (this docs commit) |
| T11 | `npm run memory:save` — `rec-9cf68574b1310920` | `236e5b75` |

### TDD Cycle Evidence

Strict TDD was followed for every module: the test file was written and
run first (RED, `ERR_MODULE_NOT_FOUND` or an assertion failure against
code that did not yet exist), then the implementation (GREEN), then one
targeted mutation per module to prove the test actually pins the behaviour
it claims to (REFACTOR — the mutation was reverted after confirming red,
no production code changed by the mutation round-trip).

| Module | RED | GREEN | Mutation (targeted, reverted) |
|---|---|---|---|
| `source-guard.test.mjs` | 3/3 fail — `lib/` had zero non-test modules yet | 3/3 pass once `layout.mjs` existed | N/A — this file IS the guard; its own regression coverage is the modules that follow it staying inside the boundary |
| `layout.mjs` | `ERR_MODULE_NOT_FOUND` (no `layout.mjs`) | 8/8 pass | dropped the back-edge reversal (`{from:n,to}` instead of `{from:to,to:n}`) — the cycle test's pinned `layer(1)===0` assertion went red; reverted, 8/8 green |
| `colour.mjs` | `ERR_MODULE_NOT_FOUND` | 5/5 pass | removed the `blockedBy`-length override branch — "blocked overrides state colour" went red; reverted, 5/5 green |
| `spec-cards.mjs` | `ERR_MODULE_NOT_FOUND` | 6/6 pass | forced `complete = true` unconditionally on WHEN — the "WHEN but no THEN" test went red; reverted, 6/6 green |
| `tasks-list.mjs` | `ERR_MODULE_NOT_FOUND` | 7/7 pass | dropped `.toLowerCase()` on the checkbox marker — the `- [X]` (uppercase) case went red; reverted, 7/7 green |
| `blame.mjs` | `ERR_MODULE_NOT_FOUND` | 5/5 pass | dropped the commit-metadata cache reuse (`commits.get(current.sha) ?? {}` → `{}`) — the repeated-commit-line assertion went red; reverted, 5/5 green |
| `resume-view.mjs` | `ERR_MODULE_NOT_FOUND` | 5/5 pass | genericized the per-field failure reason (dropped the field name) — two tests asserting the field name in the reason went red; reverted, 5/5 green |
| `provenance.test.mjs` | N/A — composes already-implemented modules, no new production code | 3/3 pass on first write | dropped `source` from a `spec-cards.mjs` scenario object — the property test caught it (1/3 red); reverted, 3/3 green |

### Verification

`GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/lib/*.test.mjs` =
42/42 green. `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/*.test.mjs
brain/scripts/ui/lib/*.test.mjs` = 117/117 green (was 75/75 before this
run's 42 new tests). `GIT_CONFIG_GLOBAL=/dev/null npm test` = 5478/5478
green, one full run (~37s). `brain:repo:check` green before every commit;
tree clean after each. Counted diff (excluding `.test.mjs`, `openspec/`,
`.memory/`) against `origin/feature/brain-ui...HEAD`: **472/1000**.

### Deviations from tasks.md / design.md

1. **T7 (`change-route.mjs`) deferred** — see "Scope decision" above; not a
   budget cut, a structural one drawn by the orchestrator's task order.
2. **`provenance.test.mjs` lives at `brain/scripts/ui/lib/provenance.test.mjs`**,
   not `brain/scripts/ui/provenance.test.mjs` as tasks.md's T9 originally
   named it — it composes only `lib/` modules this run (no `change-route.mjs`
   to reach outside `lib/` for), so it colocates with them; `tasks.md`'s own
   T9 line is corrected to match.
3. **`layout.mjs`'s edge `points`** are always exactly two endpoints (start,
   end), including for a layer-skip > 1 edge — design.md says "for a layer
   skip > 1, straight-line points; no spline routing in v1," read here as
   "still a straight line, no curve," which two endpoints already draw; no
   extra midpoints were added since nothing in R881-7 or the test plan (A1)
   requires more than two.
4. **`colour.mjs`'s priority order** (unreadable → not-computed → blocked →
   awaiting-human → unclassified → roadmap state) is a design decision this
   run makes explicit: R881-6's prose states the roadmap-state base colour
   plus two named overrides (blocked, awaiting-review/approval) but does not
   spell out the full ordering over all eight constants the D9-note's
   exhaustive test requires covering. `awaiting-review/approval` is read as
   `node.status === 'awaiting-human'` (epic-graph.mjs's own name for exactly
   that state); `unclassified` (no declaring source at all) gets its own
   mark rather than falling through to a roadmap state that describes a node
   nothing ever placed.
5. **Scope** — no file outside this run's stated boundary
   (`brain/scripts/ui/lib/**` plus the two named exceptions, `watcher.mjs`
   and `memory/lane/collect.mjs`) was touched, except `tasks.md`/
   `apply-progress.md` bookkeeping and the one memory record.

No push, no PR (per task instructions) — branch `feat/issue-881-slice-3-lib`
has not been pushed this run.

---

## PR 3 / B1 — T7 completes, PR 3 done (2026-09-15, follow-up run)

Branch `feat/issue-881-slice-3-lib`, on top of the previous run's head
(`4a8bc16e`). Scope this run: exactly the deferred T7 — `change-route.mjs`
(`GET /api/change/{issue}`), its dedicated test file, the `server.mjs`
route wiring, and `provenance.test.mjs`'s change-route property coverage —
per the fence the "Scope decision" section above drew. No other file
touched.

### T7 — task done, with commit SHA

| Task | What | Commit |
|---|---|---|
| T7a/T7b | `change-route.mjs` + `change-route.test.mjs` + `server.mjs` route wiring + `provenance.test.mjs` extension | `90699431` |

`change-route.mjs` composes the six `ui/lib/**` shapers this slice already
shipped (`spec-cards`, `tasks-list`, `blame`, `resume-view`) with
`snapshot.changes`/`prs`/`reviews` into the four R881-8 tabs — Spec, Tasks,
Working memory, Reviews — every leaf inside a tab's `value` carrying
`source` (A3, D11). `server.mjs` adds `GET /api/change/<N digits>` through
the existing method-check-before-routing path (a non-numeric id falls
through to the existing 404; a mutation method to the existing 405) and a
new `KNOWN_ROUTES` entry, `'/api/change/{issue}'` — the R881-10 S3 route-
table assertion in `server.test.mjs` was updated to match.

**Design decisions this run had to make, not spelled out verbatim in
design.md:**

1. **`project` is an added, optional parameter** to `buildChangeView`
   (`{root, issue, snapshot, project, _read, _run, _exists}`) — D8's module
   map lists `change-route.mjs`'s signature as `{root, issue, snapshot}`
   plus the injected `_read`/`_run`, but D14 requires a PR URL
   (`https://<host>/<project>/pull/<pr>`) and `project` is the only fact
   that can build one; `server.mjs` already threads it to `buildMeta()`.
   Defaults to `null`, degrading to a relative `pull/<n>` reference (still
   a non-empty `source.url`, never a crash) rather than throwing.
2. **Per-task `attribution` leaf, distinct from `actor`/`ts`.** The T7a
   task list asked for "attribution `{ok:false, reason}` per row, never
   dropped" on a blame failure, but `tasks-list.mjs` (shipped last run,
   out of this run's file fence) only accepts an `attribution` INPUT array
   of `{line, actor, ts}` and always renders `actor: 'unknown'` on a miss
   — it has no `{ok, reason}` output shape of its own. `change-route.mjs`
   post-processes every returned item, attaching its own `attribution:
   {ok:true, value:{actor, ts}} | {ok:false, reason}` field beside the
   existing `actor`/`ts` fields — the checklist itself still renders in
   full either way (never dropped), and the failure is now said per row,
   not folded into "unknown" silently.
3. **`noChangeDirTab`'s reason and `source.path`** use the literal glob
   `openspec/changes/issue-<N>-*` for both Spec and Tasks — matching the
   brief's exact reason text verbatim, so a reviewer or an operator can
   copy it into a shell glob and get the real answer.
4. **Reviews tab's `sourceNote`** is `'forge comments until #880 lands'` —
   the "What T7 delivers" section's exact string, not design.md's D14
   prose ("source: forge comments, until #880 lands `type: review`
   records") nor the brief's `spec.md`-input paraphrase ("source: forge
   comments until #880"). One literal string, exported as
   `REVIEWS_SOURCE_NOTE`, used by both the tab and its tests.

### TDD Cycle Evidence

RED confirmed by the established "move-aside" technique (`change-route.mjs`
moved to `/tmp`, all three consuming test files — `change-route.test.mjs`,
`provenance.test.mjs`, `server.test.mjs` — failed with `ERR_MODULE_NOT_FOUND`
against the same, already-written-first test files), then restored (GREEN).

| Unit | RED | GREEN | Mutation (targeted, reverted) |
|---|---|---|---|
| `change-route.mjs` (all four tabs, 10-case fixture matrix + 2 top-level guards) | `ERR_MODULE_NOT_FOUND` across `change-route.test.mjs`, `provenance.test.mjs`, `server.test.mjs` (57 tests) | 57/57 pass, stable across 3 consecutive runs | (1) dropped `HEAD` from the blame argv → 2 tests red (`change-route.test.mjs` case 6, `server.test.mjs`'s parity/argv test); reverted, 57/57 green. (2) `noChangeDirTab` collapsed to `{ok:true, value:[]}` → 2 tests red (`change-route.test.mjs` case 4, `provenance.test.mjs`'s "no change dir" leaf test); reverted, 15/15 (subset) green. (3) dropped the `names.length > 1` ambiguity check → 1 test red (`change-route.test.mjs` case 3, "two matching branches"); reverted, 11/11 (subset) green. |

One genuine test bug found and fixed while writing the tests (not a
production defect): `current_slice` in the resume.md fixture parses as the
STRING `'3'`, not the number `3` — `resume-frontmatter.mjs`'s
`parseFrontmatter` does no type coercion on scalars (confirmed against its
own `resume-frontmatter.test.mjs`, which asserts string values
throughout). Two assertions in `change-route.test.mjs` that wrote `value:
3` were corrected to `value: '3'`.

### Verification

`GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/change-route.test.mjs
brain/scripts/ui/lib/provenance.test.mjs brain/scripts/ui/server.test.mjs` =
57/57 green, 3 consecutive runs, no flake. `GIT_CONFIG_GLOBAL=/dev/null
node --test brain/scripts/ui/**/*.test.mjs brain/scripts/ui/*.test.mjs` =
132/132 green (was 117/117 before this run's 15 net new tests).
`brain:repo:check` green before the commit; tree clean after. Counted diff
(excluding `.test.mjs`, `openspec/`, `.memory/`) against
`origin/feature/brain-ui...HEAD`, measured directly after this run's
commit: **687/1000**, still well inside the lite-tier 1000-line/PR budget
(this run's two production files: `change-route.mjs` +196/-0, `server.mjs`
+18/-1, on top of the previous run's 472).

### Deviations from tasks.md / design.md

Superseding deviation 1 from the previous section ("T7 deferred"): T7 is
now complete. The four numbered design decisions above (this section) are
the only new deviations this run introduces; deviations 2-5 from the
previous section stand unchanged.

### PR 3 status: COMPLETE

All of T1-T11 are `[x]` in `tasks.md`. PR 3 / B1 — the pure page logic — is
done: `lib/**`'s six modules, the source-guard and provenance property
tests, and `change-route.mjs`'s composition of all four over the real
route table. PR 4 (B2, the page) can now build against a complete `GET
/api/change/{issue}` contract.

No push, no PR (per task instructions) — branch `feat/issue-881-slice-3-lib`
has not been pushed this run.

## Slice 3 — pre-push fresh review (2026-09-16): one blocker, three minors

**Blocker, `change-route.mjs` `buildReviewsTab`**: a per-PR review row that
`reviewRows` marked `{ok:false, reason}` was skipped with `continue`, so the
tab came back `ok:true` with an empty list — the reading of "no rounds ever
posted" (`evidence-reader-empty-on-failure.md`, R881-9). Fixed in `bdfe86f8`:
the tab carries `unreadable: [{pr, ok:false, reason, source:{url}}]` beside
the readable rounds and is `ok:false` naming every thread when none could be
read; the provenance property walks the new entries. Two tests red first;
mutation: restoring the `continue` turns exactly those two red.

**Minor, `source-guard.test.mjs`**: the forbidden-pattern list omitted
`import.meta`; `51f0b06c` adds it, proven by injecting `import.meta.url` into
`colour.mjs` (red) and restoring (green).

**Minor, `layout.mjs`**: an edge to a number that is not a node was filtered
silently; `caeee362` reports it in `droppedEdges: [{from, to, reason}]`, nodes
still never dropped. Test first; mutation: emptying the collection turns
exactly that test red.

**Minor, left as is**: `colour.mjs` throws on an unknown state, deliberately.
PR 4's renderer MUST catch per node so one unknown state cannot blank the
canvas.

Counts after this round: 135 tests under `ui/`, counted diff 699/1000.

---

## PR 4 / B2 — the page (2026-09-16)

Branch `feat/issue-881-slice-4-page`, on top of `21a37c21` (= the tracker
`origin/feature/brain-ui`: PR 1 #964 + PR 2 #971 + PR 3 #979 + `main`). Scope
this run: exactly tasks.md's PR 4 fence — `static/index.html`,
`static/app.js`, `static/app.css`, the four test files it names, and the
static-serving path in `server.mjs` that T1b makes a prerequisite. One
disclosed exception outside the fence, below.

### Tasks done, with commit SHAs

| Task | What | Commit |
|---|---|---|
| T1a/T1b (part) | static allow-list in `server.mjs` + `server.test.mjs` extension, the `index.html` shell, `app.css`, `app.js`'s bootstrap, `lib/frames.mjs` + test, `app-source-guard.test.mjs` | `2ac7db0e` |
| T3a/T3b | `lib/banners.mjs` + test, the two bands + the poll indicator and its two controls in `app.js`, `degradation-banner.test.mjs` | `ba48d759` |
| T2b (canvas) | `lib/canvas-model.mjs` + test, the SVG renderer in `app.js` | `5ea7dca1` |
| T2b (drawer) | `lib/drawer-model.mjs` + test, the four-tab drawer in `app.js` | `f6595e82` |
| T4 | `no-management-views.test.mjs` | `83c04547` |
| — | exception: `www.w3.org` allowlisted in `lib/shipped-hostnames.mjs` (see deviations) | `7795885b` |
| T5 | manual walkthrough (below) | (this docs commit) |
| T6 | full suite + `brain:repo:check` green | (this docs commit) |
| T7 | `npm run memory:save` — `rec-aaeb5b317c39db5e` | `1e88ab96` |

### The module split: why `app.js` is 315 lines of wiring and nothing else

Rule 3 of slice 2/3's review lessons ("pure logic stays in `lib/`") is what
shapes this PR. `app.js` has no `node:test` and no DOM harness exists in this
repo, so every decision the page makes was moved into a `lib/*.mjs` module
with its own test, under the same D9 source guard:

| Module | Owns | Tests |
|---|---|---|
| `frames.mjs` | the SSE reducer: `sync` / `section` / `refs` / `status`, plus `sectionOf` | 10 |
| `banners.mjs` | the two degradation sentences, the failed-section list, the poll indicator | 12 |
| `canvas-model.mjs` | `layout` + `colour` per node, the marks, the dropped/unreadable lists | 7 |
| `drawer-model.mjs` | the four R881-8 tabs in one entry shape, `sourceLabel` (A3) | 12 |

What is left in `app.js` is element creation, listeners and two `fetch`
calls. The three scan tests (`app-source-guard`, `degradation-banner`,
`no-management-views`) assert the properties of that file a value assertion
cannot reach.

### TDD Cycle Evidence

| Unit | RED | GREEN | Mutation (targeted, reverted) |
|---|---|---|---|
| static routes (`server.test.mjs` +4 tests) | 4 fail — `/app.js`, `/app.css`, `/lib/*.mjs` all 404, `KNOWN_ROUTES` short by three | 44/44 | `LIB_MODULE_RE` loosened to `/^\/lib\/(.+)\.mjs$/` → the allow-list test goes red (`/lib/layout.test.mjs` becomes servable); reverted, 44/44 |
| `app-source-guard.test.mjs` | 4/4 fail — `static/app.js` did not exist | 4/4 | N/A — this file IS the guard; its own regression cover is the page staying inside the boundary |
| `frames.mjs` | `ERR_MODULE_NOT_FOUND` | 10/10 | `data.meta ?? state.meta` → `data.meta ?? null` — "the REST read must not erase the meta" goes red; reverted, 10/10 |
| `banners.mjs` | `ERR_MODULE_NOT_FOUND` | 12/12 | "press Refresh" → "press refresh" — 2 tests red across both files; reverted, 16/16 |
| `degradation-banner.test.mjs` | red against the pre-wiring `app.js` | 4/4 | `degradationBands(...)` call replaced by `[]` in `app.js` — the wiring test goes red; reverted |
| `canvas-model.mjs` | `ERR_MODULE_NOT_FOUND` | 7/7 | the per-node `try/catch` around `colourClass` removed — "one unknown state cannot blank the canvas" goes red (the whole model throws); reverted, 7/7 |
| `drawer-model.mjs` | `ERR_MODULE_NOT_FOUND` | 12/12 | (1) the failed Reviews tab stops carrying `unreadable` entries → red; (2) `sourceLabel` degrades to `''` → the A3 property goes red; both reverted, 12/12 |
| `no-management-views.test.mjs` | — (absence guard, green on arrival) | 5/5 | a `readRoadmapView()` fetching `/api/roadmap` added to `app.js` → red; reverted, 5/5 |

One test bug found while writing, no production defect: the first version of
the source guard forbade every `https?://` in `app.js`, which the SVG
namespace constant `createElementNS` requires literally. The guard now pins
that ONE string as the only absolute URL the page may contain, asserted as a
set equality rather than an absence — a stricter shape than the one it
replaced.

### T5 — the manual walkthrough (no browser was driven)

`node brain/scripts/ui/server.mjs --port 0 --root /home/gandalf/IA/brain-issue-881
--interval 5000`, listening on 39669, with a real `gh` on this machine. Killed
by its recorded PID afterwards (never `pkill -f`); a second server on
`/tmp/.../noforge` for the degraded case, killed the same way.

| Request | Status | Content-type |
|---|---|---|
| `GET /` | 200 | `text/html` |
| `GET /app.js` | 200 | `application/javascript` |
| `GET /app.css` | 200 | `text/css` |
| `GET /lib/layout.mjs` | 200 | `application/javascript` |
| `GET /lib/canvas-model.mjs` | 200 | `application/javascript` |
| `GET /lib/drawer-model.mjs` | 200 | `application/javascript` |
| `GET /lib/nope.mjs` | 404 | `text/plain` |
| `GET /lib/%2e%2e/server.mjs` | 404 | `text/plain` |
| `GET /index.html` | 404 | `text/plain` |
| `GET /api/snapshot` | 200 | `application/json` |
| `GET /api/change/881` | 200 | `application/json` |
| `POST /api/poll/pause` | 200 | `{"paused":true,...}` |
| `POST /api/poll/once` | 200 | `lastPolledAt` advanced 7 s later |
| `POST /api/poll/resume` | 200 | — |
| `GET /api/stream` (`curl -N --max-time 5`) | 200 | one `event: sync` frame, 554 289 bytes, carrying `snapshot` AND `meta` (`watcher {ok:true, watched:141}`, `poller.paused:false`, `project csrinaldi/brain`) |

**No browser was driven — no DOM runner exists in this repo.** What replaced
it: the live `/api/snapshot` and `/api/change/881` bodies were rendered
through the exact modules the browser imports, in node.

* canvas: `ok:true`, **91 nodes drawn for 91 open issues** (none filtered),
  7 edges, 81 in the unlinked band, 12 edges to closed issues reported in
  `droppedEdges`, 0 unreadable bodies. Classes:
  `status-unclassified` 67, `state-planned` 18, `status-blocked` 6.
  **67 nodes marked `? track`**, **0 nodes fell to `node-unknown`** — the
  colour map covers everything this repo's graph currently produces.
* drawer for #881: `changeDir openspec/changes/issue-881-ui-server-canvas`,
  Spec **10 cards**, Tasks **53 rows**, Working memory `ok:false` with the
  true reason (`more than one feat/issue-881-* branch in this clone: ...`),
  Reviews read and empty (this issue's open PRs carry no posted round yet),
  with its `forge comments until #880 lands` note. **91 leaves, 0 without a
  source** (A3).
* degraded case (second server, a repo with no openspec tree): the canvas
  still drew, and the bands said the watcher failure verbatim with the failed
  path, plus `5 snapshot section(s) could not be computed` naming
  `changes`, `records`, `adrs`, `actors`, `drift` with their reasons
  (R881-9 S1).
* poll indicator over the real poller state: `polling is paused — forge
  polled 27 s ago`.

**Width after the band wrap.** The finding below was fixed on this branch
(`366b3ed2`): `layout.mjs` now wraps the unlinked band into
`max(1, ceil(sqrt(n)), widest layer)` columns. The same live rendering was
re-run afterwards — a server on port 0 over this worktree, its `/api/snapshot`
fed through `canvas-model.mjs`, killed by its recorded PID — and the canvas is
now **1960 x 1380 px** for 92 nodes and 82 unlinked (10 columns), against
**16 160 x 420 px** before. Nothing was dropped: the node count, the unlinked
count and the 7 edges are unchanged. Note that `--no-poll` cannot produce this
measurement at all — without a forge poll the graph section is `{ok:false}`
("the first forge poll has not completed") and the canvas model refuses to
build, so this run polled for real exactly as the walkthrough above did.

**What the maintainer still has to confirm by eye** (the honest N/A, per the
work-unit checklist): open `http://localhost:3000` once after `npm run
brain:ui` and check that the canvas paints, that clicking a node opens the
drawer, and that the four tab buttons switch. T5's sub-case (d) — renaming a
watched directory to force `fs.watch` to fail — was NOT run against a live
worktree; the band it produces is pinned by `banners.test.mjs` and its
`{ok:false}` input is pinned by `watcher.test.mjs`, and the degraded run
above rendered exactly that band from a synthetic watcher state.

### Verification

Numbers as of the pre-push review round below (2026-09-16), which is the
state of the branch today; the figures this section carried before that round
were 5554/5554 and 892/1000, and the band wrap plus the six review fixes have
moved both.

`GIT_CONFIG_GLOBAL=/dev/null npm test` = **5564/5564 green** (tracker
baseline 5496; +68 tests on this branch: 58 for the page itself — 10 frames,
12 banners, 7 canvas-model, 12 drawer-model, 4 source-guard, 4
degradation-banner, 5 no-management-views, 4 server — plus 1 for the unlinked
band wrap and 9 for the pre-push review round). The `ui/**` suite alone is
**203/203**, run three consecutive times. `npm run brain:repo:check` green
before every commit; tree clean after each. Counted diff (excluding
`*.test.mjs`, `openspec/`, `.memory/`) against
`origin/feature/brain-ui...HEAD`: **954 / 1000** (tier `lite`) — 892 for the
page, 15 for the band wrap, 47 for the review fixes. tasks.md forecast ~440
for this PR; the overage is the four `lib/` modules the "no logic in the
browser file" rule pulled out of `app.js`, all of them tested, none of them
optional.

### Deviations from tasks.md / design.md

1. **`/app.js`, not `/lib/app.js`** (T1a's text). `app.js` lives in
   `static/`, is imported by nothing, and imports `./lib/*.mjs`; serving it
   under `/lib/` would make the browser's relative specifiers resolve to
   `/lib/lib/*.mjs`. `KNOWN_ROUTES` gains `'/app.js'`, `'/app.css'` and
   `'/lib/{module}.mjs'`, and the R881-10 S3 route-table test was updated to
   match.
2. **No `/api/meta` route** (T2b's text says "render `/api/meta`'s
   last-polled/paused state"). This server has no such route and never had
   one: `meta` rides the SSE `sync` and `status` frames, and each poll
   control answers with the new poller state. The page reads those instead —
   adding a route to KNOWN_ROUTES for data already pushed would widen the
   surface R881-10 S3 exists to keep narrow.
3. **The banner strings live in `lib/banners.mjs`**, not in `app.js`'s
   template strings as T3a sketched, and `degradation-banner.test.mjs`
   asserts them BY VALUE there plus the wiring in `app.js`. A grep can prove
   a sentence exists in a file; it cannot prove anything ever shows it.
4. **Four new `lib/` modules** (`frames`, `banners`, `canvas-model`,
   `drawer-model`) that tasks.md's file fence does not list. They are the
   direct consequence of the fence's own TDD note plus review-lesson 3:
   everything mechanically checkable had to leave the browser file to be
   checkable at all. Every one is pure, under `lib/source-guard.test.mjs`,
   and imported by `app.js` only.
5. **Exception outside the fence — `lib/shipped-hostnames.mjs`** (+5 lines,
   commit `7795885b`). `createElementNS` compares
   `http://www.w3.org/2000/svg` by value, so the page must ship it literally
   and #648's shipped-hostname guard failed the full suite. Allowlisted with
   the reason rather than obfuscated: assembling the string from pieces would
   hide exactly what that guard exists to surface.
6. **`GET /api/change/<N>` is fetched on activation, not prefetched**, and a
   late answer for a node the operator has already left is dropped rather
   than painted over the current drawer.

### Findings for follow-up — neither inside this slice's fence

1. **`layout.mjs` laid the unlinked band in ONE row — FIXED on this branch,
   `366b3ed2`.** With 81 unlinked nodes the live canvas was **16 160 px wide**
   against a 420 px height. Nothing was lost — the area scrolled and every node
   was drawn — but the `?` track was unusable at that width. The band now wraps
   into `max(1, ceil(sqrt(n)), widest layer)` columns, ascending issue number,
   left to right then top to bottom, with its own RED-first test (81 unlinked
   nodes: 9 columns, 9 rows, byte-identical under a shuffled input). Live width
   after the fix: 1960 px.
2. **`main()` resolves the forge from `process.cwd()`, not `--root`.**
   Running `--root /tmp/.../noforge` (a fresh repo with no remote) still
   polled `csrinaldi/brain`, because `resolveForgeSource()` →
   `originIdentity()` reads the CURRENT directory's origin. So
   `brain:ui --root <other repo>` serves that repo's tree with THIS repo's
   issues — two sources of truth in one snapshot. Pre-existing since PR 1/2;
   worth its own ticket.

## Slice 4 — pre-push fresh review (2026-09-16): APPROVE with minors, five promoted and fixed

A cold-context review of the branch at `1c5c07f0` returned **APPROVE with
minors** — seven, by the reviewer's own count. Five items were fixed here,
test-first, one commit each: four are minors this repo's reading rules promote
to blocking (a failure that produces no sentence anywhere, or a guard that
cannot catch what it claims to catch), and the fifth, the `colour.mjs`
fall-through, is slice 3's own written obligation restated inside this slice's
R881-6 claims rather than a new finding. The three minors left untouched are
editorial; each one's reason is stated below.

### Fixed this round

| # | Finding | Commit |
|---|---|---|
| 1 | `frames.mjs` applied a `section` frame blindly: an unknown `name` invented a snapshot key the canvas would read as data, and a frame with no `name` wrote a section literally called `"undefined"` | `6551c288` |
| 2 | `app.js`'s `JSON.parse(event.data)` sat unguarded inside the `EventSource` listener: a non-JSON frame threw where nothing on the page can catch it — the frame lost AND no band said so | `df3b6a52` |
| 3 | a failed poll-control POST wrote its reason into `state.stream`, so the page said "the live stream dropped" about a button that did not take | `12963635` |
| 4 | `app-source-guard.test.mjs`'s `importSpecifiers()` scanned line by line, so a multi-line `import {\n … \n} from 'lodash-es';` passed the no-bare-package guard | `87ee66ad` |
| 5 | `colour.mjs` compared `node.status` against three literals and fell through to the roadmap colour, so an unknown status painted as if something had classified the node (slice 3's obligation, inside this slice's R881-6 claims) | `98e26b9f` |

### RED → GREEN → mutation, per fix

1. **Section-frame guard.** RED — two probes (`name: 'nosuchsection'` adds a
   key; a frame with no `name` writes `"undefined"`) failed, 10 pass / 1 fail.
   GREEN — 11/11. Mutation — `if (false && !Object.hasOwn(...))` → red,
   reverted. The unknown name is now said through `state.stream`, the same
   place an unknown event name is said.
2. **`parseFrame(text)`.** RED — `frames.test.mjs` would not even load
   (`parseFrame` is not exported) and the new `app.js` wiring scan failed.
   GREEN — 197/197 across `ui/**`. Mutation — parse outside the `try` → red on
   exactly the new test, reverted. `parseFrame('{nope')` returns
   `{ok:false, reason}` naming the position; `app.js` routes a failed parse to
   the stream band and renders.
3. **The `controls` band.** RED — four failures (the `controlBanner` value,
   the `degradationBands` band, `controlFailed` in page state, the `app.js`
   wiring scan). GREEN — 201/201. Mutation — routing the failure back through
   `streamFailed` → red on the wiring scan, reverted. The page state now
   carries `controls: {ok, action, reason}`, distinct from `stream`, and the
   band is rendered beside the transport band, never as it.
4. **The whole-file import scan.** Proven the other way round, because the
   defect was in the test: a multi-line `lodash-es` import was injected into
   `app.js` and the OLD guard passed 4/4 — that is the bug. With the scanner
   fixed the same injection fails 2 of 4 (the specifier assertion and the
   "module exists under `ui/lib/`" assertion); the injection was then removed
   and the file is byte-identical to its committed state. The scan now covers
   all three module forms: `… from '<spec>'`, bare `import '<spec>'`, and
   dynamic `import('<spec>')`.
5. **Unknown `node.status`.** RED — 12 pass / 2 fail (`colour.test.mjs`'s
   throw assertion and `canvas-model.test.mjs`'s `node-unknown` assertion).
   GREEN — 203/203. Mutation — `if (false && …)` restores the fall-through →
   the same 2 red, reverted. `status/epic-graph.mjs` assigns exactly four
   statuses and `snapshot.mjs` one more, all five present in
   `NODE_STATUS_CLASS`, so no live node changes colour; what changes is that a
   sixth would be marked `node-unknown` with its reason on the node instead of
   drawn as `planned`, while every sibling still draws.

### Left as follow-ups, with the reason

1. **`LIB_MODULE_RE`'s comment wording** (`server.mjs`). The reviewer found
   the comment's description of the pattern looser than the pattern itself.
   The regex is correct and pinned by a mutation test; rewording a comment is
   not worth a line of this PR's remaining budget. A later ticket.
2. **The `www.w3.org` allow-list width** (`lib/shipped-hostnames.mjs`). The
   entry allows the host, where only the exact SVG namespace string
   `http://www.w3.org/2000/svg` is needed. Narrowing it touches #648's guard —
   a shared file outside this slice's fence, with its own tests and its own
   reviewers. A later ticket, named there.
3. **The editorials about focus / Space / CLOSED** — keyboard focus handling
   on the canvas nodes, the `' '` key comparison, and the wording of the
   CLOSED-issue note. All three are suggestions about behaviour nobody has
   reported as wrong, none of them a silent failure. Deliberately not taken in
   a pre-push round: they are product decisions, not corrections.

The two findings recorded in "Findings for follow-up" above are unchanged:
finding 1 (the unlinked band) stays FIXED, finding 2 (`main()` resolves the
forge from `process.cwd()`, not `--root`) stays OPEN and still wants its own
ticket.

No push, no PR (per task instructions) — branch `feat/issue-881-slice-4-page`
has not been pushed this run.

## Slice 4 — cold review of PR #982 (head `22a0ae20`, 2026-09-16): APPROVE rev 1, two corrections landed as their own PR

The chain's four PRs are merged into `feature/brain-ui`. The two corrections
of the approving review were not worth burning the approved head; they land
in one small PR against the tracker, before the tracker's own review:

- **correction 2, `app.js` `loadChange`**: the `refs` handler reloads the
  drawer on every frame and the only staleness guard compared the selected
  issue, so two loads for the SAME issue could finish out of order and the
  older answer render last. `lib/frames.mjs` gains `requestSequence()`
  (tested); `loadChange` takes a token before the fetch and checks it after.
  Wiring pinned by the source guard; mutation: dropping the check turns that
  test red (`e2e35d0f`).
- **correction 1, `app-source-guard.test.mjs`**: the whole-file import scan
  could chain a bare `import "…";` to a later `from "lodash-es"` in a comment.
  The from-clause body now spans lines but never a `;` or a quote; pinned by
  the phantom-comment fixture and a real multi-line bare import; injecting
  the latter into `app.js` still turns the guard red (`60c28bf3`).

Counts after: 206 tests under `ui/`.
