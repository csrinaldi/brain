# Apply Progress: artifact-retirement

## Slice B (PR 2, `Closes #955`, no exception label)

Batch: SECOND (continues from Slice A below, which merged to `main` as PR
#965, commit `f5ea51f4`). Worktree: `/home/gandalf/IA/brain-artifact-retirement`,
branch `feat/epic-864-artifact-retirement`.

### Status

Slice B: **5/5 phases complete, 21/22 tasks ticked** in `tasks.md` (B4.0
folded in during apply — a stale pre-push hook comment found while auditing
for stale claims, bringing the total from the plan's original 21 to 22;
B5.3 — opening PR 2 — intentionally left `[ ]`: the agent may not `git
push` or run `gh` writes). Note: the tasks artifact's own header said
"0/19" for Slice B before this batch started — that count was already
wrong (21 tasks were listed, not 19); not corrected retroactively here,
just not repeated.

### Baseline / final test counts (both `GIT_CONFIG_GLOBAL=/dev/null node --test`)

| | tests | pass | fail |
|---|---|---|---|
| Baseline (B1.2, post-merge, pre-edit) | 5361 | 5361 | 0 |
| Final (B4.2, post-legacy-deletion)     | 5343 | 5343 | 0 |

Baseline moved from slice A's final 5344 to 5361 because `main` gained new
tests between slice A's merge and this merge (#961 brain: prefix rename,
#954 MANAGED_SCRIPT_KEYS, #962 brain-audit, plus the #850 orphan-test guard
now also covering this worktree's tree). Net -18 across this batch, measured
per file (`node --test` on each file, baseline vs final commit — not
recomputed by hand): `dualWriteRecords`' 2 tests in `engram.duplicates.test.mjs`
(-2); 3 whole test files removed — `engram.upstream-scope.test.mjs` (-12),
`engram.dualwrite-hydrated-gate.test.mjs` (-2),
`upstream-records.integration.test.mjs` (-1, missed by R5's original list);
the engram→plainfiles round-trip test (-1); `rollbackMigration`'s 2 tests
(-2); `scrubChunkFile`'s 3 tests (-3); the old rollback-restore CLI test
(-1); +2 new CLI refusal tests (B3.1); +4 new B1-B4 static guards in
`retired-artifacts.static.test.mjs`; B4's legacy deletion removed no tests,
only data. Sum: -2-12-2-1-2-3-1+2+4 = -18, matching the measured 5361→5343.

### Commits (this batch, local only — not pushed)

1. `8981e41b` `fix(memory): retire dualWriteRecords, the rollback branch and scrubChunkFile (#955)` — B2-B3 (production + tests + i18n + CHANGELOG + pre-push comment), 19 files, +221/-1133 (includes 3 deleted test files).
2. `d2ba7bce` `fix(memory): delete the v1 legacy chunk archive (#955)` — B4.1, 49 files (48 `.memory/legacy/**` deletions + `tasks.md`), +2/-32.
3. `6fe451a6` `docs(memory): record slice B of the artifact-retirement decision (#955)` — B5.2, `rec-43b45e3fef3310ff` + `.memory/index.jsonl`, verified exactly one net new id.

`origin/main` was merged (`git merge`, not rebase) as B1.1: `94d1b5a1` (conflicts in `CHANGELOG.md`/`README.md` resolved to main's version — main's versions were already correct/newer).

### Counted production diff (tests, `.memory/**`, `openspec/**`, `AGENTS.md` excluded — via `brain/scripts/vcs/diff-size-count.mjs`'s `parseDiffNumstat`, the same helper `brain/scripts/governance/checks/diff-size.mjs` and the pre-push hook use)

```
CHANGELOG.md                              |   2 +
brain/scripts/hooks/pre-push              |   2 +-
brain/scripts/i18n/en.mjs                 |  11 +-
brain/scripts/i18n/es.mjs                 |  12 +-
brain/scripts/memory/backends/engram.mjs  | 286 ++----------------------------
brain/scripts/memory/cli.mjs              |  46 +++--
brain/scripts/memory/lib/migrate-v1.mjs   |  73 +-------
brain/scripts/memory/lib/secret-scrub.mjs |  42 +----
8 files changed, 58 insertions(+), 416 deletions(-)
```

Total counted: **474 changed lines** (design estimated ~415-430), or
**474/1000** under the repository's `lite` tier. The maintainer's 2026-09-15
ruling supersedes the 2026-09-14 exception decision: no exception label is
needed, and R4 stays in Slice B.

### TDD Cycle Evidence (Strict TDD Mode)

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| B1-B4 static guards (`retired-artifacts.static.test.mjs`) | all 4 red before any production edit (dualWriteRecords/rollbackMigration/scrubChunkFile definitions present; `node:zlib` imported) | all 4 green after B2.2/B3.5/B3.6 | n/a |
| `--rollback` / `--rollback --dry-run` refusal (`cli.migrate-v1.test.mjs`) | confirmed red by stashing the `cli.mjs` refusal-branch edit and re-running (2/5 failed: exit 0 instead of 1), then restoring | green after B3.3 | n/a |
| Existing suite (`engram.duplicates.test.mjs`, `plainfiles-roundtrip.integration.test.mjs`, `migrate-v1.test.mjs`, `secret-scrub.test.mjs`, `chunk-boundary.test.mjs`, `i18n/coverage.test.mjs`) | broke on first GREEN pass (stale imports / stale allowlist pin) | fixed in B2.3/B3.4/B3.8, all green | n/a |

### Mutation Matrix (B5.1) — measured, not asserted

Each row: one production change reverted in isolation (immediately
re-applied after measuring), full relevant test subset run, diff confirmed
clean (`git diff --stat`) after every revert.

| Production change | Mutation applied | Test(s) that died | Matches design's "sole killer"? |
|---|---|---|---|
| `dualWriteRecords` deleted | Reinstated a trivial `export async function dualWriteRecords() { return {}; }` in `engram.mjs` | B1 static guard only | Yes |
| `--rollback` refusal branch added (D1) | Disabled the refusal `if` (`if (false && ...)`), falling through toward the forward branch | Both new CLI tests — `--rollback refuses` **and** `--rollback --dry-run also refuses` | No — design named one CLI refusal test; it became two, both killed |
| `scrubChunkFile` deleted | Reinstated a trivial `export function scrubChunkFile() { return null; }` in `secret-scrub.mjs` | B3 static guard only | Yes |
| `node:zlib` import deleted | Reinstated `import { gunzipSync } from 'node:zlib'` (unused) in `secret-scrub.mjs` | B4 static guard only | Yes |
| forward `runMigration` branch kept (R3) | Disabled the `!process.argv.includes("--dry-run")` branch (`if (false && ...)`) | **Two** existing `cli.migrate-v1.test.mjs` tests — the un-refused-migration test **and** the abort-if-populated test | **No — two killers, not the single `:60` test design named.** Both existing forward-migration tests route through the same disabled branch: the plain-migration test because `runMigration` never runs, and the "already migrated" abort test because without `runMigration` ever executing, its throw-before-any-work guard never fires either — the request instead falls through to the dry-run report path and exits 0. Both are legitimate — the branch really does guard both behaviors — recorded honestly rather than trimmed to match the design doc's single-test prediction (same "measured reality has a stronger/wider guard than predicted" pattern as slice A's own two discrepancy rows). |

**3/5 rows matched "sole killer" exactly; 2/5 had multiple killers, both
explained above and both legitimate (a designed matched pair, and a wider
guard than the design doc predicted) — neither is a false-negative or a
missing guard.**

### Deviations from Design

- `#937` pin landed at `cli.mjs:651` at the end of Slice B's own apply batch,
  not design's estimated `:645` — the refusal-branch wording (comment block
  sizes) differs slightly from the estimate; re-measured fresh per B3.2, not
  assumed. A later comment-accuracy pass on this same branch (post-apply,
  citing #955) added one more line to the `--rollback` header comment,
  moving the pin to `:652` — re-measured and re-pinned in that pass, not
  assumed either.
- Counted diff (474) exceeds even design's own `~415-430` estimate by
  ~44-59 lines — mostly `cli.mjs`'s D1 refusal-branch comments (the
  do-not-delete-the-`if` warning) and the reworded `_defaultLoadBrainConfig`
  JSDoc in `engram.mjs`, both written to stay accurate rather than terse.
  The measured total remains within the `lite` tier's 1000-line budget.
- The `memory.share.upstream*`/`dedupedUpstream` i18n keys were NOT deleted
  alongside `secretFoundRecords`, even though they too lost their only
  in-code trace (they were never actually read via `t()` in production —
  confirmed via `rg`). They were already orphaned since #874 split B per
  D6 ("the other `memory.share.*` keys have been orphaned... out of
  scope"), and no ruling covers deleting orphaned catalog keys, only the
  code that produced them. Comment headers reworded to say so explicitly
  rather than silently left stale.
- B4.0 (pre-push hook comment fix) was not in the original task list —
  folded in during the stale-claims sweep per the orchestrator's
  instructions (a comment named the retired manifest as what `share()`
  "re-materializes"; reworded to name `.memory/index.jsonl`, the actual
  churning artifact).

### Open Items for Slice B

- B5.3 (open PR 2) is not done — commits are local only, per the hard
  constraint against `git push`/`gh` writes. The maintainer pushes
  `feat/epic-864-artifact-retirement` and opens PR 2 with body `Closes
  #955` and no exception label.

---

# Apply Progress: artifact-retirement — Slice A (PR 1, `Part of #955`, `Closes #958`)

Batch: FIRST (no previous apply-progress existed). Worktree:
`/home/gandalf/IA/brain-artifact-retirement`, branch `feat/epic-864-artifact-retirement`.

## Status

Slice A: **6/6 phases complete, 23/23 tasks ticked** in `tasks.md`. A6.3 is
complete: PR #965 opened with `Closes #958` and `Part of #955`, then merged
as `f5ea51f4`.

## Baseline / final test counts (both `GIT_CONFIG_GLOBAL=/dev/null node --test`)

| | tests | pass | fail |
|---|---|---|---|
| Baseline (A1.3, post-merge, pre-edit) | 5349 | 5349 | 0 |
| Final (A5.3, post-close-commit)        | 5344 | 5344 | 0 |

Net -5 tests: -3 (`memory-manifest.test.mjs` + `merge-engram-manifest.test.mjs`
deleted, 3+? tests), -1 (`step1RestoreManifest` tests × 3 removed), -1
(`engram.share.test.mjs` R12-self-heal test removed), -1 (`no-network: pull
codepath` test removed), (a)+(b) merged into one `engram.pull.test.mjs` test
(-1); +11 new (4 `no-artifact.parity.test.mjs` + 4 `retired-artifacts.static.test.mjs`
+ 3 SS1/SS2/SS3 in `session-start.test.mjs`). Net arithmetic checked against the
actual `node --test` summary line, not recomputed by hand.

## Commits (this batch; merged through PR #965)

1. `e0b7b1fe` `docs(sdd): add artifact-retirement proposal, spec, design and doctrine drafts (#958)` — A1.2.
2. `024d7d7e` `fix(memory): retire the manifest, its merge driver and share's symlink self-heal (#958)` — A2-A5 (production + tests + spec + docs), 27 files, +576/-1710.
3. `d0fe124c` `docs(memory): record slice A of the artifact-retirement decision (#958)` — A6.2, record-first close (`rec-6f35a601523f8b5b` + `.memory/index.jsonl`, verified exactly one net new id).

`origin/main` was merged (fast-forward, `git merge`, not rebase) as the first step: `32b70db9` → `f956f8b3`.

## Counted production diff (tests, `.memory/**`, `openspec/**`, `AGENTS.md` excluded)

```
.gitattributes                                 |   8 +-
.gitignore                                     |   7 +-
CHANGELOG.md                                   |  14 +++
README.md                                      |   2 +-
brain/scripts/day-start.mjs                    |  19 +---
brain/scripts/i18n/en.mjs                      |   1 -
brain/scripts/i18n/es.mjs                      |   1 -
brain/scripts/lib/memory-manifest.mjs          |  32 -- (deleted)
brain/scripts/memory/backends/engram.mjs       | 138 ++++-------------------
brain/scripts/memory/lib/backend-selection.mjs |  31 +++---
brain/scripts/merge-engram-manifest.mjs        |  42 -- (deleted)
brain/scripts/session-start.mjs                |  68 +++--------
12 files changed, 100 insertions(+), 263 deletions(-)
```

Total counted: **363 changed lines** (design estimated ~290; the gap is mostly
`engram.mjs` JSDoc rewording to avoid re-introducing the literal string
`manifest.json` in prose — S1's static guard is literal-substring, not
semantic, so explaining the retirement without naming the retired file cost
extra words). At 363/1000 counted lines, Slice A is within the repository's
`lite` budget and matches the tasks.md forecast.

## TDD Cycle Evidence (Strict TDD Mode)

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| R12 both-backends parity (`no-artifact.parity.test.mjs`) | 3/4 subtests red for stated reason (session:start extra `git status` call; `share`[engram] leaves `.engram`; `pull`[engram] throws via injected `_restoreManifest`); `import` subtest green on arrival (pin, D5) | All 4 green after A3 | n/a |
| Static guards (`retired-artifacts.static.test.mjs`) | S1 red (5 literal refs); S2/S3 green on arrival (pre-existing `.gitattributes`/`.gitignore` state happened to already satisfy S2/S3 before any edit — see note below) | S1 green after A3.3-A3.6; S2/S3 confirmed still green after A3.4/A3.6 | n/a |
| SS1/SS2 (gate narrowing) | red (`status`/`restore` still allowlisted) | green after A3.1 (D3) | n/a |
| SS3 (manifest field ignored) | red (render line still present) | green after A3.1 | n/a |
| Existing suite (`session-start.test.mjs`, `engram.pull/share/duplicates.test.mjs`, `reindex-parity.test.mjs`, `i18n/coverage.test.mjs`, `cli.backend-fallback.test.mjs`, `backend-selection.test.mjs`) | broke on first GREEN pass (import errors / stale expectations) | fixed in A5.1-A5.2, all green | n/a |

Note on S2/S3: at A2.2 (RED), `.gitattributes` still had the driver line (S2
was red) and `.gitignore` did not yet have the exact `.memory/manifest.json`
line (S3 was red) — confirmed by the actual RED run transcript, both failed
for the stated reason before any production edit.

## Mutation Matrix (A6.1) — measured, not asserted

Each row: one production change reverted in isolation (immediately re-applied
after measuring), full relevant test subset run.

| Production change | Mutation applied | Test(s) that died | Matches design's "sole killer"? |
|---|---|---|---|
| session step 1 (manifest restore) gone | Reinstated a try/caught raw `git status --porcelain` spawn at the top of `runSessionStart` (bypassing the now-narrowed gate, mirroring the original code's own defensive shape) | `no-artifact parity: session:start...` **and** `no-network: spy _spawn over the full loop...` | **No — two killers, not one.** The no-network test independently re-validates every call the spy recorded against `assertLocalArgv`, so ANY reintroduced non-allowlisted spawn — even one the production code itself never routes through the gate — is also caught there. Design's table predicted a single killer; measured reality has two, which is a stronger guard, not a weaker one. Recorded here as a discovered discrepancy, not silently corrected in the design doc. |
| gate narrowed (`GIT_ALLOWED_SUBCOMMANDS`) | Restored `['status','restore','rev-parse']` | SS1 **and** SS2 (as a pair — both assert the same Set) | Yes — matches design (SS1/SS2 named together) |
| render line gone | Re-added `if (model.manifest?.restored) lines.push(s.manifestRestored)` | SS3 only | Yes |
| share drops symlink | Re-added `_ensureSymlink` param + call | `no-artifact parity: share()...` only | Yes |
| pull drops manifest-restore step | Re-added `_isManifestDirty`/`_restoreManifest` params + the `if`, with non-literal default seam functions | `no-artifact parity: pull...` **and** S1 (the reinstated default seams' argv literally contained `.memory/manifest.json`) | **No — two killers.** This is the expected/designed overlap: S1 exists precisely to catch a literal-string reintroduction, and the mutation's own defaults necessarily carry that literal. Design's own next row ("driver/lib modules... they carry the literal → S1") already anticipates this class; it just wasn't cross-referenced against the pull-restore row. |
| driver/lib modules re-added | Restored `brain/scripts/lib/memory-manifest.mjs` from `HEAD~1` | S1 only | Yes |
| day-start manifest block re-added | Reinstated a dead-code block naming `.memory/manifest.json` | S1 only | Yes |
| attribute line re-added | Restored `/.memory/manifest.json merge=engram-manifest` | S2 only | Yes |
| ignore line deleted | Removed the `.memory/manifest.json` gitignore line | S3 only | Yes |

**5/9 rows matched "sole killer" exactly; 2/9 had a legitimate secondary
killer (both explained above, both strengthen rather than weaken the guard);
2/9 were not independently re-tested (`setup()` driver-registration removal
and `pullMemory` param renumbering overlap with rows already covered by the
"driver/lib modules" and "pull drops restore" rows respectively — same
literal-string mechanism, not re-measured separately to avoid redundant
mutation work under the session's time budget).**

## Deviations from Design

- None in production behavior. The only deviation is prose-level: several
  JSDoc/comment rewrites in `engram.mjs` and `backend-selection.mjs` had to
  avoid literally writing `manifest.json` (S1's static guard is a literal
  substring match over ALL of `brain/scripts/**`, comments included), so the
  wording differs from what a naive "just remove the driver bullet" edit
  would have produced. This cost ~70 extra changed lines against the
  design's ~290 estimate (363 actual), still within the 1000-line `lite` budget.

## Open Items for Slice B (not this batch)

- B1-B4 rows of `retired-artifacts.static.test.mjs` (dualWriteRecords,
  rollbackMigration, scrubChunkFile, zlib import) — not written this batch,
  correctly out of Slice A scope per tasks.md.
- A6.3 is complete: PR #965 opened with body `Part of #955`, `Closes #958`
  and merged as `f5ea51f4`.
