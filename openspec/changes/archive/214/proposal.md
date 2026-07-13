# Proposal — Secret Scrub + Id-Integrity Hardening, slice C1b

> **Status:** Delivered · **Issue:** #214 · Track C, second implementation slice (C1b) ·
> Completes the C1 scope anticipated by
> [issue-205-memory-format-lib/tasks.md](../issue-205-memory-format-lib/tasks.md) §"C1b" and
> closes against the C0 contract:
> [spec.md](../issue-201-memory-format/spec.md) (REQ-MF-3, REQ-MF-4, REQ-MF-5) +
> [memory-format.md](../issue-201-memory-format/brain-drafts/memory-format.md).

## Context

Slice C1a (#205, merged) delivered the pure record format library (`format.mjs`), the thin I/O
layer (`store.mjs`), and `memory:reindex` — but deliberately deferred three items to a follow-up
slice: the fail-closed secret-scrub gate on `memory:share`, the additive config keys it needs,
and the repo-wide `.gitattributes` union-merge line. This slice (C1b) closes those gaps, and adds
two items discovered while closing them:

1. **Id-integrity hardening** in `store.mjs#rebuildIndex` — a record's `id` is now recomputed
   from its own read fields via the ONE shared `computeRecordId` and compared against the stored
   `id`; a mismatch fails closed with `file:line`, the same convention as the existing
   corrupt-line path (C1a task 2.1).
2. **`index.json` → `index.jsonl` rename** — the index was always JSONL (one entry per physical
   line, R1), never a whole-file JSON document; the `.json` extension invited a
   `JSON.parse(entireFile)` trap. Renamed now, at zero migration cost (no `.memory/index.json`
   had been committed yet).
3. **C0 doc-sync** — the R1 pin (index = JSONL) made the C0 drafts' union-exclusion
   justification stale (it said the index was excluded from `merge=union` because it was "a
   single JSON object"). Corrected in both `brain-drafts/memory-format.md` and
   `brain-drafts/adr-0017-memory-format-owned-by-brain.md`.

## What this slice builds

1. **`brain/scripts/memory/lib/secret-scrub.mjs`** — pure secret scanner: default patterns
   (GitHub PAT, GitLab PAT, AWS access key, PEM private-key header), `resolveSecretConfig`
   (additive merge with `governance.memorySecretPatterns`/`memorySecretAllowPatterns`),
   `scanTextForSecrets` (line-scan, allowlist is the only bypass), `scrubChunkFile` (gunzip +
   pretty-print + scan, for a meaningful line number).
2. **Wired into `memory:share`** (`backends/engram.mjs#share`) — after `engram sync --export`,
   scans only the `.memory/chunks/*.jsonl.gz` files `git status` reports as changed THIS run
   (never the whole store); a hit throws (fail-closed, non-zero exit), naming the matched
   pattern and `file:line`. No `--no-scrub` flag — the sole bypass is the config allowlist.
3. **`store.mjs#rebuildIndex` id-integrity** — recompute + compare `id` on every read record;
   fail closed on a mismatch (tampered or stale record), file:line in the error.
4. **`config-migrations.mjs` `0.5.0`** — additive migration for
   `governance.memorySecretPatterns` (defaults) and `governance.memorySecretAllowPatterns`
   (empty default); a drift-guard test (`installer.test.mjs`) keeps the migration's default list
   and `secret-scrub.mjs#DEFAULT_SECRET_PATTERNS` from silently diverging.
5. **`.gitattributes`** — appended `/.memory/records/*.jsonl merge=union` (git's BUILT-IN union
   driver, no per-clone `git config` registration); the exact literal is single-sourced as
   `managed-paths.mjs#RECORDS_UNION_MERGE_GITATTRIBUTES_LINE` and drift-guarded against the real
   file.
6. **`index.json` → `index.jsonl` rename** across `store.mjs`, `format.mjs` comments, tests, and
   the C1a (issue-205) spec/design refs + the C0 drafts.
7. **C0 doc-sync** — corrected union-exclusion rationale in both `brain-drafts/` documents.

## Design decision surfaced ahead of code (recap — full rationale in design.md)

**Scrub target in the pre-C2 gap.** `memory:share` materializes engram's gzip chunks today, not
`records/` (that lands in C2). This slice scans the chunks (decompressed to text) — the real
leak-risk surface today — rather than shipping an inert scrub with no target. C2 re-points the
scanner at `records/` without changing its public contract (`scanTextForSecrets` is already
target-agnostic).

## Out of scope (deferred)

- **C2** — re-pointing `memory:share`'s durable write path at `records/` instead of engram's
  gzip chunks. This slice's scrub explicitly targets the current (pre-C2) materialization.
- **C4** — the engram export → record migration (REQ-MF-6).
- Full PII enforcement beyond the email-actor heuristic (REQ-MF-5) — unchanged from C1a.

## Acceptance criteria

- [x] `memory:share` fails closed (non-zero exit) when a materialized chunk contains a secret
  matching a default or configured pattern; the error names the pattern and `file:line`.
- [x] `governance.memorySecretAllowPatterns` is the only bypass — no `--no-scrub` CLI flag exists.
- [x] The scanner inspects only chunks changed in the current run (via `git status`), never the
  whole store.
- [x] `rebuildIndex` recomputes `id` via the shared `computeRecordId` and fails closed
  (`file:line`) on a mismatch; a legitimate record never false-positives.
- [x] `config-migrations.mjs` `0.5.0` is additive (never overwrites a consumer-set value) and
  idempotent.
- [x] `.gitattributes` declares `/.memory/records/*.jsonl merge=union`; `managed-paths.mjs`
  single-sources the literal.
- [x] `index.json` renamed to `index.jsonl` everywhere it is produced or documented.
- [x] The C0 drafts' union-exclusion rationale is corrected to match the R1 JSONL pin.
- [x] `npm test`, `npm run brain:repo:check`, `npm run brain:nav` all green.
- [x] i18n: every new CLI-facing string routed through `t()` with `en.mjs`/`es.mjs` parity.

## Risks

- **Scrub target is pre-C2 (chunks, not records/).** Accepted and documented — the alternative
  (an inert scrub waiting for C2) leaves the real, current leak surface unguarded in the
  meantime. C2 re-points the target; the scan primitives (`scanTextForSecrets`) do not change.
- **Line numbers are relative to a pretty-printed re-serialization of the chunk**, not the
  original engram-internal byte offsets — acceptable because the chunk is otherwise an opaque
  gzip blob with no native line concept; pretty-printing is the only way to give a human a
  locatable line at all.
