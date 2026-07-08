# Proposal — migrate-v1 real-run CODE (slice C2-migrate)

> **Status:** implemented (this MR) · **Issue:** #219
> **Depends on:** C2a ([issue-217-engram-records-migration](../issue-217-engram-records-migration/))
> — `collectChunkObservations`, `buildMigrationReport`, `exportObservation`, `--dry-run`.
> **Contract:** [design.md](design.md), [tasks.md](tasks.md).

## Context

C2a shipped the dry-run migration report only; the persisting real run was explicitly deferred
(see [issue-217-engram-records-migration/proposal.md](../issue-217-engram-records-migration/proposal.md)
"Out of scope"). Per the human ruling recorded in design.md Decision 1, the real run's **code**
belongs here (C2-migrate), fixture-tested; the real **execution** against the true `.memory/`
store remains C2b's cutover — running it here would break dual-write ordering and the old
cross-machine `memory:pull` for the transition window.

## What to build (this slice)

1. **`runMigration()`** in `migrate-v1.mjs` — orchestration with injected seams (mirrors
   `backends/engram.mjs`'s pattern): idempotency abort first (populated `records/` → throw, message
   routes to the C2b cutover runbook), export + `appendRecord` per observation, a persisted
   rejection report under `.memory/legacy/`, chunk files moved (never deleted) to `.memory/legacy/`,
   and `rebuildIndex()`.
2. **`cli.mjs`** — the non-`--dry-run` path now calls `runMigration()` against the real
   `.memory/{chunks,records,legacy}` + `index.jsonl` paths and prints a summary. `--dry-run`
   unchanged.
3. **i18n** — en + es entries for the new real-run summary string.

## Out of scope (deferred to C2b)

- Import (`renderProvenance`-based brain record → engram observation).
- Secret-scrub re-point from `.memory/chunks/` to `.memory/records/`.
- The dual-write `share`/`pull` pipeline wiring and its transitional chunk policy.
- **The actual cutover** — running `runMigration()` against the TRUE `.memory/` store, and the
  runbook that governs it.

## Acceptance criteria

- [x] `runMigration()` writes accepted records to `records/<yyyy-mm>.jsonl`, moves original chunks
  to `legacy/`, persists a named rejection report, and rebuilds the index — proven against a
  synthetic fixture store only.
- [x] Idempotency abort fires FIRST, before any work, when `records/` already has `.jsonl` content;
  the error message contains "run the cutover runbook" and names the records dir.
- [x] `cli.mjs`'s non-`--dry-run` path is wired to `runMigration()`; `--dry-run` is unchanged.
- [x] Every new CLI string has an en + es i18n entry.
- [x] `npm test` and `brain:nav` stay green; `.memory/` (the real store) is never mutated by this
  slice's code or its tests.
- [x] Counted diff (excluding tests, excluding `openspec/changes/**`) stays within the ≤400 budget
  shared with C2a.

## Risks

- **`brain:repo:check` pre-existing gap**: this change directory had no `proposal.md` before this
  MR (design.md + tasks.md only) — S-1 (`openspec-incomplete`) failed on every commit attempt
  regardless of this slice's own code. This file resolves that structural gap; it does not reflect
  new code scope beyond what tasks.md/design.md already specified.
- **No real-store rehearsal here** — `runMigration()` is fixture-tested only; the first execution
  against the true `.memory/` (278 real observations) happens in C2b and may surface fixture-vs-real
  discrepancies (e.g. record-count/legacy-path assumptions) not exercised here.
