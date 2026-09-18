---
status: approved
issue: 1026
capability: test-hygiene
---

# Spec: engram.pull.test.mjs and the missing-root guard (#1026)

## R1026-1: the test suite leaves the real `.memory/index.jsonl` unchanged after running

- Every test in `brain/scripts/memory/backends/engram.pull.test.mjs` that
  calls `pullMemory()` MUST inject both `root` and `_rebuildIndex`, matching
  the pattern the file's own (f)/(g) tests already use
  (`engram.pull.test.mjs:102-141`).
- The file MUST assert, via a `before`/`after` hook
  (`engram.pull.test.mjs:37-83`), that the real `.memory/index.jsonl`
  (resolved the same way `engram.mjs`'s own `repoRoot` constant is —
  `join(dirname(fileURLToPath(import.meta.url)), '../../../..')`) is
  BOTH byte-for-byte content-identical AND has an unchanged `mtimeMs`
  before vs. after the whole file's run. Content alone is INSUFFICIENT:
  `rebuildIndex()` regenerates the index deterministically from
  `.memory/records/`, and on a checkout where the index is already in sync
  (the common case here), a stray write reproduces byte-identical content —
  the write still happens, it is invisible to a content-only diff. This
  MUST assert *unchanged*, never *absent* — the file legitimately exists
  and must stay as it was.
- A full run of `GIT_CONFIG_GLOBAL=/dev/null node --test
  brain/scripts/memory/backends/engram.pull.test.mjs` MUST leave
  `git status --short .memory/index.jsonl` empty afterward.

## R1026-2: the hygiene guard covers production functions whose root parameter defaults to the repo

- `brain/scripts/test-hygiene.test.mjs` MUST scan every `*.test.mjs` file
  under `brain/scripts/**` and `test/**` (the same `WALK_GLOBS` the #1020
  guard already uses) for a call to one of `engram.mjs`'s root-defaulting
  exports made without an explicit `root`:
  - Positional-root export: `ensureMemorySymlink` (`engram.mjs:85`) — a
    violation is a zero-argument call.
  - Object-key-root exports: `share` (174), `importMemory` (381),
    `pullMemory` (538), `setup` (931), `hydrate` (802, root in its FIRST
    object arg), `save` (622, root in its SECOND object arg, after a
    leading `title`/`content`), `featureCheckpoint` (1042),
    `featureResume` (1171) — a violation is a call whose full argument
    text never contains the word `root` (covers both `root: x` and
    shorthand `{root}`).
  - `rebuildIndex` (`brain/scripts/memory/lib/store.mjs:157`) is
    EXCLUDED: it takes `{recordsDir, indexPath}` with no default and is
    only reachable through the `_rebuildIndex` seam of the functions
    above.
- The guard MUST resolve each scanned file's own import bindings for these
  names from any `...engram.mjs` specifier, however aliased (`{ save as
  engramSave }`), and check calls under the LOCAL (possibly aliased) name —
  a bare-identifier scan is insufficient: `reindex-parity.test.mjs` and
  `no-artifact.parity.test.mjs` import `share`/`pullMemory` exclusively
  under aliases (`engramShare`, `engramPullMemory`).
- The guard MUST blank `//` and `/* */` comments AND string/template
  literal content before matching calls (keeping newline positions and
  overall length so reported line numbers stay accurate). Both are
  measured, not hypothetical, false-positive sources: `engram.pull.test.mjs`'s
  own assert message ("...reached pullMemory()'s production repoRoot
  default"), and test-name strings in `engram.save.test.mjs`,
  `engram.share.test.mjs`, and `engram.feature.test.mjs` (e.g. `test('T-E1
  — ... makes save() reject ...')`) all read as a call to the plain regex
  without this.
- A match is a violation unless present in an annotated allowlist (file,
  line, function, reason) — same design as the #1020 `ALLOWLIST`. No
  same-file variable/function-indirection tracing (`const opts = {root:
  X}; pullMemory(opts)`, or a local `pinnedSeams(root)` helper) — direct
  call-site text only, same non-goal as the #1020 guard.
- Running the guard against the real repo MUST report zero UN-allowlisted
  violations.
- The guard's scan root MUST be a parameter (not hardcoded to the real
  repo), so a fixture root under `testTmp()` can prove detection without
  touching the real tree.

## Out of scope

- Tracing a same-file variable or helper function that builds an options
  object containing `root` and is passed to a call by reference
  (`save-parity.test.mjs`'s `pinnedSeams(root)`) — allowlisted, not traced.
- General call-graph analysis of which internal seam actually dereferences
  `root` against the filesystem (`engram.import.test.mjs`'s `importMemory()`
  calls never touch the real root because their one root-consuming seam,
  `_readRecords`, is always mocked) — allowlisted, not traced.
- `pull()`, `engram.mjs`'s zero-arg `pullMemory()` wrapper — too generic an
  identifier to scan by bare name; unused directly by any test today.
