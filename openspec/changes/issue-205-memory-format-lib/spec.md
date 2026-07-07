# Spec — Durable Memory Format Library (slice C1a)

> Implements against [issue-201-memory-format/spec.md](../issue-201-memory-format/spec.md)
> (REQ-MF-1..6, C0-normative). This spec tracks C1a's fulfillment status per requirement; C1b
> closes the remaining gaps (secret-scrub, config keys, repo-wide `.gitattributes`).

| Req | C0 requirement | C1a status |
|-----|-----------------|------------|
| REQ-MF-1 | Record schema and required fields | ✅ `format.mjs#validateRecord` + `#serializeRecord`/`#parseRecordLine` (one-physical-line invariant) |
| REQ-MF-2 | Content-hash `id` identity + determinism | ✅ `format.mjs#computeRecordId` (RFC 8785 JCS subset, R2/R3 pins) |
| REQ-MF-3 | Concurrent-append merge policy | ✅ mechanism proven by `records-merge.integration.test.mjs` (real git merge); ⏳ repo-wide `.gitattributes` ships in C1b |
| REQ-MF-4 | `index.jsonl` derived, regenerable, low-churn | ✅ `store.mjs#rebuildIndex` (R1: one entry/line, sorted, deterministic; property-tested byte-identical rebuild) |
| REQ-MF-5 | Public-repo exposure constraints | ✅ partial (email-actor heuristic in `validateRecord`); ⏳ the enforcing secret-scrub gate ships in C1b |
| REQ-MF-6 | Engram export → record migration | ⏳ out of scope — slice C4 |

## REQ-MF-1 / REQ-MF-2 — implementation notes

- `buildRecord()` performs the R2 title-fold (`content = "**" + title + "**\n\n" + content`)
  strictly **before** `computeRecordId()` is called, so the folded bytes are what gets hashed —
  matching the C0 contract's "deterministic across machines" requirement for the migration case.
- `validateRecord()` rejects a `null` optional field (R3) — the concrete failure mode the C0
  spec calls out (`{}` vs. `{"issue":null}` canonicalize to different bytes).
- `serializeRecord()` relies on `JSON.stringify`'s built-in control-character escaping to
  guarantee the one-physical-line invariant; `parseRecordLine()` is the fail-closed inverse
  (throws on invalid JSON or a schema violation — never a silent skip).

## REQ-MF-4 — implementation notes

- `rebuildIndex()` reads every `records/<yyyy-mm>.jsonl`, fails closed with `<filename>:<line>`
  in the error on any corrupt/invalid line, and writes exactly one entry per unique `id`
  (duplicate physical lines from a union-merge collapse to one entry — REQ-MF-3's dedup-at-
  reindex mechanism).
- Degenerate states (absent or empty `records/`) produce an empty index and exit 0 with no
  warning, and never touch a sibling `.memory/chunks/*.jsonl.gz` (the legacy engram transport).
- The property test (`store.test.mjs`) proves: delete `index.jsonl`, reindex, byte-identical to
  the pre-deletion file — the C0 "index is fully regenerable from records" scenario.

> **C1b rename note**: this file was named `index.json` through C1a; C1b renames it to
> `index.jsonl` (issue #214) — the content was always JSONL (one entry per physical line, R1),
> never a whole-file JSON document, so the `.json` extension invited a `JSON.parse(entireFile)`
> trap. Zero migration cost: no `.memory/index.json` had been committed yet.

## Scenarios covered by tests (this slice)

#### A well-formed record validates (REQ-MF-1)
GIVEN a record with all required fields and a valid enum `type`/`actorKind`/UTC `ts`
WHEN validated — THEN accepted. (`format.test.mjs`)

#### A record occupying more than one physical line is impossible by construction (REQ-MF-1)
GIVEN a record whose `content` contains raw newlines
WHEN serialized — THEN `JSON.stringify` escapes them; the result contains no raw `\n`/`\r`.
(`format.test.mjs`)

#### The same record hashes identically regardless of `source` (REQ-MF-2)
GIVEN two records identical except for `source`
WHEN each computes `id` — THEN both ids are identical. (`format.test.mjs`)

#### Distinct concurrent appends merge without conflict (REQ-MF-3)
GIVEN branch X appends `rec-A` and branch Y appends distinct `rec-B` to the same month file
WHEN merged under `merge=union` — THEN both lines survive, no conflict markers.
(`records-merge.integration.test.mjs` — real `git merge`)

#### The index is fully regenerable from records (REQ-MF-4)
GIVEN `index.jsonl` is deleted
WHEN `memory:reindex` runs — THEN it is rebuilt byte-identical. (`store.test.mjs`)

#### A corrupt physical line fails closed (store degenerate-state contract)
GIVEN a `records/<yyyy-mm>.jsonl` with an invalid JSON line or a schema-violating record
WHEN `rebuildIndex` runs — THEN it throws with `<filename>:<line number>` in the message, never
silently skipping. (`store.test.mjs`)

#### An email-shaped actor is flagged (REQ-MF-5, partial)
GIVEN a record whose `actor` is `"someone@example.com"`
WHEN validated — THEN flagged. Full PII/secret enforcement remains the C1b scrub gate's job.
(`format.test.mjs`)
