---
status: draft
issue: 1243
---

# Design — poller-resume-close-timers (issue 1243)

## Technical approach

This design extends #1201 (D30–D43) and continues its numbering at D44. It amends D40 (the `paused` field) and D35 (the change-dir candidates) and contradicts nothing else. Line numbers are from this worktree at `ca6f182a`.

```
poller.mjs   arm(fn, ms) ── the only writer of `timer`: disarm(); if closed → no-op; set
             scheduleNext ─▶ arm(runTick, interval)      pause/close/once ─▶ disarm()
             state(): paused = userPaused · forgeHalted · forgeHaltReason · remotesLane
server.mjs   close(): closed = true first ─▶ armRemoteFollowUp() returns when closed
git-tree.mjs changeDirNames(listing) ─▶ remote-changes.mjs:121 and change-route.mjs:299-302
banners.mjs  pollIndicator(): text, countdown, halted, toggle ('pause'|'resume'|null) ─▶ app.js:504-553
```

## Decisions

| # | Decision | Rejected | Why |
|---|---|---|---|
| D44 | **`arm()` in the poller.** One private pair owns `timer` (see Interfaces). `arm(fn, ms)` calls `disarm()`, returns `false` when `closed`, otherwise sets `timer` to a handle whose callback first sets `timer = null` and then returns `fn()`. `disarm()` clears and nulls. Migrate every site: `scheduleNext` (`:293`) calls `arm(runTick, interval)` and sets `nextAttemptAt` only when it returns true; `runTick` drops `timer = null` (`:297`), now done by the wrapper; `close()` (`:313`), `pause()` (`:316`) and `once()` (`:334`) call `disarm()`. Resume (`:326`) and the `runTick().finally` re-arm (`:303`) both reach the timer only through `scheduleNext` → `arm`. **The pause-in-flight path:** `pause()` finds `timer === null` (the tick nulled it), so it clears nothing; `resume()` arms A; the tick's `.finally` arms again, and `arm` clears A before setting B. One handle. A tick that settles while still paused reaches `scheduleNext`, where `tickWanted()` is false (`:282`, `:291`), so it arms nothing and `nextAttemptAt` is null. The wrapper must `return fn()`: the tests await `scheduler.runNext()`, which returns the callback's value (`poller.test.mjs:39`). | (a) Skip the re-arm in `.finally` when a timer is already armed. (b) `resume()` defers to an in-flight tick. | (a) and (b) each patch one ordering and leave `timer =` writable from two places, which is the defect (`:293` overwrote without a clear). Clear-then-set makes "at most one handle" a property of the only writer, whatever the ordering. The re-arm after resume restarts the countdown at settle time, which is harmless. |
| D45 | **The server's follow-up.** Add `let closed = false` beside `followUp` (`server.mjs:203`). `close()` sets it as its first statement (`:404`, before `:405`). `armRemoteFollowUp()` (`:204-207`) returns when `closed`. The check belongs in the arm, not in `recomputeCurrent` (`:209-213`): the arm is the one writer of `followUp`, and the recompute's `await` (`:210`) is exactly the gap a caller-side check would miss for the next caller. The follow-up keeps its keep-first rule (`followUp !== null` returns); it is not rewritten as clear-then-set. | A shared `arm` helper module for both owners | The two owners want different rules. The poller replaces its handle (the newest schedule wins); the follow-up is a one-shot whose delay a burst of watcher recomputes should not push back, and R1201-12's "one follow-up pending, never two" test (`server-remote.test.mjs:63`) already pins keep-first. A shared module would be `ui/lib/*.mjs`, which the server ships to the browser (`KNOWN_ROUTES`, `server.mjs:66`), or a new top-level file for about 8 lines. The shared part is the discipline (one writer, a closed guard), and both follow it. |
| D46 | **State model (R1).** Internals: `userPaused` (mutable) and `forgeHalted`, which becomes a `const` (`:94`) because nothing may clear it (R2). `isPaused` (`:95`) is deleted. `state()` (`:126`) returns `paused: userPaused`, `forgeHalted`, `forgeHaltReason: initialError` and `remotesLane: fetchRemotes !== null`. `forgeHaltReason` is a separate constant and not only `lastError`, because `lastError` is mutable (`:248`, `:253`); with the forge lane never running it stays put today, but the page must not depend on that. `remotesLane` is needed because `nextAttemptAt` is null during every in-flight tick (`:297`), so it cannot tell R3's case from a tick in progress. The note at `:80-92` is rewritten to say the two are distinct and why. `server.mjs:180-183`'s comment and the stderr line at `:522` ("polling paused") change to `forge lane halted; tree sections and remote fetch still served`. | Keep `paused` as either and add `userPaused` | R1 rules it. Every consumer that offers Resume reads `paused`, so overloading it is what put a Resume button on a halt. |
| D47 | **Consumers of `paused`** (rg over `ui/**`, `lib/header-model.mjs` has none). `banners.mjs:118` `pollCountdown`: unchanged, user pause first, then `nextAttemptAt`. `banners.mjs:131-139` `pollIndicator`: gains `halted` and `toggle` and the halt text (Interfaces); with a null poller (stream not yet connected) it returns `toggle: null`, since a control with no state to act on cannot act; the halt reason falls back from `forgeHaltReason` to `lastError` to `'unknown'` for older snapshots. `app.js:504-505` "paused"/"live": unchanged; a halted forge with a connected stream is live. `app.js:508`: class `poll-indicator halted` when `indicator.halted` (one `app.css` rule beside `:188`). `app.js:552-553`: the toggle renders from `indicator.toggle`, and is not appended when it is null. `server.mjs:522`: as D46. `remotesBanner` (`banners.mjs:42`) keeps "polling is paused or it has not ticked yet", which stays true. `frames.test.mjs:7,73` and `remote-render.test.mjs:168,177` carry `paused: false` fixtures with no `forgeHalted`; the absent field is falsy and they are unchanged. | | |
| D48 | **`resume()` (R2).** `if (userPaused) { userPaused = false; scheduleNext(); } return state();`. It never writes `forgeHalted` or `lastError`. On a halted poller with a remotes lane it re-arms the remotes timer; without one, `tickWanted()` is false and it arms nothing. | | The halt comes from startup resolution (`server.mjs:514-523`), which Resume cannot redo. |
| D49 | **`changeDirNames(listing)`** in `lib/git-tree.mjs`: `[...listing].filter(([, e]) => e.type === 'tree').map(([p]) => p.slice(p.lastIndexOf('/') + 1))`. It takes the parsed Map, so `parseTreeListing` stays the one parser. `remote-changes.mjs:121` becomes `pickChangeDir(changeDirNames(parseTreeListing(run(...))), issue)`. `change-route.mjs:299-302` `listChangeDirNames` keeps its name and spawn and returns `changeDirNames(parseTreeListing(...))`, dropping its own filter. | Filtering inside `pickChangeDir` | `pickChangeDir(names, issue)` takes names, and its tests pass plain arrays (`git-tree.test.mjs:30-49`). Moving the type into it would change its input for one filter. |

## Interfaces

```js
// poller.mjs (private)
function disarm() { if (timer !== null) { _clearTimeout(timer); timer = null; } }
function arm(fn, ms) {            // the only writer of a live handle
  disarm();
  if (closed) return false;
  timer = _setTimeout(() => { timer = null; return fn(); }, ms);
  return true;
}
// poller.state()
{ paused /* = userPaused */, forgeHalted, forgeHaltReason, remotesLane, lastPolledAt, lastOkAt,
  lastError, forgeAsOf, intervalMs, nextAttemptAt, remotes }
// lib/git-tree.mjs
changeDirNames(listing: Map<path,{type}>) -> string[]
// ui/lib/banners.mjs
pollIndicator({poller, nowMs}) -> { text, paused, halted, countdown, toggle: 'pause'|'resume'|null }
//   paused             → text 'polling is paused — <when>', toggle 'resume'
//   halted+remotesLane → 'forge unavailable: <reason>; remotes fetched every <intervalMs/1000> s', toggle 'pause'
//   halted, no lane    → 'forge unavailable: <reason>', countdown 'polling disabled', toggle null
//   poller null        → toggle null
```

## Testing strategy (strict TDD, node:test)

Rules: every timer goes through an injected scheduler (`fakeScheduler`, `poller.test.mjs:28-42`; `recordingScheduler`, `server-remote.test.mjs:21-34`). Both keep a Map of live handles, so `pending()` counts armed handles and an overwritten handle stays counted, which is the detector. No real timer stays pending; no test fetches over a network (the remotes lane is `fetchSpy`, `poller.test.mjs:659`, or a local bare fixture).

**First RED** (`poller.test.mjs`): a forge-halted poller with `fetchRemotes: fetchSpy().fn`. `const t = poller.start(); poller.resume(); poller.resume(); await t;` then `assert.equal(scheduler.pending(), 1)`, then `close()` and `pending() === 0`. Today it reads 2: the first resume arms through `isPaused()` (`:326`), and the tick's `.finally` arms again (`:303`). Why first: it is the reported defect, and it fails on the overwrite itself.

New tests:

| File | Test |
|---|---|
| `poller.test.mjs` | First RED above. Pause-in-flight → resume: gate `issueList`, `start()`, `pause()`, `resume()`, release, await → `pending() === 1`. Pause-in-flight, settle: → `pending() === 0`, `nextAttemptAt === null`. Pause-in-flight → resume → `close()` → settle: 0. R2: halted with a remotes lane, `resume()`, `runNext()`, settle → forge `callLog` empty, `forgeHalted` true, `lastError` /no VCS token/. Halted, user-paused, `resume()` → `paused` false, one handle. `remotesLane` and `forgeHaltReason` on `state()`. |
| `server-remote.test.mjs` | Defect 2, with `poll: false` and a stub `_watch` so neither a tick nor a fetch runs: `_recomputeCurrent` returns `{remoteChanges: {ok: true, value: {deferred: 1}}}`; the first call resolves (startup arms the follow-up); the second is held by a gate. `runNext()` fires the follow-up (do not await it), `close()`, release the gate, settle → `pending() === 0`. Today 1 (`server.mjs:211`). |
| `lib/git-tree.test.mjs` | `changeDirNames` keeps `issue-5-x`, drops blob `issue-5-notes.md`. |
| `status/remote-changes.test.mjs` | `fx.addBranch('feat/issue-5-x', {'openspec/changes/issue-5-x/proposal.md': 'p', 'openspec/changes/issue-5-notes.md': 'n'})` → `change.ok`, dir `openspec/changes/issue-5-x`. Today `unreadable` (ambiguous). |
| `change-route.test.mjs` | The same tree on the served fixture → the resume path is under `issue-5-x` (already passes; a guard so the shared filter cannot regress it). |
| `lib/banners.test.mjs` | The three halt rows of `pollIndicator`; `toggle` null when halted without a lane. |
| `static/remote-render.test.mjs` | Through `installDom`: halted meta without a lane renders no `.poll-toggle` and no text "resume polling". |

Existing tests that change:

| Test | Change |
|---|---|
| `poller.test.mjs:180-201` (cold-6) | `:192` `paused` true → false, plus `forgeHalted` true. `:197` comment "paused: a no-op" → "halted with no remotes lane". `:199` message "until a manual resume" → "Resume never lifts it (R2)". |
| `poller.test.mjs:282-292` | Title "before the first resume" → "a halt with no remotes lane schedules nothing"; assertion unchanged. |
| `poller.test.mjs:704-721` | Add `paused` false, `forgeHalted` true. |
| `poller.test.mjs:723-736` | Add `paused` true, `forgeHalted` true. |
| `server.test.mjs:1097-1124` | `:1105` regex → the D46 stderr line. `:1118` `paused` true → false, plus `forgeHalted` true. Title "starts the poller paused" → "halted". |
| `server-remote.test.mjs:168-188` | Unchanged in assertions. Its probe (`:104`, POST resume) used to lift the halt here and arm a second chain; add `assert.equal(scheduler.pending(), 1)` after `:180`. Today it reads 2 when the first tick settled before the probe. |
| `lib/banners.test.mjs:112,129` | `deepEqual` gains `halted: false` and `toggle: 'pause'` / `null`. `:117-125`, `:134-139` add `toggle: 'resume'`. |
| `poller.test.mjs:93-94,128,256-280`; `server.test.mjs:274-281,780-802`; `frames.test.mjs:73` | Unchanged: they assert the user's pause. |

## Size (gated, excluding `*.test.mjs`)

| File | Lines |
|---|---|
| `ui/poller.mjs` | +~22 / −~10 (incl. the rewritten note) |
| `ui/server.mjs` | +~4 / −~3 |
| `ui/lib/banners.mjs` | +~14 / −~4 |
| `ui/static/app.js`, `app.css` | +~5 / −~3, +1 |
| `lib/git-tree.mjs` | +~8 |
| `status/remote-changes.mjs`, `ui/change-route.mjs` | ±1, −2 |

About 60–75 gated lines, under the proposal's 120–180 and the `lite` budget of 1000. One PR.

## Migration / rollout

None. `state()` only gains fields; `paused` narrows. Revert the PR to roll back.

## Risks

- **R3 is not reachable from the CLI today.** `server.mjs:265` always passes `fetchRemotes`, so a real forge-less server always has a remotes lane and takes the "remotes fetched every N s" branch. R3's state exists for `createPoller` without `fetchRemotes`; it is built and tested at the poller and banner level. No open question blocks the design.
- **`--no-poll` resume.** With `--no-poll`, `main()` resolves no forge (`server.mjs:514`), so `forgeHalted` is false and Resume runs the forge lane against `noForgeVcs` (`:69`), showing its generic reason. That is pre-existing and listed out of scope in the spec.
- **A halt no longer shown as "paused".** Mitigated by the indicator text, the `halted` class, and the poller band, which still shows `lastError` (`banners.mjs:87`).
- **The re-arm after a resume restarts the countdown** when a tick settles. One handle survives; only its due time moves.
- **The design length** exceeds the skill's 800 words, because the brief asked for eight evidenced sections.
