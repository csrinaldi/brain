---
status: draft
issue: 1243
---

# Tasks — poller-resume-close-timers (issue 1243)

Strict TDD (node:test, `npm test`). Each commit holds its tests with the code they drive. Timers are counted through injected schedulers; no wall-clock assertions.

## Commit 1: one timer writer in the poller (R1243-1, R1243-2)

- [x] 1.1 RED: `brain/scripts/ui/poller.test.mjs`: forge-halted poller with a `fetchSpy` remotes lane, `start()`, `resume()` x2, settle, `pending() === 1`, then `close()` and `pending() === 0` (R1243-1). Failed `2 !== 1`.
- [x] 1.2 RED: same file: pause in flight then resume leaves one handle (RED); pause in flight then settle arms nothing (GUARD, passes on the parent); close after pause-resume with a tick in flight arms nothing (GUARD, passes on the parent) (R1243-1, R1243-2). Review follow-up: direct tests for arm()'s clear (two settling ticks) and for pause clearing the only chain.
- [x] 1.3 GREEN: `brain/scripts/ui/poller.mjs`: private `arm(fn, ms)` / `disarm()`, the only writer of `timer`; `scheduleNext`, `runTick`, `close`, `pause`, `once` migrated (D44).

## Commit 2: the server follow-up respects close (R1243-2)

- [x] 2.1 RED: `brain/scripts/ui/server-remote.test.mjs`: close with a follow-up recompute in flight, then settle, `pending() === 0`. Failed `1 !== 0`.
- [x] 2.2 GREEN: `brain/scripts/ui/server.mjs`: `closed` set first in `close()`; `armRemoteFollowUp` returns when closed (D45).

## Commit 3: the state model and its consumers (R1243-3, R1243-4, R1243-5)

- [x] 3.1 RED: `poller.test.mjs`: `state()` carries `forgeHalted`, `forgeHaltReason`, `remotesLane`; Resume never lifts the halt; resume re-arms only the remotes timer; no-op when not paused. Existing cold-6 and W3 tests updated (`paused` false, `forgeHalted` true).
- [x] 3.2 RED: `brain/scripts/ui/lib/banners.test.mjs` (three halt rows, `halted`/`toggle` on existing rows), `brain/scripts/ui/static/remote-render.test.mjs` (no toggle, no "resume polling" when halted without a lane), `brain/scripts/ui/server.test.mjs` (stderr line, `paused` false, probe is `resume`), `server-remote.test.mjs` (`pending() === 1` after the probe).
- [x] 3.3 GREEN: `poller.mjs` (`userPaused` only in `paused`, `forgeHalted` const, `resume()` clears only `userPaused`; D46, D48); `ui/lib/banners.mjs` `pollIndicator` (D47); `ui/static/app.js` (`halted` class, toggle from `indicator.toggle`); `ui/static/app.css` (`.halted` rule); `ui/server.mjs` stderr line.

## Commit 4: one change-dir filter (R1243-6)

- [x] 4.1 RED: `brain/scripts/lib/git-tree.test.mjs` (`changeDirNames`), `brain/scripts/status/remote-changes.test.mjs` (stray blob beside the change dir, was `unreadable`), `brain/scripts/ui/change-route.test.mjs` (guard, already passing).
- [x] 4.2 GREEN: `brain/scripts/lib/git-tree.mjs` exports `changeDirNames`; `status/remote-changes.mjs` and `ui/change-route.mjs` both use it (D49).

## Final checks

- [x] 5.1 Full `npm test` green; poller and server test files looped 20x with 0 failures; `npm run brain:repo:check` clean.

## Review Workload Forecast

- Estimated gated lines: about 60-75 (tests, openspec and memory excluded).
- Chained PRs recommended: No. Single PR, no chain.
- 400-line budget risk: Low (`lite` budget is 1000).
- Decision needed before apply: No.
