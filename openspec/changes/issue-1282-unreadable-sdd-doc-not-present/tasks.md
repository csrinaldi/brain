---
status: approved
issue: 1282
---

# Tasks — unreadable-sdd-doc-not-present (issue 1282)

Strict TDD. Runner: `node --test brain/scripts/ui/tab-source.test.mjs`, then `npm test`.

- [x] 1.1 RED — tab-source.test.mjs R1282-1, R1282-2, R1282-3 (worktree symlink, origin symlink entry, unresolvable origin sha). Failed on current code: `present` was true.
- [x] 1.2 GREEN — `buildSourcedSddTab`: `present` excludes `unreadable`; the row detail is `could not be read: <reason>` (D106).
- [x] 1.3 Class sweep (D107): no other instance; nothing to fix.
- [x] 1.4 Close — full suite, repo:check, nav, gated diff, mutation checks.
