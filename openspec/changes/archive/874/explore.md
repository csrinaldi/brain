---
status: draft
issue: 874
---

# Explore: #874 — record first, backend after

Today an agent capture under `MEMORY_BACKEND=engram` has no durable path at all: `memory:save`
is pinned to `plainfiles` (`package.json:65`), `engram.save()` is `unsupportedOp`
(`brain/scripts/memory/backends/engram.mjs:1121`), and the only door into engram is the MCP
`mem_save` tool writing straight into its store — bypassing `.memory/records/` entirely. `share()`
then walks the pipe backwards: `engram sync --export` → read the chunks it just wrote → scrub them
→ dual-write into records. #874 (epic task 3.2, ruled by #863 D2/D2b/D3) inverts this: a capture
becomes a record first (mirroring `plainfiles.save()`, already correct), then the active backend
is *hydrated* from that one record. `share` stops exporting anything and becomes a pure
self-check, exactly like `plainfiles.share()` already is.

## What dies here vs. what moves to 2.4

Per the #874 ledger (issue comment, corrected 2026-09-10) — 3.2 owns rows 1–5 and half of 7
(the `engram.mjs` allowlist entry only); 2.4 owns rows 6 and the rest of 7.

| # | surface | file:line | measured size |
|---|---|---|---|
| 1 | `_defaultShareExport` (the `engram sync --export` call) | `engram.mjs:486-493` | ~8 lines |
| 2 | `_defaultReadObservations` + its `collectChunkObservations` import | `engram.mjs:273-275`, `:61` | ~5 lines + 1 allowlist row |
| 3 | `dualWriteRecords`'s `_readObservations` seam | default `:199`, call `:345` | seam removed, function reshaped |
| 4 | `_defaultChangedChunkFiles`, `assertExportDestinationIsRead`, `scrubMaterializedChunks` | `:578-609`, `:653-670`, `:686-710` | ~32+18+25 = ~75 lines — **deleted only after the re-proof below** |
| 5 | `engram.share.test.mjs` | whole file | **1069 lines** — largest single deletion in 3.2 |
| 7 (half) | `collectChunkObservations` allowlist row for `engram.mjs:61` only | `chunk-boundary.test.mjs:171` | the `cli.mjs:615` and `migrate-v1.test.mjs:13` rows **stay** — those die at 2.4 with `migrate-v1.mjs` itself |

Not touched here: `.engram` symlink (`engram.mjs:221`, stays confined to `setup()`), `.gitattributes:5`
+ merge driver, `.memory/legacy/*.gz`, `.gitignore:81-84` — all row 6/7, explicitly D3-sequenced
*after* 3.2 so the manifest isn't retired while nothing else has stopped writing it.

## The record-first sequence, as concrete calls

**1. `engram.save(title, content, opts)`** — today `unsupportedOp`. Must become a mirror of
`plainfiles.save()` (`plainfiles.mjs:82-278`), which already does everything the contract asks:
`resolveActor`/`resolveActorKind` (#738 provenance), `deriveIssue`, `classifySupersedes` when
`--supersedes` is given (#805), `buildRecord`, **`scanTextForSecrets` over the serialized
candidate BEFORE `appendRecord`**, `appendRecord`, `rebuildIndex`. Then, new: call
`hydrate({root, recordId: candidate.id})`.

**2. `hydrate({root, recordId})`** — does not exist yet under any name. The contract's signature
(`memory-backend-contract.md:62`) wants a fast path that projects one record without a full
import. A primitive for exactly this already exists and is already used, just not for this:
`_defaultEngramSave()` (`engram.mjs:1710-1719`, today only called by `featureResume`) shells out
to `engram save <title> <content> --type … --project … --topic <topic>`. The doc comment on
`_defaultExistingTopicKeys` (`:1533-1538`) and `buildImportPayload` (`:883-886`) both state that
engram's `topic_key` match **upserts** rather than inserts — so calling it with
`topic: recordId` is, by the same mechanism `importMemory` already relies on for idempotence,
a single-record idempotent hydrate. `importMemory()` (bulk import) stays the fallback the
contract names, unchanged.

**3. `share({root})`** — reshaped to exactly `plainfiles.share()`'s shape (`plainfiles.mjs:378-383`):
call `rebuildIndex`, return `{indexCount, duplicates}`. No `_export`, no `_readObservations`, no
`dualWriteRecords`. `pre-push` (`brain/scripts/hooks/pre-push:70`) keeps calling
`cli.mjs share` unchanged — it is backend-agnostic by design and never knew about chunks.

**4. `package.json:65`** — `"memory:save": "MEMORY_BACKEND=plainfiles node …"` must lose its
pin so an agent session under the repo's default (`engram`) can reach `save` at all. This is a
one-line config change, but it's the thing that makes the whole slice *reachable*.

## The secret-scrub re-proof (ledger row 4)

Row 4 may be deleted only *after* proving the #469 fail-closed guarantee holds over
record-first `save`. Two findings narrow this a lot:

- **The scan already exists at the right chokepoint.** Both `plainfiles.save()`
  (`plainfiles.mjs:213-221`) and `dualWriteRecords()` (`engram.mjs:407-420`) already call
  `scanTextForSecrets` over the serialized candidate record **before** `appendRecord`. If
  `engram.save()` mirrors `plainfiles.save()` (step 1 above), it inherits this scan by
  construction — not a new mechanism, the same one.
- **A dedicated reader for this already exists and is unused.** `scrubRecordsFile()`
  (`secret-scrub.mjs:137`) — reads a plaintext `.memory/records/*.jsonl` file, no gunzip — is
  fully implemented and tested (`secret-scrub.test.mjs:148-193`) but has **zero production call
  sites**. It looks built for exactly this re-proof and never wired in.
- **What the chunk scrub covered that this doesn't need to:** secrets arriving via `mem_save` →
  `engram sync --export` → chunk. Under record-first that path is *gone* — `mem_save` stays
  non-durable and is never exported (see below) — so there is no equivalent surface to cover,
  not a gap to fill.

The re-proof is therefore: a test that captures a secret through `engram.save()` and asserts the
record is refused before `appendRecord` runs (mirroring `plainfiles.save-index-failure.test.mjs`'s
shape), stated explicitly as the reason row 4 is safe to delete.

## `mem_save` / the MCP door

#863 D2 ratified option (a): `mem_save` stays working-memory only (`brain-feature-*`,
`featureResume`'s projection), declared non-durable, **never exported by `share`**, and **the MCP
plugin is untouched** (proposal.md:62, "Non-goals: … changing the MCP plugin"). Grep for any
bridge from `mem_save` observations into records (poster, session-start, a heal script) came back
empty — none exists. #874 does nothing about it; the epic's 1.2a is the one-time heal of
pre-existing `mem_save` captures that never became records, out of this ticket's scope.

## Hydration idempotence / two-session scenario

Two sessions save the same topic before either shares: two records, later `--supersedes`
(needs #805, already landed per worktree state). Each `save()` calls its own `hydrate({recordId})`
— `topic_key = record.id`, content-addressed, so a re-hydrate of the same record (a retry, a
second `save --supersedes` on the same topic) upserts rather than duplicates. `#820`'s guard
(`hydration-guard.mjs`) governs `importMemory`'s bulk delta window; a single-record
`_defaultEngramSave` call is a different, narrower write and **may not need the guard at all** —
open question below.

## Tests

| file | fate |
|---|---|
| `engram.share.test.mjs` (1069 lines) | **deleted** — mocks the seam being removed |
| `engram.save-search-unsupported.test.mjs` | **rewritten** — `save` is no longer unsupported on engram |
| `chunk-boundary.test.mjs` | **edited** — allowlist row for `engram.mjs:61` removed (guard is bidirectional; same commit) |
| new: `engram.save.test.mjs` | mirrors `plainfiles.save.test.mjs`'s scenarios (provenance, supersedes, secret refusal) |
| new: `engram.hydrate.test.mjs` | single-record idempotence: two hydrations of one snapshot → one row |
| `cli.save-search.test.mjs` | extend — `save` reachable under `MEMORY_BACKEND=engram` without the plainfiles pin |
| `engram.batch-import.test.mjs`, `engram.import.test.mjs`, `hydration-guard*.test.mjs` | untouched — bulk import/guard stay the fallback |

Integration shape: `engram.mjs`'s existing tests inject `_engramSave`/`_engramImport`/etc. as seams
rather than hitting the real binary — the new `save`/`hydrate` should follow the same pattern
(`_appendRecord`, `_rebuildIndex`, `_engramSave` injectable, no real `engram` process in unit tests).

## Approaches and tradeoffs

| approach | for | against |
|---|---|---|
| **A. `engram.save()` duplicates `plainfiles.save()`'s body** | matches the existing convention — every backend file is already independent, zero shared abstraction between them today | the provenance/supersedes/scrub logic now lives twice; a future fix must touch both |
| B. extract a shared `buildAndAppendRecord()` core, both backends call it, engram adds `hydrate` | one copy of the correctness-critical logic | touches `plainfiles.save()`, which is heavily tested and currently correct — scope creep risk on a slice the ticket says "must NOT become … a backfill" |
| **hydrate via single `_defaultEngramSave` call** | primitive already exists and is already proven (`featureResume` uses it today); cheap (one execFileSync, not a full export+import round trip) | unclear if engram's CLI `save --topic` upsert is atomic under concurrent writers — no guard wraps it today |
| hydrate via `importMemory` filtered to one record | reuses the guard, the dedup, the tested delta machinery | pays the "read back the WHOLE local store" cost (`_defaultExistingTopicKeys`, measured 0.67s/2248 obs) for one record — defeats the point of a fast path |

**Leaning A + the single-`_defaultEngramSave`-call hydrate** — smallest diff, reuses proven
primitives, matches the "mirror, don't unify" convention the two backend files already have.

## Open questions for the proposal

1. Does `engram save --topic <id>` upsert atomically, or does it need the same hydration guard
   `importMemory` uses? Not measured this session — worth a direct `engram --help`-adjacent check
   or an upstream question before committing to guard-free.
2. Should `hydrate({recordId})` skip the guard entirely (single record, upsert-safe by topic_key)
   or take it anyway for uniformity with the bulk path? The contract's `deferred`/`contended`
   return shape (`memory-backend-contract.md:62`) implies the guard is expected.
3. A vs. B above — does the maintainer want the shared-core refactor now, or duplicate-and-drift
   like the rest of `engram.mjs`/`plainfiles.mjs` today?
4. Does unpinning `package.json:65` belong in split A, or is it its own one-line PR ahead of A?
5. `scrubRecordsFile()` is unused — confirm it's meant to be wired into `engram.save()`'s scrub
   step (replacing the inline `scanTextForSecrets` call) rather than left dead, or state why not.

## Split candidates (counted estimates)

- **A — `memory:save` record-first + `hydrate({recordId})` + scrub re-proof.** New:
  `engram.save()` (~90-120 lines, mirrors `plainfiles.save()`), `hydrate()` (~40-60 lines),
  `package.json:65` unpin (1 line), tests (~200-300 new lines: `engram.save.test.mjs`,
  `engram.hydrate.test.mjs`, extended `cli.save-search.test.mjs`). Net: **~350-500 lines**, new
  logic, needs TDD (strict TDD is active for this project).
- **B — `share()` = commit what is true; retire the export/read/scrub subsystem; allowlist.**
  Deletions: ~75 lines of production code (rows 1-4) + 1069-line test file (row 5) + allowlist
  edit; `share()` rewritten to the ~15-line plainfiles-mirror shape. Net: **roughly -1150 to
  -1200 lines**, almost entirely deletion, mechanical, low risk — but functionally depends on A
  having landed first (share must stop exporting only once save/hydrate are the real producer
  path, per D3's ordering intent even though nothing in B's code literally imports from A).
  **Recommend B ship as its own PR after A merges** — the 400-line budget and the risk profile
  (pure deletion vs. new logic) are different enough to want separate review.
- **C — docs/conformance.** Flip `memory-backend-contract.md:102`'s engram row (rule 2, `save`)
  from "not yet" to "yes" — a few lines, no code. Small enough to ride with A's PR rather than
  stand alone.

## Risks

- **A host on an older `brain` checkout still runs `engram sync --export`** via its own
  `pre-push`/`share` after this ships — harmless: it writes local chunks nobody reads back
  anymore (row 2's reader is gone), so it's dead weight on that machine, not a shared-store risk.
- **The MCP door's pre-existing observations** (captured before this merge, never exported as
  records) stay stranded — explicitly 1.2a/heal territory, not this ticket.
- **`engram save --topic` semantics are version-dependent** — this worktree has engram v1.20.0;
  the upsert-by-topic_key behavior the hydrate design leans on is documented only in code
  comments here, not independently re-verified against the binary this session.
