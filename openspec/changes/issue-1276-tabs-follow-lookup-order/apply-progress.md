---
issue: 1276
---

# Apply progress — tabs-follow-lookup-order (issue 1276)

Mode: Strict TDD. Batch 1 of 1: all phases (1 to 6) done, 22 of 22 tasks.

## Step 0 (maintainer rulings, recorded before coding)

- Q1 ruled: several origin branches hold the change, the issue's open PR head branch wins (the same first precedence as `resolveBranch`), no PR or no matching holder means refuse and name the branches. Recorded in proposal (rulings table), spec R1276-4 (text and two scenarios) and design D89.
- Q2 ruled as proposed: an unread step stops the walk and says why. Recorded in spec R1276-5 and design D90.
- R3 withdrawn (false report; the tiles are wired to `selectNode`). Removed from all four artifacts: spec R1276-10 and its scenarios, design D93 and the app-smoke test row, tasks Phase 6; R1276-11 became R1276-10, D94 became D93, Phase 7 became Phase 6. No tile change was made.

## Environment

- `git --version`: 2.53.0. `git blame --porcelain --contents - <rev> -- <path>` works with a revision (proved by the R1276-9 real-git tests).

## TDD cycle evidence

The pre-change code was extracted with `git archive HEAD` into a scratch dir, and each new test file was run there to record RED against the unmodified code.

| Task | RED (before the code) | GREEN | Refactor |
|---|---|---|---|
| 1.2 first RED | `tab-source.test.mjs` R1276-1 failed with `Cannot read properties of undefined (reading 'kind')` (no `tabSource`; `sdd` was the no-change-dir failure) | passes | |
| 1.4 held | `local-overlay.test.mjs`: 2 failed (the new held test and the `held: new Map()` deepEquals) | 29 pass | |
| 1.3, 1.5, 1.6 | | `localBlock` returns `{block, held}`; `holdingWorktrees`, `pickTabSource`, `publicSource`; `resolveBranch` uses `holdingWorktrees` | the R883-15 tests stay green |
| 2.1 to 2.3 | `tab-source.test.mjs` against pre-change code: 18 of 18 failed (R1276-2, 3, 5 included) | 18 pass on the new code | |
| 3.1 to 3.4 | R1276-9 modified-tasks test failed on the new route before `gitRun` took `input` (`git blame output was empty`); `git-run.test.mjs` input test failed: 1 | `gitRun` pipes `opts.input`; 27 pass | `documentFailure` names the source's ref (3.5) |
| 4.1, 4.2 | `change-route.test.mjs` against pre-change code: 5 of 64 failed (the R1276-4 tests) | 64 pass | |
| 5.1, 5.2 | `drawer-model.test.mjs` pre-change: 4 failed; `local-render.test.mjs` pre-change: 5 failed | 48 and 14 pass | |
| 6.1 | R1276-10 recording runner test (forge proxy, banned flags, one `--contents -` blame, byte digests of the worktree and its admin dir) | passes on the GREEN code, as the task predicted | header comment (6.2) |

Honest note: after the first RED and its GREEN, the route code for phases 2 to 4 was written in one pass and the RED for those tests was recorded against the pre-change snapshot, not between two edits of the route.

## Tasks

All of 1.1 to 6.4 are marked done in `tasks.md`. Task 6.3 output is below.

## Verify on this machine (6.3)

Server code from this worktree, serving the main checkout (port 3992), killed by pid afterwards (gone confirmed). `GET /api/change/1251`:

- `tabSource`: `{kind: worktree, leaf: brain-issue-1251, dir: openspec/changes/issue-1251-ticket-hierarchy, ...}`
- sdd: ok, `from worktree brain-issue-1251 · feat/issue-1251-...`; rows: proposal present, spec present (both `committed on feat/issue-1251-..., not on main`), the rest missing, archive `not read outside the served root`.
- spec: `from worktree brain-issue-1251 · committed on ...`; not ok, because that worktree's `spec.md` declares no `### R<issue>-<n>` heading (a truthful failure from the grammar, not a source failure).
- tasks: `from worktree brain-issue-1251 · not in this worktree`; `tasks.md is not in worktree brain-issue-1251` (it has none yet).

## Results

- `npm test`: 7530 tests, 7527 pass, 0 fail, 3 skipped.
- change-route, tab-source, drawer-model, local-render and local-overlay tests, 10 runs each: 0 failures.
- `npm run brain:repo:check`: green.
- Gated diff (adds plus deletes, excluding tests and openspec): 355 lines against the `lite` budget of 1000.

## Deviations and discoveries

- A served root with no `openspec/changes` directory has a `changes` section that is not ok (ENOENT). R1276-5 says that keeps today's reason, so a first-ever change that lives only in a worktree still reads as no change dir in a repo like that. The tab-source tests give main an unrelated change dir for that reason. Left as specified; the maintainer may want ENOENT treated as an empty section.
- The design said the `from` wording comes from `LOCAL_STATE_WORDING` imported by the route; the route imports the new exported `localStateWording` instead (same table, without the task count that `localRowDetail` appends).
- `tabSource` for `head` carries `{kind, dir}` only; `worktree` and `origin` also carry a `label` the page uses for the empty-state line.
- SDD rows count an `unreadable` worktree document as present (the file exists), with its state as the detail; only `missing` and `deleted` are not present.
