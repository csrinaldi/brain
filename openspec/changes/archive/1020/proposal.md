# Proposal: archive.test.mjs stops writing into the real repo root (#1020)

## Problem

With #1019 merged, the cold-review stage names what changed inside the
candidate. Two runs on different heads refused publication with
`the cold-review candidate changed during execution; refusing publication —
1 path(s) changed: +scratch`.

The cold reviewer role allows it to run the suite. One test writes into the
real working directory: `archive.test.mjs:241`'s `4.1: Integration: E2E CLI
run over sandbox layout` built its sandbox under
`join(process.cwd(), 'scratch/test-archive-sandbox')` and removed only that
leaf, leaving the `scratch/` parent behind. Every full-suite run in a fresh
checkout adds a `scratch` directory to the real tree; in a review candidate
that is a changed path and the whole review is refused. Same class as #1011
(fixed in #1013) and #1010 (fixed in #1019): a test that exercises a real
entrypoint must not write into the real repository root.

## Approach

Two independent, small changes:

- **R1020-1**: `archive.test.mjs` 4.1's sandbox moves under
  `testTmp()` (`brain/scripts/lib/test-tmp.mjs`, the repo's existing #842
  per-run tmp-root helper with automatic process-exit cleanup) instead of a
  path under the test's own `process.cwd()`. `scriptPath` resolves via
  `fileURLToPath(new URL('./archive.mjs', import.meta.url))` instead of
  `join(process.cwd(), ...)`, removing the cwd dependency entirely. A
  before/after snapshot of the real repo root's entry list
  (`readdirSync(process.cwd()).sort()`) proves the run leaves the root
  unchanged — never an absence claim on one path.
- **R1020-2**: a new source-level guard, `brain/scripts/test-hygiene.test.mjs`,
  scans every `*.test.mjs` under `brain/scripts/**` and `test/**` for a
  write call (`mkdirSync`/`writeFileSync`/`symlinkSync`/`cpSync`) whose own
  argument list directly references `process.cwd()`/`resolve('.')`, and
  fails unless allow-listed. Scope is the direct inline form only —
  whole-file variable tracing was tried and measured to false-positive on
  `installed-version.test.mjs`'s four same-named, different-scope `root`
  bindings.

## Non-goals

- No full-suite-in-a-temp-root run (too expensive for what this needs to
  prove).
- No general data-flow/AST-based scan of variable-derived paths — direct
  inline detection is the floor this issue asks for ("at minimum a
  source-level scan").
