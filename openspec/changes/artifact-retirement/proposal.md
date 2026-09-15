---
status: draft
issue: 955
---

# Proposal: #955 — retire the engram artifacts record-first capture made dead weight (epic #864 task 2.4)

## Intent

Since #874 split B, `share()` exports nothing, and nothing writes `.memory/manifest.json`. The
engram adapter's transport estate still ships and runs, though. It includes the tracked manifest, its
restore in `session:start`, `day:start` and `pullMemory`, the `merge=engram-manifest` driver,
48 tracked `.memory/legacy/` files, the callerless `dualWriteRecords()`, and a gunzip path that
no production code calls. Rule 3 of `brain/core/methodology/memory-backend-contract.md`
(no backend artifact is load-bearing) stays `not yet` for engram until they go
(`memory-backend-contract.md:109`). Task 3.1b's lane also depends on this change, because manifest
churn would trip 3.1c.

## Rulings (for ratification)

| # | Ruling | Why |
|---|--------|-----|
| R1 | **Delete `.memory/legacy/` (47 `.jsonl.gz` + `migration-rejected.json`) from the tracked tree, in slice B.** This is the one irreversible act: `migrate-v1 --rollback` stops existing, and v1→v2 rollback ends for this repo. The bytes stay recoverable with `git show <sha>:.memory/legacy/<file>` (the PR body names the last commit that carries them), unless history is rewritten. | `rollbackMigration()` is no safety net today. Its step 4 removes `.memory/records/` entirely (`migrate-v1.mjs:289-293`), so running it would destroy every record captured since cutover. It would restore a chunk transport that nothing reads anymore (hydration is records-only since C4, and `share` stopped exporting in #874). A maintainer loses only a destructive command. Keeping the files for one release would cost 48 tracked files plus that command staying live. |
| R2 | Delete `rollbackMigration()`, the `--rollback` branch (`cli.mjs:617-632`), its tests and the `memory.migrateV1.rollbackSummary` catalog key. | These are the archives' only reader (R1), so they go with them. |
| R3 | **Keep forward migration** (`runMigration`, `collectChunkObservations`, `buildMigrationReport`, `migrate-v1 --dry-run`, the `cli.mjs:655` call site) and re-annotate their `chunk-boundary.test.mjs` allowlist rows. This departs from ledger row 7. | `collectChunkObservations` reads a consumer's own `chunks/`, not `legacy/`, so the archive decision and the reader code are independent. Ledger row 7 couples them wrongly. Forward migration is the only path to records for a consumer still on v1 chunks, and this repo cannot show that no such consumer exists. |
| R4 | Delete `scrubChunkFile` and `secret-scrub.mjs`'s `gunzipSync` import, plus their three tests. `scrubRecordsFile` stays unchanged, which settles the item #874 R9 handed to this task. | `scrubChunkFile` has only a test importer. `scrubRecordsFile` is a reader for the records layer, not a backend artifact. |
| R5 | **Delete `engram.mjs#dualWriteRecords`** (`:253-320`) with its `_readObservations` seam, default seams, JSDoc, `engram.upstream-scope.test.mjs`, `engram.dualwrite-hydrated-gate.test.mjs` and the dual-write rows of `engram.duplicates.test.mjs`. **#874's O1 cleanup ends in this change.** | The "unless 1.2a claims it first" clause does not apply. 1.2a deletes the adapter's own duplicate rows inside the engram store (contract, Deletion). `dualWriteRecords` writes observations into records, which is a different operation on a different store. The epic's `cli.upstream-config.test.mjs` item is stale: #874 B1 already deleted that file. |
| R6 | Retire the manifest: `git rm .memory/manifest.json`, add `.memory/manifest.json` to `.gitignore`, delete `lib/memory-manifest.mjs` and its test, remove session-start step 1, the `day-start.mjs:123` call and `pullMemory`'s `_isManifestDirty`/`_restoreManifest` seams. | No writer remains. A gitignore line stops an old checkout or a manual `engram sync --export` from tracking the file again. |
| R7 | Remove the driver: `.gitattributes:1-5` (and reword ":8 Unlike the line above"), `merge-engram-manifest.mjs` and its test, and `setup()`'s driver registration. Remove `_ensureSymlink` from `share()` so the `.engram` symlink lives only in `setup()`. No `bootstrap.sh` edit. | `bootstrap.sh` only calls `cli.mjs setup`, so `setup()` is the only place the driver is registered. Confining the symlink closes #874 R12, which handed it here. |
| R8 | **The consumer upgrade gap stays unfixed and gets documented.** A consumer upgrading from an older brain keeps a tracked `.memory/manifest.json` and a local `merge.engram-manifest.driver` config. The upgrade note (CHANGELOG entry) gives the two manual commands. No installer step and no `config-migrations.mjs` change. | `.gitattributes` is managed (COPY), so the upgrade drops the attribute, and git never runs a driver that no attribute names. Nothing reads the leftover manifest, so it adds noise but breaks nothing. Removing it would give the installer a new ability to change git state and data in the consumer's repo, outside `managed-paths.mjs`, through a Tier-2 file. That is too heavy for inert leftovers. |
| R9 | `openspec/specs/session-start/spec.md`: **REQ-3 is marked Removed (#955) and keeps its number.** Its scenarios are replaced by "manifest absent: `session:start` makes no manifest operation and succeeds". The same delta also removes manifest wording from the purpose (:9), the full-context scenario (:113) and REQ-9 (:134). | REQ-3 requires the restore today. A stable number keeps existing `REQ-n` references in tests and docs valid. |
| R10 | Doctrine changes ship as two `brain:promote` drafts under `openspec/changes/artifact-retirement/brain-drafts/`. `harness-contract.session-start.draft.md` rewrites row :27. `memory-backend-contract.rule3.draft.md` covers :48-51, :60 (`setup` = symlink only), :109 (engram rule 3 `not yet` → `yes`) and :173-177/:191. Each draft opens ```` ```brain-amendment/1 ```` and every `amend-find` matches exactly once. `AGENTS.md:222` and `README.md:194` are edited directly. ADR-0002/0004/0017 and `consolidation-protocol.md:200` stay unchanged. | Agents never edit `brain/core/**`. The ADRs already describe 2.4 as future work and are historical. `consolidation-protocol.md:200` is still true. Drafts are promoted only after their slice merges. |
| R11 | **Two stacked PRs to `main`.** Slice A, a sub-ticket (`Part of #955`), holds R6, R7 and R9, the `README`/`AGENTS` edits, both drafts and R12's proof. Slice B (`Closes #955`) holds R1, R2, R4 and R5. B's commit that edits `cli.mjs` above :655 re-pins `chunk-boundary.test.mjs:170` in the same commit (#937). | A closes rule 3 and unblocks 3.1b. B isolates the irreversible deletion for its own review. Each slice is estimated under 400 counted lines. |
| R12 | Acceptance is one cross-backend test, modelled on `reindex-parity.test.mjs` and parametrized over `plainfiles` and `engram`. On a fixture with no manifest, chunks, legacy, symlink or driver attribute, `session:start`, `memory:share`, `memory:pull` and `cli.mjs import` all complete and hydrate from `.memory/records/` alone, with engram's binary absent or injected. A static guard also proves that no production file under `brain/scripts/` references `manifest.json` or `engram-manifest`. | This proves the epic scenario under both backends rather than asserting it. The test lands in A and stays green through B. |

## Scope

### In scope
- R1–R12 above, across slices A and B.

### Out of scope (non-goals)
- Task 1.2a's heal of the three duplicate engram rows.
- Task 3.1d (#890), retiring the feature-PR memory surfaces.
- The first real `memory:ship`.
- Forward `migrate-v1` (R3), `scrubRecordsFile` (R4), consumer-side cleanup automation (R8), ADR text changes.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `session-start`: REQ-3 removed, and manifest wording removed from the purpose, the output scenario and REQ-9 (R9).

## Approach

Strict TDD per slice. For A, write R12's cross-backend test first (red while restores and the driver
exist), then delete in dependency order: callers (session-start, day-start, `pullMemory`), then
`memory-manifest.mjs`, then the driver, `.gitattributes` and `.gitignore`, then `setup`/`share`
symlink confinement, then the spec delta and drafts. B deletes `dualWriteRecords` and its tests,
then `scrubChunkFile`, then rollback code plus the `#937` re-pin, and removes the archives last.

## Affected Areas

| Area | Impact | Slice |
|------|--------|-------|
| `.memory/manifest.json`, `.gitattributes`, `.gitignore` | Removed/Modified | A |
| `brain/scripts/lib/memory-manifest.mjs`, `brain/scripts/merge-engram-manifest.mjs` (+tests) | Removed | A |
| `brain/scripts/session-start.mjs`, `day-start.mjs`, `memory/backends/engram.mjs` (`setup`, `share`, `pullMemory`) | Modified | A |
| `openspec/specs/session-start/spec.md`, `README.md`, `AGENTS.md`, `brain-drafts/` | Modified/New | A |
| `engram.mjs#dualWriteRecords` + three test files | Removed | B |
| `memory/lib/migrate-v1.mjs` (rollback), `memory/cli.mjs`, `memory/lib/secret-scrub.mjs`, `chunk-boundary.test.mjs` | Modified | B |
| `.memory/legacy/` (48 files) | Removed | B |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A consumer still depends on v1 chunks | Low | R3 keeps forward migration |
| R3 contradicts ledger row 7 as written | Med | Raised for ratification below |
| `AGENTS.md:222` is a generated mirror of `harness-contract.md` and an edit gets clobbered | Med | Design checks `agents-clobber.mjs` before editing |
| `chunk-boundary.test.mjs:170` pin drifts | High if forgotten | R11: re-pin in the same commit |
| A consumer's old engram binary exports again and churns an untracked manifest | Low | The `.gitignore` line (R6) keeps it harmless |

## Rollback Plan

Each slice is one squash merge that can be reverted on its own. Reverting A restores the manifest file,
restores, driver and REQ-3, and A's drafts are not promoted until A merges. Reverting B restores the code and the
legacy blobs from history. R1's capability loss is undone only by that revert, which must happen
before any history rewrite. Records are never touched.

## Dependencies

- #874 (3.2) shipped. No manifest writer remains, so the #803 gate is satisfied.
- None on 1.2a (R5).

## Success Criteria

- [ ] R12's test passes under `plainfiles` and `engram`.
- [ ] No tracked `.memory/manifest.json`, no `.memory/legacy/`, and no `engram-manifest` reference in production code.
- [ ] `dualWriteRecords` and `scrubChunkFile` have zero definitions and zero importers.
- [ ] Both drafts promote cleanly after A merges, and engram's rule 3 reads `yes`.
- [ ] The full suite is green, including `chunk-boundary.test.mjs` after the re-pin.

## Proposal question round

These need the maintainer's decision before spec and design freeze:
1. **R1**: accept losing `migrate-v1 --rollback`, with history as the only copy of the archives?
2. **R3**: keep forward migration despite ledger row 7, or declare that no consumer remains on v1 and delete it too?
3. **R8**: accept the documented consumer residue instead of an installer cleanup?
4. **R4**: keep `scrubRecordsFile`, or delete it as callerless?
