# ADR-0017 — The Durable Memory Record Format Is Owned By Brain, Not By Engram

**Status**: Accepted · **amended 15/08/2026** (Amendment 1 — see below)
**Date**: 2026-07-04 (amended 2026-07-07, C1b/issue #214: `index.json` → `index.jsonl` rename +
union-exclusion rationale correction)

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
- **`.memory/index.jsonl`** — a committed, **derived, regenerable** lookup surface over the
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
   same record. Repeated lines are **deduplicated and REPORTED**, never silently collapsed:
   `index.jsonl` is keyed by `id`, the first occurrence wins — the earliest line of the earliest
   month file, which is what the read path already resolved to — and the accounting travels out
   to every caller that reads the store (#574/#598).

   Repeated lines are **not necessarily byte-identical**, and this doctrine must not assume it:
   `id` hashes the record's meaning and excludes `source` as incidental provenance, so brain's
   own export→import→export returns the same `id` with widened bytes. A pair that agrees on `id`
   and disagrees on bytes is **divergent**: counted on its own channel, resolved first-wins, and
   never refused — refusing it would refuse records brain itself writes, on a store brain cannot
   migrate. Pinned by `store.duplicates.test.mjs::roundtrip-divergence`.

   Refusal is reserved for the one genuinely corrupt case: a line whose bytes do not hash to its
   own `id` (tampered or stale). That gate is unchanged and stays fail-closed.

   The JSONL stays strictly append-only (never rewritten — preserving union safety and clean
   `git log .memory/`); the index is the dedup authority.

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
memory; hence a mandatory, careful merge driver. Brain's `index.jsonl` is the inversion:
**derived and regenerable** from the plaintext records via a future `memory:reindex`. The
records JSONL is the durable truth; the index is throwaway. Even if the index ever conflicts or
is deleted, it is rebuilt from the records — the failure mode ADR-0002 could not tolerate
becomes a no-op here. Note the union driver is scoped to `records/*.jsonl` **only** and
deliberately **excludes** `index.jsonl`. **Corrected rationale (C1b, issue #214 — the original
"union would splice two JSON objects into invalid JSON" framing (now removed) was stale the
moment the index was fixed as one-entry-per-line JSONL, not a single JSON document):** a reindex REPLACES
and REORDERS the index's lines on every run (stable-sorted by `id`), so a line-based union of
two independently regenerated indexes would concatenate both sides' now-superseded snapshots —
producing duplicate and stale entries, not a clean merge. The index is fully regenerable from
`records/`, so a merge conflict on `index.jsonl` is resolved by **discarding both sides and
running `memory:reindex`**, never by hand- or union-merging it.

### Index churn discipline (the manifest-churn lesson)

`memory:share` / `memory:reindex` **MUST NOT produce whole-file churn in `index.jsonl`** — the
ADR-0002 export-churn that rewrote the entire manifest each `memory:share` and blocked a raw
`git pull`. The index is stable-ordered by `id`; a reindex adds/updates only the entries for
newly appended records and leaves every other entry byte-identical, so `git diff index.jsonl` is
proportional to the *new* records, not to the store size.

**The rule is about the DIFF, not the write** (Amendment 1, #635). `rebuildIndex` regenerates the
whole file from `records/` rather than patching it, and always has — so a literal reading of
"rewrite" was never satisfied by any implementation. What must stay proportional is what
`git diff` shows, and it does, because the regenerated bytes are identical wherever the records
are. **Caveat:** that holds while duplicate groups are *intra-file*. A duplicate spanning two
month files changes the winning entry's `file` field, and a first-wins resolution moves it —
producing exactly the whole-file churn this rule forbids, on a `share` that appended nothing.
That is a property of the corpus, not of the rule.

The index is serialized **one entry per physical line, sorted by `id`, deterministically** — a
normative rule: because `id`s are content hashes, parallel insertions distribute **uniformly**
across the sorted file, so git's ordinary 3-way merge auto-resolves most parallel appends cleanly
and a real conflict is reduced to the occasional adjacent-line insertion (a compact single-line
`JSON.stringify` would instead conflict on every parallel merge). The conflict ergonomics MAY be
a helper or a post-merge hook, but MUST NOT require a **custom merge driver for `index.jsonl`** — a
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

## Amendment 1 — duplicates are not byte-identical, and the churn rule governs the diff (issue #635)

**Signed**: 15/08/2026 — Cristian Rinaldi

### What this does NOT change

Stated first, because an amendment to the format decision invites the wrong
reading. **The record format stays brain-owned. The JSONL stays strictly
append-only. Union stays the merge policy, and the index stays the dedup
authority.** Every Decision point stands. This amendment corrects a premise the
record asserts and a rule the record states at the wrong altitude — it does not
reopen what was decided.

### The premise that was false

The "Dedup at reindex" point asserted that duplicated physical lines *"are
byte-identical"*. They need not be, and brain is the counter-example.

`id` is a content hash over the record's **meaning**. `source` is deliberately
excluded as incidental provenance — and `renderFuente` relies on that exclusion,
prepending `issue #N` to a `source` that does not already cite the issue,
described as free precisely *because* the field is unhashed. So brain's own
export→import→export returns the same `id` with different bytes:

```
original      : {"issue":405,"source":"PR #405"}
round-tripped : {"issue":405,"source":"issue #405 / PR #405"}
same id?       true   bytes differ? true
```

A union merge can land both copies, and #530 shipped `--issue`, so the trigger
is live rather than theoretical.

This was not a harmless imprecision. An earlier draft of #598 **refused** such a
pair on the strength of the premise, which would have bricked `reindex`,
`share`, `pull`, `save`, `setup` and `resolve-index` on a store brain has no
migration for — for one `--issue`-carrying record round-tripped on a second
machine. The rule that shipped instead is the one recorded here.

### The rule, as implemented

- A repeated `id` is **deduplicated and reported** — never silently collapsed.
  The accounting travels out to every caller that reads the store.
- **First-wins**: the earliest line of the earliest month file. Not an arbitrary
  tie-break — it is what the read path already resolved to, so the index and the
  reader agree by construction rather than by coincidence.
- A pair agreeing on `id` and disagreeing on bytes is **divergent**: counted on
  its own channel, resolved first-wins, **never refused**.
- **Refusal is reserved** for a line whose bytes do not hash to its own `id`
  (tampered or stale). That gate is unchanged and fail-closed.

The implementation lives in `brain/scripts/memory/lib/duplicates.mjs`, and
`store.duplicates.test.mjs::roundtrip-divergence` is the executable disproof of
the old premise.

### The churn MUST NOT, restated at the right altitude

The record said `memory:share` / `memory:reindex` *"MUST NOT rewrite the whole
`index.jsonl` on every run"*. `rebuildIndex` has always written the whole file —
it regenerates from `records/` rather than patching — so the letter was dead
from the first implementation and only the spirit was ever alive: the **diff**
stays proportional to the new records.

#598 removed a `toAppend.length > 0` guard on that basis, recording the
reasoning in `engram.mjs` (*"the churn rule is about the DIFF, not the write"*).
The measurement holds — rebuilding over the live corpus reproduces the committed
`index.jsonl` byte-for-byte, so `git diff` stays empty.

Reinterpreting a normative MUST NOT in an implementation comment is the wrong
altitude, in a repository that landed formal amendments to ADR-0006 and ADR-0026
for smaller premise changes. Hence this act: the rule now says what it governs.

### The caveat, written down rather than discovered later

The churn measurement held **only because every duplicate group was
intra-file**. A duplicate spanning two month files changes the winning entry's
`file` field; a first-wins resolution moves it, and the result is exactly the
whole-file churn this rule forbids — on a `share` that appended nothing.

At the time of this amendment #636 has reconciled this corpus to **zero**
duplicate groups, so no cross-file case exists to observe. That is a property of
the corpus and not of the rule, which is precisely why it is recorded here: the
next union merge can reintroduce one, and the reader should meet the caveat in
the ADR rather than in a post-mortem.
