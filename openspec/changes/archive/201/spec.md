# Durable Memory Record Format Specification (design-only, slice C0)

## Purpose

Specifies the **normative durable memory record format** owned by brain — the record schema,
the `.memory/records/` + `.memory/index.jsonl` layout, the content-hash identity, and the
concurrent-append **merge policy** (union + content-hash + dedup-at-reindex) chosen in
[design.md](design.md) Decision 2. This is a **design-only** delta (slice C0): it fixes the
contract; the format library, validator, `.gitattributes` merge driver, and the engram↔record
migration are implemented in slices C1–C4.

The spec enforces the **shape and invariants** of the durable format — not the internals of the
library that reads/writes it, which C1 chooses.

## Requirement Index

| Req | Name | Testable |
|-----|------|----------|
| REQ-MF-1 | Record schema and required fields | Unit (`node --test`) — schema validator |
| REQ-MF-2 | Content-hash `id` identity + determinism | Unit (`node --test`) |
| REQ-MF-3 | Concurrent-append merge policy (union + dedup) | Integration (git merge fixture) |
| REQ-MF-4 | `index.jsonl` is derived, regenerable, and low-churn | Unit + git-diff assertion |
| REQ-MF-5 | Public-repo exposure constraints (handle-not-PII, project-scope only) | Unit (validator) |
| REQ-MF-6 | Engram export → record migration losses are enumerated and handled | Unit (`node --test`) — C4 |

> These are **design requirements** for slices C1–C4 to satisfy. C0 produces no code; the
> `[unit-testable]` notes describe the tests the later slices must write.

---

## Requirement REQ-MF-1: Record Schema And Required Fields

A durable record is one JSON object per line of `.memory/records/<yyyy-mm>.jsonl`. It MUST carry
`id`, `ts`, `actor`, `actorKind`, `type`, `project`, `content`; it MAY carry `issue`,
`supersedes`, `source`. `ts` MUST be ISO-8601 UTC (`YYYY-MM-DDTHH:MM:SSZ`, `Z` required).
`actorKind` MUST be `"human"` or `"agent"`. `type` MUST be one of `decision`, `architecture`,
`pattern`, `bugfix`, `config`, `discovery`, `session_summary`. Records are **append-only**: a
record MUST NOT be edited or deleted in place; a correction is a new record with `supersedes`.
Record physical order within a `.jsonl` file is NOT semantically significant — `merge=union`
interleaves appends in any order; chronological order is obtained by sorting on `ts`, never by
file position.

A record MUST be serialized as **exactly ONE physical JSONL line**. Because `content` is Markdown
and may contain newlines, those newlines MUST be escaped (`\n`) so the record never spans
multiple physical lines. This one-physical-line-per-record invariant is load-bearing: `merge=union`
(REQ-MF-3) is line-based, so a record that spanned multiple physical lines could be split by a
union merge. The validator MUST reject a record that occupies more than one physical line.

[**unit-testable**: a schema validator accepts a well-formed record and rejects missing required
fields, a non-enum `type`, a non-UTC `ts`, an invalid `actorKind`, and a record occupying more
than one physical line]

#### Scenario: A well-formed record validates

- GIVEN a JSON object with `id`, `ts` (`2026-07-04T12:00:00Z`), `actor`, `actorKind: "human"`,
  `type: "decision"`, `project`, `content`
- WHEN the record is validated
- THEN it is accepted

#### Scenario: A naive (non-UTC) timestamp is rejected

- GIVEN a record whose `ts` is `"2026-07-04 12:00:00"` (no `T`, no `Z`)
- WHEN the record is validated
- THEN it is rejected for a non-UTC timestamp

#### Scenario: A non-enum type is rejected

- GIVEN a record whose `type` is `"manual"`
- WHEN the record is validated
- THEN it is rejected as an unknown type

#### Scenario: Multi-line content is serialized as a single physical line

- GIVEN a record whose `content` is Markdown containing newlines
- WHEN the record is serialized to `records/<yyyy-mm>.jsonl`
- THEN it occupies exactly one physical line with the newlines escaped as `\n`
- AND a record that occupies more than one physical line is rejected by the validator

---

## Requirement REQ-MF-2: Content-Hash `id` Identity And Determinism

`id` MUST be `"rec-" + sha256(canonicalJson(hashInput))[:16]`, where `hashInput` is the
canonical JSON of `{ type, actor, actorKind, ts, project, issue?, supersedes?, content }`.
`canonicalJson` MUST be **RFC 8785 (JSON Canonicalization Scheme, JCS)**: keys sorted by UTF-16
code-unit order, no insignificant whitespace, minimal number encoding, JCS string escaping, and
UTF-8 serialization. Stable key ordering alone is insufficient — whitespace, number format,
escaping, and encoding all alter the hashed bytes, so the canonical form is normative, not
left to the implementation. `id` MUST be deterministic: identical `hashInput` on any machine or
branch MUST produce the identical `id`. `source` MUST be excluded from the hash. A random/UUID
`id` MUST NOT be used.

Optional fields (`issue`, `supersedes`, `source`) that are absent MUST be **omitted from the
record AND from the `hashInput`**, NEVER serialized as `null`. RFC 8785 canonicalizes `{}` and
`{"issue":null}` to **different** bytes → a different `id` → a silent dedup break, so an absent
optional MUST be omitted rather than nulled. The validator MUST reject a record carrying a
`null` optional field.

Because `id` includes `ts`, determinism depends on `ts` determinism. Engram timestamps are
timezone-less, so the migration (REQ-MF-6) MUST apply **one canonical timezone rule: engram's
timezone-less timestamps are treated as UTC**. This guarantees identical sources yield identical
`ts` — hence identical `id` — across machines; a divergent tz rule would break dedup silently.

[**unit-testable**: hashing the same semantic record twice (and on differing `source`) yields
one id; changing any hashed field yields a different id; two whitespace-/key-order-variant
serializations of the same record yield the same id under RFC 8785]

#### Scenario: The same record hashes identically on two machines

- GIVEN two machines each materialize a record with identical `type`, `actor`, `actorKind`,
  `ts`, `project`, `issue`, and `content`, but citing `source` differently
- WHEN each computes `id`
- THEN both `id`s are identical (the differing `source` does not change the hash)

#### Scenario: A changed semantic field changes the id

- GIVEN two records identical except for `content`
- WHEN each computes `id`
- THEN the two `id`s differ

---

## Requirement REQ-MF-3: Concurrent-Append Merge Policy

`.memory/records/*.jsonl` MUST be resolved by git's `merge=union` driver (declared in
`.gitattributes` in slice C1) so that concurrent appends from two branches concatenate without
conflict markers and never split a record. When both branches append the **same** record, the
union result MAY contain a duplicate physical line; that duplicate MUST be collapsed at reindex
because both lines share one content-hash `id` (REQ-MF-2, REQ-MF-4). The JSONL MUST remain
strictly append-only — the merge MUST NOT rewrite existing lines. Per-actor sharding and
manual-conflict resolution are rejected (see [design.md](design.md) Decision 2).

[**unit-testable / integration**: build a git fixture where two branches append distinct records
to the same month file, merge, and assert a clean union with both records and no conflict
markers; then a case where both append the *same* record and assert the index collapses it to
one entry]

#### Scenario: Distinct concurrent appends merge without conflict

- GIVEN branch X appends record `rec-A` and branch Y appends a distinct record `rec-B` to the
  same `records/2026-07.jsonl`
- WHEN the branches merge under `merge=union`
- THEN the merged file contains both `rec-A` and `rec-B` lines
- AND there are no git conflict markers
- AND no existing line was rewritten

#### Scenario: The same record written on both branches collapses at reindex

- GIVEN branch X and branch Y each append the **same** record (identical `hashInput` → identical
  `id`) to `records/2026-07.jsonl`
- WHEN the branches merge under `merge=union` (yielding two identical physical lines)
- AND `memory:reindex` runs
- THEN `index.jsonl` contains exactly one entry for that `id`
- AND the JSONL is not rewritten (the duplicate physical line remains until an explicit compact)

---

## Requirement REQ-MF-4: `index.jsonl` Is Derived, Regenerable, And Low-Churn

`.memory/index.jsonl` MUST be a **derived** projection of `records/`, regenerable via
`memory:reindex`, keyed by `id`, and MUST NOT be treated as authoritative — the records are the
source of truth. A reindex or `memory:share` MUST NOT rewrite the whole index on every run: it
MUST update/add only entries for newly appended records and leave every other entry
byte-identical (stable-ordered by `id`), so the `git diff` is proportional to the new records.

`index.jsonl` MUST be serialized **one entry per physical line, sorted by `id`, with
deterministic (stable) formatting**. This is normative, not cosmetic: because `id`s are content
hashes, parallel insertions distribute **uniformly** across the sorted file, so git's ordinary
3-way merge auto-resolves **most** parallel appends cleanly — a real conflict is reduced to the
**occasional adjacent-line insertion**, NOT the common case. A compact single-line
`JSON.stringify` would instead conflict on **every** parallel merge, making the discard+reindex
fallback a routine manual step rather than a rare one.

The conflict ergonomics MAY be implemented as a **helper or a post-merge hook**, but MUST NOT
require a **custom merge driver for `index.jsonl`** — a per-clone `.git/config` registration is
exactly the engram-driver friction this design eliminates. (`records/*.jsonl` still uses the
built-in `merge=union`, which needs no per-clone registration.)

The `merge=union` driver (REQ-MF-3) MUST NOT apply to `index.jsonl`: the `.gitattributes` glob
scopes union to `records/*.jsonl` ONLY and deliberately EXCLUDES the index (union is a line
concatenator; splicing two JSON objects yields invalid JSON). A git merge conflict on
`index.jsonl` MUST be resolved by **discarding both sides and running `memory:reindex`** to
regenerate it; the index MUST NEVER be hand-merged or union-merged.

[**unit-testable**: reindex after appending one record touches exactly one index entry; deleting
the index and reindexing reproduces it byte-for-byte from the records]

#### Scenario: A single new record produces a single-entry index diff

- GIVEN an existing `index.jsonl` for a populated store
- WHEN one new record is appended and `memory:reindex` runs
- THEN `git diff index.jsonl` shows exactly one added/updated entry and no reordering of others

#### Scenario: The index is fully regenerable from records

- GIVEN `index.jsonl` is deleted
- WHEN `memory:reindex` runs over `records/`
- THEN `index.jsonl` is rebuilt and is equivalent to the pre-deletion index

#### Scenario: Hash-distributed appends 3-way merge the index cleanly

- GIVEN branch X and branch Y each append a record whose content-hash `id` sorts to a
  non-adjacent position in `index.jsonl`
- WHEN the branches merge
- THEN git's ordinary 3-way merge auto-resolves `index.jsonl` with no conflict and no reindex
- AND only an adjacent-line insertion collision falls back to discarding both sides + `memory:reindex`

#### Scenario: An `index.jsonl` merge conflict is discarded and regenerated, never merged

- GIVEN `index.jsonl` has a git merge conflict
- WHEN the conflict is resolved
- THEN both sides are discarded and `memory:reindex` regenerates the index from `records/`
- AND the index is never hand-merged and never union-merged

---

## Requirement REQ-MF-5: Public-Repo Exposure Constraints

Because `records/*.jsonl` is committed plaintext in a shared/public repo, `actor` MUST be a
stable handle (not an email, legal name, or other PII), and only `scope: project` durable
knowledge MUST be promoted to records — `scope: personal` memories MUST NOT be written to
`records/`. Records MUST NOT contain secrets, tokens, or clinical/patient data.

This constraint is **convention-backed plus a partial heuristic**, NOT full enforcement: the
validator's only automated PII check is an **email-shaped `actor` regex**, so a bare legal name
as `actor` passes undetected. Full enforceability MUST NOT be claimed for the C1 validator — the
enforcing gate is the **C1 pre-commit secret-scrubbing hook**, not the schema validator. This
requirement fixes the constraint that the hook enforces; the validator only flags the email case.

[**unit-testable**: the validator flags an `actor` matching an email pattern; the migration
(REQ-MF-6) drops `scope: personal` observations]

#### Scenario: A personal-scope observation is not promoted

- GIVEN an engram observation with `scope: "personal"`
- WHEN records are materialized from engram
- THEN no record is written for that observation

#### Scenario: An email-shaped actor is flagged

- GIVEN a record whose `actor` is `"someone@example.com"`
- WHEN the record is validated
- THEN it is flagged as a PII/handle violation

---

## Requirement REQ-MF-6: Engram Export → Record Migration Losses Are Enumerated And Handled

The engram→record migration (slice C4) MUST account for every item in the
[design.md](design.md) "what engram export loses" enumeration: it MUST recover `actor`,
`actorKind`, `issue`, `supersedes`, and `source` from the
[consolidation-protocol](../../../brain/core/methodology/consolidation-protocol.md) §4 prose in
`content` where present, MUST synthesize a content-hash `id` (REQ-MF-2) and a UTC `ts`
(recording the timezone assumption), MUST drop engram bookkeeping fields (`sync_id`,
`revision_count`, `duplicate_count`, `last_seen_at`, `updated_at`, `session_id`), MUST **fold** a
non-empty `title` into `content` as a bold prefix (`content = "**" + title + "**\n\n" + content`;
when `title` is empty, `content` is unchanged), MUST filter `scope: personal` (REQ-MF-5), and
MUST map-or-reject non-enum `type` values (e.g. `"manual"`) rather than silently coercing them.

[**unit-testable**: feed a fixture engram observation with §4 prose provenance; assert the
migrated record's structured `actor`/`issue`/`supersedes`; assert a `type: manual` observation
is rejected (not coerced); assert a `scope: personal` observation is skipped]

#### Scenario: Provenance is recovered from §4 prose

- GIVEN an engram observation whose `content` begins with `**Actor:** @crinaldi (humano)` and
  contains `**Fuente:** issue #201`
- WHEN it is migrated to a record
- THEN `actor` is `"@crinaldi"`, `actorKind` is `"human"`, and `issue` is `201`

#### Scenario: A non-enum engram type is rejected, not coerced

- GIVEN an engram observation with `type: "manual"`
- WHEN it is migrated
- THEN no record is silently written with a coerced type
- AND the observation is surfaced for human reclassification

#### Scenario: A naive engram timestamp becomes a UTC `ts` with a recorded assumption

- GIVEN an engram observation with `created_at: "2026-06-26 22:29:51"` (no timezone)
- WHEN it is migrated
- THEN `ts` is a valid ISO-8601 UTC value
- AND the timezone assumption is recorded (e.g. in `source`)
