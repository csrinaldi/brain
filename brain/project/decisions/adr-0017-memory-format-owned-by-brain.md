# ADR-0017 — The Durable Memory Record Format Is Owned By Brain, Not By Engram

**Status**: Accepted · **amended 16/08/2026** (Amendments 1-2 — see below)
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

- **`.memory/records/<yyyy-mm>-<id>.jsonl`** — append-only, plaintext, **one record per file**
  since Amendment 2 (#677), one JSON record per line, named by the record's own content hash
  with the month as a prefix. This is the source of truth. (Before Amendment 2: one
  `<yyyy-mm>.jsonl` per month. Readers accept both, which is what makes the migration opt-in.)
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

1. **One record per file** (Amendment 2, #677). A record is written to
   `records/<yyyy-mm>-<id>.jsonl` — the content-addressed `id` IS the filename, with the month
   kept as a prefix so the log still sorts and greps by month. Two branches capturing different
   records write two different paths, and git merges distinct added paths with no driver,
   no attribute and no configuration. There is nothing left to union.

   **Why not the union driver this ADR originally chose.** `merge=union` on a single
   `records/<yyyy-mm>.jsonl` is correct git and it works — locally. A `.gitattributes` merge
   driver is a LOCAL mechanism, and the merge that actually lands work in this repository is the
   forge's merge button, which does not apply it. So the property this ADR asserted held
   everywhere *except* at the one place it was needed: the first memory-capturing PR merged
   clean and every subsequent one conflicted, on the durable append-only log, resolved by hand
   in a web UI. Measured driver-free on the same two records and the same base: one month file
   → CONFLICT; one file per record → clean, both records present.

   That the resolution was manual is the severity, not the friction. A hand-resolution of the
   month log can drop a session record, resurrect lines a reconciliation removed, or splice a
   marker mid-JSONL — and a MISSING record is indistinguishable from one that was never
   captured (`evidence-reader-empty-on-failure`, the class #574 exists for).

   The `.gitattributes` entry stays, demoted to a convenience: where the driver DOES run it
   turns the one residual conflict — a same-`id` pair whose bytes diverge (Amendment 1) — into a
   two-line file the reindex deduplicates and reports. It is no longer the mechanism the format
   depends on, and nothing may cite it as making the log conflict-free.

   **Migration is opt-in, never automatic.** `.memory/**` is consumer-owned, so a brain upgrade
   does not rewrite it. Every reader globs `*.jsonl` under `records/` and parses line by line,
   so a month-file store, a per-record store and a half-migrated store all read identically; a
   repository moves when it runs `memory:split-records`, which refuses any line it cannot read
   and proves every record reads back before deleting a month file.
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
log and does not scale to parallel agents. Union + content-hash + dedup-at-reindex was chosen as the only option both conflict-free *and*
able to collapse the re-import duplicate it can create — **and that claim was too strong**
(Amendment 2, #677): union is conflict-free only where the union driver runs, which is not the
forge that performs the merge.

The option not considered here is **one file per record** (`records/<yyyy-mm>-<id>.jsonl`),
which answers every objection raised against per-actor sharding: the filename is a content
hash, not an actor, so no identity leaks; no merge-sort is needed, because the ids ARE the
filenames and the index is already stable-ordered by `id`; and same-actor-two-branches does not
conflict, because two different records are two different files. It costs one file per record
instead of one per month — measured on this repository's 2052-record store: reading it is
*faster* than the three month files (≈70 ms vs ≈133 ms, the large-file `split('\n')` dominating),
the packed repository grows ≈15% one-off, and the per-append cost is unchanged. It also makes
the dedup rule structural: the same record is the same filename, so the filesystem enforces what
the index used to have to notice.
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
eliminates. (Amendment 2, #677: `records/*.jsonl` still declares the built-in `merge=union`, and
it needs no per-clone registration — but a merge driver, built-in or custom, is applied by the
git that performs the merge, and the forge's merge button applies neither. So this passage's
conclusion holds for a stronger reason than the one it gave: the answer for `index.jsonl` is
`memory:resolve-index`, and the answer for `records/` is the layout, not a driver.)

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
- **Positive**: concurrent appends are conflict-free by construction — **and by a construction
  that survives the forge** (Amendment 2, #677): one record per content-addressed file, so a
  merge of two captures is a merge of two distinct added paths and needs no driver. The index is
  regenerable, so the manifest's authoritative-conflict trap is gone.
- **Negative (honest residual)**: one file per record is one filesystem entry per record —
  2052 of them on this repository at the time of Amendment 2. Measured rather than feared:
  reading the store got faster, `git status` did not move, and the packed size grew ≈15% once.
  A store that has not run `memory:split-records` still carries the month log and still
  conflicts; the migration is opt-in by design, because `.memory/**` is consumer-owned.
- **Negative (honest residual)**: a duplicate physical line can still exist — a half-migrated
  store, or the union driver resolving a divergent same-`id` pair into two lines — and survives
  in the log until the next reindex; queries dedup by `id`, but `wc -l` over-counts. Accepted —
  the alternative (rewriting the JSONL) breaks append-only.
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

## Amendment 2 — one record per file, because the merge driver does not exist where the merge happens (issue #677)

**Signed**: 16/08/2026 — Cristian

### What this does NOT change

Stated first, because an amendment to the format decision invites the wrong
reading. **The record schema is unchanged. The `id` is still the RFC 8785
content hash over the record's meaning. The log is still strictly append-only —
a record is never edited or deleted in place. Duplicates are still deduplicated
and REPORTED, first-wins, never refused; refusal is still reserved for a line
whose bytes do not hash to its own `id`. The index is still derived, regenerable
and the dedup authority.** Amendment 1 stands in full.

What changes is one thing: **which file a record is written to**.

### The premise that did not survive contact with the merge

Decision point 1 made `merge=union` the mechanism that keeps the durable log
conflict-free. It is correct git. It is also a **local** mechanism: a
`.gitattributes` merge driver is applied by the git that performs the merge, and
the merge that lands work in this repository is performed by the forge's merge
button, which does not apply it.

So the guarantee held on every machine and failed at the only place that
matters. Measured across four memory-capturing pull requests merged in sequence
on one day: local `git merge` reported clean, the forge reported `dirty`, and a
pure three-way merge of the one file both sides touched conflicted while the
same merge with `--union` resolved cleanly. Same inputs; the only variable was
the driver.

The cost scales with how well the memory discipline is followed, which is the
wrong direction for a rule to point. The PR template requires memory capture;
`memory:save` appends one line to `records/<yyyy-mm>.jsonl`; every open PR
therefore appends a different line at the same position of the same file. The
first merges clean and **every subsequent one conflicts**.

### Why this was not merely friction

The conflict landed on the durable append-only log and was resolved by hand, in
a web UI, by whoever was merging. That is the one file in this repository where
a hand-resolution can silently drop a session record, resurrect lines a
reconciliation removed (#636 removed 139 of them), or splice conflict markers
into JSONL. `rebuildIndex` catches a *tampered* line by hash. It cannot catch a
**missing** one — a record that was dropped reads exactly like a record that was
never written, which is `evidence-reader-empty-on-failure` and the reason #574
exists.

### The rule, as implemented

- A record is written to `records/<yyyy-mm>-<id>.jsonl` — **one record, one
  file, one line**. `store.mjs#recordFilename` is the single place that states
  the layout, and it refuses to build a path out of an `id` that is not
  `rec-<16 hex>`, because the `id` is now a filename.
- `appendRecord` is **idempotent and says so**: a record whose file already
  exists is not rewritten and the caller is told `written: false`. First-wins,
  the same rule the readers apply — and where the existing file diverges in
  bytes, what is already on disk wins, because it may be what another branch
  merged in.
- **Readers are unchanged.** They glob `*.jsonl` under `records/` and parse line
  by line, so both layouts and any mixture of them read identically. This is
  what makes the migration opt-in rather than a forced rewrite of a store brain
  does not own.
- `memory:split-records` performs the migration: report-only unless `--apply`,
  refuses any corrupt or tampered line before writing anything, and deletes a
  month file only after every record it held has been read back out of the new
  layout. A verification failure leaves BOTH layouts on disk — a duplicated
  store is detectable and reported, a short one is not.

### The residual conflict, named rather than claimed away

Two branches writing the same `id` with **divergent bytes** — Amendment 1's
`source` round-trip — still conflict, because it is the same filename with
different content. Two things make that acceptable where the month-log conflict
was not:

- the conflict is confined to **one file holding one record**, and both sides of
  it are the same record by construction, since `id` hashes the meaning;
- where the union driver *does* run it resolves even that, into a two-line file
  the reindex deduplicates and reports.

The month layout put every record in the file at the mercy of the same
resolution.

### `.memory/manifest.json` — deliberately out of scope

The `merge=engram-manifest` driver has the same hole and worse: it is a
**custom** driver, which cannot exist on the forge at all. It is left in place
deliberately, with the reason stated rather than omitted. `manifest.json` indexes
the legacy engram **chunk** transport (`.memory/chunks/`, gitignored;
`.memory/legacy/` for what was migrated), not the durable records. It is derived
and regenerable — `day-start` already discards its local churn as safe — so a
bad merge of it loses a pointer that `memory:share` rebuilds, not a durable
record that nothing can recover. Retiring it belongs with the chunks
decommission (C4/D1, #247), not here.
