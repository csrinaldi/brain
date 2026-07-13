# Design — Secret Scrub + Id-Integrity Hardening (slice C1b)

> Realizes [proposal.md](proposal.md) against the C0 contract
> ([spec.md](../issue-201-memory-format/spec.md),
> [memory-format.md](../issue-201-memory-format/brain-drafts/memory-format.md)) and closes the
> gaps C1a's [design.md](../issue-205-memory-format-lib/design.md) Decision 5 anticipated.

## Decision 1 — the scrub target in the pre-C2 gap: chunks, decompressed, not `records/`

**Problem.** REQ-MF-5's stance ("records are public-by-construction; keeping secrets out is the
writer's burden, enforced by a gate") names `records/*.jsonl` as the enforcement surface. But
`memory:share` (`backends/engram.mjs#share`) does not write `records/` yet — it calls
`engram sync --export`, which materializes engram's own gzip chunks
(`.memory/chunks/*.jsonl.gz`). That re-pointing is C2's job, not this slice's.

**Two options considered:**

- **(a) [chosen] Scrub what `share()` materializes TODAY** — the gzip chunks, decompressed to
  text. C2 re-points the scanner at `records/` later.
- **(b) [rejected] Ship the scanner inert until C2 lands** — wire the config keys and the
  `scanTextForSecrets` primitive now, but scan nothing until `records/` exists as a real write
  path.

**Rationale for (a).** The actual leak risk lives in the chunks *today* — `memory:share` is the
command a developer runs before every push, and it is the chunks that get committed. Shipping
(b) would satisfy the letter of "add a secret scanner" while leaving the one command that
currently writes secret-bearing content to git completely unguarded until an indeterminate
future slice lands. "Close the highest-risk gap" is this deliverable's entire justification —
(b) closes no gap at all. (a) is also forward-compatible: `scanTextForSecrets` is
target-agnostic (it operates on decompressed/plain text, not on the engram chunk shape
specifically), so C2 only needs to swap `_changedChunkFiles`/`_scrubChunk` for a `records/`-aware
pair — the pattern-resolution and line-scan contract does not change.

**Mechanics.** A chunk is content-addressed (filename derives from content), so `git status
--porcelain -- .memory/chunks` after `engram sync --export` runs reports exactly the chunks that
are new or changed THIS run — an untouched chunk's filename never appears as dirty. This gives
"materialized this run, never the whole store" for free, without engram exposing any
before/after diff of its own. Each reported chunk is gunzipped (`node:zlib#gunzipSync`),
`JSON.parse`d, and re-serialized with `JSON.stringify(parsed, null, 2)` so the scanner has a
meaningful line number to report — the raw gzip has no native line concept (ADR-0017's empirical
inspection: one gzip = one JSON object, not JSONL). If the chunk is not parseable JSON, the raw
decompressed bytes are scanned as a defensive fallback rather than silently skipped.

## Decision 2 — no `--no-scrub` flag; the allowlist is the only valve

Recorded ahead of time in C1a's design.md Decision 5, honored here unchanged: a CLI bypass flag
is unauditable (nothing in `git log` records that someone suppressed a real finding on a given
run). `governance.memorySecretAllowPatterns` is the sole valve — committed, reviewable, diffable.
`scanTextForSecrets` treats an allow-pattern match on the *same line* as the hit as suppression;
a match on an unrelated line is still reported (tested: `secret-scrub.test.mjs`).

An over-broad entry (e.g. `.*`, or any pattern that also matches benign lines) SILENTLY disables
the gate for every line it matches — the scanner has no way to distinguish an intentionally
narrow allowlist from an accidentally broad one. There is no runtime backstop for this: the sole
mitigation is human review of the `governance.memorySecretAllowPatterns` diff at commit/PR time.
Allow patterns MUST therefore be kept specific and anchored to the known false positive, not
broad wildcards.

## Decision 3 — id-integrity hardening reuses the ONE shared hasher, never a second one

`rebuildIndex` already fails closed on a malformed physical line (C1a task 2.1). This slice adds
a second, independent failure mode: a **well-formed** record whose `id` does not match its own
content. Recomputing via `format.mjs#computeRecordId(record)` — the exact function `buildRecord`
uses — rather than a parallel/duplicated hash routine is deliberate: a second hasher risks
drifting from the canonicalization rules (RFC 8785 JCS subset) over time, silently reintroducing
the exact dedup-breaking bug REQ-MF-2 exists to prevent. Because a legitimate record already has
`title` folded into `content` and absent optionals omitted (R2/R3) at write time,
`computeRecordId(record)` on read reproduces the stored `id` byte-for-byte — no false positives
(tested explicitly: a record built via `buildRecord` with a title and an optional `issue` field
never mismatches). A mismatch — most plausibly a hand-edited or corrupted line, since the format
is append-only and never rewritten — throws with the same `filename:line` convention as the
corrupt-line path, so the failure is locatable the same way.

## Decision 4 — rename `index.json` → `index.jsonl` now, at zero cost

The index's on-disk shape has been JSONL (one entry per physical line, sorted by `id`, R1) since
C1a shipped `serializeIndex`. The `.json` extension was always a misnomer inviting a
`JSON.parse(entireFile)` trap for any future reader who trusts the extension over the R1 pin.
Renaming costs nothing today because no `.memory/index.json` had been committed in this repo yet
— there is no migration, no `git mv`, no consumer file to move. Renamed in: `store.mjs` (the
actual generated path, in `cli.mjs`), `format.mjs`'s comments, the corresponding tests, the C1a
(issue-205) spec/design refs, and the C0 drafts.

## Decision 5 — `.gitattributes`: built-in `union` driver, no per-clone registration

Appended `/.memory/records/*.jsonl merge=union` — git's BUILT-IN union merge driver. This is a
meaningfully different mechanism from the pre-existing `/.memory/manifest.json
merge=engram-manifest` line immediately above it in the same file: `engram-manifest` is a
**custom** driver that must be registered per clone (`git config merge.engram-manifest.driver
...`, done by `bootstrap.sh` / `engram.mjs#setup()`). `union` requires zero registration — it
ships with git itself. The literal is single-sourced as
`managed-paths.mjs#RECORDS_UNION_MERGE_GITATTRIBUTES_LINE` (mirroring the existing
`MANAGED_SCRIPT_KEYS` single-source-of-truth convention) so a test can drift-guard the real
`.gitattributes` file against it, the same way `governance-ignorelist.test.mjs` already
drift-guards `brain.config.json` against `config-migrations.mjs`'s `0.4.0` default.

## Decision 6 — `0.5.0` migration defaults mirror `secret-scrub.mjs`'s runtime defaults, guarded against drift

`config-migrations.mjs`'s `0.5.0` migration ships the same default pattern list as
`secret-scrub.mjs#DEFAULT_SECRET_PATTERNS` — necessarily duplicated, since `brain/core/` does not
import from `brain/scripts/memory/lib/` (core sits below scripts in the dependency direction; the
reverse import would invert that layering). Rather than accept silent drift between "the patterns
a fresh consumer config ships with" and "the patterns the scanner actually defaults to at
runtime," `installer.test.mjs` asserts the two lists are `deepEqual` — a single failing test
whenever a future edit updates one list and forgets the other.

## Doc-sync note (not a design decision — a correction)

The R1 pin (index = JSONL, not a single JSON document) made the C0 drafts' stated reason for
excluding `index.json`/`index.jsonl` from `merge=union` stale: both
`brain-drafts/memory-format.md` and `brain-drafts/adr-0017-memory-format-owned-by-brain.md` said
the index was excluded because "union would splice two JSON objects into invalid JSON" — true
only if the index were a single JSON document, which R1 already contradicts. Corrected in both
drafts to the actual reason: a reindex **replaces and reorders** the index's lines on every run,
so a line-based union of two independently regenerated indexes would concatenate both sides'
now-superseded snapshots, producing duplicate/stale entries — not a clean merge. The index is
fully regenerable from `records/`, so a conflict is discarded and reindexed, never merged. Filed
as a correction here because the human promotion of these drafts (Tier-2 gate) should promote the
corrected text, not the stale rationale.
