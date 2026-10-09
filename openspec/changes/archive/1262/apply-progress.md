---
issue: 1262
---

# Apply progress — paused-poller-and-closed-delta (issue 1262)

Mode: Strict TDD. One batch, 9 of 9 tasks done.

## TDD cycle evidence

| Task | RED (before the code) | GREEN | Refactor |
|---|---|---|---|
| 1.1 | 4 tests failed: snapshot pending-with-reason (reason was the loading wording), 2 banner tests (no idle band, loading band claimed), server `poll: false` (graph reason was the loading wording) | `pendingLane`, `pendingFrom`, `waitingSections`; the server test needed the idle flag carried to `hierarchy` and `localWorktrees` (found by its own band assertion) | none |
| 2.1 | poller test failed: closed list `[3]`, expected `[5, 3]` | filter at publish time, `closedHeld` untouched | none |
| 3.1 | forge-cache test failed: per-number miss said "queued" after a closed landing alone | `holdsAnyAnswer` keys off the open lane | comment corrected |

## Verification

- `npm test`, run twice: tests 7607, pass 7604, fail 0, cancelled 0 (3 skipped in the baseline), both runs.
- `npm run brain:repo:check`, `npm run brain:nav`: clean.

## Mutation checks (each reverted)

- Always-loading wording in `pendingLane`: caught by the snapshot test and the server test.
- `publishClosed` deleting from `closedHeld` again: caught by the poller test.
- `holdsAnyAnswer` counting any list: caught by the forge-cache test.
- Banner ignoring `idle`: caught by both banner tests and the server test.
- `pendingFrom` dropping `idle`: caught by the server test.

## Deviations

None. Part 3 decided in D115 with no maintainer question.
