# Verify report — issue-361-reindex-parity (#950, closes #361)

**Verdict: PASS**

## Evidence (HEAD 7335552d)

- No production change — confirmed: `git log` shows only test/doc files touched by #950's commit.
- The defect was already fixed independently before this change started:
  `share()` unconditional reindex via #874 split B (`56de7408`), `pull` reindex Step 3 via #574
  (`a029ed0a`) — proposal.md's comparison table matches current source.
- This change pins it with regression tests: `memory/backends/reindex-parity.test.mjs` (new,
  3 cross-backend tests) + two new tests in `memory/backends/engram.pull.test.mjs`.
- Focused tests: `engram.pull.test.mjs` + `engram.share.test.mjs` + `reindex-parity.test.mjs` →
  **15/15 pass**.
- Epic tracker `openspec/changes/issue-864-memory-2-0/tasks.md` line 45 (task 4.1) ticked,
  landed in the same PR (`#950`) — confirmed via `git log -1 -- tasks.md` = `7335552d`
  (the #950 merge commit), not edited separately here.

## Deliberately left undone

- `engram.pull()`/`engram.setup()`'s pre-existing `{root}` argument bound (unreachable today,
  documented in `cli.mjs`'s `ROOTED_OPS` comment) — out of scope, unrelated to reindex parity.

No CRITICAL / WARNING.
