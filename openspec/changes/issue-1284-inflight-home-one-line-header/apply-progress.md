---
status: applied
issue: 1284
---

# Apply progress — inflight-home-one-line-header (issue 1284)

All tasks 1.1 through 7.4 are done. Strict TDD: each unit was written test first and run red, then green.

## Commits

- feat(ui): the snapshot reads each change dir's last commit and each bare worktree's head time (#1284) — phase 1
- feat(ui): the in-flight model joins open issues across changes, worktrees, branches and PRs (#1284) — phase 2
- feat(ui): the epic gets a short header form and a banner; a card with no work knows its absence is quiet (#1284) — phases 3 and 4 (models)
- feat(ui): the home opens with the in-flight section, the header is one line, quiet cards drop the absence line (#1284) — phase 5
- test(governance): raise the publish canary to 9.7 MB for the in-flight model and its suites (#1284)

## Measurement (task 6.1, D94)

The exact D94 `git log --no-renames --format=%x1e%cI%x1f%an --name-only -- <dirs>` over 58 non-archived change dirs (57 on main plus this change's own) printed 53,223 bytes in 0.07 s. The default `execFileSync` `maxBuffer` is 1 MiB, so the output is about 5% of the limit. No `maxBuffer` constant was added. An overflow would throw and degrade every active row to `the change-dir log could not be read` (covered by the throwing-run test).

## Closing (7.x)

- `npm test`: 7585 tests, 7582 pass, 0 fail, 3 skipped.
- `npm run brain:repo:check` and `npm run brain:nav` pass.
- Gated diff vs origin/main (governance `ignoreList` applied: tests, `.memory/**`, `openspec/**` excluded): 313 added + 17 deleted = 330 lines; `diffSize` against budget 1000 passes. Estimate was about 350.

## Mutation sanity (each reverted)

Eight mutations, each failed at least one test: drop the open filter; drop the stale split; put activity-unknown rows in stale; say "no open issue is in flight" while a source is missing; show the long epic sentence as the header text; make `quietAbsence` ignore remote branches; let one dir take any record in the D94 parse; draw rows while `hierarchy` is not ready.

## Deviations from the design

1. D103 placement: `readLocalWorktrees` makes the single `git show -s --format=%cI` call for worktrees whose `dirState` is `missing` and whose `touchedAt` is null. It cannot know whether a branch time exists, since that lives in `remoteChanges`. The model prefers `touchedAt`/`tipAt` and uses `headCommitAt` only when no branch or worktree time exists, so the outcome matches D103. Entries gain a `headCommitAt` field (null when not asked).
2. R1284-3 text says an issue the hierarchy does not list is included as `state unknown`; D96 (ruled) says an unlisted issue is not open. D96 was followed (54 closed dirs would otherwise show).
3. R1284-8 scenario "Forge sections pending at first paint" says rows from ready sources render while `hierarchy` is pending; D96/RULED says no row until `hierarchy` is ready, only the candidate count. The ruling was followed.
4. Added model fields not in D97: `facts` (row text), `authorLines`, `notices`, `empty`, `candidates`, so `app.js` only places elements.
5. The publish canary in `test/publish-allowlist.e2e.test.mjs` was raised 9.6 to 9.7 MB (about 60 KB of source and suites, no bulk), following the file's own rule to read what was added before raising.
6. Phase 4 and `facts` model code were green before a separate red run was recorded; phases 1, 2, 3 and 5 have recorded red runs.

## Left undone

Nothing. `proposal.md`, `spec.md`, `design.md`, `tasks.md` and this file are untracked in the worktree and are left for the orchestrator to persist and commit.
