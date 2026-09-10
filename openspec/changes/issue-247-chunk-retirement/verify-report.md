---
change: issue-247-chunk-retirement
status: PASS
verified_at: 2026-09-10
head: c410259e6a44de06eab6f9e124e9f2249428038f
---

# Verification Report — #247 chunk read-back boundary

**Change**: issue-247-chunk-retirement
**Mode**: Strict TDD
**Verified against**: `origin/main` post-merge (`c410259e`, PR #913), worktree `/home/gandalf/IA/brain-issue-247-archive` (branch `docs/issue-247-archive`)

## Completeness

| Metric | Value |
|--------|-------|
| Section 0 measurements | 5/5 done |
| Work Units 1-5 tasks | 12/12 done |
| Wrap-up tasks | 5/6 ticked, 1 (W3) intentionally unticked |
| Tasks total (excl. epic-doc line) | 17 |
| Tasks incomplete | 0 (W3 is a designed non-tick, not incomplete work — see below) |

## Build & Tests Execution

**Focused** (`node --test brain/scripts/memory/chunk-boundary.test.mjs brain/scripts/memory/backends/plainfiles.share.test.mjs brain/scripts/governance/run-check.test.mjs`):
```text
tests 131
pass 131
fail 0
```

**Full** (`npm test`):
```text
tests 5194
pass 5194
fail 0
skipped 0
```
Progression recorded in tasks.md W1: 5139 baseline → 5148 after Work Units 1-5 → 5155 at the
PR's final reviewed head (`257de47f`) → 5194 today at `c410259e` (later, unrelated PRs added
tests on top; #247's own slice never regressed).

**check-refs** (`node brain/scripts/check-refs.mjs`):
```text
✓ No prohibited references found.
✓ Artifact structure is valid.
```

**Coverage**: not run — no coverage tool invoked for this change; not required by spec/design.

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| `readChunkObservations` zero importers (guard 1) | guard is red on reintroduction | `memory/chunk-boundary.test.mjs > readChunkObservations: zero importers...` + 3 redefinition-shape tests | ✅ COMPLIANT |
| `collectChunkObservations` annotated allowlist (guard 2) | unlisted importer fails; stale entry fails | `memory/chunk-boundary.test.mjs > collectChunkObservations: ... both directions` + forward/reverse-direction tests + 4 evasion tests (re-export, alias, namespace, dynamic import) | ✅ COMPLIANT |
| `share` under `plainfiles` writes no chunk (guard 3, pin) | no chunk file after share | `memory/backends/plainfiles.share.test.mjs > share: over a real temp store, the .memory/ tree is exactly index.jsonl + records/ — no chunks/` | ✅ COMPLIANT |
| PR #258 readers stay records-only (guard 4, pin) | no silent regression to chunk reads | `memory/chunk-boundary.test.mjs > brain-audit.mjs and brain-check.mjs import readRecordObservations, never a chunk reader` (cross-referenced by existing `brain-audit.test.mjs`/`brain-check.test.mjs`) | ✅ COMPLIANT |
| #874 ledger is a written obligation | #874's explore finds the ledger, not a rediscovery | Source inspection: seven-row ledger present verbatim in `tasks.md` §5.1 and `design.md`; posted to #874 as `issuecomment-5625476087`, later PATCHED with the row 6/7 corrections | ✅ COMPLIANT (static + posted artifact, no covering unit test — by nature a docs/process requirement) |
| Epic task 2.3 wording reconciled | the epic line matches the ruling | Source inspection: `issue-864-memory-2-0/tasks.md:32` reads the rewritten read-back-only wording, matching `issue-863-backend-contract/design.md` D3's sequencing | ✅ COMPLIANT |
| Non-goals: capture path byte-unchanged | `share`, `dualWriteRecords`, scrub subsystem diff clean against pre-merge `main` | `git show --stat c410259e` — no `engram.share.test.mjs`, no `.memory/legacy/*`, no `.gitattributes` in the diff; only `engram.mjs` (header comment), the three new/modified test files, and `openspec/**` docs | ✅ COMPLIANT |

**Compliance summary**: 7/7 requirements compliant.

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| `CHUNK_IMPORT_RE` whole-source scan | ✅ Implemented | Catches multi-line dynamic `await import(...)`, not line-anchored |
| `NAMESPACE_BINDING_RE` + member-access scan | ✅ Implemented | Syntax-anchored `<name>.collectChunkObservations`, not free-text substring (review-correction hardening) |
| `WALK_GLOBS` scope | ✅ Implemented | `brain/**/*.mjs`, `test/**/*.mjs` — widened from the original `brain/scripts/**` after MAJOR-2 finding |
| `engram.mjs` header note | ✅ Implemented | 13-line comment block, ledger-row pointers per seam, `share()`/`dualWriteRecords`/scrub subsystem untouched below it |
| `run-check.test.mjs:32` comment | ✅ Implemented | Points to `chunk-boundary.test.mjs` instead of restating stale narrative |

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| D3 sequencing (2.3 read-back → 3.2 export → 2.4 artifacts) | ✅ Yes | Epic line 2.3 rewritten to match; `share` still calls `engram sync --export` |
| D4 guard shape (four guards, annotated allowlist not zero-importer for `collectChunkObservations`) | ✅ Yes | Confirmed in code |
| Ledger anchors re-measured after WU4.1's header-note shift | ✅ Yes | Row 3 at `:345` (not proposal's `:323`); row 4 split into three anchors |
| Non-goals boundary (D2/D3 subsystems untouched) | ✅ Yes | No legacy gz, manifest, driver, symlink, or scrub-subsystem file in the merge diff |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | apply-progress (#3331, #3336) carries RED/GREEN narrative per work unit, plus a mutant-survival-then-death table for the 7 review-correction evasions |
| All tasks have tests | ✅ | 12/12 implementation tasks map to `chunk-boundary.test.mjs` or `plainfiles.share.test.mjs` cases |
| RED confirmed (tests exist) | ✅ | Both test files exist on the merged tree, at the paths the tasks/spec name |
| GREEN confirmed (tests pass) | ✅ | 131/131 focused, 5194/5194 full, both re-run at archive time |
| Triangulation adequate | ✅ | Guard 2 alone carries 9 distinct cases (allowlist match, forward direction, reverse direction, 4 evasion shapes, scan-floor, symbol-exists); guard 1 carries 5 |
| Safety Net for modified files | ✅ | `plainfiles.share.test.mjs` and `run-check.test.mjs` were both pre-existing suites; full `npm test` run before each commit per W1 |

**TDD Compliance**: 6/6 checks passed

### Assertion Quality
No tautologies, ghost loops, or production-code-free assertions found in `chunk-boundary.test.mjs` or the `plainfiles.share.test.mjs` new case — the exact-tree assertion enumerates the real `mkdtempSync` listing (not a vacuous `!includes` check), and every guard-evasion test plants a real fixture import and asserts the guard's `deepEqual`/found-set actually changes.

**Assertion quality**: ✅ All assertions verify real behavior

## Editorial Correction Applied

`spec.md`'s three `Test:` pointers named `governance/chunk-boundary.test.mjs`; the file lives at
`brain/scripts/memory/chunk-boundary.test.mjs` (the design's chosen location, matching the
relative-path convention already used by the adjacent `Test: memory/backends/plainfiles.share.test.mjs`
line). Fixed at lines 26, 43, 70 to `memory/chunk-boundary.test.mjs`.

## Wrap-up Ticks Applied

`tasks.md` W1, W2, W4, W5, W6 ticked with the evidence in this report's Build & Tests and Spec
Compliance sections above. W3 (epic task 2.3) stays **intentionally unticked** — it is rewritten,
not completed, since only the read-back half of the epic's chunk-materialization retirement is
done in this slice; the export half is #874's task 3.2. This matches #863 D3's ratified
sequencing and is not an oversight.

## Issues Found

**CRITICAL**: None.

**WARNING**: None.

**SUGGESTION**:
- Running `npm test` in this worktree mutated `.memory/index.jsonl` in place (one record's
  position resorted) as a side effect of some test in the suite operating on the real repo
  `.memory/` tree rather than a `mkdtempSync` copy. Unrelated to #247's own guard/pin tests
  (`chunk-boundary.test.mjs`, `plainfiles.share.test.mjs` use real temp dirs correctly, per D4
  guard 3/A6). Reverted via `git checkout -- .memory/index.jsonl` before writing this report, per
  this task's instruction not to touch `.memory/` in this clone. Worth a follow-up ticket to find
  and fix the leaking test — out of scope for #247's own verification.

## Handover

- **#874 inherits the ledger, not a rediscovery.** The seven-row ledger in `tasks.md`/`design.md`
  is restated on #874 (`issuecomment-5625476087`, PATCHED once for the row 6/7 correction).
  #874's task 3.2 **must re-measure every anchor before acting** — this change's own history shows
  anchors drift under edits above them (WU4.1's 13-line header note shifted every `engram.mjs`
  line below it by exactly +13; row 3 moved from the proposal's `:323` to the measured `:345`).
  Do not trust the ledger's line numbers as of #247's merge without a fresh `rg -n` pass first.
- **Row 4 (`_defaultChangedChunkFiles`/`scrubMaterializedChunks`/`assertExportDestinationIsRead`)
  is gated**: delete only after the #469 fail-closed guarantee is re-proved over record-first
  `save`. This is the one row in the ledger that is not a simple "3.2 deletes it" — it has its
  own precondition.
- **The guard's coverage is heuristic, not a parser.** `CHUNK_IMPORT_RE` and
  `NAMESPACE_BINDING_RE` are regex-based source scans over `WALK_GLOBS` (`brain/**/*.mjs`,
  `test/**/*.mjs`), hardened against 7 known evasion shapes found in review (re-export, aliased
  import, namespace import + member access, non-destructured dynamic import + member access, and
  three `readChunkObservations` redefinition shapes). It is not an AST-based analysis — a shape
  not yet enumerated as a mutant test could still slip past. Any future editor of this guard
  should add a new mutant test alongside any new evasion shape they think of, per the
  "mutant-survival-then-death" pattern already established (plant against the OLD detection logic
  first, prove it survives, harden, prove it dies).
- **The #874 comment lag was closed, but check next time.** Between the apply batch and the PR
  merge, the #874 comment briefly lagged the corrected row 6/7 wording before being patched — a
  reminder that a "post once" comment referencing in-flight ledger content needs a re-check before
  the dependent work (#874) actually starts, not just before this PR merges.

## Verdict

**PASS**

All 7 spec requirements are compliant with passing runtime evidence; the full suite is green
(5194/5194) on the merged tree; the merge diff contains no D2/D3 subsystem file; the PR (#913)
merged with a posted cold-review APPROVE; the #874 ledger and #247 re-scope comments are posted
and cross-linked. One editorial correction applied to `spec.md`'s test pointers. The epic task
2.3 line is correctly rewritten and correctly left unticked by design. No CRITICAL or WARNING
issues block archive.
