# Durable Memory Record Format (`.memory/records/`)

> **STATUS: DRAFT** — Authored by an agent under
> `openspec/changes/issue-201-memory-format/brain-drafts/`. A human reviews and promotes it to
> `brain/core/methodology/` (Tier-2 human gate). Relative links below are written for the
> **final** location `brain/core/methodology/`.

> **status:** draft | **last-reviewed:** 2026-07-04 | **owner:** @crinaldi
> **governed by:** [ADR-0017](../../project/decisions/adr-0017-memory-format-owned-by-brain.md)
> (brain owns the durable format) · [ADR-0002](../../project/decisions/adr-0002-memoria-git-based-dos-capas.md)
> (two-layer durable/live memory) · [ADR-0004](../../project/decisions/adr-0004-adapter-memoria-memory-backend.md)
> (memory-backend adapter)

## Purpose

Define the **normative, tool-independent** on-disk format of brain's *durable* memory layer,
so that team knowledge is recoverable with nothing but `git clone` and a text editor — the
literal promise of [ADR-0002](../../project/decisions/adr-0002-memoria-git-based-dos-capas.md).
This format is owned by brain and is **independent of engram's gzip chunk transport**. The
format library, its validator, and the engram↔record migration are out of scope here (slices
C1–C4); this document is the contract they implement.

## Layout

```
.memory/
  records/
    2026-07.jsonl        # append-only, plaintext, one record per line
    2026-06.jsonl
  index.json             # derived, regenerable, committed — a query accelerator, never authoritative
```

- **`records/<yyyy-mm>.jsonl`** — the **source of truth**. Append-only: a record is never
  edited or deleted in place; corrections are new records with `supersedes`. One complete JSON
  record per line (JSONL) — the per-line integrity is what makes union merge safe (below). A
  record MUST occupy **exactly one physical line**: because `content` is Markdown and may contain
  newlines, those newlines MUST be escaped (`\n`). This is a hard requirement — `merge=union` is
  line-based, so a record spanning multiple physical lines could be split by a union merge; the
  validator rejects any multi-line record.
- **`index.json`** — **derived** from the records and regenerable via a future `memory:reindex`.
  It is committed for zero-tool querying and as the materialized dedup surface, but it is never
  the truth. If it is lost, deleted, or conflicts, it is rebuilt from `records/`.

## The record schema (normative)

Each line of a `records/<yyyy-mm>.jsonl` file is exactly one JSON object:

| Field | Type | Req | Meaning |
|-------|------|-----|---------|
| `id` | string | ✅ | `"rec-" + sha256(canonicalJson(hashInput))[:16]` — a **content hash**. See "Identity". |
| `ts` | string | ✅ | ISO-8601 UTC, `YYYY-MM-DDTHH:MM:SSZ`. Must carry the `Z` (UTC) — no naive local timestamps. |
| `actor` | string | ✅ | Stable handle of the author (`@crinaldi`, `claude-sonnet-4-6`). **A handle, never PII.** |
| `actorKind` | string | ✅ | `"human"` \| `"agent"`. |
| `type` | string | ✅ | One of `decision` \| `architecture` \| `pattern` \| `bugfix` \| `config` \| `discovery` \| `session_summary`. |
| `project` | string | ✅ | Owning project (`brain`). |
| `issue` | number | ⬜ | Issue/MR number the record originates from. |
| `supersedes` | string | ⬜ | `id` of a record this one replaces (see [consolidation-protocol](consolidation-protocol.md) §4). |
| `content` | string | ✅ | The memory body, Markdown. |
| `source` | string | ⬜ | Free-form provenance (`"issue #201 / PR #204"`). |

Provenance fields (`actor`, `actorKind`, `issue`, `supersedes`, `source`) are the structured
form of the [consolidation-protocol](consolidation-protocol.md) §4 Actor / Source / Supersede
convention — the same meaning, promoted from prose inside `content` to first-class fields.

## Identity — the content hash

`id = "rec-" + sha256(canonicalJson(hashInput))[:16]`, where `hashInput` is the record's
**semantic** fields in a canonical JSON encoding:

```
hashInput = { type, actor, actorKind, ts, project, issue?, supersedes?, content }
```

- **Canonical form is pinned to RFC 8785 (JSON Canonicalization Scheme, JCS).** Stable key
  ordering is only one axis; whitespace, number encoding, string escaping, and Unicode/UTF-8
  encoding all change the hashed bytes. `canonicalJson` MUST be **RFC 8785 JCS**: keys sorted by
  UTF-16 code-unit order, no insignificant whitespace, minimal number encoding, JCS string
  escaping, UTF-8 serialization. This is normative — canonicalization is not left to the
  implementation's choice.
- **Deterministic across machines — and its `ts` dependency.** The same semantic record
  materialized on two branches / two machines produces the **same** `id`, which is what lets a
  re-imported duplicate collapse (below). Because `id` includes `ts`, this holds only if `ts` is
  itself deterministic. Engram's timestamps are timezone-less, so the migration MUST apply **one
  canonical rule: engram's timezone-less timestamps are treated as UTC.** Under that rule, `ts`
  taken from the source observation's `created_at` is stable across machines that materialize the
  same source, so the hash is stable too. (Records **authored fresh** on two branches take
  different wall-clock `ts` and correctly get different `id`s — they are distinct memories, not a
  duplicate.)
- **Random ids are forbidden.** A UUID would make a record that both branches wrote an
  *invisible* duplicate after a union merge. The content hash makes it a *detectable,
  collapsible* one.
- **Uniqueness = semantic identity.** Two records with an identical `hashInput` are, by
  definition, the same record and share an `id`. `index.json` is keyed by `id`.
- `source` is **excluded** from the hash: it is incidental provenance and must not split one
  logical record into two ids when two writers cite it slightly differently.
- **Absent optionals are omitted, never `null`.** Optional fields (`issue`, `supersedes`,
  `source`) that are absent MUST be omitted from the record **and** from `hashInput`, NEVER
  serialized as `null`. RFC 8785 canonicalizes `{}` and `{"issue":null}` to **different** bytes →
  a different `id` → a silent dedup break, so the validator MUST reject a record carrying a
  `null` optional field.

## Concurrent-append merge policy

Two branches (or two actors) appending to the same `records/<yyyy-mm>.jsonl` collide on the
file's trailing region — a textual conflict on every merge. This is the reincarnation of the
ADR-0002 manifest problem. It is resolved structurally:

1. **Union merge.** `records/*.jsonl` uses git's built-in `merge=union` (declared via
   `.gitattributes` in slice C1). Because each line is one complete record, union concatenates
   both sides' appended lines with no conflict markers and never produces a half-record.
2. **Content-hash `id`** (above) makes the same record identical across branches.
3. **Dedup at reindex.** Union's one failure mode is a duplicated physical line when both
   branches wrote the same record. Those lines are byte-identical and share an `id`, so
   `index.json` (keyed by `id`) collapses them losslessly. The JSONL stays **strictly
   append-only** — never rewritten — which preserves union safety and a clean
   `git log .memory/records/`. The index, not the log, is the dedup authority.

> A rare duplicate physical line survives in the JSONL until the next reindex. This is
> deliberate: queries read through the index (deduped), and rewriting the log to remove a
> duplicate would break append-only and union safety. `wc -l` over-counting is the accepted
> price.

**Rejected alternatives.** *Per-actor sharding* (`records/<yyyy-mm>-<actor>.jsonl`) avoids
distinct-actor conflicts but fragments the layout, complicates reindex/query with a merge-sort,
still conflicts on same-actor-two-branches, and leaks actor identities into filenames (a
public-repo concern). *Manual conflict resolution* reintroduces the ADR-0002 pain on a
machine-generated log and does not scale to parallel agents. See
[ADR-0017](../../project/decisions/adr-0017-memory-format-owned-by-brain.md) for the full
comparison.

## `index.json` — derived, regenerable, low-churn

`index.json` maps each `id` to its lookup metadata (`ts`, `actor`, `type`, `project`, `issue`,
`supersedes`, and the `records/<yyyy-mm>.jsonl` file it lives in). It is:

- **Derived** — the inverse of ADR-0002's *authoritative* manifest. The records are the truth;
  the index is rebuilt from them by `memory:reindex`. Losing or conflicting on the index is a
  no-op — regenerate it.
- **Serialized one entry per physical line, sorted by `id`, deterministically.** This is
  normative. Because `id`s are content hashes, parallel insertions distribute **uniformly**
  across the sorted file, so git's ordinary 3-way merge auto-resolves most parallel appends
  cleanly and a true conflict is reduced to the occasional adjacent-line insertion — not the
  common case. A compact single-line `JSON.stringify` would instead conflict on every parallel
  merge, making the discard+reindex fallback routine rather than rare. The conflict ergonomics
  MAY be a helper or a post-merge hook, but MUST NOT require a **custom merge driver for
  `index.json`** (a per-clone `.git/config` registration — the engram-driver friction this format
  eliminates); `records/*.jsonl` keeps the built-in `merge=union`, which needs no per-clone
  registration.
- **Excluded from the union driver.** The `merge=union` policy is scoped to `records/*.jsonl`
  ONLY; the `.gitattributes` glob deliberately EXCLUDES `index.json`. Union is a line
  concatenator — applied to a single JSON object it would splice two objects into invalid JSON.
  A git merge conflict on `index.json` is therefore resolved by **discarding both sides and
  running `memory:reindex`** — it is NEVER hand-merged and NEVER union-merged.
- **Low-churn** — `memory:reindex` / `memory:share` **MUST NOT rewrite the whole index every
  run**. Entries are stable-ordered by `id`; a reindex adds/updates only entries for newly
  appended records and leaves every other entry byte-identical, so `git diff index.json` is
  proportional to the new records, not to the store size. This is the direct lesson of the
  ADR-0002 manifest churn that rewrote the full file each `memory:share` and blocked a raw
  `git pull`.

## Public-repo exposure — stance

`.memory/records/*.jsonl` is committed plaintext, deliberately readable — that *is* the
durability guarantee. Therefore:

- Actor is a **stable handle**, never an email, legal name, or other PII. `actorKind` is the
  coarse `human|agent` only.
- **Only `scope: project` durable knowledge becomes a record.** Engram `scope: personal`
  memories are never promoted — they have no brain home and no place in a shared repo.
- Records hold **development knowledge** (decisions, patterns, discoveries), never secrets,
  tokens, or clinical/patient data. Records are public-by-construction; keeping secrets out is
  the writer's burden. A pre-commit secret-scrubbing hook is a follow-up (slice C1); this
  document fixes the stance that makes it required.
- **Enforcement is partial, not full.** The stance is convention-backed plus a *partial*
  email-shaped `actor` heuristic — the validator can flag `someone@example.com`, but a bare legal
  name as `actor` passes. The enforcing gate is the **C1 secret-scrubbing hook**, not the schema
  validator; full PII/secret enforceability is not claimed for the validator.

## What engram export cannot supply (and what the record drops)

Migrating an engram chunk (see the real shape in
[ADR-0017](../../project/decisions/adr-0017-memory-format-owned-by-brain.md)) into a brain
record is lossy in both directions. This enumeration is the migration contract for slice C4.

**Brain fields engram export cannot supply structurally** — they exist only as
[consolidation-protocol](consolidation-protocol.md) §4 prose inside `content`, or not at all:

1. `actor` — no engram field; only the `**Actor:**` prose line. (`session_id` /
   chunk-level `created_by` are not the record author.)
2. `actorKind` — only the `(humano)/(agente)` text; not a field.
3. `issue` — no field; only the `**Fuente:** issue #N` prose.
4. `supersedes` — no field; only the `**Supersede:**` prose (harness `mem_judge` relations are
   not present in the exported chunk).
5. `source` — same `**Fuente:**` prose.
6. `id` (content hash) — engram's `id` is a **local autoincrement integer** (non-portable across
   machines); `sync_id` is a hash of engram's own shape, not brain's `hashInput`.
7. `ts` (ISO-8601 UTC) — engram timestamps are `"YYYY-MM-DD HH:MM:SS"` (space, no `T`, **no
   `Z`/offset**); the timezone is lost, so a claimed-UTC `ts` is a conversion guess.

**Engram fields with no brain equivalent** — dropped on import:

8. `title` — the record has no title slot. The C4 migration **folds** a non-empty `title` into
   `content` as a bold prefix (`content = "**" + title + "**\n\n" + content`; an empty `title`
   leaves `content` unchanged) — deterministic, so the folded bytes feed the `id` hash
   identically across machines.
9. `scope: personal` — no brain home; must **not** be imported (public-repo stance).
10. `session_id`, chunk-level `sessions[]` / `prompts` — session/prompt grouping is not modeled.
11. `sync_id`, `revision_count`, `duplicate_count`, `last_seen_at`, `updated_at` — engram
    bookkeeping, no equivalent.
12. `type: manual` (and any non-enum type, e.g. the observed `"manual"` "temp search" record) —
    no brain type; must be mapped or rejected by the C4 migration, never silently coerced.
13. `topic_key` — engram's internal upsert/evolution key (e.g. `sdd/x/proposal`) for deduping and
    versioning observations inside engram. No record equivalent: the C4 migration **drops it**
    (it may optionally inform the `supersedes` chain), never coerces it into a record field.

## Relationship to the live layer

Per [ADR-0002](../../project/decisions/adr-0002-memoria-git-based-dos-capas.md) /
[ADR-0004](../../project/decisions/adr-0004-adapter-memoria-memory-backend.md), the live backend
(engram) remains a *derived index* for semantic search. This format governs the **durable**
layer only. `memory:share` materializes durable knowledge into `records/`; `memory:import`
projects `records/` into the active backend. The gzip chunks are engram's private transport and
are no longer the durable truth.
