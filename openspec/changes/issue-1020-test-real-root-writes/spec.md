---
status: approved
issue: 1020
capability: test-hygiene
---

# Spec: real-root write hygiene for the test suite (#1020)

## R1020-1: the suite leaves the real root unchanged

- `archive.test.mjs` 4.1 ("Integration: E2E CLI run over sandbox layout")
  MUST build its sandbox under a temp root outside the real repo working
  directory (`testTmp()`), never under `join(process.cwd(), ...)`.
- The test MUST resolve `archive.mjs`'s script path independently of its own
  `process.cwd()` (via `import.meta.url`), so the test's behavior does not
  depend on the caller's working directory.
- The test MUST assert, via a before/after snapshot of the real repo root's
  entry list, that running it leaves the root's entries unchanged. An
  absence claim on a single named path (e.g. `scratch`) is insufficient —
  the assertion covers the whole root.
- A full run of `GIT_CONFIG_GLOBAL=/dev/null node --test
  brain/scripts/archive.test.mjs` MUST leave no `scratch/` directory (or any
  other new entry) in the real repo root afterward.

## R1020-2: the class stays closed

- A source-level guard MUST scan every `*.test.mjs` file under
  `brain/scripts/**` and `test/**`.
- The guard MUST fail if any scanned file contains a write call
  (`mkdirSync`, `writeFileSync`, `symlinkSync`, or `cpSync`) whose own
  argument list directly references `process.cwd()` or
  `resolve('.')`/`resolve(".")`, unless the match is present in an
  annotated allowlist (file, line, reason).
- The guard's scan root MUST be a parameter (not hardcoded to the real
  repo), so a test can point it at an isolated fixture root to prove
  detection without polluting the real tree.
- Known read-only `process.cwd()` uses (e.g.
  `agent-runtime.test.mjs:401,410`, `installed-version.test.mjs:67`,
  `engram.branch.test.mjs:67`, `ui/server.test.mjs`'s `parseArgs` default
  comparisons) MUST NOT be flagged — none of them pass a `process.cwd()`
  reference directly into one of the four write calls' own argument list.
- Running the guard against the real repo MUST report zero violations after
  R1020-1 lands.

## Out of scope

- Tracing a same-file variable built from `process.cwd()` earlier and passed
  to a write call by name (indirect form). Measured to be unsafe to add
  naively on this repo today (see proposal.md's false-positive note on
  `installed-version.test.mjs`).
