# Design — Brain-Owned Durable Memory Record Format (design-only, slice C0)

> **Status:** Design-only (slice C0) · Stops at checkpoint **CP-C0** for external review.
> How the [proposal](proposal.md) is realized — the format and its merge policy only. **No code
> lands this slice** (the format library, validator, `.gitattributes`, and migration are
> C1–C4).
> Governed by [ADR-0002](../../../brain/project/decisions/adr-0002-memoria-git-based-dos-capas.md)
> (two-layer durable/live memory + the manifest lesson),
> [ADR-0004](../../../brain/project/decisions/adr-0004-adapter-memoria-memory-backend.md)
> (memory-backend adapter),
> [ADR-0009](../../../brain/project/decisions/adr-0009-documentation-language-policy.md) (docs English).
> ADR draft: [adr-0017-memory-format-owned-by-brain.md](brain-drafts/adr-0017-memory-format-owned-by-brain.md)
> (DRAFT — human-promote later). Normative format: [memory-format.md](brain-drafts/memory-format.md).

## The architectural shape

The durable memory layer stops being *engram's gzip export* and becomes a **brain-owned
plaintext record store**:

```
   engram (live backend, semantic search)        ← derived index, ADR-0004
        ▲   memory:import / memory:share
        │
  .memory/records/<yyyy-mm>.jsonl   ← SOURCE OF TRUTH: append-only, one JSON record per line
        │
        ▼   memory:reindex (derives)
  .memory/index.json                ← derived, regenerable, committed query accelerator
```

The record schema, layout, and identity rules are normative in
[memory-format.md](brain-drafts/memory-format.md); this design justifies the load-bearing
choices and enumerates the CP-C0 evidence.

## Decision 1 — The record schema (target)

One JSON object per JSONL line:

```jsonc
{
  "id":        "rec-<sha256-16>",      // content hash — Decision 3
  "ts":        "2026-07-04T12:00:00Z", // ISO-8601 UTC, required
  "actor":     "@crinaldi",            // stable handle, not PII — Note (a)
  "actorKind": "human",                // "human" | "agent"
  "type":      "decision",             // decision|architecture|pattern|bugfix|config|discovery|session_summary
  "project":   "brain",
  "issue":     201,                     // optional
  "supersedes":"rec-…",                // optional
  "content":   "…markdown…",
  "source":    "issue #201 / PR #…"    // optional
}
```

Provenance (`actor`, `actorKind`, `issue`, `supersedes`, `source`) inherits the meaning of
[consolidation-protocol](../../../brain/core/methodology/consolidation-protocol.md) §4 — the
Actor / Source / Supersede convention, promoted from prose to fields.

## Decision 2 — Concurrent-append merge policy (the CP-C0 crux)

`records/<yyyy-mm>.jsonl` is append-only. Two branches or two actors appending in parallel both
add lines to the **same trailing region** of the same file, so git reports a **textual conflict
on every merge**. This is the ADR-0002 manifest conflict, reincarnated in the record log. Three
policies were evaluated honestly.

### Option A — union merge driver (`.gitattributes` `merge=union`)

Declare `.memory/records/*.jsonl merge=union`. Git's built-in union merge takes lines from
**both** sides and concatenates them, no conflict markers.

- **Pro:** appends are conflict-free with zero human intervention — the ergonomic win of an
  append-only log is preserved.
- **Pro:** the layout stays **one file per month** → reindex/query is a single glob, trivial.
- **Pro:** JSONL line integrity means union (which is line-based) never splits a record — a
  property a pretty-printed JSON array would **not** have.
- **Con:** union is a dumb line concatenation — if **both** branches wrote the **same** record
  (e.g. the same decision consolidated from the same engram observation on two machines), union
  emits **two identical lines** → a duplicate. Union does not dedup.
- **Con:** needs a `.gitattributes` entry (created in C1; here we only design the policy).

### Option B — per-actor sharding (`records/<yyyy-mm>-<actor>.jsonl`)

Each actor appends only to its own shard, so two branches with distinct actors touch distinct
files → no conflict.

- **Pro:** structurally conflict-free for **distinct** actors, no merge driver needed.
- **Con:** **fragments the layout** — N files per month; every reindex/query must glob and
  merge-sort all shards, and "what happened in July" is no longer one file.
- **Con:** **leaks actor identities into filenames** — a direct hit on the public-repo stance
  (Note a). The actor set becomes enumerable from `ls`.
- **Con:** does **not** fully solve the problem — the same actor on two branches (two machines,
  one person; or the same agent id) still collides on its own shard.
- **Con:** complicates the migration and the index build.

### Option C — manual-resolution conflicts + documented procedure

No driver, no sharding: accept a conflict on every concurrent append and document a resolution
runbook.

- **Pro:** no infrastructure; a human dedups by hand, so no accidental duplicate.
- **Con:** the **worst UX** — every parallel merge halts with a conflict on a
  **machine-generated** log. This is precisely the ADR-0002 manifest pain the merge driver was
  built to avoid; here it would be *more* frequent (every append, not just the manifest).
- **Con:** does not scale to parallel agents / slice chains — the workflow this repo is built
  around.

### CHOICE — Option A: union merge + content-hash `id` + dedup-at-reindex

**Union merge driver for `records/*.jsonl`, content-hash `id`, and dedup materialized in
`index.json` at reindex.** Union makes appends conflict-free and keeps the layout to one file
per month (the clean glob for reindex/query). Union's failure mode — a duplicate line when two
branches wrote the **same** record — is neutralized *for the case that actually produces
byte-identical records*: two branches materializing the **same upstream engram observation**
(the re-import case). Because those records share an upstream `ts` (Decision 3 determinism rule),
they hash to the *same* content-hash `id`, so the duplicate is **detectable and collapsible**
rather than invisible, and `index.json` (keyed by `id`) is the dedup authority. Note the scope
honestly: two records **authored fresh** on two branches take different wall-clock `ts` values,
hash to **different** `id`s, and are therefore **correctly NOT deduped** — they are two distinct
memories, not one. The content-hash strategy neutralizes the re-import duplicate; it does not
(and should not) collapse independently-authored records. Sharding trades one clean file for N
fragmented shards *and* leaks actor identity into filenames (bad in a public repo) *and* still
conflicts on same-actor-two-branches. Manual resolution reintroduces the ADR-0002 conflict on a
machine-generated log and does not scale to parallel agents. **Option A is the only choice that
is both conflict-free and able to collapse the re-import duplicate it can create** — and it is
strictly better than ADR-0002's manifest because brain's index is *derived and regenerable*, not
authoritative (Note b), so an index conflict is a throwaway, never a data-loss risk.

## Decision 3 — `id` semantics (pins the dedup)

- **Generation — content hash, not random.**
  `id = "rec-" + sha256(canonicalJson({ type, actor, actorKind, ts, project, issue?,
  supersedes?, content }))[:16]`.
- **Canonicalization — pinned to RFC 8785 (JSON Canonicalization Scheme, JCS).** "Stable-key
  ordering" is only one axis; whitespace, number encoding, string escaping, and Unicode
  normalization all change the hashed bytes. `canonicalJson` MUST be **RFC 8785 JCS**: keys
  sorted by their UTF-16 code-unit sequence, **no** insignificant whitespace, minimal (ECMAScript
  `Number`-style) number encoding, the JCS string-escaping rules, serialized as **UTF-8**. This is
  normative — canonicalization is NOT left to the implementer's imagination in C1.
- **Why not random/UUID.** A UUID makes a record both branches wrote an *invisible* duplicate
  after union; the content hash makes it a *detectable, collapsible* one. Random ids would
  defeat the entire dedup strategy that lets us adopt union in the first place.
- **Determinism across machines — a HARD requirement, and its one dependency: `ts`.** The `id`
  includes `ts`, so `id` is only deterministic if `ts` is. Engram's timestamps are
  timezone-less (evidence item 7), so two machines applying different tz rules would derive
  **different** `ts` → **different** `id` → **silent dedup failure**. To close this, the C4
  migration MUST apply **one canonical tz rule: engram's timezone-less timestamps are treated as
  UTC.** Under that rule, two machines materializing the same source observation derive the
  **same** `ts` and hence the **same** `id`. `source` is **excluded** from the hash so incidental
  provenance differences do not split one logical record.
- **Uniqueness = semantic identity.** Two records with an identical hash input are the same
  record and share an id.
- **Dedup policy.** `index.json` is keyed by `id`; on reindex, duplicate ids collapse to one
  entry (byte-identical records → lossless). The JSONL stays strictly append-only (never
  rewritten — preserving union safety and clean history); a physical duplicate line survives
  until reindex, and that is accepted (queries read the deduped index). A future
  `memory:reindex --compact` **may** optionally drop duplicate physical lines, but it is off by
  default because rewriting the log reintroduces churn and breaks the union guarantee.

## Decision 4 — index is derived, not authoritative (inverts the ADR-0002 manifest)

`index.json` maps `id → { ts, actor, type, project, issue, supersedes, file }`. It is committed
for zero-tool query and as the materialized dedup surface, but it is **derived** and
regenerable from `records/` via `memory:reindex`. This is the deliberate inversion of ADR-0002:
the manifest was *authoritative and non-regenerable* (lose it → lose the memory; hence a
mandatory careful merge driver), whereas brain's index is *throwaway* — even if it conflicts or
is deleted, it rebuilds from the plaintext records, which are the durable truth and are
union-safe by line. The manifest's authoritative-conflict trap simply does not exist here.

Because `source` is excluded from the hash (Decision 3), two records differing **only** in
`source` share one `id` and therefore collapse in the index to a **single `file` pointer** — both
physical JSONL lines survive in the append-only log, but the index carries one entry; `source` is
declared incidental and is not a distinguishing key.

---

## Note (a) — Public-repo exposure stance (REQUIRED)

`.memory/records/*.jsonl` is committed **plaintext**, deliberately human-readable — that is the
entire ADR-0002 durability guarantee (`git clone` + a text editor, no tooling). The explicit
stance for a public repo:

- **Actor is a stable handle, never PII.** `@crinaldi`, `claude-sonnet-4-6` — never an email,
  a legal name, or any other personal identifier. `actorKind` is the coarse `human|agent` only.
  **Enforcement is honest about its limits:** the constraint is *convention-backed* plus a
  *partial* email-shaped heuristic (the validator can flag `someone@example.com`, but a bare
  legal name as `actor` looks like any other handle and **passes**). Full PII/secret enforcement
  is NOT claimed for C1's validator — the enforcing gate is the **C1 secret-scrubbing hook**, not
  the schema validator.
- **Only `scope: project` durable knowledge is promoted** to a record. Engram
  `scope: personal` observations are **never** exported — they have no brain home (they are also
  in the engram-loss list, item 9) and no place in a shared/public repo.
- **Records hold development knowledge only** — decisions, patterns, discoveries — **never**
  secrets, tokens, or clinical/patient data. In the Sinergia context this is consistent:
  clinical PII never leaves the server; records are *developer* knowledge, not clinical data.
- **Records are public-by-construction; keeping secrets out is the writer's burden.** The
  automated pre-commit **secret-scrubbing hook is slice C1** — this slice fixes the *stance*
  (records are readable, so content must be scrubbed *before* it becomes a record), not the
  mechanism.

## Note (b) — `index.json` churn discipline (the manifest lesson, REQUIRED)

ADR-0002's manifest was rewritten **in full on every `memory:share`**, which left the file dirty
and blocked a raw `git pull` — the churn that forced the churn-resilient `memory:pull`
(restore → pull → import). The record-format index must not repeat this:

- **`memory:share` / `memory:reindex` MUST NOT rewrite the whole `index.json` every run.**
- Entries are **stable-ordered by `id`**; a reindex adds/updates **only** entries for newly
  appended records and leaves every other entry **byte-identical**.
- Therefore `git diff index.json` is proportional to the **new** records, not to the store size
  — small, localized diffs that merge cleanly.
- **`index.json` is serialized one entry per physical line, sorted by `id`, with deterministic
  (stable) formatting.** This is normative, not cosmetic: because `id`s are content hashes,
  parallel insertions distribute **uniformly** across the sorted file, so **git's normal 3-way
  merge auto-resolves most parallel appends cleanly** — a real conflict is reduced to the
  **occasional adjacent-line insertion**, NOT the common case. Without this pin, a compact
  `JSON.stringify` conflicts on **every** parallel merge and "discard + reindex" becomes a
  routine manual step instead of a rare fallback.
- **C1 constraint on the conflict ergonomics.** The rare adjacent-line conflict MAY be smoothed
  by a **helper or a post-merge hook**, but it MUST NOT require a **custom merge driver for the
  index** — a per-clone `.git/config` registration is exactly the engram-driver friction this
  design eliminates. (`records/*.jsonl` still uses the built-in `merge=union`, which needs no
  per-clone registration.)
- **Union is scoped to `records/*.jsonl` ONLY and deliberately EXCLUDES `index.jsonl`.** The
  `.gitattributes` glob (`.memory/records/*.jsonl merge=union`) does **not** cover the index:
  the index's lines are replaced and reordered on every reindex, so a line-based union of two
  independently regenerated indexes would concatenate both sides' now-superseded snapshots —
  producing duplicate and stale entries, not a clean merge. The index is fully regenerable from
  `records/`, so a git merge conflict on `index.jsonl` is therefore resolved by **discarding both
  sides and running `memory:reindex`** — it is **never** hand-merged and **never** union-merged.
  The index is derived and regenerable (Decision 4), so a conflict on it is throwaway, not a
  data-loss risk.

## Note (c) — Co-promotion gate for the two drafts (REQUIRED)

The co-promotion commit carries **THREE files, not two**:
`adr-0017-memory-format-owned-by-brain.md`, `memory-format.md`, **and `brain/HOME.md`**. They
**MUST be promoted together, in the same commit**:

- The two drafts each cross-link the other at its **final** `brain/` path (the ADR governs the
  format doc; the format doc links back to the ADR), so a lone promotion of one leaves a dangling
  link and **breaks `brain:nav`** — the exact `#197 → #199` lesson.
- The promotion MR carries the `decision` label (this is a **real new ADR**), so the
  `adrPresence` / decision-gate **REQUIRES a `brain/HOME.md` change** — the ADR-index entry.
- `brain:nav` would flag `memory-format.md` as an **ORPHAN** without an incoming link, so
  `brain/HOME.md` must **also** add the methodology-doc link.

When promoting: move both drafts to their final homes AND add both `HOME.md` entries (the
ADR-index row and the methodology-doc link) in the **same** commit, then **verify all cross-links
resolve post-promotion** (`npm run brain:nav`).

---

## CP-C0 evidence — what engram export loses vs. the target record

Inspected the **real** durable store on 2026-07-04:
`.memory/manifest.json` (top-level `{ version, chunks[] }`, each chunk
`{ id, created_by, created_at, sessions, memories, prompts }`) and a decompressed chunk
(`gunzip` of `.memory/chunks/*.jsonl.gz`) — each chunk is a single JSON object
`{ sessions, observations, prompts }` whose observations carry:

```
id (local autoincrement int), sync_id, session_id, type, title, content,
project, scope, topic_key, revision_count, duplicate_count,
last_seen_at, created_at, updated_at
```

Timestamps are `"2026-06-26 22:29:51"` — space separator, **no `T`, no `Z`/offset**. Observed
`type` values include `session_summary`, `architecture`, and **`manual`** ("temp search" /
"placeholder"), which is outside brain's type enum.

Mapping the real chunk onto the target record is lossy **in both directions**. This list is the
**mandatory CP-C0 verdict evidence** (also carried in
[memory-format.md](brain-drafts/memory-format.md) as the C4 migration contract):

**A. Brain fields engram export CANNOT supply structurally** (only as
[consolidation-protocol](../../../brain/core/methodology/consolidation-protocol.md) §4 prose in
`content`, or not at all):

1. **`actor`** — no engram field. Buried in the `**Actor:**` prose line. (`session_id` =
   `"manual-save-brain"` and chunk-level `created_by` = the exporting machine, not the record
   author.)
2. **`actorKind`** — only the `(humano)/(agente)` text; not a field.
3. **`issue`** — no field; only `**Fuente:** issue #N` prose.
4. **`supersedes`** — no field; only `**Supersede:**` prose. Harness `mem_judge` relations are
   **not** present in the exported chunk.
5. **`source`** — same `**Fuente:**` prose.
6. **`id` (content hash)** — engram's `id` is a **local autoincrement integer**, non-portable
   across machines; `sync_id` is a hash of engram's *own* shape, not brain's `hashInput`.
7. **`ts` (ISO-8601 UTC)** — engram timestamps lack `T` and any timezone marker; the zone is
   **lost**, so a claimed-UTC `ts` is a conversion guess, not a faithful copy.

**B. Engram fields with NO brain equivalent** (dropped on import):

8. **`title`** — the record has no title slot (content only). The C4 migration **folds** a
   non-empty `title` into `content` as a bold prefix
   (`content = "**" + title + "**\n\n" + content`; an empty `title` leaves `content` unchanged) —
   a single deterministic rule, so the folded bytes feed the `id` hash **identically across
   machines** with zero per-migration judgment.
9. **`scope: personal`** — no brain home, and must **not** enter a public repo (Note a). This is
   both a lost field and a filter rule.
10. **`session_id`, chunk `sessions[]`, `prompts`** — session/prompt grouping is not modeled by
    records.
11. **`sync_id`, `revision_count`, `duplicate_count`, `last_seen_at`, `updated_at`** — engram
    bookkeeping; no equivalent (the record keeps a single immutable `ts`).
12. **`type: manual`** (and any non-enum type) — no brain type; the C4 migration must **map or
    reject** it, never silently coerce.
13. **`topic_key`** — engram's internal upsert/evolution key (e.g. `sdd/x/proposal`) used to
    dedupe and version observations *inside* engram. The record has **no equivalent slot**: the
    C4 migration **drops it** (it may optionally inform the `supersedes` chain when the semantics
    line up), but it is **never coerced** into a record field.

**Verdict basis.** Items 1–7 mean a faithful engram→record migration (C4) **cannot** be a pure
field copy — it must parse the §4 prose conventions to recover provenance and must synthesize a
content-hash `id` and a UTC `ts` (accepting the timezone assumption). Items 8–13 mean the
reverse (record→engram) also drops nothing brain needs but must filter `scope: personal`. This
asymmetry is the concrete justification for brain owning the format
([ADR-0017](brain-drafts/adr-0017-memory-format-owned-by-brain.md)) rather than adopting
engram's chunk shape as the durable truth.

## Open questions (for CP-C0 review)

- [ ] **`.gitattributes` ownership.** The `merge=union` entry is created in C1. C0 assumes union
  is available in the consumers' git (it is — a core git merge driver since git 1.6). No
  external dependency, but flagged so C1 does not treat it as novel.
- [x] **`ts` reconstruction on migration — RESOLVED as a hard determinism requirement (was an
  open question; M1 review).** Because `ts` feeds the `id` hash, a free choice of tz rule would
  make dedup fail silently across machines. This is no longer optional: the C4 migration MUST
  treat engram's timezone-less timestamps as **UTC** — the single canonical rule — so identical
  sources yield identical `ts` and hence identical `id` (Decision 3, REQ-MF-2). The assumption is
  recorded in the migrated record's `source`.
- [ ] **`type: manual` disposition.** Recommend the C4 migration **rejects** non-enum types
  (surfacing them for human reclassification) rather than dropping or coercing — but this is a
  migration-policy call deferred to C4.
- [ ] **Does `index.json` need committing at all,** or is gitignore + reindex-on-clone enough?
  C0 commits it (zero-tool query + materialized dedup) and keeps churn small (Note b); revisit
  if index diffs prove noisy in practice.
