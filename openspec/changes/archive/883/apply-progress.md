---
status: complete
issue: 883
batch: 1
---

# Apply progress — local-worktree-overlay (issue 883)

Mode: Strict TDD (node:test). Tasks: 32/32 done. Gated diff: 651 lines against the `lite` budget of 1000 (measured with the governance ignore list; the new test-support fixture, 73 lines, is counted).

## Commits (branch feat/issue-883-featui-slice-5-local-overlay-uncommitted)

| sha | subject |
|---|---|
| 2a10fe85 | feat(ui): the snapshot lists the linked worktrees of open issues and the drawer reads their change dir as uncommitted (#883) |
| c3cb1fc2 | feat(ui): local documents are read safely, compared as git blobs, capped at three worktrees per issue, and never written (#883) |
| 15c3be46 | feat(ui): local blocks sit beside remote ones, a clean block at its origin tip collapses, and a branch of any type resolves (#883) |
| 94f67d2b | feat(ui): the drawer draws an on-this-machine block per worktree and reloads when this issue's worktree changes (#883) |
| cf4ef68c | feat(ui): the watcher holds two directory watches per open-issue worktree and the server keeps them in step with the section (#883) |

## TDD cycle evidence

| Task | RED (first failing message) | GREEN | REFACTOR |
|---|---|---|---|
| 1.2/1.3 | `local-overlay.test.mjs` "R883-6: an untracked proposal…": `Cannot read properties of undefined (reading '0')` (`value.local` undefined) | passes | `capText` exported, `change-route.mjs` still has no `node:fs` |
| 2.1/2.2 | `local-worktrees.test.mjs`: import failed (no `LOCAL_DRAWER_CAP`), then 11 of 15 failing on behaviour | 15/15 | `HIDDEN` causes named once |
| 2.3/2.4 | `snapshot-cli.test.mjs` "text mode lists a local line": no `local` line; `server.test.mjs` R1199-6: `localWorktrees` missing from the forge-unavailable override | passes | `snapshot.mjs` header states the one working-tree read |
| 3.1/3.2 | blob / progress / same-as-main tests failing (`blob` undefined) | 8/8 | |
| 3.3/3.4 | symlink, stale-dir, torn-read tests failing; the FIFO test hung the file (the plain read blocks on a FIFO), so the run was killed and re-run with `--test-timeout` | 14/14 | |
| 3.5/3.6 | "R883-13: four worktrees…": `expected: 3, actual: 4` | 18/18 | |
| 3.7 | resume outcome test: `Cannot read properties of null (reading 'state')` (confirmed by reverting the line) | passes | `remoteResume` renamed `resumeOutcome`, shared; source guard that `local-overlay.mjs` never names `root` |
| 4.1/4.2 | `change-route.test.mjs` wording/argv tests and the fix/ branch test failing; same-as-origin and Working memory wording tests failing | all pass | sweep: no `slice 5` or `feat/issue-${` left in `ui/` |
| 5.1/5.2 | `drawer-model.test.mjs`: no `LOCAL_STATE_WORDING` export | 43/43 | |
| 5.3/5.4 | `local-render.test.mjs`: 5 of 6 failing (no local block rendered) | 7/7 | `appendBlockRows` shared by remote and local blocks |
| 6.1/6.2 | `watcher.test.mjs`: `w.setLocalTargets is not a function` (5 tests) | 26/26 | |
| 6.3/6.4 | `server.test.mjs` acceptance 1 and the keep-handles test failing (the server never called `setLocalTargets`) | passes | headers amended |

Two tests were written together with their code and checked RED afterwards by reverting the line: the resume outcome (3.7) and the section note for an unreadable section (R883-2, no separate RED).

## Verification

- `npm test`: 7483 tests, 7480 pass, 0 fail, 0 cancelled (the other 3 are skipped or todo markers already in the suite).
- local-overlay, watcher and change-route tests, 10 runs each: 0 failures in 30 runs.
- `npm run brain:repo:check`: green.
- Real smoke on this machine (`server.mjs --port 3994`, read-only): `localWorktrees` ok with 12 entries; hidden `{served: 1, bare: 0, prunable: 0, detached: 0, notIssue: 3, closed: 49}`; #1114 shows 3 read blocks, 4 capped, with the cap note; #1263 has no served change dir and its two blocks come first. #883's own worktree is the served root, so it is hidden by design (R883-1, R4) and shows no local block.

## Deviations

- D82(1): R881-3's amendment is recorded in this change's `spec.md` ("Modifies R881-3" note under R883-16) instead of the archived 881 spec, by orchestrator ruling; design D82 and task 6.5 were adjusted. `proposal.md` still lists the archived spec as a modified file (not edited: approved).
- The server only watches a worktree's `openspec/changes/` when its real path stays inside the worktree, and its change dir only when `dirState` is `present` (R6: never watch through a symlink). Not in the design; covered by a server test.
- A section that could not be read (not pending) adds a one-line `localNote` to the drawer ("this machine's worktrees were not read: …"), so a forge-less server says why the overlay is absent instead of hiding it. R883-2 only forbids failure wording for an ok section with zero entries.
- `test/publish-allowlist.e2e.test.mjs` canary raised 9.5 to 9.6 MB (one line, net zero): the tarball measured 9.50 MB.
- `fake-git.mjs` `branch --list` now accepts several patterns (the two globs of D81).
