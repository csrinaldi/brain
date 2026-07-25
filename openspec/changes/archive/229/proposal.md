# Proposal — CLOSE THE WINDOW (slice C4)

> **Status:** planned · **Issue:** #229 (awaiting `status:approved`)
> **Depends on:** #222 C2b-2 (the cutover), merged into `feature/v2.0.0`.
> **Contract:** [spec.md](spec.md) · [design.md](design.md) · [tasks.md](tasks.md).

## Context

The C2b-2 cutover migrated the real store chunks → `records/`, activated dual-write, and opened a
**declared transitional window** with an EMBARGO on chunk-based `pull` (the manifest goes stale by
design; see the cutover runbook). C4 is the next slice — scheduled immediately, with nothing in
between — and it CLOSES that window: it makes `records/` the sole read+write truth, retires the
`memory.dualWrite` flag and the transitional chunks path, and ENDS the embargo. After C4 there is no
chunk path left to go stale.

## What this slice ships (CODE + artifacts — record path only)

1. **D1 — round-trip contract test on real data.** `computeRecordId(exportObservation(importRecord(r)).record) === r.id`
   for every record in the REAL committed store (`.memory/records/2026-06.jsonl` — 135 `@legacy`
   records — + `2026-07.jsonl`), plus the existing synthetic issue-without-source fixture. Source is
   hash-excluded (C2a pin), so a re-materialized `source` must not shift the id.
2. **D2 — switch pull/import to records-only.** Wire `importRecord()` (shipped dormant in C2b-1) into
   `pull`/`import`: read `.memory/records/*.jsonl`, transform, write per-record via `engram save`.
   **IDEMPOTENT by contract** — re-running pull over an already-populated engram MUST NOT duplicate.
3. **D3 — retire `memory.dualWrite`.** Retire-by-deletion (pre-release ruling — see design.md): delete
   the config gate, delete the key from this repo's `brain.config.json`, remove the never-shipped 0.6.0
   migration entry. Record-write becomes unconditional (records-only is the only path).
4. **D4 — retire the chunks path in the memory-gate** (the #227 dual-reader OR was transitional), and
   **fold in cutover finding 7 (id:388)**: fix the `_defaultChangedChunkFiles` deletion→ENOENT live bug
   (a `D ` porcelain entry passes the `.jsonl.gz` filter → `scrubChunkFile` reads a deleted path).
5. **D5 — END the embargo, declared in the PR body.** Precise wording: the chunk path no longer exists,
   so there is nothing left to go stale — NOT "chunk-based pull is safe again."

## C3 disposition (DECIDED — own slice, NOT folded into C4)

C3 (plainfiles-as-second-consumer) stays a separate slice. Rationale, pinned in the issue: C4 already
closes window + embargo + flag + gate; D1's contract covers the record↔engram direction only;
plainfiles is C3's job; folding would blow C4's budget past one reviewable slice.

## Out of scope

- C3 plainfiles second consumer (own slice).
- Any post-release config-key retirement mechanism (tolerate-and-ignore + warning) — NOT invented
  speculatively now; C4's removal is the pre-release retire-by-deletion case only.
- Bumping / reconciling this repo's stale `schemaVersion` (0.3.0) — flagged as an open question in
  design.md, not decided by this slice.

## Acceptance criteria (CP-C4 — hard stop, PR-as-review, Part of #229)

- [ ] D1: round-trip id-equality test passes over every REAL record + the issue-without-source fixture.
- [ ] D2: `pull`/`import` are records-only and PROVEN idempotent (explicit re-run-no-duplicate test).
- [ ] D3: config gate deleted, key removed from `brain.config.json`, 0.6.0 migration entry removed;
      record-write unconditional; never-shipped verification captured as CP-C4 evidence.
- [ ] D4: memory-gate reads records only; finding 7 (id:388) ENOENT bug fixed with a regression test.
- [ ] D5: embargo END declared in the PR body with the precise "path no longer exists" wording.
- [ ] Every changed CLI string has en + es i18n; `memory:share` run before push.
- [ ] `npm test`, `brain:repo:check`, `brain:nav` green. No `decision` label unless a new promoted
      decision arises.
