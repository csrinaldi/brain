# Tasks: artifact-retirement (epic #864 task 2.4, issue #955)

Base: `origin/main` has moved past `32b70db9` (worktree creation point). Both slices merge `origin/main` first — never rebase (squash-merge repo).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Slice A ~290, Slice B ~415-430 |
| 400-line budget risk | Slice A: Low. Slice B: High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Slice A) → PR 2 (Slice B) |
| Delivery strategy | ask-on-risk (pre-resolved for this change) |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High (Slice B only)

Slice B's over-budget forecast was already ruled (engram `sdd/artifact-retirement/design-decisions`, 2026-09-14): ships as `size:exception`, R4 stays in B. No further decision gate before `sdd-apply`.

### Suggested Work Units

| Unit | Goal | PR | Base / notes |
|------|------|----|----|
| 1 | Retire manifest, driver, symlink confinement; R12 both-backends test + static guard; doctrine drafts; spec REQ-3 stub | PR 1 — `Part of #955`, closes #958 | `main` (after merge-in). Stacked-to-main: merges to `main` first. |
| 2 | Retire `dualWriteRecords`, rollback (refusal branch kept), `scrubChunkFile`, `.memory/legacy/` (last) | PR 2 — `Closes #955`, label `size:exception` | Branches from PR 1's branch; retarget to `main` once PR 1 merges, then merge `origin/main` again before finishing. |

**Coordination risk**: issue #961 (`brain:` prefix rename, parallel work) also edits `brain/scripts/memory/cli.mjs`, both `i18n/{en,es}.mjs` catalogs, and likely `package.json` (`memory:migrate-v1` script name). Overlap files: `cli.mjs`, `i18n/en.mjs`, `i18n/es.mjs`, possibly `package.json`. Whichever of #955-slice-B and #961 merges second must merge `main` and resolve conflicts by hand — both touch the same `cli.mjs` region (`:599-632`) and the same catalog keys' neighborhood.

---

## Slice A — PR 1 (`Part of #955`, Closes #958)

**`.memory/**` staging rule for this slice**: stage ONLY the deletion of `.memory/manifest.json`. Never stage `.memory/index.jsonl` or anything under `.memory/records/**`. Verify with `git diff --cached --name-status -- .memory` before every commit in this slice.

### Phase A1: Integration
- [x] A1.1 `git merge origin/main` into the branch (merge, not rebase — repo squash-merges, a rebase would replay commits already upstream).
- [x] A1.2 Commit `openspec/changes/artifact-retirement/{explore,proposal,spec,design}.md` and `openspec/changes/artifact-retirement/brain-drafts/*.md` (currently untracked) as the first docs commit, citing `#958`.
- [x] A1.3 Run `GIT_CONFIG_GLOBAL=/dev/null node --test` on the merged tree to record the baseline (all green) before any production edit.

### Phase A2: RED — R12 parity + static guards
- [x] A2.1 Write `brain/scripts/memory/backends/no-artifact.parity.test.mjs`: subtests `session:start`, `share`×{plainfiles,engram}, `pull`×{plainfiles,engram}, `import`×{plainfiles,engram} per design.md Testing Strategy. Confirm each is RED for the expected reason (step 1 `git status`, symlink creation, manifest seams) except the two `import` legs, which pin already-correct behavior.
- [x] A2.2 Write `brain/scripts/memory/retired-artifacts.static.test.mjs` S1 (no `manifest.json`/`engram-manifest` string in `brain/scripts/**` prod files, >100 files scanned), S2 (`.gitattributes` has no `engram-manifest`), S3 (`.gitignore` has exact line `.memory/manifest.json`). Confirm RED.
- [x] A2.3 Write session-start SS1/SS2 (`git restore`/`git status` no longer allowlisted) and SS3 (manifest field renders byte-identically to no field) in `session-start.test.mjs`. Confirm RED.

### Phase A3: GREEN — retire manifest & driver
- [x] A3.1 `brain/scripts/session-start.mjs`: delete `:34` import, `step1RestoreManifest` (`:275-287`), manifest render line (`:231-233`), key (`:498`), `manifest` from JSDoc (`:192,197`) and call sites (`:467,472`); narrow `GIT_ALLOWED_SUBCOMMANDS` to `['rev-parse']` at `:89,102` (D3); fix comments `:3,15,21-22,258,440`.
- [x] A3.2 `brain/scripts/day-start.mjs`: delete `:19` import and `:117-127` restore call.
- [x] A3.3 `brain/scripts/memory/backends/engram.mjs`: `share()` `:151-178` drop `_ensureSymlink`; delete manifest seams `:490-524`; `pullMemory` `:800-857` drop step 1/2 params and renumber; `setup()` `:1226-1250` keep only the symlink step; header comment `:11`.
- [x] A3.4 `git rm .memory/manifest.json`; add `.memory/manifest.json` to `.gitignore:63-68`, reword `:64`.
- [x] A3.5 Delete `brain/scripts/lib/memory-manifest.mjs` + `.test.mjs`.
- [x] A3.6 Delete `brain/scripts/merge-engram-manifest.mjs` + `.test.mjs`; `.gitattributes:1-6` delete, reword `:8` ("Unlike the line above, this uses" → "This uses"); remove driver registration from `engram.mjs#setup()` (covered by A3.3); no `bootstrap.sh` edit.
- [x] A3.7 Confirm A2.1-A2.3 are GREEN. Confirm baseline (A1.3) suite still passes.

### Phase A4: Doctrine, spec, docs (no code)
- [x] A4.1 `openspec/specs/session-start/spec.md`: REQ-3 → "Removed (#955)" stub, same number, no renumbering; drop manifest wording at `:9,113,134` per R9.
- [x] A4.2 Verify `brain-drafts/harness-contract.session-start.draft.md` and `brain-drafts/memory-backend-contract.rule3.draft.md` (already committed in A1.2) still match current anchors; no live edit needed unless anchors drifted since design. (Verified: anchors target `brain/core/methodology/*.md` prose, unaffected by this slice's code edits — no drift.)
- [x] A4.3 `brain/scripts/memory/lib/backend-selection.mjs`: comment-only edits `:52,61-66,77-86` (`:63` stops naming `manifest.json`); `README.md:194` drop manifest wording from the `memory:pull` row; `CHANGELOG.md` new `## Unreleased` section (R8 upgrade commands) above `## v1.5.0`.
- [x] A4.4 `brain/scripts/i18n/{en,es}.mjs`: delete `session.manifest.restored`.

### Phase A5: Existing test suite updates
- [x] A5.1 `session-start.test.mjs`: edit `:19,167,174-190,296-336,383,396-412,559-575,608-612,671,719-757`; delete `:759-774`.
- [x] A5.2 `i18n/coverage.test.mjs:404`; `engram.pull.test.mjs` (drop seams from merge cases a/b); `engram.duplicates.test.mjs:70-71,98`; `reindex-parity.test.mjs:43,69-70,97,109-110`; `engram.share.test.mjs` (`:21` loses `ensureSymlink`, delete `:60-72`); comment-only `cli.backend-fallback.test.mjs:130,186`, `backend-selection.test.mjs:131`. `engram.setup.test.mjs` untouched.
- [x] A5.3 Run full `GIT_CONFIG_GLOBAL=/dev/null node --test` suite; confirm all green. (5344/5344 pass, 0 fail.)

### Phase A6: Mutation matrix + close
- [x] A6.1 Run the Slice A rows of design.md's mutation matrix (session step 1, gate, render line, share symlink, pull restore, driver/lib modules, attribute/ignore lines). Revert one production change at a time; confirm exactly its named test dies. Record the table in `apply-progress.md`.
- [x] A6.2 Record-first close: `npm run memory:save -- "<title>" "<content>" --issue 958 --type <type>` (positional title/content, per #928). Parse the `rec-` id from stdout; stage only that record file plus `.memory/index.jsonl`; verify exactly one net new id.
- [ ] A6.3 Open PR 1: body `Closes #958` and `Part of #955`. (NOT DONE — agent may not push/open PRs per hard constraints; maintainer pushes and opens PR 1.)

### Review Workload Forecast — Slice A

| Field | Value |
|-------|-------|
| Estimated changed lines | ~290 (tests/`.memory/**`/`openspec/**` excluded by `governance.ignoreList`) |
| 400-line budget risk | Low |
| Chained PRs recommended | N/A (this is PR 1 of 2) |
| Decision needed before apply | No |

---

## Slice B — PR 2 (`Closes #955`, label `size:exception`)

**`.memory/**` staging rule for this slice**: stage ONLY the 48 deletions under `.memory/legacy/`. Never stage `.memory/index.jsonl` or `.memory/records/**`; `.memory/manifest.json` was already handled in Slice A.

### Phase B1: Integration
- [x] B1.1 `git merge origin/main` into the branch (merge, not rebase) — picks up Slice A's squash-merge and any other `main` movement. Done as commit `94d1b5a1` (conflicts in CHANGELOG.md/README.md resolved to main's version).
- [x] B1.2 Run `GIT_CONFIG_GLOBAL=/dev/null node --test` on the merged tree to record the new baseline before any production edit. Baseline: 5361/5361 pass, 0 fail.

### Phase B2: RED/GREEN — `dualWriteRecords` removal (R5)
- [x] B2.1 Extend `retired-artifacts.static.test.mjs` with B1 (no `dualWriteRecords` definition in `brain/**`). Confirm RED. Done — 4 new static guards (B1-B4) all red before any production edit.
- [x] B2.2 `engram.mjs`: deleted `dualWriteRecords` (JSDoc + function; re-measured at lines 180-436 post-import-cleanup, not the stale `:186-443`); reworded the top-of-file ledger comment (row 3); removed imports `exportObservation`, `emptyDuplicates`, `SUPERSEDES_ID_RE`. Kept `upstreamRecordEntries`, `readRecordIds`, `scanTextForSecrets`, `classifySupersedes`, `resolveSecretConfig`, `compilePatterns`, `normalizeDuplicates` (all still used by `save`/`share`/`pull`). Reworded `_defaultLoadBrainConfig`'s doc to drop its stale "two wiring points" claim — now one (`save()`).
- [x] B2.3 Deleted `engram.upstream-scope.test.mjs`, `engram.dualwrite-hydrated-gate.test.mjs`, `lib/upstream-records.integration.test.mjs` (staged via `git add` — a plain `rm` alone left them in `git ls-files` and broke the #850 orphan-test guard, same #928-class lesson as slice A). `plainfiles-roundtrip.integration.test.mjs`: deleted the engram→plainfiles test + `buildFixtureObservations` helper, reworded the file header, trimmed now-unused imports. `engram.duplicates.test.mjs`: deleted the two `dualWriteRecords` tests + the `── share ──` comment block, trimmed now-unused `buildRecord` import and `baseRecordFields`. Deleted `memory.share.secretFoundRecords` from `i18n/{en,es}.mjs` (D6). The sibling `memory.share.upstream*`/`dedupedUpstream` keys are LEFT — zero production readers confirmed, but they were already orphaned since #874 split B per D6, and no ruling covers deleting orphaned catalog keys, only the code that produced them (comment headers reworded to say so).
- [x] B2.4 Confirmed B2.1 GREEN (all 4 static guards). Confirmed B1.2 baseline still passes.

### Phase B3: RED/GREEN — rollback refusal, `scrubChunkFile`, #937 re-pin
- [x] B3.1 Extended `retired-artifacts.static.test.mjs` with B2/B3/B4. Wrote 2 new CLI refusal tests in `cli.migrate-v1.test.mjs` (`--rollback` and `--rollback --dry-run`, both exit 1, stderr includes `en['memory.migrateV1.rollbackRetired']`, chunk untouched, no `records/`/`legacy/` created). Confirmed RED by stashing the `cli.mjs` edit and re-running (2/5 failed for the stated reason: exit 0 instead of 1), then restoring.
- [x] B3.2 Re-measured: `collectChunkObservations` import in `cli.mjs` was at `:655` pre-edit, landed at `:651` after B3.3's comment/refusal-branch edit — not the design estimate of `:645` (main's movement plus the exact refusal-branch wording differ from the estimate).
- [x] B3.3 `cli.mjs`: reworded the `:599-601`-region comment (now names the retirement, R1/R2/D1, and the do-not-delete-the-`if` warning); replaced the old `rollbackMigration` if-block with the D1 refusal branch (placed BEFORE the `--dry-run` check, catalog key `memory.migrateV1.rollbackRetired`, exit 1); reworded the `:952-959`-region comment (dropped the "kept, per O1" claim — the exporter is deleted, not kept). Kept forward branch, `--dry-run`, the `collectChunkObservations` import.
- [x] B3.4 Same commit as B3.3: re-pinned `chunk-boundary.test.mjs`'s allowlist to `{file: 'brain/scripts/memory/cli.mjs', line: 651, retiredBy: 'kept — R3 (#955)'}` and `{file: '.../migrate-v1.test.mjs', line: 13, retiredBy: 'kept — R3 (#955)'}` (both corrected from the stale `'2.4 — ledger row 7'` wording, which R3 explicitly overturns).
- [x] B3.5 `migrate-v1.mjs`: deleted `rollbackMigration` (JSDoc + function, ran to EOF) and the `rmSync` import. Kept `collectChunkObservations`, `buildMigrationReport`, `runMigration`, `REJECTION_REPORT_FILE`, `gunzipSync` (R3 — forward migration stays, `gunzipSync` still used by `collectChunkObservations`).
- [x] B3.6 `secret-scrub.mjs`: deleted `scrubChunkFile` (JSDoc + function) and the `node:zlib`/`existsSync` imports (both callerless once `scrubChunkFile` is gone); reworded `scrubRecordsFile`'s doc to stop citing `scrubChunkFile`'s signature as a mirror. Kept `scrubRecordsFile` (R4).
- [x] B3.7 `i18n/{en,es}.mjs`: deleted `memory.migrateV1.rollbackSummary`; added `memory.migrateV1.rollbackRetired` (static message, no interpolation, matches design.md's "`--rollback` after slice B" text exactly in en; a matching voseo es translation consistent with the rest of `es.mjs`).
- [x] B3.8 `migrate-v1.test.mjs`: deleted the two `rollbackMigration` tests, kept the `:13` import as one line (dropped `rollbackMigration` from the destructure). `secret-scrub.test.mjs`: deleted the `gzipSync` import, `scrubChunkFile` from the import list, `tmpGzChunk` helper + its 3 tests, reworded the file header. `cli.migrate-v1.test.mjs`: replaced the old rollback-restores test with the 2 B3.1 refusal tests (kept the un-refused-migration and `--dry-run` tests — R3's forward-migration proof).
- [x] B3.9 Confirmed B3.1 GREEN including the re-pinned `chunk-boundary.test.mjs`. `cli.migrate-v1.test.mjs`'s forward-migration test still passes.
- [x] B3.10 `CHANGELOG.md` `## Unreleased`: added the rollback bullet in the same close-out pass as B3.3 (single `## Unreleased` heading with `###` subsections; bullet lands under `### Engram's transport artifacts retire (#955)`), naming `brain:memory:migrate-v1 --rollback`.

### Phase B4: Legacy archive deletion (last, irreversible — R1)
- [x] B4.0 (folded in during apply, not in the original plan) `brain/scripts/hooks/pre-push`: the "uncommitted .memory/ check" comment (~line 115) said `brain:memory:share` "re-materializes the manifest" — stale since slice A retired the manifest. Reworded to say it rebuilds `.memory/index.jsonl` instead (that is the actual non-deterministic, churning artifact `share()` still writes). Comment-only; no behavior change.
- [ ] B4.1 `git rm -r .memory/legacy` (47 `.jsonl.gz` + `migration-rejected.json`, 48 paths). This is the LAST content commit of Slice B. PR body names the last SHA that carried these files.
- [ ] B4.2 Run full `GIT_CONFIG_GLOBAL=/dev/null node --test` suite; confirm all green, including the re-pinned `chunk-boundary.test.mjs` and `cli.migrate-v1.test.mjs:60`.

### Phase B5: Mutation matrix + close
- [ ] B5.1 Run the Slice B rows of design.md's mutation matrix (dualWriteRecords deletion, rollback refusal branch, the three static-guard deletions, zlib import, forward-migration-kept row via `cli.migrate-v1.test.mjs:60`). Revert one production change at a time; confirm exactly its named test dies. Record the table in `apply-progress.md`.
- [ ] B5.2 Record-first close: `npm run memory:save -- "<title>" "<content>" --issue 955 --type <type>` (positional title/content). Parse the `rec-` id from stdout; stage only that record file plus `.memory/index.jsonl`; verify exactly one net new id.
- [ ] B5.3 Open PR 2: body `Closes #955`, label `size:exception` (pre-accepted per engram `sdd/artifact-retirement/design-decisions`).

### Review Workload Forecast — Slice B

| Field | Value |
|-------|-------|
| Estimated changed lines | ~415-430 (258 of them `dualWriteRecords` alone; tests/`.memory/**`/`openspec/**` excluded) |
| 400-line budget risk | High — exceeds 400 |
| Chained PRs recommended | N/A (this is PR 2 of 2, already the smaller irreversible slice) |
| Chain strategy | stacked-to-main |
| Decision needed before apply | No — `size:exception` already accepted (2026-09-14); do not move R4 into Slice A |
