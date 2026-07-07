# ADR-0017 — The Durable Memory Record Format Is Owned By Brain, Not By Engram

> **STATUS: DRAFT** — Authored by an agent under `openspec/changes/issue-201-memory-format/brain-drafts/`.
> A human reviews and promotes it to `brain/project/decisions/` per the consolidation
> protocol (Tier-2 human gate). Not an accepted ADR until promoted. Relative links below
> are written for the **final** location `brain/project/decisions/`.

**Status**: Proposed (draft)
**Date**: 2026-07-04

## Context

[ADR-0002](adr-0002-memoria-git-based-dos-capas.md) established the two-layer memory model:
a **durable** layer versioned in git (`.memory/`) that must be recoverable with nothing but
`git clone` — no engram, no CLI, no network — and a **live** layer (the backend chosen by
`MEMORY_BACKEND`, today engram) for fast semantic search. The durable layer is the source of
truth; the live layer is a derived index.

Today the durable layer *is engram's own on-disk export*: gzipped content-addressed chunks
(`.memory/chunks/*.jsonl.gz`) plus `.memory/manifest.json`. Inspecting a real chunk
(2026-07-04) shows each is a gzip of a single JSON object `{ sessions, observations, prompts }`,
where every observation carries engram-internal fields:

```
id (local autoincrement int), sync_id, session_id, type, title, content,
project, scope, topic_key, revision_count, duplicate_count,
last_seen_at, created_at, updated_at
```

This couples the *durable format* to an *implementation's transport*, and it violates the
spirit of ADR-0002 in three concrete ways:

1. **Gzip is not `git clone`-recoverable knowledge.** A human (or a different tool) cannot
   read `.memory/chunks/02f82977.jsonl.gz` without engram's decompression and schema
   knowledge. "Recoverable with only git" degrades to "recoverable with only git *and a
   working engram*."
2. **The manifest is authoritative and non-regenerable.** ADR-0002's own empirical note
   proves it: a fresh engram pointed at `.memory/` **with** the manifest imports 6 chunks;
   **without** it, zero — even though the chunk files are physically present. So the manifest
   is a hard conflict point that *must* be merge-driven, and losing it silently loses all
   memory. The durable truth depends on an index the tool refuses to rebuild.
3. **Engram's record shape is not brain's knowledge model.** Provenance that brain treats as
   first-class — *who* authored a memory, *human or agent*, *which issue*, *what it
   supersedes* — is not a field in engram's export. It lives only as a prose convention
   inside `content` ([consolidation-protocol](../../core/methodology/consolidation-protocol.md) §4).

## Decision

**Brain owns the durable memory record format. Engram is one transport, not the format.**

The durable layer is redefined as a **brain-owned, plaintext, tool-independent record store**,
independent of engram's gzip chunks:

- **`.memory/records/<yyyy-mm>.jsonl`** — append-only, plaintext, one JSON **record** per line,
  monthly files. This is the source of truth.
- **`.memory/index.json`** — a committed, **derived, regenerable** lookup surface over the
  records (query accelerator + dedup materialization). Never authoritative.

The normative record schema and the full rationale live in the methodology doc
[memory-format.md](../../core/methodology/memory-format.md). The record is:

```jsonc
{
  "id":        "rec-<sha256-16>",     // content hash — see below
  "ts":        "2026-07-04T12:00:00Z",// ISO-8601 UTC, required
  "actor":     "@crinaldi",           // stable handle, not PII
  "actorKind": "human",               // "human" | "agent"
  "type":      "decision",            // decision|architecture|pattern|bugfix|config|discovery|session_summary
  "project":   "brain",
  "issue":     201,                    // optional
  "supersedes":"rec-…",               // optional
  "content":   "…markdown…",
  "source":    "issue #201 / PR #…"   // optional
}
```

Provenance semantics (`actor`, `actorKind`, `issue`, `supersedes`, `source`) are **promoted
from prose to structured fields**, inheriting the meaning of
[consolidation-protocol](../../core/methodology/consolidation-protocol.md) §4 — the same
Actor / Source / Supersede convention, now machine-readable.

### The concurrent-append merge policy (the ADR-0002 manifest problem, solved)

An append-only monthly file written by two branches or two actors in parallel produces a
**textual conflict on the trailing region of the file at every merge** — the exact pain
ADR-0002's manifest merge driver exists to manage. Brain resolves it structurally:

1. **Union merge for `records/*.jsonl`.** The file is line-oriented JSONL (one complete
   record per line), so git's built-in `merge=union` concatenates both sides' appended lines
   with no conflict markers and never splits a record. (The `.gitattributes` entry
   `.memory/records/*.jsonl merge=union` is created in the implementation slice C1 — this ADR
   fixes the *policy*, not the file.)
2. **Content-hash `id`.** `id = "rec-" + sha256(canonicalJson({ type, actor, actorKind, ts,
   project, issue?, supersedes?, content }))[:16]`, where `canonicalJson` is **RFC 8785 (JSON
   Canonicalization Scheme)** — sorted keys, no insignificant whitespace, minimal number
   encoding, specified string escaping, UTF-8 (stable key order alone is not enough). Deterministic:
   the *same* record materialized on two machines gets the *same* id. Because `id` includes `ts`,
   determinism requires a canonical timezone rule: engram's timezone-less timestamps are treated
   as **UTC**, so identical sources yield identical `ts` (hence identical `id`). Random/UUID ids
   are rejected — they would make union's failure mode (the same record re-imported on two
   branches) an **invisible duplicate**.
3. **Dedup at reindex.** Union can physically duplicate a line when both branches wrote the
   same record; because those lines are byte-identical and share an `id`, `index.json` is keyed
   by `id` and collapses them losslessly. The JSONL stays strictly append-only (never
   rewritten — preserving union safety and clean `git log .memory/`); the index is the dedup
   authority.

Two rejected alternatives, honestly: **per-actor sharding**
(`records/<yyyy-mm>-<actor>.jsonl`) avoids conflicts between distinct actors but fragments the
layout into N files per month, complicates reindex/query with a merge-sort, still conflicts on
same-actor-two-branches, and **leaks actor identities into filenames** (a public-repo concern).
**Manual conflict resolution** reintroduces exactly the ADR-0002 pain on a machine-generated
log and does not scale to parallel agents. Union + content-hash + dedup-at-reindex is the only
option that is both conflict-free *and* able to collapse the re-import duplicate it can create.
(Records authored fresh on two branches take different wall-clock `ts`, hash to different `id`s,
and are correctly NOT deduped — they are distinct memories, not one.)

### Why this is strictly better than ADR-0002's manifest

ADR-0002's manifest was **authoritative and non-regenerable** — lose it and you lose the
memory; hence a mandatory, careful merge driver. Brain's `index.json` is the inversion:
**derived and regenerable** from the plaintext records via a future `memory:reindex`. The
records JSONL is the durable truth; the index is throwaway. Even if the index ever conflicts or
is deleted, it is rebuilt from the records — the failure mode ADR-0002 could not tolerate
becomes a no-op here. Note the union driver is scoped to `records/*.jsonl` **only** and
deliberately **excludes** `index.json` (union would splice two JSON objects into invalid JSON);
a merge conflict on `index.json` is resolved by **discarding both sides and running
`memory:reindex`**, never by hand- or union-merging it.

### Index churn discipline (the manifest-churn lesson)

`memory:share` / `memory:reindex` **MUST NOT rewrite the whole `index.json` on every run** — the
ADR-0002 export-churn that rewrote the entire manifest each `memory:share` and blocked a raw
`git pull`. The index is stable-ordered by `id`; a reindex adds/updates only the entries for
newly appended records and leaves every other entry byte-identical, so `git diff index.json` is
proportional to the *new* records, not to the store size.

The index is serialized **one entry per physical line, sorted by `id`, deterministically** — a
normative rule: because `id`s are content hashes, parallel insertions distribute **uniformly**
across the sorted file, so git's ordinary 3-way merge auto-resolves most parallel appends cleanly
and a real conflict is reduced to the occasional adjacent-line insertion (a compact single-line
`JSON.stringify` would instead conflict on every parallel merge). The conflict ergonomics MAY be
a helper or a post-merge hook, but MUST NOT require a **custom merge driver for `index.json`** — a
per-clone `.git/config` registration is exactly the engram-driver friction this format
eliminates; `records/*.jsonl` keeps the built-in `merge=union`, which needs no per-clone
registration.

### Public-repo exposure — an explicit stance

`.memory/records/*.jsonl` is committed **plaintext**, deliberately human-readable — that is the
whole durability guarantee. Consequently:

- Records carry **stable handles** (`@crinaldi`, agent model ids), never emails, legal names,
  or other PII. `actorKind` is the coarse `human|agent` only.
- **Only `scope: project` durable knowledge is promoted** to records. Engram `scope: personal`
  memories are never exported — they have no brain home and no place in a shared/public repo.
- Records hold **development knowledge** (decisions, patterns, discoveries) — never secrets,
  tokens, or clinical/patient data. Records are public-by-construction; the burden is on the
  writer to keep secrets out. A pre-commit secret-scrubbing hook is a follow-up
  implementation concern (slice C1); this ADR fixes the *stance* that makes it necessary.

## Consequences

- **Positive**: durable memory is now recoverable with `git clone` and a text editor alone —
  ADR-0002's promise, finally literal. No engram, no gzip, no manifest required to *read* it.
- **Positive**: provenance (`actor`, `actorKind`, `issue`, `supersedes`) is queryable without
  parsing prose, strengthening [consolidation-protocol](../../core/methodology/consolidation-protocol.md) §4.
- **Positive**: concurrent appends are conflict-free by construction (union + content-hash),
  and the index is regenerable, so the manifest's authoritative-conflict trap is gone.
- **Negative (honest residual)**: union can leave a rare duplicate physical line until the next
  reindex; queries dedup by `id`, but `wc -l` over-counts. Accepted — the alternative
  (rewriting the JSONL) breaks append-only and union safety.
- **Negative (honest residual)**: a brain-owned format means engram export must be *mapped*
  into it, and that mapping is lossy in both directions (see the format doc's
  "What engram export cannot supply" list). The format library, validator, and the
  engram↔record migration are deferred to slices C1–C4.
- **Scope**: this ADR is drafted alongside the **design-only** slice C0 (issue #201). It fixes
  the format and the merge policy; it writes **no code**. The `.gitattributes` merge driver,
  the format library, the validator, and the migration are C1–C4.

## References

- [ADR-0002](adr-0002-memoria-git-based-dos-capas.md) — the two-layer durable/live model and
  the manifest merge-driver + churn lesson this ADR resolves at the format level.
- [ADR-0004](adr-0004-adapter-memoria-memory-backend.md) — the memory-backend adapter: engram
  is one backend; this ADR makes the *durable format* equally backend-independent.
- [ADR-0001](adr-0001-arquitectura-3-capas-harness-reemplazable.md) — replaceable-harness
  principle the brain-owned format serves.
- [ADR-0009](adr-0009-documentation-language-policy.md) — documentation-language policy (English).
- [ADR-0013](adr-0013-auto-adr-onboarding.md) — the draft → human-review → promotion flow this
  draft itself follows.
- [consolidation-protocol.md](../../core/methodology/consolidation-protocol.md) §4 — the
  Actor / Source / Supersede provenance convention the record schema structures.
- [memory-format.md](../../core/methodology/memory-format.md) — the normative record schema,
  layout, merge policy, and the engram-export-loss enumeration.
- `openspec/changes/issue-201-memory-format/` — the C0 slice this ADR records
  (`proposal.md`, `design.md`, `spec.md`).
