---
status: approved
approved: 2026-10-02 (maintainer)
issue: 1243
---

# Proposal: one timer per owner, and a pause the page can act on (#1243)

## Intent

Round-1 cold review of PR #1241 found three defects in `brain:ui`. All three are verified in code:

1. **Duplicate tick chain.** `poller.mjs:95` reports `paused` as `userPaused || forgeHalted`, but `tickWanted()` (`:282`) runs the timer whenever remotes exist. On a forge-less server the page offers Resume (`app.js:552`). `resume()` (`:326`) then calls `scheduleNext()`, which overwrites `timer` (`:293`) without clearing it. The result is two chains that `pause()` and `close()` cannot stop. `resume()` also clears `forgeHalted`. From then on the forge lane polls `noForgeVcs` (`server.mjs:69`), and the real reason is replaced by a generic one.
2. **Follow-up after close.** `recomputeCurrent()` (`server.mjs:209-211`) arms the follow-up after an `await` and never checks for shutdown.
3. **Split change-dir input.** `remote-changes.mjs:121` passes blob names to `pickChangeDir`, while `change-route.mjs:301` passes only trees. A stray `issue-5-notes.md` makes the remote reader answer `unreadable`.

## Class sweep (`brain/scripts/ui/**`)

| Site | Failure | Verdict |
|---|---|---|
| `poller.mjs:326` resume while a tick is in flight after `pause()` | Resume arms a timer, then the tick's `.finally` (`:303`) arms a second one: same overwrite | **In** |
| `poller.mjs:334` `once()` | Clears the timer before `runTick` | Safe |
| `watcher.mjs:137` `scheduleDebounce` | Clears before set; `close()` clears | Safe |
| `watcher.mjs:157-159` queued `dispatch()` after `close()` | Runs one more recompute after shutdown. That recompute reaches #2's arm, which #2's guard covers. On its own it is bounded and arms no timer | Out (see Q4) |
| `lib/render-budget.mjs:46` | Armed once, synchronously | Safe |

## Scope

**In:**
- One arming discipline per owner: `arm()` clears any existing handle before it sets a new one, and does nothing when the owner is closed. `scheduleNext` and `armRemoteFollowUp` both use it.
- The server gets a `closed` flag. Close sets it first, and `armRemoteFollowUp` checks it.
- A state model: `state().paused` becomes `userPaused` only. A new `forgeHalted` field (plus the existing `lastError`) carries the halt. `resume()` lifts only `userPaused`.
- Page: when the forge is halted and remotes are running, the bar says "forge unavailable: <reason>; remotes fetched every N s". The toggle reads "disable polling" and the countdown is live.
- `git-tree.mjs` exports `changeDirNames(listing)` (tree entries only). Both callers use it.
- The tests listed under Success Criteria.

**Out:** the watcher's post-close dispatch; recovering a halted forge without a restart; any change to fetch cadence.

## Capabilities

New: None. Modified: None. No `openspec/specs/` capability covers `brain:ui`. The requirements live in the #881 and #1201 change artefacts, and this change restores their stated intent.

## Decisions for the maintainer

- **Q1.** Should `paused` mean only the user's pause, with a separate `forgeHalted`? This reverses the "cannot tell the two apart" note at `poller.mjs:84-86`. *Recommend yes.*
- **Q2.** Can Resume lift a forge halt? *Recommend no.* The halt comes from startup resolution, which Resume cannot fix.
- **Q3.** What should a forge-less server without remotes show (timer idle, `paused: false`)? *Recommend* the halt reason with the countdown at "polling disabled" and no Resume.
- **Q4.** Should the watcher's post-close dispatch be guarded here? *Recommend no.* It is a different failure mode; file a follow-up.

## Affected Areas

`brain/scripts/ui/poller.mjs`, `ui/server.mjs`, `ui/lib/banners.mjs`, `ui/static/app.js`, `lib/git-tree.mjs`, `ui/change-route.mjs`, `status/remote-changes.mjs`, and their `*.test.mjs` files.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Something else reads `state().paused` as "forge halted" | Low | rg shows only `banners.mjs` and `app.js` read it; tests pin both |
| A halted forge goes unseen once it is no longer shown as `paused` | Med | The poller band already shows `lastError`; the indicator text names the halt |

## Rollback Plan

Revert the single PR. No data, config or schema changes.

## Size

Small: about 120 to 180 gated lines plus tests.

## Success Criteria

- [ ] #1: with injected timers, start → resume → resume leaves exactly one armed handle, and close leaves none. Pause, a tick in flight, then resume, leaves one.
- [ ] #1: a forge-halted state reports `paused: false` and `forgeHalted: true`; the page offers no Resume; `lastError` keeps the startup reason.
- [ ] #2: closing while a deferred follow-up recompute is pending leaves no armed handle.
- [ ] #3: a listing with an `issue-5-notes.md` blob beside `issue-5-x/` makes both readers pick `issue-5-x`.

### Rulings (maintainer, 2026-10-02, binding)

| # | Ruling |
|---|---|
| R1 | `state().paused` means the USER's pause only. The forge halt is reported separately as `forgeHalted`. This reverses the note at `poller.mjs:84-86`. |
| R2 | Resume never lifts a forge halt. Only a restart re-resolves the forge. |
| R3 | A forge-less server with no remotes lane shows the halt reason, the countdown reads "polling disabled", and no Resume control is offered. |
| R4 | The watcher's queued `dispatch()` after `close()` (`watcher.mjs:157-159`) is out of scope, filed as a follow-up. |
