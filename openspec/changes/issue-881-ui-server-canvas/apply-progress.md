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
| `watcher.mjs:240` `activeWorktrees()` | `recordFailure('<git-common>/worktrees', err); return []` | records the failure (OK on its own) — see discrepancy below |
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

Both are real, currently untested gaps in `rescanWorktrees()` /
`activeWorktrees()`, not something this round introduced or was asked to
fix — the task scope and diff budget were specific to `listChangeDirs()`.
Recorded here as a **follow-up finding** for a future round: give
`activeWorktrees()` the same `null`-on-failure sentinel and have
`rescanWorktrees()` skip reconciliation on it, and clear the
`<git-common>/worktrees` failure entry on the next successful call —
the same shape `listChangeDirs()`/`rescanChangeDirs()` now have.

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
