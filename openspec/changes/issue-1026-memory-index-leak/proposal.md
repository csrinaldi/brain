# Proposal: engram.pull.test.mjs stops reindexing the real .memory/index.jsonl (#1026)

## Problem

A cold review of PR #1015 refused twice with:
`the cold-review candidate changed during execution; refusing publication —
1 path(s) changed: ~.memory/index.jsonl`

`pullMemory({root = repoRoot, _rebuildIndex = rebuildIndex})`
(`brain/scripts/memory/backends/engram.mjs:538-541`) defaults `root` to the
real checkout. `brain/scripts/memory/backends/engram.pull.test.mjs`'s own
header comment (lines 26-31, pre-fix) claimed tests (a)-(c)/(e) "rely on the
production `_rebuildIndex` default against the real repoRoot — deliberately
left as-is here since it is pre-existing and out of #361's scope" — asserted
without verification. Measured (isolated `--test-name-pattern` runs,
before/after mtime + content of the real `.memory/index.jsonl`): only (a)
"pull → import in order" and (e) "default _import seam is importMemory"
actually reach the real root and rewrite the real index — (c) "failing git
pull propagates error" does not, because `_gitPull` throws before the
`_rebuildIndex` step (`pullMemory`'s step 2) is ever reached, despite also
omitting `root`.

Content alone is not sufficient evidence that a write happened: on this
repo's checkout right now, `.memory/index.jsonl` is already fully in sync
with `.memory/records/`, so `rebuildIndex()`'s deterministic regeneration
reproduces byte-identical content — `git status`/`git diff` show nothing
even though a real `fs.writeFileSync` against the real root just ran (mtime
changes on every run; confirmed via `sha256sum` and `stat -c '%Y'` before
and after isolated single-test runs).

#1020's `test-hygiene.test.mjs` guard (WRITE_FNS/CWD_REF_RE) does not catch
this shape: it flags a literal `process.cwd()`/`resolve('.')` inside a
test's own write-call arguments. Here the write is not spelled in the test
at all — it is a *default parameter* inside a production function
(`pullMemory`, and eight siblings in `engram.mjs`) that a test reaches
simply by omitting `root`.

Third occurrence of this general class after #1011 (fixed in #1013) and
#1010/#1020 (fixed in #1019/#1022) — same "a test that exercises a real
entrypoint must not write into the real repository root" property, new
shape (default parameter, not a literal cwd reference).

## Approach

Two independent changes, same file scope as the issue's own `brain-graph`
block (`engram.pull.test.mjs`, `test-hygiene.test.mjs`):

- **R1026-1**: `engram.pull.test.mjs`'s tests (a), (c), (e) inject
  `root: '/fake/root'` + a no-op `_rebuildIndex`, matching the pattern the
  file's own newer tests (f)/(g) already use. (c) gets the injection too,
  for defense-in-depth, even though it does not currently reach the real
  root — a future reordering of `pullMemory`'s steps must not silently
  start writing to the real root again without this file's own guard
  catching it. A file-level `before`/`after` hook snapshots the real
  `.memory/index.jsonl`'s content AND mtime around the whole file's run,
  asserting both unchanged — mtime is necessary in addition to content
  because content-only comparison is not sensitive enough on this repo
  today (see Problem).
- **R1026-2**: `test-hygiene.test.mjs` grows a second guard,
  `findMissingRootViolations`, alongside the existing #1020 one: it flags a
  test file that imports (however aliased) and calls one of engram.mjs's
  nine root-defaulting exports — `ensureMemorySymlink` (root is a bare
  positional argument), `share`, `importMemory`, `pullMemory`, `setup`,
  `hydrate`, `save`, `featureCheckpoint`, `featureResume` (root is a key in
  an options object) — without supplying `root`. Chosen over the issue's
  suggested suite-level content-hash-snapshot fallback because a
  source-level scan is not too blunt here, PROVIDED it resolves each
  file's own import bindings (to follow aliases like `pullMemory as
  engramPullMemory`) and blanks comments AND string-literal content before
  matching calls (both are real, measured false-positive sources — see
  Non-goals). Ten genuinely-safe indirect call sites (root passed through a
  local helper function, or root's value never dereferenced because the
  one seam that consumes it is always mocked) are allowlisted with
  per-entry justification rather than silently ignored.

## Non-goals

- No same-file variable/function-indirection tracing (`const opts = {root:
  X}; pullMemory(opts)`, or `pinnedSeams(root)` returning an object with
  `root` set) — same "direct-only, zero-known-false-positive floor"
  non-goal already established for #1020's WRITE_FNS guard. Measured: this
  exists today in `save-parity.test.mjs` (`pinnedSeams(root)`) and is
  allowlisted rather than traced.
- No general call-graph analysis of which seams inside a root-defaulting
  function actually dereference `root` against the filesystem (would let
  `engram.import.test.mjs`'s `importMemory()` calls, which always mock the
  one root-consuming seam `_readRecords`, pass without an explicit `root`)
  — allowlisted instead, with the specific seam-mocking reasoning recorded.
- `pull()` (engram.mjs's own zero-arg wrapper around `pullMemory()`) is not
  in the scanned function list — "pull" is too generic an identifier to
  scan by bare name without a false-positive storm, and no test in this
  repo calls it directly today (verified via `rg '\bpull\(\)'`).
