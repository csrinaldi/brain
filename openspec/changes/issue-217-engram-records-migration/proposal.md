# Proposal — Engram ↔ Brain Record Migration (slice C2)

> **Status:** C2a implemented (this MR) · C2b deferred (see [tasks.md](tasks.md)) · **Issue:** #217
> **Depends on:** C1a ([issue-205-memory-format-lib](../issue-205-memory-format-lib/)) —
> `format.mjs`/`store.mjs`; C1b ([issue-214-secret-scrub-idintegrity](../issue-214-secret-scrub-idintegrity/))
> — `secret-scrub.mjs`. **Contract:** [issue-201-memory-format/spec.md](../issue-201-memory-format/spec.md)
> REQ-MF-6, [memory-format.md](../issue-201-memory-format/brain-drafts/memory-format.md) "What
> engram export cannot supply", [checkpoint-report.md](../issue-201-memory-format/checkpoint-report.md).
> **Grammar source:** [consolidation-protocol.md](../../../brain/core/methodology/consolidation-protocol.md)
> §4 (read-only — this slice does not edit brain doc zones).

## Context

C0 fixed the durable record format and enumerated, evidence-based, everything an engram
observation cannot structurally supply (REQ-MF-6): `actor`, `actorKind`, `issue`, `supersedes`,
`source` exist only as consolidation-protocol §4 prose inside `content`, or not at all. C1a/C1b
built the format library, validator, and secret-scrub — but engram itself still only "speaks"
its own gzip-chunk observation shape. C2 is where engram starts speaking the brain record format:
a parser/renderer pair for the §4 grammar, an export transform (engram observation → record) with
the declared fallback convention for the 278/278 real observations that carry no §4 prose, and a
one-shot `memory:migrate-v1` CLI to produce the migration report.

## What to build (C2a — this slice)

1. **`provenance.mjs`** — the shared parser/renderer PAIR for the §4 grammar (`**Actor:**`,
   `**Fuente:**`, `**Supersede:**`), built from ONE set of shared marker constants. A mandatory
   property test (`parse(render(record))` recovers exact fields) anchored to the
   consolidation-protocol.md §4 canonical examples — never to real chunks, since 0/278 real
   observations carry this prose.
2. **`engram-export.mjs`** — `exportObservation()`: engram observation → brain record. Tries §4
   recovery first; falls back to the declared `@legacy`/`human` convention (documented as a
   convention, not a factual claim) when absent — the expected path for the entire current store.
   Folds `title` (R2), converts the naive engram `ts` to UTC seconds, filters `scope: personal`,
   and REJECTS (never coerces) a non-enum `type`.
3. **`migrate-v1.mjs`** + `memory:migrate-v1 --dry-run` CLI verb — decompresses every real chunk,
   runs the export transform over every observation, and reports: record count, a types
   histogram, unparseable chunks, the rejection report (id/title/type/reason), and the
   provenance recovered/fallback histogram.

## Out of scope (deferred to C2b — see tasks.md "Deferred")

- **Import** (`renderProvenance`-based brain record → engram observation) — the other half of the
  round trip C4 asserts.
- **Secret-scrub re-point** from `.memory/chunks/` (C1b's target) to `.memory/records/`.
- **The real (persisting) `memory:migrate-v1` run** — writing `records/<yyyy-mm>.jsonl`, moving
  old chunks to `.memory/legacy/`, the idempotency abort-if-`records/`-already-has-content guard,
  and the reindex.
- **The full post-C2 `share`/`pull` pipeline wiring** (`export → transform → append → reindex →
  scrub`) and its dual-write transitional chunk policy — pinned in [design.md](design.md) as a
  decision for C2b to implement, not implemented here.

This split follows the ≤400-counted-line budget: C2a alone (parser/renderer + export + dry-run
migration + histograms + CLI + i18n) already counts **395** lines (excluding `*.test.mjs` and
`openspec/changes/**`), leaving no room for C2b's import/scrub-repoint/real-run/pipeline work in
the same change.

## Acceptance criteria

- [x] `provenance.mjs` exports `parseProvenance`/`renderProvenance` sharing ONE set of marker
  constants; the mandatory property test passes against §4-canonical fixtures.
- [x] `engram-export.mjs`'s `exportObservation()` implements the fallback convention, R2 title
  fold, UTC `ts` conversion, `scope:personal` filtering, and non-enum `type` rejection; its output
  passes `validateRecord`.
- [x] `memory:migrate-v1 --dry-run` runs against the real `.memory/chunks/` (via a temp copy) and
  reports record count / types histogram / rejections / provenance histogram.
- [x] `npm test`, `brain:repo:check`, `brain:nav` stay green.
- [x] Every new CLI string has an en + es i18n entry (`brain/scripts/i18n/{en,es}.mjs`).
- [x] Counted diff (excluding tests, excluding `openspec/changes/**`) stays ≤400 lines.
- [x] No writes to `brain/core/methodology/**`, `brain/project/decisions/**`, or
  `brain/core/anti-patterns/**` (read-only per the assignment's constraint).
- [x] `.memory/chunks/` is never mutated by this slice's code or its manual verification (verified
  against a `/tmp` copy only).

## Risks

- **`scope:personal` filtering is untested against a real fixture** — the current real store has
  0 personal-scope observations (all 278 are `scope: project`), so the filter is unit-tested with
  a synthetic fixture only; the real-store dry-run cannot exercise it.
- **`supersedes` is treated as an opaque string**, not resolved against another record's
  content-hash `id` — the §4 prose only carries descriptive text ("observación anterior..."), not
  a portable id. Resolving prose-described supersession into a real cross-record `id` chain is out
  of scope for C2 entirely (noted for C4 in the C0 checkpoint's open questions).
- **4 real chunks have `observations: null`** (not `[]`) — `collectChunkObservations()` correctly
  flags these as unparseable rather than silently treating them as zero-observation chunks; this
  is new evidence not previously documented in the C0/C1 checkpoint reports.
