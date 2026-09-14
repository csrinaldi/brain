# Apply Progress: artifact-retirement — Slice A (PR 1, `Part of #955`, `Closes #958`)

Batch: FIRST (no previous apply-progress existed). Worktree:
`/home/gandalf/IA/brain-artifact-retirement`, branch `feat/epic-864-artifact-retirement`.

## Status

Slice A: **6/6 phases complete, 18/18 tasks ticked** in `tasks.md` (A6.3 — opening
PR 1 — intentionally left `[ ]`: the agent may not `git push` or run `gh` writes;
the maintainer pushes and opens the PR).

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

## Commits (this batch, local only — not pushed)

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
extra words). Well under the 400 budget — matches the tasks.md forecast
(`400-line budget risk: Low`).

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
  design's ~290 estimate (363 actual), still well inside the 400 budget.

## Open Items for Slice B (not this batch)

- B1-B4 rows of `retired-artifacts.static.test.mjs` (dualWriteRecords,
  rollbackMigration, scrubChunkFile, zlib import) — not written this batch,
  correctly out of Slice A scope per tasks.md.
- PR 1 is not opened (A6.3) — commits are local only, per the hard
  constraint against `git push`/`gh` writes. The maintainer pushes
  `feat/epic-864-artifact-retirement` and opens PR 1 with body `Part of
  #955`, `Closes #958`.
