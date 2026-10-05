---
schema: gentle-ai.verify-result/v1
evidence_revision: git:f28864785588b46c6db3e9702e1f16c7381f9b8c
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
requirements: 6/6 compliant
scenarios: all mapped, 0 missing (1 note: the R1243-1 start/resume/resume test no longer exercises arm()'s clear, see W1)
test_command: "npm test"
test_exit_code: 0
test_output_hash: sha256:not-captured
build_command: "npm run brain:repo:check && npm run brain:change:verify"
build_exit_code: 0
build_output_hash: sha256:not-captured
---

# Verify Report: issue-1243-poller-resume-close-timers

**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 2 WARNING, 3 SUGGESTION).
**Verified in**: /home/gandalf/IA/brain-issue-1243, HEAD f28864785588b46c6db3e9702e1f16c7381f9b8c, 4 commits over origin/main. Read-only: no code edited, nothing committed, no git stash; every mutation reverted with git checkout -- <file>, git status shows only the untracked change dir.
**Mode**: Strict TDD.

## Runs
- npm test: 7287 tests, 7284 pass, 0 fail, 3 skipped.
- npm run brain:repo:check: clean. npm run brain:change:verify: "Validacion completa: repo + scripts", exit 0.
- Gated diff: 110 (matches expected). Diff budget not at risk.
- Flakiness, taskset -c 0, 10x each: poller.test.mjs 0/10, server.test.mjs 0/10, server-remote.test.mjs 0/10 failures.

## Red-on-parent (detached scratch worktree, parent checkout + commit's test files, removed afterwards)
| Commit | Parent run | Verdict |
|---|---|---|
| 36428086 poller single writer | 2 fail (start/resume/resume 2!==1; pause-in-flight-then-resume) | RED. The "settles while paused arms nothing" and "close after pause-resume" tests pass on parent: guards, not reds (W2) |
| fc236166 server follow-up after close | 1 fail (R1243-2 close with follow-up in flight) | RED |
| f3b604e4 state model + page | 15 fail (poller R3/R4, banners, server stderr/state, remote-render) | RED |
| f2886478 change-dir filter | 2 fail (git-tree.test.mjs import of changeDirNames; remote-changes stray blob) | RED. change-route stray-blob test already passes on parent (drawer reader already filtered): guard, as tasks.md 4.1 says |

## Requirement compliance
| Req | Proving test | Result |
|---|---|---|
| R1243-1 one handle | poller.test.mjs:898, :914, :927; code poller.mjs arm/disarm :282-287 | COMPLIANT |
| R1243-2 no timer after close | server-remote.test.mjs:313; poller.test.mjs:938; server.mjs closed guard :207, set first in close() | COMPLIANT |
| R1243-3 paused = user pause | poller.test.mjs:961; server.test.mjs (resume probe, stderr line) | COMPLIANT |
| R1243-4 resume never lifts halt | poller.test.mjs:976, :990, :1002 | COMPLIANT |
| R1243-5 page | banners.test.mjs:151, :160, :168; remote-render.test.mjs:188 | COMPLIANT |
| R1243-6 tree-only filter | git-tree.test.mjs:51; remote-changes.test.mjs:194; change-route.test.mjs:188 | COMPLIANT |

## Issue acceptance criteria
1. start, resume, resume leaves one armed timer: poller.test.mjs:898 (pending 1, 0 after close). Met.
2. No armed timer after close(): :898 tail, :938. Met.
3. Pause during in-flight tick then resume leaves one handle: :914. Met.
4. No timer after close() with a follow-up recompute in flight: server-remote.test.mjs:313. Met.
5. Both readers pick the dir over issue-5-notes.md: remote-changes.test.mjs:194, change-route.test.mjs:188 (guard), unit git-tree.test.mjs:51. Met.

## Mutations (each reverted, git status clean afterwards)
- (a) arm() skips the clear: 1 fail, poller.test.mjs "pause during an in-flight tick, then resume" (:914). The start/resume/resume test does NOT fail (W1).
- (b) drop closed guard in armRemoteFollowUp: 1 fail, the R1243-2 close test. Killed.
- (c) resume() clears forgeHalted: 3 fail (R1243-4 tests, :976, :990, :1002). Killed.
- (d) drop the tree filter in changeDirNames: 3 fail (git-tree unit, remote-changes blob, change-route blob). Killed.

## Class sweep (brain/scripts/ui/**, watcher excluded per R4, filed #1245)
- poller.mjs: timer is written only in arm() and cleared in disarm()/the fired wrapper; start/pause/resume/once/close/scheduleNext all route through them; scheduleNext checks closed and tickWanted after the tick's await. Clean.
- server.mjs: followUp has one arming site (armRemoteFollowUp, guarded by closed) and two clears (the fired callback, close()). Clean.
- Remaining setTimeout hits: render-budget.mjs (client, per-render, not a poller chain), static/app.js, test-support, watcher debounce (out of scope). No bypass found.

## Apply deviations
- cold-6 probe switched from pause to resume (server.test.mjs): JUSTIFIED. pause() would mutate state and its response is no longer a "state read" of a halted poller; resume on an unpaused poller is a spec'd no-op (R1243-4) and returns state(). Asserts paused false and forgeHalted true, the spec's own control-route scenario.
- Null-poller indicator returns toggle: null (banners.mjs): ACCEPTABLE. Before the stream connects there is no state to act on, so offering Pause/Resume would be a control that cannot act (R1243-5 spirit). Not in the spec's four cases, covered by the updated #881 test. See S1.
- pollIndicator falls back to lastError when forgeHaltReason is absent, then to 'unknown': ACCEPTABLE, defensive for older snapshots/meta; spec says text derives from forgeHaltReason, state() always supplies it. See S2.

## Findings
### CRITICAL
None.
### WARNING
- W1: After the R2 fix, resume() on a not-paused poller is a no-op, so the spec scenario "Start, then resume twice" no longer reaches arm()'s clear; test :898 passes under mutation (a). The clear is protected only by :914. Both guard the invariant, but the headline defect-1 test is now a regression guard for R1243-4, not R1243-1. Consider a direct test calling once() or start() while a handle is armed.
- W2: Two tests added under tasks 1.2 (:927, :938) pass on the parent and so are not reds; they are guards. Same for change-route.test.mjs:188. tasks.md flags the last; the first two are not flagged.
### SUGGESTION
- S1: Add the null-poller toggle:null case to the spec or note it in design (D47) so the traceability table is complete.
- S2: Add a banners test for the lastError fallback or drop the fallback.
- S3: R1243-1's "Pause clears the only chain" scenario has no dedicated test; it is covered implicitly (mutation of disarm in pause would be caught by :927/:914 only partially). A two-line test would close it.

## Resolution

- W1: resolved. New test "arm() clears a live handle before setting, so two settling ticks leave ONE handle" (`poller.test.mjs`, `start()` twice). Mutation: arm() with its disarm() removed fails it (and the in-flight pause/resume test); reverted, tree clean. The start/resume/resume test is retitled as a guard (resume is a no-op while not paused).
- W2: resolved. tasks.md 1.2 now marks the "settles while paused" and "close after pause-resume" tests as GUARDs (pass on the parent).
- S1: resolved. design D47 and spec R1243-5 gain the null-poller case (`toggle: null`), with one scenario.
- S2: resolved. banners.test.mjs covers the `lastError` fallback and the final `'unknown'`.
- S3: resolved. New test "pause clears the only chain": zero armed handles and null `nextAttemptAt` after pause.
