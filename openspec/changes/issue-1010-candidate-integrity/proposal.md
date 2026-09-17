# Proposal: candidate integrity for the cold-review stage (#1010)

## Problem

`npm run brain:review` failed with `EISDIR: illegal operation on a directory,
read` while re-snapshotting the cold-review candidate. Two independent
defects meet there:

1. **The producer mutates the candidate it is asked to judge.** With hooks
   disabled at the SessionStart layer, the review still failed the same way
   on PR #1015. A watcher on the live candidate worktree caught the cause:
   the reviewer engine runs `npm test` inside the candidate, and the suite
   creates `.engram -> .memory` in the working directory. The only writer,
   `ensureMemorySymlink(root = repoRoot)` (`brain/scripts/memory/backends/
   engram.mjs`), is reached through `engram.setup()`, which — despite
   `cli.mjs`'s `ROOTED_OPS` already forwarding `BRAIN_MEMORY_TEST_ROOT` for
   the `setup` op — took no parameters at all, silently discarding the
   forwarded root and always writing to the real repo root. Empirically
   (measured, not read), the sole path that fires this inside `npm test` on
   this checkout is `cli.backend-fallback.test.mjs`'s own `#641 setup is NOT
   substituted` test, confirmed by `strace -f -e trace=symlink,symlinkat` on
   a full-suite run and reproduced in isolation by running that one file
   alone.
2. **`candidate-snapshot.mjs` reads THROUGH a symlink.** `entry()` hashed a
   symlink with `readFileSync(path)`, which follows the link: a link to a
   directory throws `EISDIR`, and a link to a file is hashed by the target's
   bytes instead of the link's own identity. Defect 1 surfaces as a crash
   instead of the designed refusal "the candidate changed during execution".
3. **The refusal, once it fires correctly, does not say what changed** —
   `run-cold-review-stage.mjs` names only that the candidate changed, not
   which paths, so confirming a fix (or diagnosing a new mutation) requires
   re-attaching a watcher by hand.
4. **Nothing stops the engine's own hooks from running inside the
   candidate** in the first place. The claude harness backend spawns `claude
   -p` with no `--settings` override, so this repo's committed
   `.claude/settings.json` SessionStart hook rides along on every stage,
   including a cold review over the repo's own candidate worktree.

## Approach

- `engram.setup({root})` honours `BRAIN_MEMORY_TEST_ROOT` the same way
  `share()`/`pull()`/`import()` and `plainfiles.setup()` already do, closing
  the actual write path measured above. A guard test drives the real `setup`
  subprocess through the existing `runCli()` harness and snapshots the real
  repo root's `.engram` state before/after (never an absence claim).
- `candidate-snapshot.mjs` hashes a symlink by `readlinkSync` (its target
  string), never by following it.
- `run-cold-review-stage.mjs`'s refusal names the changed paths (bounded to
  the first 10 plus a count).
- `claude.mjs`'s `runStage()` always passes `--settings
  {"disableAllHooks":true}`, kept inside the claude backend only — brain's
  contract with an engine is "must not mutate the candidate", not "must not
  run hooks".

## Non-goals

- `engram.pull()` still does not honour `{root}` — out of scope; not
  implicated in this crash.
- No change to which ops run inside a cold-review candidate (e.g. whether
  `npm test` itself should be disallowed there) — the fix closes the actual
  writer instead.
