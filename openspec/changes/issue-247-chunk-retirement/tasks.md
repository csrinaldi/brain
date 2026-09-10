---
status: proposed
issue: 247
---

# Tasks: #247 — the chunk read-back becomes an enforced boundary, and #874 inherits a ledger

Implements `spec.md` under `design.md`'s A1–A7, ruling `sdd/issue-247-chunk-retirement/ruling`
(D0–D6, 2026-09-10). Parent: #864 task 2.3. Delivery: `ask-on-risk`, already resolved by the
design forecast — **one PR**, `stacked-to-main`, `Closes #247`, `Parent: #864` in prose, label
`type:bug`. Branch: `fix/issue-247-chunk-boundary-guard`.

STRICT TDD MODE IS ACTIVE. Test runner: `npm test` (node:test). Every implementation task below
is preceded by its failing test task, naming the file and case from `spec.md`/`design.md`. Run
the focused `node --test` command after each RED/GREEN pair; run the full `npm test` before each
commit.

## 0. Live measurements apply performs first (no Bash available in `sdd-design`/`sdd-tasks`)

- **0.1** `rg -n "collectChunkObservations" brain/ test/` — the importer set MUST be exactly
  `engram.mjs:48`, `cli.mjs:615`, `migrate-v1.test.mjs:13`. A fourth row goes into the allowlist
  with a `retiredBy` ticket, never silently.
- **0.2** `plainfiles.share({root: tmp})` with real deps over a seeded temp store — capture the
  actual recursive `<tmp>/.memory` listing BEFORE writing task 2's exact-tree expectation
  (design assumed `['index.jsonl','records','records/<seed>.jsonl']`; confirm, don't assume).
- **0.3** `npm test` baseline green BEFORE the first red test, so the red is attributable.
- **0.4** The chunk-path-literal set (`.memory/chunks` / `"chunks"`) across
  `brain/scripts/**` production `.mjs`, comments excluded — the input to design Open Question 1
  (`_defaultChangedChunkFiles:565-596`'s uncovered `readdirSync` reader). Record findings; do not
  act on them this slice.
- **0.5** Re-read every ledger anchor's line number immediately before the PR body is written —
  four already drifted from the proposal (design measured row 3 at `:332` not `:323`; row 4 split
  into three anchors `:565-596`/`:640`/`:673` instead of the proposal's single `:565-596`).

## Work Unit 1 — the guard: allowlist, bidirectional, `readChunkObservations` absent

`brain/scripts/memory/chunk-boundary.test.mjs` (NEW).

- [x] 1.1 RED: write `CHUNK_IMPORT_RE` (design A4) matching both `import { x } from '...'` and
  `const { x } = await import('...')` spanning lines, over whole-source text (not
  `split('\n')` + `/^\s*import\b/`, which cannot see `cli.mjs:615-617`'s 3-line dynamic import).
  Write `ALLOWLIST` with ONLY two rows — `engram.mjs:48`, `migrate-v1.test.mjs:13` — deliberately
  omitting `cli.mjs:615`. `node --test brain/scripts/memory/chunk-boundary.test.mjs` — RED: the
  found set includes `cli.mjs` and the allowlist doesn't, proving the walk saw the multi-line
  dynamic import.
- [x] 1.2 GREEN: add the third annotated row
  `{file: 'brain/scripts/memory/cli.mjs', line: 615, retiredBy: '2.4 — ledger row 7'}`. Focused
  command — GREEN, `assert.deepEqual(sortedFound, sortedAllowlist)` passes.
- [x] 1.3 RED→GREEN, bidirectional (design A3): temporarily plant a fixture importer with no
  allowlist row → fails, naming it; delete the fixture. Then temporarily drop one real allowlist
  row while its import still exists in source → fails (stale-row direction). Restore. Add the
  scan self-check: assert the walk actually read `engram.mjs`, `cli.mjs`, `migrate-v1.mjs`, and
  that `migrate-v1.mjs` still exports `collectChunkObservations`.
- [x] 1.4 RED→GREEN: `readChunkObservations` — assert zero importers AND no
  `/^\s*export\s+function\s+readChunkObservations\b/m` definition anywhere in
  `brain/scripts/**`/`test/**`. Comments (`store.mjs:281`, `store.test.mjs:266,269`,
  `run-check.test.mjs:32`) stay unscanned — already true, pin not red-first; state that plainly
  in the commit body.

Commit: `test(memory): add chunk-boundary guard — annotated allowlist, bidirectional, readChunkObservations pin (#247)`.

## Work Unit 2 — plainfiles `share` chunk-free pin

`brain/scripts/memory/backends/plainfiles.share.test.mjs` (MOD).

- [x] 2.1 RED: new case using REAL deps (no `_rebuildIndex` mock) over `mkdtempSync`, seed
  `<tmp>/.memory/records/<seed>.jsonl`, run `share({root: tmp})`, assert the recursive listing of
  `<tmp>/.memory` equals EXACTLY the array captured live in measurement 0.2 — exhaustive
  enumeration, not `!includes('chunks')`. Assert the tree stays under the `mkdtempSync` path only
  (no write into the real repo).
- [x] 2.2 GREEN: adjust the exact-tree expectation to the measured value if it differs from the
  design's assumption; no production code change expected (`plainfiles.mjs` already never touches
  chunks — one comment at `:145`).

Commit: `test(memory): pin plainfiles share writes no chunk file, exact tree (#247)`.

## Work Unit 3 — the readers' records-only pin

`brain/scripts/memory/chunk-boundary.test.mjs` (same file, new case) — cross-referencing the
existing `brain-audit.test.mjs` / `brain-check.test.mjs`.

- [x] 3.1 Pin (green on arrival, not red-first — state so in the commit body): assert
  `brain-audit.mjs:53` and `brain-check.mjs:28` import `readRecordObservations`, and that neither
  resolves to `readChunkObservations` or `collectChunkObservations`. This guards against a silent
  regression on PR #258's migration.

Commit: `test(memory): pin brain-audit/brain-check as records-only readers (#247)`.

## Work Unit 4 — `engram.mjs` header note (the only production diff, ~12 counted lines)

`brain/scripts/memory/backends/engram.mjs` (MOD); `brain/scripts/governance/run-check.test.mjs:32`
(MOD, prose → cross-reference).

- [x] 4.1 Add a header note pointing each chunk seam at its ledger row (see Work Unit 5's table):
  `_defaultShareExport` (row 1) → `_defaultReadObservations` + import (row 2) → `dualWriteRecords`'s
  `_readObservations` seam (row 3) → the scrub subsystem (row 4, deletable only after the #469
  re-proof) → `engram.share.test.mjs` (row 5) → symlink ensure (row 6, 2.4) → legacy gz/allowlist
  (row 7, 2.4). Nothing that runs changes; `share`, `dualWriteRecords`, and the scrub subsystem
  stay byte-unchanged.
- [x] 4.2 `governance/run-check.test.mjs:32`'s prose comment gains a one-line pointer to
  `chunk-boundary.test.mjs` instead of restating the now-stale narrative. Done in commit
  `75afb500` (correction batch), re-wrapped to ~72 cols alongside the WALK_GLOBS widening in
  the guard-hardening commit.

Commit: `docs(memory): point each chunk seam at its #874 ledger row (#247)`.

## Work Unit 5 — the ledger, the epic 2.3 rewrite, the #874 comment draft

- [x] 5.1 Confirm the seven-row ledger below is restated, substance-identical, in both this file
  and `design.md` (corrected anchors: row 3 at `:345` not the proposal's `:323`; row 4 split into
  three measured anchors instead of one grouped range; all `engram.mjs` anchors re-measured
  **after** Work Unit 4.1's header note — that insertion shifted every line below it by exactly
  +13, per tasks.md 0.5). Wording is copied verbatim from `design.md`'s table so a drift between
  the two files cannot hide behind a paraphrase.

  | # | surface (file:line) | dies at | note |
  |---|---|---|---|
  | 1 | `engram.mjs#_defaultShareExport` `:486-493` | **3.2** | the `engram sync --export` call itself |
  | 2 | `engram.mjs#_defaultReadObservations` `:273-275` + the import `:61` | **3.2** | the read-back; allowlist row 1 |
  | 3 | `dualWriteRecords`'s `_readObservations` seam — default `share():199`, call `:345` | **3.2** | proposal said `:323`; **measured `:345`** (post-header-note) |
  | 4 | `_defaultChangedChunkFiles` `:578-609`, `scrubMaterializedChunks` `:686`, `assertExportDestinationIsRead` `:653` | **3.2, last** | delete **only after** #469's fail-closed guarantee is re-proved over record-first `save`. Proposal grouped all three at `:565-596`; **measured separately** |
  | 5 | `engram.share.test.mjs` (~1069 lines, ~15 chunk-scrub tests) | **3.2** | largest line count in 3.2; not an allowlist row (it mocks the seam) |
  | 6 | `.engram → .memory` symlink ensure `engram.mjs:221` → confined to `setup()`; `brain/scripts/bootstrap.sh:302-308` delegates driver registration to `cli.mjs setup` (does not register `engram-manifest` itself); `.gitattributes:5` (`merge=engram-manifest`) + `merge-engram-manifest.mjs`; `.memory/manifest.json` untracked | **2.4** | D3's order: after 3.2, or the manifest churn of #803 returns |
  | 7 | `secret-scrub.mjs`'s `gunzipSync`/`scrubChunkFile`; `collectChunkObservations` in `migrate-v1.mjs:42` + `cli.mjs:615`; `.memory/legacy/*.jsonl.gz` (47 files) + `migration-rejected.json` (48 tracked files total); the `.gitignore` chunk block `:81-84` | **2.4** | the legacy gz **reader story**: zero readers outside `migrate-v1 --rollback` (`cli.mjs:578`); historical value only — stated *by 2.4, when it deletes them*, not by #247 |

- [x] 5.2 Rewrite `openspec/changes/issue-864-memory-2-0/tasks.md:32` (epic task 2.3) to:
  ```markdown
  - [ ] 2.3 #247 — **[rev 2026-09-10, per #863 D3]** the **read-back boundary only**: `chunk-reader.mjs`'s verdict is *deleted* (PR #258) and `readChunkObservations` has zero importers; a guard test pins that plus `collectChunkObservations`'s annotated allowlist (`migrate-v1.mjs`, `engram.mjs`, `cli.mjs`'s `migrate-v1`); the ledger of what 3.2 deletes is written. **`share` keeps calling `engram sync --export`** — retiring it here would leave engram with no producer path (`save` is `unsupportedOp`), so "`share` reads no chunk file" moves to **3.2 (#874)**.
  ```
- [x] 5.3 Post a comment on #874 restating the seven-row ledger above verbatim, prefixed: "Carried
  over from #247 (this change) — task 3.2 must delete these seven surfaces, row 4 only after the
  #469 re-proof." **Posted**: issuecomment-5625476087.

Commit: `docs(openspec): rewrite epic task 2.3 to the read-back boundary wording, restate ledger on #874 (#247)`.

## Wrap-up

- [ ] W1 `npm test` full run before the first commit (baseline, measurement 0.3) and again before
  push — record both counts.
- [ ] W2 `memory:save --issue 247` — record-first, committed before the first push.
- [ ] W3 Epic task 2.3 — **NOT ticked.** It is REWRITTEN (Work Unit 5.2) to state the read-back
  half is done here; the export half (`share` stops calling `engram sync --export`) moves to task
  3.2 (#874). Ticking 2.3 now would claim the whole chunk-materialization retirement is done,
  which is false per D0/D1.
- [ ] W4 Fresh-context review before opening the PR (PR rule) — a ~12-counted-line diff invites a
  reviewer to assume "nothing happened"; the review must confirm the guard is actually red-first
  where claimed and that the ledger/epic-line changes are present.
- [ ] W5 Open the PR: `Closes #247`, `Parent: #864` in prose, label `type:bug`. **Body leads with
  D0's reconciliation** (a near-zero-diff PR must explain itself before anything else): the ticket
  and epic wording said "retire chunk materialization"; the ratified #863 D3 sequencing (2.3 →
  3.2 → 2.4) means 2.3 is read-back only, because `engram.mjs:1108` `save()` is `unsupportedOp` —
  retiring the export now would break the only capture path reaching `records/`. Then: summary
  (the guard, the pin, the ledger), changes table, test plan (every `node --test` command above
  plus full `npm test`), the Non-goals section below, dependency note (this PR feeds #874's task
  3.2), contributor checklist per `branch-pr` skill.
- [ ] W6 After merge: confirm the #874 comment (5.3) posted; confirm #247's earlier
  reconciliation comment (issuecomment-5625044748) and this PR are cross-linked.

## Non-goals

Does NOT: retire `engram sync --export`; change `share()`, `dualWriteRecords`, or
`_defaultShareExport` behaviour; delete or untrack any `.memory/legacy/*` file (task 2.4); touch
the manifest, `.engram` symlink, merge driver, or `.gitattributes`; measure or adopt `engram
export` parity as a chunk-round-trip substitute; close the `_defaultChangedChunkFiles` path-literal
hole (Open Question 1, deferred).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~12 counted (`engram.mjs` header note); ~430 reviewer-visible (tests + `openspec/**`, excluded by `brain.config.json:18-29`) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low
