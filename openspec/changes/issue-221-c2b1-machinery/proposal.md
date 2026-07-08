# Proposal — records-as-write-truth machinery (slice C2b-1)

> **Status:** planned · **Issue:** #221
> **Depends on:** #217 C2a (provenance pair + export) + #219 C2-migrate (migrate-v1), both merged.
> **Followed by:** C2b-2 (#222) — THE CUTOVER (the real execution; separate approved issue).
> **Contract:** [spec.md](spec.md) · [design.md](design.md) · [tasks.md](tasks.md).

## Context

C2a made engram observations exportable to brain records; C2-migrate built the migration tool. What
is still missing before the store can flip to `records/` as the source of truth: the **inverse**
(record → engram, for the pull side), the secret-scrub **re-pointed** to `records/`, and a `share`
that **dual-writes** records + chunks during the transition. This slice ships that machinery,
**fixture-tested — the real `.memory/` store is never mutated here** (that is C2b-2's human-gated
cutover).

## What to build (this slice)

1. **Import — brain record → engram observation** (the inverse of C2a's `exportObservation`), using
   the shared `renderProvenance`. Designed for the **C4 round-trip under id-equality**.
2. **Scrub re-point** — the secret-scrub scans `.memory/records/` (plaintext JSONL) instead of the
   gzip chunks; `scanTextForSecrets`'s contract is unchanged.
3. **Dual-write in `share`** with **scan-then-write** ordering: scan the candidate records BEFORE any
   write, gating BOTH outputs (records + chunks), so nothing secret ever touches the append-only log.

## Out of scope

- **THE CUTOVER** — the real execution of `migrate-v1` against the true store → **C2b-2 (#222)**.
- The full round-trip **contract test** + the `pull` → records-only switch → **C4**.

## Acceptance criteria

- [ ] Import inverts export; a record → engram → record round-trip preserves `id` (id-equality).
- [ ] Scrub scans `records/` and still fails closed on a planted secret.
- [ ] `share` dual-writes under scan-then-write: a planted secret aborts BEFORE any append/materialize
  (records + chunks both untouched on a hit); a clean run writes both + reindexes.
- [ ] `npm test`, `brain:repo:check`, `brain:nav` green; `.memory/` never mutated by code or tests.
- [ ] Counted diff (excl. tests, excl. `openspec/changes/**`) ≤400.

## Risks

- **Scan-then-write inverts C1b's post-materialization scan** — the scrub now runs pre-write over
  candidates. `scanTextForSecrets` is reused verbatim, but `share`'s orchestration changes; the
  fail-closed guarantee must be preserved (and strengthened: nothing written on a hit).
- **Fixture-only** — import + dual-write are proven against synthetic stores; the first real run is
  C2b-2's cutover and may surface fixture-vs-real discrepancies.
