---
status: draft
issue: 1093
---

# Tasks — #1093

- [x] **T1** Write `brain/scripts/bootstrap.cross-tree-code.test.mjs` covering REQ-1093-1
      through -6: `WORKTREE_ROOT`/`BRAIN_SCRIPTS` resolution, the home-scaffold direct-call
      reproduction, the silent-swallow-becomes-visible case, the hard guard (fires / does not
      fire), and the `$PM run brain:memory:pull` worktree-vs-main resolution.
- [x] **T2** RED: run the new suite standalone against the unmodified `bootstrap.sh` — confirm
      all 6 fail because `WORKTREE_ROOT=`/`BRAIN_SCRIPTS=` do not exist yet.
- [x] **T3** Add `WORKTREE_ROOT`/`BRAIN_SCRIPTS` capture (before `REPO_ROOT`), and the hard
      `brain/scripts/` existence guard.
- [x] **T4** Repoint every direct `node brain/scripts/...` call at `$BRAIN_SCRIPTS`; wrap
      `brain:memory:pull`/`brain:memory:index` in a `(cd "$WORKTREE_ROOT" && ...)` subshell;
      move PM detection into the same subshell.
- [x] **T5** Convert the two silent `brain-config.mjs`/`home-scaffold.mjs` `|| true` swallows
      into warn-and-track (`MISSING_OPTIONAL`), moving the array's declaration earlier so both
      sites can add to it.
- [x] **T6** Export `AGENT_PLATFORM`, `SDD_ENGINE`, `MEMORY_BACKEND` after each is resolved,
      before the `harness/cli.mjs`/`memory/cli.mjs` calls that depend on them.
- [x] **T7** GREEN: re-run the new suite standalone — all 6 pass.
- [x] **T8** Regression check: `bootstrap.worktree.test.mjs` (#657, 9 tests) passes unmodified.
- [x] **T9** Full suite (`npm test`) green, no regressions — including fixing two pre-existing
      drift guards this change's new file/comment text tripped (`memory-script-prefix.test.mjs`
      bare `memory:` token in a comment; `test-spawn-hygiene.test.mjs` allowlist for the two
      `execFileSync` call sites in the new test file).
- [x] **T10** `npm run brain:repo:check` green.
- [x] **T11** SDD artifacts for this change (`proposal.md`, `spec.md`, `design.md`, `tasks.md`).
