# Proposal — Durable Memory Format Library, slice C1 (C1a delivered)

> **Status:** In progress · **Issue:** #205 · Track C, first implementation slice ·
> Implements the C0 contract:
> [spec.md](../issue-201-memory-format/spec.md) (REQ-MF-1..6) +
> [memory-format.md](../issue-201-memory-format/brain-drafts/memory-format.md).

## Context

Slice C0 (#201, merged) fixed the **normative** durable memory record format — schema, layout,
content-hash identity, and concurrent-append merge policy — but shipped no code. C1 is the first
slice that turns the contract into a working library: the record builder/validator, the
append-only writer, and `memory:reindex` (the derived-index rebuild REQ-MF-4 requires).

## Split: C1a / C1b (pre-approved)

Implementing the full C1 scope in one slice risked exceeding the 400-counted-line budget. The
work splits cleanly on a natural seam — the pure record format and its reindex path (C1a) vs. the
secret-scrubbing gate and its config plumbing (C1b), which depend on C1a but not vice versa:

- **C1a (this slice, delivered):** `format.mjs` (pure record builder/validator/canonicalizer),
  `store.mjs` (thin I/O: `appendRecord`, `rebuildIndex`), the `memory:reindex` CLI subcommand,
  degenerate-state handling (absent/empty `records/`, corrupt-line fail-closed), and the
  REQ-MF-3 git-merge integration test.
- **C1b (follow-up):** the fail-closed secret-scrub gate in `memory:share`, the
  `governance.memorySecretPatterns` / `governance.memorySecretAllowPatterns` config keys (a
  `0.5.0` additive migration in `brain/core/config-migrations.mjs`), and the repo-wide
  `.gitattributes` `.memory/records/*.jsonl merge=union` line (`brain/core/managed-paths.mjs`
  already lists `.gitattributes` as a managed path — no change needed there).

## What C1a builds

1. **`brain/scripts/memory/lib/format.mjs`** — pure functions: `canonicalJson` (RFC 8785 JCS),
   `computeRecordId`, `buildRecord` (R2 title-fold, R3 omit-not-null optionals),
   `validateRecord`, `serializeRecord`, `parseRecordLine`, `buildIndexEntry`, `serializeIndex`.
2. **`brain/scripts/memory/lib/store.mjs`** — thin I/O: `appendRecord` (validate + append one
   physical JSONL line to `records/<yyyy-mm>.jsonl`), `rebuildIndex` (regenerate
   `.memory/index.jsonl` from `records/` alone; fails closed on a corrupt line with file+line
   number; degenerate-empty is a no-op success).
3. **`memory:reindex`** — new CLI op in `brain/scripts/memory/cli.mjs`, dispatched directly
   (backend-agnostic — the record format is brain-owned, not a `MEMORY_BACKEND` concern) — plus
   the `memory:reindex` npm script.
4. **REQ-MF-3 integration test** — a real temp git repo, two branches each appending a distinct
   record to the same month file under a `merge=union` `.gitattributes` entry, a real
   `git merge`: asserts a conflict-free union and a clean re-index (CP-C1 evidence).

## Out of scope (this slice — deferred to C1b)

- The secret-scrubbing hook in `memory:share` and its config keys.
- The repo-wide `.gitattributes` append (the integration test declares its own scoped
  `merge=union` attribute inside its temp-repo fixture, proving the mechanism without requiring
  the repo-wide file yet).
- `brain-drafts/adr-0017-memory-format-owned-by-brain.md` promotion (Note (c) co-promotion gate,
  #201 design.md) — unrelated to C1's code scope.

## Acceptance criteria

- [x] `format.mjs` implements R1 (index serialization), R2 (title fold before hashing), R3
  (absent optionals omitted, never null) — all three code-pins.
- [x] `validateRecord` rejects: null optional, non-enum `type`, missing required field, naive
  (non-UTC) `ts`, invalid `actorKind`, email-shaped `actor` (REQ-MF-5 partial heuristic).
- [x] `rebuildIndex` is deterministic (delete-index-and-reindex is byte-identical) and fails
  closed (file + line number) on a corrupt/invalid physical line — never a silent skip.
- [x] Degenerate absent/empty `records/` → empty index, exit 0, no warning, and never touches
  `.memory/chunks/*.jsonl.gz`.
- [x] `memory:reindex` CLI op + npm script exist and are i18n-routed (`en.mjs`/`es.mjs`).
- [x] A real git-merge integration test proves REQ-MF-3's union-merge mechanism conflict-free.
- [x] `npm test`, `npm run brain:repo:check`, `npm run brain:nav` all green.
- [x] This slice (excluding `*.test.mjs`, `openspec/changes/**`, `.memory/**`) is under the
  400-counted-line budget (~325 lines).

## Risks

- **`.gitattributes` not yet shipped repo-wide.** Until C1b lands, `memory:share`/manual appends
  in THIS repo have no live union-merge protection — mitigated by the integration test proving
  the mechanism works once the C1b `.gitattributes` line lands, and by C1a not touching
  `memory:share` at all (no new production write path is exposed without the C1b gate).
- **`canonicalJson` is a minimal RFC 8785 subset**, not a full JCS implementation (no float/NaN
  support, since the record schema never carries floats) — documented in `format.mjs` and
  `design.md`; revisit if a future field needs float precision.
