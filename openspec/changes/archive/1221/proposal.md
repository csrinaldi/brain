# Proposal: tests feed child stdin from a file, not spawnSync `input` (#1221)

## Problem
In the cold reviewer's Codex sandbox, a child spawned with `spawnSync(..., { input })` never sees EOF on
its stdin pipe. Anything that reads stdin to EOF hangs until the timeout. The three newline-less
`#1214` tests in `bootstrap.memory-backend-validate.test.mjs` time out there while passing locally and in CI.

## Change
- `runFragment` writes the answer bytes to a temp file and adopts it as fd 0 (`exec 0<file`).
- The rest of the suite is swept; every site whose child reads to EOF gets the same file-based treatment.
- `test-spawn-hygiene` allowlist line pins are updated.

## Non-goals
No production code changes. `bootstrap.sh` is untouched.
