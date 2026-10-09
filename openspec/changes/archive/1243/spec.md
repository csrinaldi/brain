---
status: draft
issue: 1243
---

# Spec — poller-resume-close-timers (issue 1243)

Capability: `brain:ui` (no `openspec/specs/` capability covers it; its requirements live in the #881 and #1201 change artefacts). Delta requirements: what MUST be true after this change. The proposal's rulings R1-R4 are binding and are referenced by number. Requirement keywords follow RFC 2119. Requirements that modify an R881-n or R1201-n requirement say so explicitly; every such requirement not named here is unchanged.

Scenario grammar: each scenario carries one `WHEN` and one `THEN` line and an optional `GIVEN`, so the UI's spec cards (`ui/lib/spec-cards.mjs`, which keeps only the last `THEN`) render this file in full.

Fixed values used throughout:

- "Armed handle": a handle returned by the injected `_setTimeout` and not yet cleared by `_clearTimeout` or fired. Tests count them with an injected scheduler; no real timer is used.
- "Forge-halted": a poller built with `initialError` (the server's `forgeUnavailable`), meaning startup could not resolve a forge port.
- "Remotes lane": a poller built with a non-null `fetchRemotes` (#1201 D40).
- Poll interval in examples: 60 s.

## Timers

### R1243-1: The poller holds at most one armed timer handle at any time

The poller MUST NOT hold more than one armed handle, whatever the order of `start()`, `pause()`, `resume()`, `once()` and the settling of an in-flight tick. Arming a handle MUST first clear any handle the poller already holds. A tick that settles while the user has paused polling MUST NOT arm a handle. `pause()` and `close()` MUST leave zero armed handles, so every chain the poller started is one they can stop.

This requirement restores the intent of R881-4 ("the timer stops firing" when disabled) and R1201-9 (one tick chain feeding the remotes lane), which a second, unreachable chain broke.

#### Scenario: Start, then resume twice, on a forge-halted poller with a remotes lane (defect 1)
- **GIVEN** a forge-halted poller with a remotes lane and an injected scheduler
- **WHEN** `start()` runs, `resume()` is called twice before the first tick settles, and the tick then settles
- **THEN** exactly one handle is armed, and after `close()` none is

#### Scenario: Pause during an in-flight tick, then resume before it settles (class sweep)
- **GIVEN** a poller whose first tick is held in flight by a gated forge read
- **WHEN** `pause()` then `resume()` run, and the gate is then released so the tick settles
- **THEN** exactly one handle is armed

#### Scenario: A tick that settles while paused arms nothing
- **GIVEN** a poller whose first tick is held in flight
- **WHEN** `pause()` runs and the tick then settles
- **THEN** no handle is armed and `nextAttemptAt` is null

#### Scenario: Pause clears the only chain
- **GIVEN** a poller that reached one armed handle through any of the sequences above
- **WHEN** `pause()` runs
- **THEN** no handle is armed

### R1243-2: No timer is armed after close, even with work in flight

After `close()` returns, neither the poller nor the server MUST arm a new handle. The server MUST record that it is closed before it clears anything, and its follow-up arming (R1201-12) MUST do nothing once closed, including when a recompute that started before `close()` settles after it. This modifies R1201-12 only by adding the shutdown condition to "the chain ends when `deferred` reaches 0": the chain also ends at `close()`.

#### Scenario: Close with a follow-up recompute in flight (defect 2)
- **GIVEN** a server whose snapshot reports `deferred > 0`, an injected scheduler, and a follow-up recompute that has fired and is held in flight
- **WHEN** `close()` runs and the held recompute then settles with `deferred > 0`
- **THEN** no handle is armed

#### Scenario: Close with a poller tick in flight after a resume
- **GIVEN** a poller paused during an in-flight tick and then resumed
- **WHEN** `close()` runs and the tick then settles
- **THEN** no handle is armed and `nextAttemptAt` is null

## Poller state

### R1243-3: `paused` reports the user's pause only; the forge halt is reported separately (R1)

`poller.state().paused` MUST be true exactly when the user paused polling (`--no-poll` or the Pause control) and MUST NOT reflect the forge halt. `state()` MUST also carry `forgeHalted` (boolean), `forgeHaltReason` (the startup reason, or null) and `remotesLane` (boolean). A forge-halted poller MUST keep its startup reason in `lastError` for its whole life, because its forge lane never runs.

This modifies R881-4's "the UI MUST show … whether polling is currently paused": "paused" now means the user's pause, and the forge halt is shown by R1243-5. It modifies R881-5's control-route responses only in that `paused` follows this definition. It reverses the #881 judgment:cold-6 note at `poller.mjs:80-86` ("a caller … cannot tell the two apart") and #1201 D40's "`state().paused` still reports either" (`poller.mjs:88-92`): a caller can now tell them apart, and MUST be able to.

#### Scenario: A forge-halted poller is not paused
- **GIVEN** a poller built with `initialError: 'no VCS token'` and polling not paused by the user
- **WHEN** `state()` is read
- **THEN** `paused` is false, `forgeHalted` is true, `forgeHaltReason` and `lastError` both name `no VCS token`

#### Scenario: A user pause on a forge-halted poller is a pause
- **GIVEN** a forge-halted poller
- **WHEN** `pause()` runs
- **THEN** `paused` is true and `forgeHalted` is still true

#### Scenario: The control route reports the split (server)
- **GIVEN** a server started through `main()` whose forge resolution failed with `no VCS token`
- **WHEN** the state is read through `POST /api/poll/resume`, a no-op on a poller the user has not paused
- **THEN** the response carries `paused: false`, `forgeHalted: true` and `lastError` naming `no VCS token`, and stderr no longer says "polling paused"

### R1243-4: Resume never lifts a forge halt (R2)

`resume()` MUST clear only the user's pause. It MUST NOT clear `forgeHalted`, MUST NOT run the forge lane against the unresolved port, and MUST NOT replace `lastError`. Only a restart re-resolves the forge. When the user has not paused polling, `resume()` MUST be a no-op that returns the state.

This modifies R881-4 S2's resume control: on a forge-halted server it re-arms only what the user paused (the remotes lane's timer), never the forge lane.

#### Scenario: Resume keeps the halt and its reason (defect 1, second half)
- **GIVEN** a forge-halted poller with a remotes lane, a forge port that records calls, and an injected scheduler
- **WHEN** `resume()` runs and the armed tick then fires and settles
- **THEN** `forgeHalted` is true, `lastError` still names the startup reason, and the forge port was never called

#### Scenario: Resume after a user pause re-arms only the remotes timer
- **GIVEN** a forge-halted poller with a remotes lane that the user paused
- **WHEN** `resume()` runs
- **THEN** `paused` is false, `forgeHalted` is true and exactly one handle is armed

#### Scenario: Resume on a poller that is not paused does nothing
- **GIVEN** a running poller with one armed handle
- **WHEN** `resume()` runs
- **THEN** the same single handle is armed and `nextAttemptAt` is unchanged

## The page

### R1243-5: The status bar says the forge halt and offers only controls that can act (R1, R3)

The poll indicator MUST derive its text, its countdown and its toggle from `paused`, `forgeHalted`, `forgeHaltReason`, `remotesLane`, `intervalMs` and `nextAttemptAt`:

- User paused (any forge state): text `polling is paused — <when>` as today, countdown `paused`, toggle "resume polling".
- Forge halted, not paused, with a remotes lane: text `forge unavailable: <reason>; remotes fetched every <N> s`, a live countdown from `nextAttemptAt` (as today), toggle "disable polling".
- Forge halted, not paused, without a remotes lane (R3): text `forge unavailable: <reason>`, countdown `polling disabled`, and no toggle at all.
- Otherwise: unchanged.
- No poller state yet (before the stream connects): toggle null, so no control is rendered.

The page MUST NOT render a Resume control unless `paused` is true. The poller band (`pollBanner`) is unchanged: it keeps showing `lastError`.

#### Scenario: A forge-halted server with remotes running
- **GIVEN** poller meta with `paused: false`, `forgeHalted: true`, `forgeHaltReason: 'no VCS token'`, `remotesLane: true`, `intervalMs: 60000` and a `nextAttemptAt` 55 s ahead
- **WHEN** the status bar renders
- **THEN** it reads `forge unavailable: no VCS token; remotes fetched every 60 s`, the countdown reads `next poll in 55 s`, and the toggle reads "disable polling"

#### Scenario: A forge-halted server with no remotes lane (R3)
- **GIVEN** poller meta with `paused: false`, `forgeHalted: true`, `remotesLane: false` and `nextAttemptAt: null`
- **WHEN** the status bar renders
- **THEN** it reads `forge unavailable: <reason>`, the countdown reads `polling disabled`, and no poll toggle is rendered

#### Scenario: No Resume while the forge alone is halted
- **GIVEN** poller meta with `paused: false` and `forgeHalted: true`
- **WHEN** the status bar renders
- **THEN** no control reads "resume polling"

#### Scenario: A user pause on a halted forge still offers Resume
- **GIVEN** poller meta with `paused: true` and `forgeHalted: true`
- **WHEN** the status bar renders
- **THEN** the toggle reads "resume polling" and the countdown reads `paused`

#### Scenario: No poller state before the stream connects
- **GIVEN** no poller meta (null)
- **WHEN** the status bar renders
- **THEN** the indicator reads `the poll state is unknown until the stream connects`, the countdown reads `polling disabled`, and the toggle is null

## Change-dir lookup

### R1243-6: Only tree entries are change-dir candidates, through one filter both readers use

`brain/scripts/lib/git-tree.mjs` MUST export one function that turns a parsed `ls-tree` listing into the bare names of its tree entries, dropping blobs and any other type. The remote reader (`status/remote-changes.mjs`) and the drawer reader (`ui/change-route.mjs`) MUST both build `pickChangeDir`'s input with it, and neither MUST keep its own filter. A blob whose name parses as a change id (for example `issue-5-notes.md`) MUST NOT be a candidate.

This modifies R1201-6 and R1201-8 (and #1201 D35): "the change dir" and "more than one dir carries the issue number" count directories only, as the drawer reader already did.

#### Scenario: The filter keeps trees only
- **GIVEN** a parsed listing with tree `openspec/changes/issue-5-x` and blob `openspec/changes/issue-5-notes.md`
- **WHEN** the filter runs
- **THEN** it returns `['issue-5-x']`

#### Scenario: The remote reader ignores a stray blob (defect 3)
- **GIVEN** a remote branch `feat/issue-5-x` whose tree holds `openspec/changes/issue-5-x/proposal.md` and a file `openspec/changes/issue-5-notes.md`
- **WHEN** `readRemoteChanges` builds the entry
- **THEN** `change.ok` is true with `dir` `openspec/changes/issue-5-x`, and no state is `unreadable`

#### Scenario: The drawer reader picks the same dir
- **GIVEN** the same tree at a commit served to the drawer
- **WHEN** `readResumeAt` lists the change dirs for issue 5
- **THEN** it picks `issue-5-x`

## Out of scope

- The watcher's queued `dispatch()` after `close()` (`watcher.mjs:157-159`), per R4. It runs one more recompute after shutdown; R1243-2 makes that recompute arm nothing. A follow-up issue owns it.
- Recovering a halted forge without a restart (R2).
- Any change to fetch cadence, the remotes lane's fetch, or the 60 s interval.
- The `--no-poll` path, where no forge is resolved and a later Resume polls the placeholder port (`server.mjs:514`). It is not a forge halt under R1243-3 and keeps its current behaviour.

## Traceability

| Item | Requirement | Scenarios proving it |
|---|---|---|
| Defect 1 (duplicate chain from resume) | R1243-1, R1243-4 | Start, then resume twice…; Resume keeps the halt and its reason |
| Class sweep: pause in flight, then resume | R1243-1 | Pause during an in-flight tick, then resume before it settles; A tick that settles while paused arms nothing |
| Defect 2 (follow-up after close) | R1243-2 | Close with a follow-up recompute in flight |
| Defect 3 (blob as change-dir candidate) | R1243-6 | The filter keeps trees only; The remote reader ignores a stray blob; The drawer reader picks the same dir |
| R1 (`paused` is the user's pause; `forgeHalted` separate) | R1243-3, R1243-5 | A forge-halted poller is not paused; The control route reports the split; A forge-halted server with remotes running |
| R2 (Resume never lifts a halt) | R1243-4, R1243-5 | Resume keeps the halt and its reason; No Resume while the forge alone is halted |
| R3 (no remotes lane: reason, "polling disabled", no Resume) | R1243-5 | A forge-halted server with no remotes lane |
| R4 (watcher dispatch out) | Out of scope | — |
| Modifies R881-4, R881-5 (meaning of `paused`, resume) | R1243-3, R1243-4 | A forge-halted poller is not paused; Resume after a user pause re-arms only the remotes timer |
| Modifies R1201-9 / D40 (`paused` reported either) and the cold-6 note at `poller.mjs:80-92` | R1243-3 | A forge-halted poller is not paused |
| Modifies R1201-12 (follow-up chain ends at close) | R1243-2 | Close with a follow-up recompute in flight |
| Modifies R1201-6, R1201-8, D35 (dirs only) | R1243-6 | The remote reader ignores a stray blob |
