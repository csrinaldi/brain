# Apply progress: candidate integrity for the cold-review stage (#1010)

## Culprit list (unit 1 measurement)

Empirical, not read. From a clean worktree (`.engram` absent), ran each
suspect file alone under `GIT_CONFIG_GLOBAL=/dev/null node --test <file>`
and checked for `.engram` after each — all came back clean:
`session-start.test.mjs`, `session-start-config.test.mjs`,
`brain-upgrade.test.mjs`, `harness/backends/{claude,plain,antigravity,
settings-hooks}.test.mjs`, `i18n/coverage.test.mjs`.

The full suite (`npm test`) DID create `.engram -> .memory` in the real
repo root. Traced with `strace -f -tt -s 300 -e trace=symlink,symlinkat,
execve`:

```
71722 execve(".../node", [".../node", ".../brain/scripts/memory/cli.mjs", "setup"], ...)
71722 symlink(".memory", "/home/gandalf/IA/brain-issue-1010/.engram") = 0
```

Reproduced in isolation: `node --test
brain/scripts/memory/cli.backend-fallback.test.mjs` alone creates
`.engram -> .memory` in the real repo root. **Sole culprit**: that file's
`#641 setup is NOT substituted` test, via its `runCli()` helper —
`spawnSync(process.execPath, [CLI, ...args], {encoding:'utf8', env})` with
no `cwd` override, spawning the REAL `cli.mjs` file (whose `repoRoot` is
fixed by `import.meta.url`, independent of `cwd`). `runCli()` already sets
`BRAIN_MEMORY_TEST_ROOT`, and `cli.mjs`'s `ROOTED_OPS` already forwards
`{root: memoryTestRoot}` for the `setup` op — but `engram.setup()` took no
parameters at all, so the forwarded root was silently discarded.

An earlier instrumentation attempt (unconditional `console.error` inside
`ensureMemorySymlink`) showed zero calls with `root === repoRoot` in the
parent process's captured stdout — a red herring: `runCli()`'s
`spawnSync(..., {encoding: 'utf8'})` captures the child's stderr into
`r.stderr` rather than piping it to the parent terminal, so the trace fired
but was invisible until `strace` named the syscall directly.

## TDD Cycle Evidence

| Unit | RED | GREEN | Mutation → RED | Commit |
|---|---|---|---|---|
| 2. `engram.setup({root})` | Guard test added first; failed `false !== true` (sandboxed root never got `.engram`) | Fix applied; 31/31 pass, real root untouched | Pre-fix state (no `{root}` param) IS the mutation — already captured as RED above | `7bea99f9` |
| 3. `candidate-snapshot.mjs` symlink hash | Symlink tests added first; threw `EISDIR` on dir-link exactly as the issue measured | Fix applied (`readlinkSync`); 3/3 pass | Reverting to `readFileSync` reproduces the captured EISDIR RED | `80083864` |
| 4. refusal names paths | Extended existing test + new bound test; both failed (`actual` had no path list) | Fix applied; 39/39 pass | Dropping `describeCandidateChange(...)` from the reason reproduces the captured RED | `cfad1d6c` |
| 5. claude backend disables hooks | New test added first; failed (`flagIndex === -1`) | Fix applied; 9/9 pass, 123/123 harness suite | Dropping the `--settings` args reproduces the captured RED | `7d4af22e` |
| 5b. run-stage.test.mjs fallout | Full-suite run surfaced 1 failing test pinning the exact argv | Narrowed assertion to the model flag only; 22/22 pass | N/A — regression fix, not a new behavior | `205935e5` |

## Commits

1. `7bea99f9` — fix(memory): engram setup() honours BRAIN_MEMORY_TEST_ROOT
2. `80083864` — fix(review): candidate snapshot hashes a symlink by its target
3. `cfad1d6c` — fix(review): the candidate-changed refusal names the paths
4. `7d4af22e` — fix(harness): claude backend disables every hook for the stage
5. `205935e5` — test(harness): run-stage's model-flag test tolerates the new tail

## Final verification

- Targeted suites (cli.backend-fallback, engram.setup, backend-selection,
  candidate-snapshot, run-cold-review-stage, claude.test.mjs — 82 tests) ×3:
  green every run, `.engram` never appeared in the real repo root.
- `GIT_CONFIG_GLOBAL=/dev/null npm test`: **5590/5590 pass** (main was
  5586 green after #1013; +4 net from the new tests added here, one
  regression test fixed inline). `.engram` absent before and after — unchanged.
- `npm run brain:repo:check`: clean before every commit.
- Counted diff (`git diff --numstat origin/main...HEAD`, excluding
  `.test.mjs`/`openspec/`/`.memory/`): **94** lines — well under the 400
  budget.
- `git status --short`: clean except this `openspec/changes/` directory,
  which the record-first memory commit will not touch.

## Tasks

All 5 tasks in `tasks.md` are marked `[x]`.
