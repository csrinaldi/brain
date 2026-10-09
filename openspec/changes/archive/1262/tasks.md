---
status: approved
issue: 1262
---

# Tasks — paused-poller-and-closed-delta (issue 1262)

Strict TDD: RED, GREEN, REFACTOR per part. Runner: `npm test`; one file runs with `node --test <path>`. No real timers: the poller tests use the fake scheduler and `flush()`.

## Phase 1 — Paused reason (R1262-1, R1262-2, D112, D113)

- [x] 1.1 RED — `status/snapshot.test.mjs` (pending lane with a reason), `ui/lib/banners.test.mjs` (idle band, loading plus idle), `ui/server.test.mjs` (`poll: false` over the cache-backed snapshot, no `vcs`). All fail today.
- [x] 1.2 GREEN — `pendingLane` and `pendingFrom` (`status/report.mjs`, used by `readHierarchy` and `local-worktrees.mjs`), `waitingSections` in `ui/lib/banners.mjs`.

## Phase 2 — Closed delta (R1262-3, D114)

- [x] 2.1 RED — `ui/poller.test.mjs`: closed delta lands before a held open list that no longer lists #5; asserts #5 is closed.
- [x] 2.2 GREEN — `publishClosed` filters at publish time.

## Phase 3 — Cache reasons (R1262-4, D115)

- [x] 3.1 RED — `ui/forge-cache.test.mjs`: closed landing alone keeps the first-poll wording.
- [x] 3.2 GREEN — `holdsAnyAnswer` keys off the open lane; comment corrected.

## Phase 4 — Verify

- [x] 4.1 `npm test` twice, `brain:repo:check`, `brain:nav`, gated diff, mutation checks (see `apply-progress.md`).

## Micro-decisions

- The `idle` flag, not a string match, is how the banner tells idle from loading (D112).
