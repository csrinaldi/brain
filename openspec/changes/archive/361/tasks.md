# Tasks — issue #361 reindex parity

- [x] 1. Read the amended `memory-backend-contract.md` (Amendments 1 and 2)
      and re-derive today's actual `share()`/`pull()` behavior from source,
      not from the ticket's table.
- [x] 2. Confirm via `git log` that both fixes (#574 pull reindex, #874
      split B share reindex) landed AFTER the ticket was filed and
      independently of it.
- [x] 3. Add `pullMemory()` reindex-step unit tests to
      `brain/scripts/memory/backends/engram.pull.test.mjs` (tests f, g) —
      previously untested production behavior.
- [x] 4. Add `brain/scripts/memory/backends/reindex-parity.test.mjs`
      (cross-backend share + pull-path parity, plus a shared
      recordsDir/indexPath shape assertion).
- [x] 5. Mutation-prove each new test: revert the corresponding production
      code, confirm exactly the intended tests go RED, restore, confirm
      GREEN (mutation table in `apply-progress.md`).
- [x] 6. Run full `npm test` under `GIT_CONFIG_GLOBAL=/dev/null` isolation;
      confirm count is baseline + exactly the new tests, 0 failures.
- [x] 7. Write `proposal.md` stating the ticket's framing is stale and why.
- [x] 8. Tick epic task 4.1 in
      `openspec/changes/issue-864-memory-2-0/tasks.md`.
- [x] 9. Record-first closing commit via `npm run memory:save`.
