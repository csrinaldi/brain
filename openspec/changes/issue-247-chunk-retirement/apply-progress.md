---
status: proposed
issue: 247
---

# Apply progress — #247 the chunk read-back becomes an enforced boundary

Batch: 1 of 1 (no prior apply-progress existed). Worktree
`/home/gandalf/IA/brain-issue-247`, branch
`fix/issue-247-fixmemory-complete-the-c4-chunkrecords-m` at base `51ff915f`.
Strict TDD mode active, test runner `npm test` (node:test). Wrap-up (W1-W6)
and PR opening are explicitly the orchestrator's per this batch's launch
scope — not attempted here.

## Section 0 — live measurements (re-run, all confirmed matching design/tasks)

- **0.1** `rg -n "collectChunkObservations" brain/ test/` — importer set exactly
  `engram.mjs:48` (pre-4.1), `cli.mjs:615`, `migrate-v1.test.mjs:13`. Matches
  design/tasks exactly; no fourth row.
- **0.2** `plainfiles.share({root: tmp})` with real deps (`buildRecord` +
  `appendRecord` + `share`) over a seeded `mkdtempSync` store — the recursive
  `<tmp>/.memory` listing is exactly `['index.jsonl', 'records',
  'records/<the seeded record's own filename>']`. Matches design A6's
  assumption exactly (the actual filename is `2026-07-rec-<hash>.jsonl`, not
  a literal `<seed>`).
- **0.3** `npm test` baseline: **5139/5139 pass, 0 fail** before the first red
  test.
- **0.4** Chunk-path-literal set (`.memory/chunks` / `"chunks"`), production
  `.mjs`, comments excluded: `cli.mjs:572` (`const chunksDir = join(...,
  "chunks")`), `engram.mjs:261/:566` (pre-4.1 lines; `_defaultReadObservations`
  and `_defaultChangedChunkFiles`'s `readdirSync` target). Recorded per
  design's Open Question 1; not acted on this slice.
- **0.5** Every ledger anchor re-read — **twice**: once before Work Unit 4.1
  (confirmed byte-identical to design.md's already-corrected anchors, zero
  further drift), and again **after** 4.1 landed, because the header note
  inserted 13 lines ahead of the import block and shifted every subsequent
  `engram.mjs` line number by exactly +13. Both `tasks.md` and `design.md`
  now carry the post-header-note anchors (see the ledger table below).

## Work Units — status

- [x] **Work Unit 1** — `brain/scripts/memory/chunk-boundary.test.mjs` (NEW).
  Tasks 1.1-1.4 all done, TDD evidence below. Commit `fac50fe6`.
- [x] **Work Unit 2** — `plainfiles.share.test.mjs` exact-tree pin. Tasks
  2.1-2.2 done. Commit `7616c73d`.
- [x] **Work Unit 3** — brain-audit/brain-check records-only pin, same file
  as Work Unit 1, new case. Task 3.1 done (green-on-arrival, stated as such).
  Commit `d6379b42`.
- [x] **Work Unit 4** — `engram.mjs` header note. Task 4.1 done (commit
  `ba5dcf08`). Task 4.2 (`governance/run-check.test.mjs:32` prose →
  cross-reference) done in the review-correction batch, commit `75afb500`,
  re-wrapped to ~72 cols in `aea77892` — see "Review corrections" below.
- [x] **Work Unit 5** — ledger, epic 2.3 rewrite, #874 comment. Tasks 5.1-5.2
  done (commit `031434ce`, which also carries the #247 SDD planning trail —
  proposal/explore/spec/design/tasks were untracked in this worktree before
  this batch). Task 5.3 posted in the review-correction batch as
  issuecomment-5625476087 — see "Review corrections" below.
- [ ] **Wrap-up (W1-W6)** — explicitly out of this batch's scope per the
  launch instructions ("leave the wrap-up/PR for the orchestrator"). `npm
  test` full-suite numbers are recorded below for W1's record.

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1 | 2-row allowlist (cli.mjs:615 omitted) run against the real tree — `deepEqual` failed, `found` included `cli.mjs:615` the 2-row list didn't, proving the whole-source matcher saw the 3-line dynamic `await import(...)` | — | — |
| 1.2 | (continues 1.1) | 3rd annotated row added; `assert.deepEqual(sortedFound, sortedAllowlist)` passed | Allowlist line for `engram.mjs` corrected `48→61` after Work Unit 4.1 shifted it; re-ran, green again |
| 1.3 | Two independent proofs authored: (a) a `testTmp`-isolated fixture importer scanned alone vs an empty allowlist — `notDeepEqual` must hold; (b) the real `found` set vs an allowlist with one added stale row — `notDeepEqual` must hold | Both assertions pass on first run (they assert inequality, so "RED" here is the mismatch they're designed to detect, proven present) | Rewrote the fixture-importer string via concatenation (`'im' + 'port'`) after discovering the literal `import {...} from '...'` text in the fixture-writing test was itself being matched by the guard scanning its OWN file (`chunk-boundary.test.mjs` is under `brain/scripts/**`) — see Issues Found |
| 1.4 | N/A — stated as a pin, not red-first (spec.md's explicit scenario: the guard is already true today) | zero-importers + zero-definition assertions pass | — |
| 2.1 | Deliberately wrong expectation `['index.jsonl', 'records']` (no seeded-file entry) asserted against the real tree — failed, `actual` had the extra `records/<filename>` entry | — | — |
| 2.2 | (continues 2.1) | Expectation corrected to the measured tree (`0.2`); passed | — |
| 3.1 | N/A — pin, green on arrival (PR #258 already migrated both readers); stated as such in the commit body, not claimed as red-first | assertions pass | — |
| 4.1 | N/A — docs-only header note, not test-driven | full suite green after the edit; `git diff` confirms comment-only, 13 lines, no behaviour change | — |
| 5.1-5.2 | N/A — docs | ledger tables confirmed byte-identical in `tasks.md`/`design.md`; epic `tasks.md:32` rewritten verbatim per design | — |

## Test results

- Focused (chunk-boundary.test.mjs + plainfiles.share.test.mjs): **11/11 pass, 0 fail**.
- Full `npm test`:
  - Baseline (measurement 0.3, before any red test): **5139/5139 pass, 0 fail**.
  - Final (after all 5 commits): **5148/5148 pass, 0 fail** (+9 new tests: 8 in
    `chunk-boundary.test.mjs`, 1 in `plainfiles.share.test.mjs`).

## Counted lines (measured, `brain.config.json:18-29` exclusions applied)

`git diff --stat 51ff915f..HEAD -- . ':(exclude)**/*.test.mjs'
':(exclude)openspec/changes/**'` → **13 lines**, `engram.mjs` only (the
header note). Forecast was ~12; measured 13. Total reviewer-visible diff:
1182 insertions + 1 deletion across 9 files. `400-line budget risk: Low`
holds — counted is 13, far under budget.

## Commits (this batch, all local, none pushed)

| SHA | Message |
|---|---|
| `fac50fe6` | `test(memory): add chunk-boundary guard — annotated allowlist, bidirectional, readChunkObservations pin (#247)` |
| `d6379b42` | `test(memory): pin brain-audit/brain-check as records-only readers (#247)` |
| `7616c73d` | `test(memory): pin plainfiles share writes no chunk file, exact tree (#247)` |
| `ba5dcf08` | `docs(memory): point each chunk seam at its #874 ledger row (#247)` |
| `031434ce` | `docs(openspec): rewrite epic task 2.3 to the read-back boundary wording, restate ledger on #874 (#247)` |

## Deviations from design

- **Ledger anchors moved** (measured drift, not a design error): Work Unit
  4.1's header note shifted every `engram.mjs` line at or after the import
  block by exactly +13. `tasks.md`/`design.md`'s ledger and the guard's
  `ALLOWLIST` were all re-measured and corrected post-edit (see Section 0.5).
  Design's own anchors (already corrected once from the proposal) needed a
  second correction pass this apply had to perform live — exactly the kind
  of drift `tasks.md 0.5` anticipated.
- **Task 4.2 not done** — `governance/run-check.test.mjs:32`'s prose → cross-
  reference update is outside this batch's allowed-write paths. No production
  or guard behaviour depends on it; it is a documentation pointer only. Left
  for the orchestrator to schedule (amend scope or accept as a stated PR gap).
- **Task 5.3 drafted, not posted** — see the #874 comment text below;
  posting is the orchestrator's per this batch's no-`gh`-writes restriction.
- **`migrate-v1.test.mjs` not extended** — design.md's module map lists it as
  MOD ("the allowlist is a contract, not an accident"), but `tasks.md`'s
  Work Units never assign it as a checklist item, and it is outside this
  batch's allowed-write list. Not touched. The allowlist contract is already
  enforced by `chunk-boundary.test.mjs`'s bidirectional check regardless.

## Issues found

- The fixture-importer test in Work Unit 1.3 initially used a literal
  `"import { collectChunkObservations } from './lib/migrate-v1.mjs';\n"`
  string. Because `chunk-boundary.test.mjs` itself lives under
  `brain/scripts/**` (one of the guard's own walk roots), that literal text
  was matched by the guard scanning ITS OWN source, registering as a second
  real importer and breaking the main allowlist-equality test. Fixed by
  building the fixture source via string concatenation (`'im' + 'port'`) so
  it never appears as a literal import statement in the guard's own file.
  Worth flagging for any future source-scanning guard test in this repo that
  plants fixture import syntax as a string literal.

## #874 ledger comment — posted as issuecomment-5625476087

Posted (by the orchestrator, between batch 1 and this correction batch)
using the wording drafted below, which predates this batch's row 6/7
wording fixes (MINOR-1, MINOR-2). The posted GitHub comment therefore still
reads `bootstrap.sh:304` and `.jsonl.gz` (48 files) rather than the
corrected `brain/scripts/bootstrap.sh:302-308` / "47 files +
migration-rejected.json (48 tracked total)" wording now in `tasks.md`/
`design.md`. Flagged as a residual risk below — no `gh`-write scope in this
batch to edit the already-posted comment.

> Carried over from #247 (this change) — task 3.2 must delete these seven
> surfaces, row 4 only after the #469 re-proof.
>
> | # | surface (file:line) | dies at | note |
> |---|---|---|---|
> | 1 | `engram.mjs#_defaultShareExport` `:486-493` | **3.2** | the `engram sync --export` call itself |
> | 2 | `engram.mjs#_defaultReadObservations` `:273-275` + import `:61` | **3.2** | the read-back; allowlist row 1 |
> | 3 | `dualWriteRecords`'s `_readObservations` seam — default `share():199`, call `:345` | **3.2** | proposal said `:323`; measured `:345` (post-header-note) |
> | 4 | `_defaultChangedChunkFiles` `:578-609`, `scrubMaterializedChunks` `:686`, `assertExportDestinationIsRead` `:653` | **3.2, last** | delete only after #469's fail-closed guarantee is re-proved over record-first `save` |
> | 5 | `engram.share.test.mjs` (~1069 lines, ~15 chunk-scrub tests) | **3.2** | largest line count in 3.2; not an allowlist row (mocks the seam) |
> | 6 | `.engram → .memory` symlink ensure `engram.mjs:221`; `bootstrap.sh:304`; `.gitattributes:5`; `.memory/manifest.json` untracked | **2.4** | D3's order: after 3.2, or #803's manifest churn returns |
> | 7 | `secret-scrub.mjs`'s gunzip/`scrubChunkFile`; `collectChunkObservations` in `migrate-v1.mjs:42` + `cli.mjs:615`; `.memory/legacy/*.jsonl.gz` (48 files); `.gitignore:81-84` | **2.4** | legacy gz reader story: zero readers outside `migrate-v1 --rollback` (`cli.mjs:578`) |
>
> This PR (#247) added the guard (`brain/scripts/memory/chunk-boundary.test.mjs`)
> that pins rows 1-3, 5, and part of 7 (the `collectChunkObservations`
> allowlist) as the current state; task 3.2 is what deletes them.

## Review corrections (batch 2, cold-reviewer findings)

A fresh-context reviewer measured the batch-1 output against the real repo
and found 2 MAJOR + 2 MINOR doc-accuracy issues plus a guard-strength gap
(7 mutants the chunk-boundary guard did not catch). Worktree unchanged
(`/home/gandalf/IA/brain-issue-247`, same branch, base still `51ff915f`).
Two new local commits on top of the 7 from batch 1.

### Findings and fixes

- **MAJOR-1** — `engram.mjs:20-21` claimed the seven-row ledger "lives
  byte-identical" in `tasks.md`/`design.md`; measured only row 1 actually
  matched (rows 2-7 differed in wording, not substance). Fixed: the header
  comment now says "is restated"; `tasks.md`'s task 5.1 dropped the
  `byte-identical,` claim it could not back; `tasks.md`'s ledger rows 2-7
  were replaced with `design.md`'s exact wording so the two tables are now
  word-for-word identical (confirmed via diff, ignoring leading indentation
  only).
- **MAJOR-2** — `run-check.test.mjs:33-34` said the guard is "pinned
  repo-wide", but `WALK_GLOBS` was `['brain/scripts/**/*.mjs',
  'test/**/*.mjs']` and three tracked production modules lived outside it
  (`brain/core/config-migrations.mjs`, `brain/core/managed-paths.mjs`,
  `brain/project/check-refs-rules.mjs`); a planted importer in `brain/core/`
  was measured to pass the guard 8/8 (undetected). Fixed: `WALK_GLOBS`
  widened to `['brain/**/*.mjs', 'test/**/*.mjs']`; measured live that none
  of the three modules imports a chunk symbol today, so the real
  `ALLOWLIST`/found set is unchanged. The comment is now literally true and
  was re-wrapped to ~72 cols.
- **MINOR-1** — ledger row 7 said `.memory/legacy/*.jsonl.gz` (48 files);
  measured: 47 `.jsonl.gz` + `migration-rejected.json` = 48 tracked files
  total. Fixed the wording in both `tasks.md` and `design.md`.
- **MINOR-2** — ledger row 6 cited `bootstrap.sh:304`; measured the real
  range is `brain/scripts/bootstrap.sh:302-308`, and that block *delegates*
  driver registration to `cli.mjs setup` rather than registering
  `engram-manifest` itself. Fixed the wording (with the corrected anchor and
  the delegation clarification) in both `tasks.md` and `design.md`.
- **MINOR-3** — the guard's importer detection survived 7 planted evasions,
  each proven against a scratch copy of the *old* detection logic before any
  edit landed, then proven to die against the hardened version: (C)
  `export { collectChunkObservations } from '...'` re-export; (E)
  `import { collectChunkObservations as grabChunks }` aliasing; (F)
  `import * as mig from '...'` + `mig.collectChunkObservations(...)`; (G)
  `const mod = await import(...)` + `mod.collectChunkObservations`; (H1-H3)
  `readChunkObservations` redefined as `export async function`, `export
  const`, or a bare (non-exported) `function` paired with a separate
  `export { readChunkObservations }` list. Hardening: `CHUNK_IMPORT_RE`
  gained an `export` alternative and alias-stripping (`s.split(/\s+as\s+/)
  [0]`) on named-import lists; a new `NAMESPACE_BINDING_RE` + syntax-
  anchored `<name>.collectChunkObservations` member-access check covers F/G
  (deliberately NOT a free-text substring scan — that would self-match the
  guard's own fixture-building source, discovered and fixed mid-batch, see
  "Issues found" below); `readChunkObservations`'s definition scan gained
  two more anchored patterns (`export (async )?function|const|let|var`, a
  bare `function`, and a line-anchored `export { }` list). One test added
  per mutant (7 new tests, all using the same string-concatenation trick as
  batch 1's fixture test to avoid the guard self-matching its own source).
- Ticked task 4.2 (done in `75afb500`, already on the branch before this
  correction batch started — re-wrapped for length in this batch) and task
  5.3 (the #874 ledger comment was posted: `issuecomment-5625476087`).

### TDD evidence — guard hardening (mutant-survival proof)

| Mutant | RED (old logic, scratch copy) | GREEN (hardened logic) |
|---|---|---|
| C re-export | Confirmed NOT caught — `chunkImporters` returned `[]` for the fixture | New test: `found.length === 1` after adding the `export` alternative |
| E aliased import | Confirmed NOT caught — names array kept `"collectChunkObservations as grabChunks"` whole | New test: `found.length === 1` after alias-stripping |
| F namespace import + member access | Confirmed NOT caught — `{ }` destructuring required, none present | New test: `found.length === 1` after `NAMESPACE_BINDING_RE` |
| G non-destructured dynamic import + member access | Confirmed NOT caught — same gap as F | New test: `found.length === 1` |
| H1 `export async function` | Confirmed NOT caught — old pattern required `export function` (no `async`) | New test: file listed in `definesReadChunkObservations` |
| H2 `export const` | Confirmed NOT caught — old pattern required `function`, not `const` | New test: file listed |
| H3 bare `function` + `export { }` list | Confirmed NOT caught — neither half alone matched `export function` | New test: file listed |

Proof method: a scratch copy of the pre-edit detection logic
(`/tmp/.../scratchpad/mutant-proof/old-logic.mjs`, deleted after use) run
against isolated fixture files for each of the 7 mutants, confirming all 7
passed through undetected; then the same fixtures re-run against the
hardened logic (`new-logic.mjs`) confirming all 7 are now caught; then the
hardened logic applied to the real tracked file and re-verified against the
real repo tree (found set unchanged: still exactly `engram.mjs`, `cli.mjs`,
`migrate-v1.test.mjs`) before committing.

### Issues found (this batch)

- The `namespaceImporters` JSDoc and the top-of-file `NAMESPACE_BINDING_RE`
  comment originally spelled out the real exploit pattern in prose (e.g.
  `` `import * as mig from '...migrate-v1.mjs'` `` immediately followed by
  `` `mig.collectChunkObservations(...)` ``) — this made the guard's own
  file self-match when scanning the real repo tree (`assert.deepEqual`
  failure, `chunk-boundary.test.mjs` appearing in `found`). Same root cause
  as batch 1's fixture-string issue, different location: explanatory prose,
  not fixture-building code. Fixed by (a) genericizing the doc comments to
  use `<name>` placeholders instead of concrete `mig`/`mod` bound next to
  the member-access phrase, (b) never writing a real quoted specifier ending
  in `migrate-v1.mjs` directly after `from`/`import(` in prose (use bare
  `migrate-v1.mjs` without quotes, or an ellipsis-only placeholder), and (c)
  anchoring `BARE_EXPORT_LIST_RE` to line-start (`^\s*export\s*\{`) so an
  unrelated prose mention of the phrase cannot match mid-line. Worth
  flagging generally: any source-scanning guard test whose OWN file lives
  inside its walked roots must audit not just fixture-building code strings
  (batch 1's lesson) but also its explanatory comments for the same
  self-match risk.

### Test results (this batch)

- Focused: `node --test brain/scripts/memory/chunk-boundary.test.mjs
  brain/scripts/governance/run-check.test.mjs` — **128/128 pass, 0 fail**
  (121 pre-existing + 7 new mutant tests).
- Full `npm test`: **5155/5155 pass, 0 fail** (+7 over batch 1's 5148),
  run before each of the two commits below.

### Commits (this batch, both local, none pushed)

| SHA | Message |
|---|---|
| `aea77892` | `test(memory): harden chunk-boundary guard against 7 review-found evasions (#247)` |
| `55fa7d81` | `docs(sdd): fix ledger wording, bootstrap.sh anchor, legacy file count, tick 4.2/5.3 (#247)` |

### Files changed (this batch)

| File | Action | What |
|---|---|---|
| `brain/scripts/memory/chunk-boundary.test.mjs` | Modified | Widened `WALK_GLOBS`; hardened `CHUNK_IMPORT_RE` (export + alias-stripping); added `NAMESPACE_BINDING_RE` + `namespaceImporters`; hardened `definesReadChunkObservations` (extracted as a function, 3 anchored patterns); 7 new tests |
| `brain/scripts/governance/run-check.test.mjs` | Modified | Comment-only: re-wrapped the cross-reference line to ~72 cols |
| `brain/scripts/memory/backends/engram.mjs` | Modified | Header-comment-only: "lives byte-identical" → "is restated" |
| `openspec/changes/issue-247-chunk-retirement/tasks.md` | Modified | Task 5.1 wording fix; ledger rows 2-7 synced to `design.md`; row 6/7 corrections; ticked 4.2, 5.3 |
| `openspec/changes/issue-247-chunk-retirement/design.md` | Modified | Ledger row 6 (bootstrap.sh anchor + delegation wording) and row 7 (48-file breakdown) corrections |

### Deviations from design (this batch)

None — all fixes are corrections toward what the design/spec already
intended (accurate cross-file claims, a guard that actually covers its
stated surface); no new design decision was made.

### Risks (this batch)

- The already-posted `issuecomment-5625476087` on #874 now lags the
  corrected local ledger wording (MINOR-1/MINOR-2, see above) — a follow-up
  comment or edit is needed before #874 is worked, or a reader will see two
  slightly different versions of row 6/7.

## Remaining tasks

- [ ] W1-W6 wrap-up and PR opening (orchestrator's per launch scope) —
  W1's `npm test` numbers: baseline 5139/5139 (batch 1), 5155/5155 final
  (this batch, after both correction commits)
