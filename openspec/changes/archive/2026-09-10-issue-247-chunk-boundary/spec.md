---
status: proposed
issue: 247
---

# Chunk Read-Back Boundary Specification (#247)

Per #863 D3 (ratified 2026-09-08): #247 is the read-back boundary and its guard, not the
export retirement (task 3.2, #874). `openspec/specs/**` is empty by convention; the normative
surfaces this delta touches are `memory-backend-contract.md` rule 3 (unchanged — still "not
yet") and `issue-864-memory-2-0/tasks.md:32` (task 2.3, amended by this PR).

## Requirements

### Requirement: `readChunkObservations` has zero importers, enforced (D4 guard 1)

A source-level test MUST assert `readChunkObservations` has zero importers across `brain/**`
(comments excluded). The test MUST fail the moment any file imports it again.

#### Scenario: guard is red on reintroduction
- GIVEN a fixture file imports `readChunkObservations`
- WHEN the guard test runs against the fixture
- THEN it fails, naming the importing file
- AND WHEN run against the real tree today, THEN it passes — the module has zero importers now

Test: `memory/chunk-boundary.test.mjs`.

### Requirement: `collectChunkObservations`'s importers are an annotated allowlist (D4 guard 2)

A source-level test MUST assert `collectChunkObservations` is imported ONLY by an allowlist
constant naming `migrate-v1.mjs` (its own definition/test), `backends/engram.mjs`, and
`cli.mjs`'s `migrate-v1` path — each entry annotated with the ticket that retires it (`3.2` for
`engram.mjs`; `2.4` for the `migrate-v1` pair). The test MUST fail when an importer outside the
allowlist appears, or when an allowlisted importer is retired from code without its entry being
removed from the list.

#### Scenario: an unlisted importer fails; a stale allowlist entry fails
- GIVEN a new file imports `collectChunkObservations` without an allowlist entry
- WHEN the guard test runs, THEN it fails, naming the unlisted importer
- AND GIVEN `engram.mjs`'s import is removed from code but its allowlist entry remains
- WHEN the guard test runs, THEN it fails — the list and the code MUST agree

Test: `memory/chunk-boundary.test.mjs`.

### Requirement: `share` under `plainfiles` writes no chunk (D4 guard 3, pinned)

`memory:share` under `MEMORY_BACKEND=plainfiles` MUST NOT write any file under
`.memory/chunks/`. This is true by construction today (`plainfiles.mjs` mentions chunks only in
a comment) and MUST stay pinned by a behavioural test, not a comment.

#### Scenario: no chunk file after share
- GIVEN `MEMORY_BACKEND=plainfiles`
- WHEN `memory:share` runs
- THEN `.memory/chunks/` contains no new or modified file

Test: `memory/backends/plainfiles.share.test.mjs`.

### Requirement: PR #258's readers stay records-only (D4 guard 4, pin)

`brain-audit.mjs` and `brain-check.mjs` MUST continue to call `readRecordObservations`, never
`readChunkObservations` or `collectChunkObservations`.

#### Scenario: no silent regression to chunk reads
- GIVEN `brain-audit.mjs` and `brain-check.mjs` as shipped by PR #258
- WHEN their observation-reading calls are inspected
- THEN both resolve to `readRecordObservations`, and the guard test fails if either resolves to
  a chunk reader

Test: existing `brain-audit.test.mjs` / `brain-check.test.mjs`, cross-referenced by
`memory/chunk-boundary.test.mjs`.

### Requirement: the #874 ledger is a written obligation, not a rediscovery

This change's `tasks.md`/`design.md` MUST carry the seven-row ledger (proposal.md, "Ledger for
#874") of what task 3.2 deletes when `share` stops calling `engram sync --export`, including the
obligation that item 4 (`scrubMaterializedChunks`/`_defaultChangedChunkFiles`, the #469
fail-closed guarantee) is deleted only after it is re-proved over record-first `save` — never
dropped silently. The ledger MUST also be restated on issue #874.

#### Scenario: #874's explore finds the ledger, not a rediscovery
- GIVEN #874's explore phase reads this change's tasks/design and the #874 issue thread
- WHEN it looks for what task 3.2 must delete
- THEN it finds the seven rows already written, including the #469 re-proof obligation, and does
  not re-derive them from source

### Requirement: epic task 2.3's wording is reconciled with the ruling

`openspec/changes/issue-864-memory-2-0/tasks.md:32` (task 2.3) MUST be rewritten in this PR to
state the read-back boundary only — deferring "`share` reads no chunk file" to task 3.2 — per
#863 D3's ratified sequencing 2.3 → 3.2 → 2.4.

#### Scenario: the epic line matches the ruling
- GIVEN `issue-864-memory-2-0/tasks.md:32` after this PR
- WHEN it is read beside `issue-863-backend-contract/design.md:32` (D3)
- THEN both describe the same sequencing — no reader can construct approach (C) from either

## Non-goals

This change does NOT: retire `engram sync --export`; change `share()`, `dualWriteRecords`, or
`_defaultShareExport` behaviour; delete or untrack any `.memory/legacy/*` file (task 2.4); touch
the manifest, the `.engram` symlink, the merge driver, or `.gitattributes`; measure or adopt
`engram export` parity as a substitute for the chunk round-trip.

#### Scenario: the capture path is byte-unchanged
- GIVEN this PR merges
- WHEN `share`, `dualWriteRecords`, and the chunk-scrub subsystem (`engram.share.test.mjs`) are
  diffed against `main` pre-merge
- THEN their behaviour is unchanged; only a header note in `engram.mjs` points at the ledger
