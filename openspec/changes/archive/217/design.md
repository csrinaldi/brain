# Design — Engram ↔ Brain Record Migration (slice C2)

> Realizes [proposal.md](proposal.md) against the C0 contract
> ([spec.md](../issue-201-memory-format/spec.md) REQ-MF-6,
> [memory-format.md](../issue-201-memory-format/brain-drafts/memory-format.md)) and the C1a/C1b
> format library + secret-scrub built on top of it.

## Decision 1 — the parser/renderer PAIR shares ONE grammar, never two "equivalent" impls

`brain/scripts/memory/lib/provenance.mjs` defines `ACTOR_MARKER`, `FUENTE_MARKER`,
`SUPERSEDE_MARKER` as the single source of truth for the consolidation-protocol.md §4 grammar.
Both `parseProvenance()` (prose → structured fields) and `renderProvenance()` (structured fields
→ prose, the inverse) build their regexes/output from these same three constants — never from a
second, independently-typed "equivalent" string literal. This mirrors the precedent
`format.mjs#computeRecordId` already set (ONE hasher, never a parallel one, to prevent silent
drift): a parser and a renderer that each hardcode the marker text independently would drift the
moment either changed, breaking the round trip silently. The mandatory property test
(`parse(render(record))` recovers exact fields) is the drift guard.

**Round-trip scope, honestly stated.** The property test's fixtures always pass a `source` whose
embedded `issue #N` matches the `issue` field — the natural shape, since in real §4 prose both
come from ONE Fuente line (`source` is the whole line's text; `issue` is a structured extraction
FROM it). A record providing `issue` with no `source` at all is a synthetic edge case that does
not round-trip byte-for-byte (rendering synthesizes a `Fuente: issue #{issue}` line, and parsing
that back produces a `source` field the original never had). This is documented, not silently
assumed away: first-class future writers of records SHOULD set `source` whenever `issue` is set.

**MINOR-5 (explicit, post-review pass).** This gap is currently unreachable from the export path
(`exportObservation()` only ever sets `issue` alongside the `source` it was extracted from — see
`engram-export.mjs`), but a later slice, **C4, which will assert round-trip on records, MUST NOT
assert round-trip on an `issue`-without-`source` record** as things stand today. Before C4 can
safely drop that carve-out, `renderProvenance()` needs a distinct `issue`-only representation
(e.g. a dedicated marker or an unambiguous encoding that parses back to `issue` alone, without
fabricating a `source` string) — until that lands, C4's round-trip property test fixtures must
either always pair `issue` with a matching `source`, or explicitly exclude the `issue`-only shape
from its round-trip assertions.

## Decision 2 — the fallback convention: `@legacy`/`human` is a DECLARED convention, not a claim

`engram-export.mjs`'s `exportObservation()` tries `parseProvenance()` first. Verified against the
real store (2026-07): **0 of 278 real observations carry §4 prose** — every migrated record for
the CURRENT store takes the fallback path. The fallback sets `actor: '@legacy'`,
`actorKind: 'human'`, and `source: 'provenance unknown — migrated from engram chunk <sync_id>'`.

This is explicitly a **declared convention** — the store owner stands in as the record's ultimate
author for bookkeeping purposes — **not a factual authorship claim**. The record's `source` field
says so in plain text (`'provenance unknown'`), so a reader is never misled into thinking
`@legacy` did the actual work. `actorKind` stays `'human'` (never a third `'unknown'` enum value)
deliberately: format.mjs's `actorKind` enum is fixed at `human|agent` by REQ-MF-1/the validator,
and this migration must not grow a third value just to express "we don't know" — the `source`
field is where that uncertainty is recorded, not the schema.

## Decision 3 — the rejected-records policy: reject, never coerce, always report

A non-enum `type` (the real store has 1 `manual` and 2 `preference` observations, neither in
`RECORD_TYPES`) is REJECTED, not silently coerced to the nearest enum value or dropped. REQ-MF-6
is explicit about this ("map-or-reject... never silently coercing"). `exportObservation()` returns
`{ rejected: {id, title, type, reason} }` for these, and `buildMigrationReport()` accumulates them
into a mandatory rejection report — every dry-run (and, in C2b, every persisted real run) prints
the full list, so a human can decide per-observation whether to hand-reclassify and re-run, or
leave it out of the durable store permanently. `validateRecord()` is ALSO called as a second,
defensive rejection gate inside `exportObservation()` — a bug in the export transform itself (an
unexpectedly-shaped `ts`, an email-like fallback actor, etc.) surfaces as a REJECTED record with
the validator's own error text as the reason, rather than a record silently written that would
later fail `rebuildIndex`'s id-integrity check.

## Decision 4 — idempotency and the real-run guard (C2b, pinned here now)

The REAL (persisting) `memory:migrate-v1` run is deferred to C2b, but its idempotency contract is
pinned here so C2b does not re-litigate it: the real run MUST abort with a clear message if
`.memory/records/` already has content — migrating twice must never silently duplicate or
re-append records. (Re-running is naturally idempotent at the CONTENT level — `computeRecordId`
means re-exporting the same observation twice yields the same `id`, deduped at reindex per
REQ-MF-3/4 — but the migration is a ONE-SHOT tool, not a repeatable sync, so a clear abort is
preferred over relying on dedup-at-reindex to paper over a double-run.) Old chunks move to
`.memory/legacy/` (never deleted, never rewritten in place) so the pre-C2 store is fully
recoverable if the migration needs to be re-run from scratch after a fix.

## Decision 5 — the full post-C2 `share`/`pull` pipeline (C2b, pinned here now)

Today `memory:share` (`backends/engram.mjs#share`) calls `engram sync --export`, which
materializes engram's own gzip chunks, then C1b's secret-scrub scans those decompressed chunks
(Decision 1 of the C1b design.md explicitly named this a pre-C2 gap). Once C2b lands, the
pipeline becomes:

```
export → transform → append → reindex → scrub
  |          |           |         |        |
  engram   exportObservation   appendRecord  rebuildIndex   scanTextForSecrets
  sync     (this slice,        (store.mjs,   (store.mjs,    (secret-scrub.mjs,
 --export  engram-export.mjs)   C1a)          C1a)           re-pointed at
                                                              records/, C2b)
```

`scanTextForSecrets`'s contract (line-scan, first-hit-wins, allowlist bypass) does NOT change —
only its INPUT changes, from decompressed engram chunks to the plaintext `records/<yyyy-mm>.jsonl`
files C2 produces. This is the forward-compatibility C1b's design.md already banked on
(`scanTextForSecrets` is target-agnostic).

**Dual-write transitional policy.** `memory:pull`'s cross-machine sync still round-trips through
engram's own chunks for the foreseeable term — a bare `git pull` on a machine that has not yet
adopted C2/C3's record-only flow must still be able to `engram sync --import` from chunks. C2b
therefore keeps BOTH written: `records/` (the new durable truth) AND the legacy chunks (the
transitional cross-machine transport), until C3/C4 retire the chunk side of `pull` entirely.
`renderProvenance()` (this slice) is the missing piece C2b's `pull`-side import needs to
re-materialize an engram observation's `content` from a record, closing the round trip C4 asserts.

## Decision 6 — malformed / partial §4 prose: Actor is an all-or-nothing anchor (ruling 3b)

`parseProvenance()` treats the `**Actor:**` line as the block **anchor**, and it is **all-or-
nothing**: `ACTOR_LINE_RE` requires a well-formed `@actor (humano|agente)` pair. A partial or
malformed Actor line — `**Actor:** @x` with no `(kind)`, or `**Actor:** @x (robot)` with an
out-of-enum kind — does NOT anchor a block; the parser returns every field `undefined` and the
content **unchanged**, so the malformed prose is preserved verbatim and the export's `@legacy`
fallback keeps it in the record's `content` (declared, never silently dropped). The optional
`**Fuente:**`/`**Supersede:**` lines are **best-effort and order-anchored**: they are recovered
only when well-formed and in the expected sequence immediately after Actor; a malformed optional
line ends the block and remains in `content` (partial recovery of the anchor, none of the bad
optional).

**Why anchor-strict, not lenient.** A lenient parser that recovered `@x` from a kind-less Actor
line would have to invent an `actorKind` (there is no `unknown` in the enum — Decision 2), i.e.
fabricate a provenance field the source never carried. The whole point of the fallback is that
uncertainty is *declared in `source`*, not guessed into a structured field. So a malformed anchor
correctly falls to `@legacy` with a `provenance unknown` source, rather than half-recovering into
a fabricated shape. This is guarded by negative tests at both levels: `provenance.test.mjs`
(kind-less Actor, unknown-kind Actor, valid-Actor + malformed-Fuente) and `engram-export.test.mjs`
(malformed leading prose → `@legacy` fallback, prose preserved verbatim into content).

## What C2a explicitly does NOT touch

**Re-split note (CP-C2 budget, human ruling):** after the adversarial-review fixes, the original
C2a (pair + export + `migrate-v1 --dry-run`) counted **476/400**. Per plan §10 (split, never
`size:exception`), it was re-split: **C2a (this slice, #217) = the `provenance` pair + `engram-
export` lib only** (reviewed against §4 fixtures — a *contract* verdict), and **C2-migrate (a new
approved issue) = `migrate-v1` + the CLI op + the real-data dry-run report** (reviewed against the
278 real observations — an *application* verdict). C2b (import + scrub re-point + real run + dual-
write) is unchanged and follows C2-migrate.

So this slice touches NO CLI (`cli.mjs`), NO i18n, NO `package.json` script, and NO migration
code at all. It also does not edit `secret-scrub.mjs`'s scrub target (still chunks, per C1b, until
C2b re-points it), and makes no `memory:share`/`memory:pull` wiring change, no real (persisting)
migration run, and no import direction. `provenance.mjs` and `engram-export.mjs` are pure libs
(no filesystem, no engram, no child process); `.memory/chunks/` is never read or written by this
slice's code.
