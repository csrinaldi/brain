# Design: #955 — retire engram's transport artifacts (epic #864 task 2.4)

Base: `origin/main` 32b70db9. Rulings R1–R12 ratified 2026-09-13 (engram #3445). All line numbers below were re-measured on this base.

## Technical Approach

This change is almost all deletion, in two stacked PRs to `main` (R11). Slice A retires the manifest, driver and symlink, and proves rule 3 with one cross-backend test plus a static guard (R12). Slice B retires the observation→record writer, the rollback and the gzip scrub, then deletes the archive last. Nothing gains a new capability. The one addition is a refusal branch for `migrate-v1 --rollback`, so the retired flag can never fall through into the forward migration.

## Architecture Decisions

| # | Option chosen | Rejected | Why |
|---|---|---|---|
| D1 | `--rollback` keeps a **refusal branch** (exit 1, catalog key `memory.migrateV1.rollbackRetired`), placed BEFORE the `--dry-run` check | Deleting the branch outright (R2 literal) | Without the branch, `migrate-v1 --rollback` reaches `runMigration()` (`cli.mjs:634`). On a v1 consumer that runs the FORWARD migration silently; on this repo it throws a misleading "run the cutover runbook". R2 still holds: `rollbackMigration`, its tests and `rollbackSummary` all go. |
| D2 | **`AGENTS.md` is NOT edited in either PR** | Editing `AGENTS.md:222` directly (R10 text) | `AGENTS.md` is compiled from the 5 `SOURCE_DOCS` (`harness/backends/antigravity.mjs:36-42`), and `harness/backends/antigravity.drift.test.mjs:42` asserts byte-equality. A hand edit turns the suite red. `brain:promote` of the harness draft regenerates and stages it (§1d act 3, `brain-promote.mjs:819`). `README.md:194` is not generated and is edited directly. |
| D3 | The session-start gate narrows to `GIT_ALLOWED_SUBCOMMANDS = ['rev-parse']` (`session-start.mjs:89`) | Leaving `status` and `restore` allowlisted | Their only user was step 1. `currentBranch` spawns only `rev-parse` (`lib/git-branch.mjs:26`). A dead `restore` entry lets a read-only loader run a tree-mutating git verb. |
| D4 | `setup()` keeps its signature; only step 2 is deleted | Adding a `{root}` seam | This is not needed for R7, and a behavioural test of today's `setup()` would write the REAL clone's `.git/config` (`cwd: repoRoot`, `engram.mjs:1245`). The driver's removal is proven statically instead. |
| D5 | The plainfiles `import` leg of R12 **passes by vacuity out loud**: it asserts the named refusal (`cli.mjs:787`) and an untouched tree | Adding `plainfiles.importMemory` | Out of R1–R12 scope. The contract already allows vacuity said out loud (`memory-backend-contract.md:26-28`). **Needs ratification** — see Open Questions. |
| D6 | Delete `memory.share.secretFoundRecords` (its only reader is `engram.mjs:373`) in B | Leaving it | The key dies with its function. The other `memory.share.*` keys have been orphaned since #874 and are out of scope. |

## Data Flow (after A)

    records/ ──rebuildIndex──> index.jsonl        (share, pull: both backends)
    records/ ──importMemory──> engram store       (cli import, post-merge, session step 2)
    setup() ──> .engram symlink (engram only; nothing in brain reads it; engram import uses a temp payload, engram.mjs:1780)

## File Changes — Slice A (`Part of #955`)

| File | Change | Deliberately stays |
|---|---|---|
| `.memory/manifest.json` | `git rm` | — |
| `.gitignore:63-68` | add `.memory/manifest.json`; reword `:64` "(chunks + manifest) SÍ se commitea" (neutral Spanish, matching the file) | `.engram`, `.memory/chunks/` lines |
| `.gitattributes:1-6` | delete; `:8` "Unlike the line above, this uses" → "This uses" | `:28` union line (drift-guarded by `managed-paths.mjs:47`) |
| `brain/scripts/lib/memory-manifest.mjs` (+ `.test.mjs`) | delete | — |
| `brain/scripts/merge-engram-manifest.mjs` (+ `.test.mjs`) | delete | — |
| `brain/scripts/session-start.mjs` | delete `:34` import, `:275-287` `step1RestoreManifest`, `:231-233` manifest line, `:498` key, `manifest` from the `:192,197` JSDoc and the `:467,472` call; fix comments `:3,15,21-22,258,440`; D3 at `:89,102` | steps 2–5, `gatedSpawn`, exit-0 contract |
| `brain/scripts/day-start.mjs` | delete `:19` and `:117-127` | step 5 import |
| `brain/scripts/memory/backends/engram.mjs` | `:11` header; `share()` `:151-178` drops `_ensureSymlink`; delete `:490-524` seams; `pullMemory` `:800-857` drops step 1 and 2 params, renumbers steps; `setup()` `:1226-1250` keeps only the symlink | `ensureMemorySymlink`, `lstatSync`/`symlinkSync`, `_defaultGitPull`, `importMemory`, `hydrate`, `save`, `_defaultResolveDir` (callerless, not ruled) |
| `brain/scripts/memory/lib/backend-selection.mjs:52,61-66,77-86` | comments only (`:63` names `manifest.json`) | `FALLBACK_OPS = ["pull"]` |
| `brain/scripts/i18n/{en,es}.mjs` | delete `session.manifest.restored` | — |
| `README.md:194` | the `memory:pull` row loses its manifest wording | — |
| `CHANGELOG.md` | new `## Unreleased` section above `## v1.5.0` (R8) | — |
| `openspec/specs/session-start/spec.md` | REQ-3 → "Removed (#955)" stub, same number; `:9`, `:113`, `:134` per R9 | REQ-1..9 numbering |
| `brain-drafts/harness-contract.session-start.draft.md` | new (2 edits) | — |
| `brain-drafts/memory-backend-contract.rule3.draft.md` | new (6 edits + Amendment 3 body) | — |
| Tests (not counted) | new `memory/backends/no-artifact.parity.test.mjs`, new `memory/retired-artifacts.static.test.mjs`; edit `session-start.test.mjs` (`:19,167,174-190,296-336,383,396-412,559-575,608-612,671,719-757`, delete `:759-774`), `i18n/coverage.test.mjs:404`, `engram.pull.test.mjs` (merge (a)/(b), drop seams), `engram.duplicates.test.mjs:70-71,98`, `reindex-parity.test.mjs:43,69-70,97,109-110`, `engram.share.test.mjs` (test `:21` loses ensureSymlink, delete `:60-72`), comments in `cli.backend-fallback.test.mjs:130,186` and `backend-selection.test.mjs:131` | `engram.setup.test.mjs` |

## File Changes — Slice B (`Closes #955`)

| File | Change | Deliberately stays |
|---|---|---|
| `.memory/legacy/**` (47 `.jsonl.gz` + `migration-rejected.json`) | `git rm -r`, last commit; the PR body names the last SHA that carries them | — |
| `engram.mjs` | delete `:186-443` (`dualWriteRecords`, JSDoc, seams); header `:25-28`; imports `exportObservation` (`:53`), `emptyDuplicates` (`:57`), `SUPERSEDES_ID_RE` (`:64`); `_defaultLoadBrainConfig` doc `:452-457` | `upstreamRecordEntries`, `readRecordIds`, `scanTextForSecrets`, `classifySupersedes` (all used by `save`) |
| `memory/lib/migrate-v1.mjs` | delete `:281-350` and `rmSync` from `:14` | `collectChunkObservations` `:42`, `buildMigrationReport`, `runMigration` `:196`, `REJECTION_REPORT_FILE`, `gunzipSync` (R3) |
| `memory/cli.mjs` | `:599-601` comment; `:617-632` → D1 refusal; `:952-959` comment | forward branch `:634-653`, `--dry-run`, the `:655` import |
| `memory/lib/secret-scrub.mjs` | delete `:13` and `:94-123`; `:128-130` doc stops citing `scrubChunkFile` | `scrubRecordsFile` (R4), scan and compile helpers |
| `i18n/{en,es}.mjs` | delete `memory.migrateV1.rollbackSummary` and `memory.share.secretFoundRecords`; add `memory.migrateV1.rollbackRetired` | other `migrateV1.*` keys |
| Tests (not counted) | delete `engram.upstream-scope.test.mjs`, `engram.dualwrite-hydrated-gate.test.mjs`, `lib/upstream-records.integration.test.mjs` (its only test drives `dualWriteRecords`, **missed by R5's list**); `plainfiles-roundtrip.integration.test.mjs` loses test `:61-85` and its fixture helpers; `engram.duplicates.test.mjs:8,19-60`; `migrate-v1.test.mjs:321-371` (the `:13` import stays one line); `secret-scrub.test.mjs:11,21,112-146`; `cli.migrate-v1.test.mjs:1-2,110-126` → refusal test; `chunk-boundary.test.mjs:170-171` re-pin + `retiredBy: 'kept — R3 (#955)'`; append to `retired-artifacts.static.test.mjs` | `cli.migrate-v1.test.mjs:60` (R3 proof), `engram.share.test.mjs:52` |

**Prose left untouched**: `store.mjs:107,247`, `plainfiles.mjs:76,234`, `staged-records-check.mjs:5` and `store.test.mjs` mention `dualWriteRecords` as precedent. The static guard checks definitions and imports, not prose.

## Readers and writers of each retired artifact (base 32b70db9)

- **`.memory/manifest.json`**: no writer. Readers and restorers are `session-start.mjs:34,281-283`, `day-start.mjs:19,123`, `lib/memory-manifest.mjs:11-25`, `engram.mjs:496-524,845-857`, and the driver `merge-engram-manifest.mjs`. Prose-only mentions: `backend-selection.mjs:63`, `managed-paths.mjs:44` (`brain/core`, left alone), ADRs, `feature-working-memory/spec.md:202`. Tests: see the slice A table.
- **Driver**: `.gitattributes:1-5`, `engram.mjs:1237-1250`, `managed-paths.mjs:44` (comment only). `bootstrap.sh` never registers it.
- **`.engram` symlink**: `engram.mjs:171,178` (share), `:1235` (setup), `backend-selection.mjs:83`, and tests `engram.share.test.mjs:21-34,62-72`, `reindex-parity.test.mjs:43,97`, `engram.setup.test.mjs`.
- **`dualWriteRecords`**: no production caller. Importers: `engram.upstream-scope.test.mjs:18`, `engram.dualwrite-hydrated-gate.test.mjs:42`, `engram.duplicates.test.mjs:8`, `lib/upstream-records.integration.test.mjs:22`, `lib/plainfiles-roundtrip.integration.test.mjs:12`.
- **`rollbackMigration` / `.memory/legacy/`**: `migrate-v1.mjs:312`, `cli.mjs:617-632`, `migrate-v1.test.mjs:13,321-371`, `cli.migrate-v1.test.mjs:112-126`, keys `en.mjs:430` and `es.mjs:384`. `package.json:75` only aliases `migrate-v1`.
- **`scrubChunkFile`**: `secret-scrub.mjs:111` and `secret-scrub.test.mjs:21,121-146`.

## `--rollback` after slice B

`node brain/scripts/memory/cli.mjs migrate-v1 --rollback`, with or without `--dry-run`, prints `memory/cli: ` followed by the `memory.migrateV1.rollbackRetired` message on stderr, then exits 1. Nothing is read or written. English text: `migrate-v1 --rollback was retired (#955): it restored v1 chunks from .memory/legacy/ and then deleted .memory/records/, destroying every record captured since the migration. Nothing was changed. The archived chunks remain in git history: git show <sha>:.memory/legacy/<file>`.

## Sanctioned `.memory/**` staging

| Slice | Staged under `.memory/` | Never |
|---|---|---|
| A | exactly the deletion of `.memory/manifest.json` | `index.jsonl`, `records/**`, `legacy/**` |
| B | exactly the deletions under `.memory/legacy/` (48 paths) | `index.jsonl`, `records/**`, `manifest.json` |

Before each commit, verify `git diff --cached --name-status -- .memory` shows only `D` lines for those paths.

## #937 line pin

Slice A never edits `cli.mjs`. In slice B, the `cli.mjs` edits at `:599-632` move the `collectChunkObservations` import (today `:655`, expected about `:645`). The new line is re-measured and `chunk-boundary.test.mjs:170` is re-pinned **in the same commit**.

## Testing Strategy (STRICT TDD; `GIT_CONFIG_GLOBAL=/dev/null node --test <file>`)

**`no-artifact.parity.test.mjs`**. Each subtest builds its own `testTmp` fixture containing only `.memory/records/<one record>.jsonl`, injects every seam not under test, and ends with `assertOnlyRecordsAndIndex(root)`: the root holds only `.memory/`, and `.memory/` holds only `records/` and `index.jsonl`.
- `session:start` (backend-agnostic, runs once): `runSessionStart(tmp, {_spawn: recorder→status 0, _branch, _changes, _resume, _recency})`. Asserts exit 0 and that the recorded argv set is exactly `[cli.mjs import]`. Red today because of step 1's `git status`.
- `share` × {plainfiles, engram}: real `rebuildIndex`, `indexCount 1`. The engram leg is red today because `.engram` gets created.
- `pull` × {plainfiles `_gitPull` no-op, engram `pullMemory` with `_gitPull` no-op, an `_import` spy, and legacy seams `_isManifestDirty: () => true, _restoreManifest: () => { throw }`}. The engram leg is red today.
- `import`: engram `importMemory` with the binary, key-read, import and guard seams injected, expecting `written 1` and `topic_key === record.id`. plainfiles spawns `cli.mjs import` with `MEMORY_BACKEND=plainfiles BRAIN_MEMORY_TEST_ROOT=tmp`, expecting exit 1, the named refusal and an unchanged tree (D5). Both are green on arrival and act as pins.

**`retired-artifacts.static.test.mjs`**:
- S1 (A): no file under `brain/scripts/**` (hooks included; `*.test.mjs` and `__fixtures__/` excluded) contains `manifest.json` or `engram-manifest`, with an evidence floor of more than 100 files scanned including `engram.mjs`.
- S2 (A): `.gitattributes` has no `engram-manifest`.
- S3 (A): `.gitignore` has the exact line `.memory/manifest.json`.
- B1–B3 (B): no definition of `dualWriteRecords`, `rollbackMigration` or `scrubChunkFile` in `brain/**`.
- B4 (B): `secret-scrub.mjs` does not import `node:zlib`.

**Session-start**: SS1 `assertLocalArgv('git',['restore'])` throws; SS2 the same for `status`; SS3 a `manifest` field in the model renders byte-identically to no field. **CLI refusal** (B): a fixture with a chunk and no records; both `--rollback` and `--rollback --dry-run` exit 1, stderr includes `en['memory.migrateV1.rollbackRetired']`, and the chunk is still in `chunks/` with no `records/` or `legacy/` created.

**Mutation matrix.** Each mutation kills exactly one test. Mutations re-add behaviour without re-adding the literal strings, so S1 stays independent.

| Production change | Mutation | Sole killer |
|---|---|---|
| session step 1 gone | re-add a step spawning `git status --porcelain` | parity `session:start` |
| gate narrowed | re-add `'restore'` / `'status'` | SS1 / SS2 |
| render line gone | re-add `if (manifest?.restored)` | SS3 |
| share drops symlink | re-add `_ensureSymlink(root)` | parity `share`[engram] |
| pull drops restore | re-add both params, defaults non-literal, plus the `if` | parity `pull`[engram] |
| driver registration, day-start block, lib modules | re-add (they carry the literal) | S1 |
| attribute line / ignore line | re-add / delete | S2 / S3 |
| refusal branch | delete it | CLI refusal |
| three deletions / zlib import | re-add | B1–B3 / B4 |
| forward migration kept (R3) | delete the `runMigration` branch | `cli.migrate-v1.test.mjs:60` (existing) |

## Migration / Rollout — CHANGELOG (`/CHANGELOG.md`, newest first, no Unreleased section exists yet)

```
## Unreleased — engram's transport artifacts retire (#955)

**Manual step (consumers upgrading from an older brain).** The upgrade drops the
`merge=engram-manifest` attribute (`.gitattributes` is managed), so git never runs the old
driver again. Two inert leftovers stay in YOUR repo and nothing reads them. To remove them:

    git rm .memory/manifest.json
    git config --unset merge.engram-manifest.driver

- `session:start`, `day:start` and `memory:pull` no longer restore a manifest; `memory:share`
  no longer creates the `.engram` symlink (`brain:env:init` / `cli.mjs setup` still does).
- (slice B) `memory:migrate-v1 --rollback` is removed and refuses with a reason. Forward
  `migrate-v1` and `--dry-run` are unchanged.
```

## Line budget (400; `governance.ignoreList` excludes tests, `.memory/**`, `openspec/**`, `AGENTS.md`)

| Slice | Counted estimate | Risk |
|---|---|---|
| A | engram.mjs ~107, memory-manifest 32, driver 42, session-start ~49, day-start 13, backend-selection ~10, i18n 2, .gitattributes ~10, .gitignore ~6, README 2, CHANGELOG ~16 → **~290** | Low |
| B | engram.mjs ~275, migrate-v1 ~73, cli.mjs ~30 (+11 if the `:952` comment is edited), secret-scrub ~36, i18n 6 → **~415-430** | **High — exceeds 400** |

## Failure modes

| Failure | Effect | Guard |
|---|---|---|
| A consumer keeps a tracked manifest or driver config | noise only | CHANGELOG commands (R8) |
| An old engram binary re-exports the manifest | untracked here | `.gitignore` (the ignore file is not managed for consumers) |
| A fresh worktree without `.engram` runs share | harmless; no reader | parity `share` test |
| A user runs `--rollback` | exit 1, no change | D1 test |
| `AGENTS.md` is hand-edited | drift guard goes red | D2 |
| A draft anchor drifts before promotion | `brain:promote` refuses (`free ≠ 1`) | promote only after merge |
| `cli.mjs` pin not moved | `chunk-boundary` goes red | same-commit re-pin |
| Apply stages index or records | memory-lane hazard | staging table |
| Slice B is reverted after a history rewrite | archives lost | R1, accepted |

## Open Questions

- [ ] **D5**: R12 says `cli.mjs import` completes under plainfiles, but plainfiles does not implement `import` (`cli.mjs:787`). Is proving that leg by named-refusal vacuity acceptable, or is `plainfiles.importMemory` in scope?
- [ ] **Slice B budget**: ~415-430 counted lines, above 400. Take a `size:exception`, or re-rule a part (for example R4) into A?
- [ ] The spec delta's REQ-4 scenario (`spec.md:63`, "exported chunks") is stale but outside R9's line list. Should the spec phase fix it?
