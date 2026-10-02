# Apply progress — multidev-remote-branches (issue 1201)

Batch 1 of 1: phases 1-8 implemented (tasks 1.1-8.4 ticked; 8.5 is the human-gated PR note).

T0 (from design.md): git 2.53.0, `for-each-ref` listing 13 ms, `--merged` 12 ms, 24 branches cold 165 ms.

Commits (work units): resume path (R2), `lib/git-tree.mjs`, `readRemoteChanges`, snapshot wiring + server memo, async fetch + poller lane + refresh route, drawer remote blocks, remote-model + remotes band, UI wiring. The final test-guard commit exists as c3d21c90 (it was once blocked by an unrelated index state; that stash incident was resolved by the orchestrator with the maintainer's authorisation). Verify follow-ups: the remotes lane no longer depends on the forge (W3), the recording shim finds the verb past git's global options (S1).

Measured (real git, local bare remote): 30 grammar branches cold = 74 spawns (2 base + 24 x 3), 6 deferred; warm = exactly 2 spawns; 30 unjoined = exactly 2 spawns. Slowest remote tests: 30-branch cold 1165 ms, 30 unjoined 972 ms (fixture build dominates), everything else under 600 ms.

Gated diff: 977 lines (under the 1000 budget; no size:exception needed).
Full `npm test`: 7231 tests, 7228 pass, 0 fail, 3 skipped.
