---
status: designed
issue: 330
epic: 313
artifact_store: openspec
topic_key: sdd/issue-330-memory-index-merge-strategy/design
---

# Design — `.memory/index.jsonl` merge strategy (issue 330)

## D1 — `merge=union`, and why the records' rationale does not transfer unchanged

The records rule is justified by append-only semantics: each line is one complete record, both
sides append at the tail, union concatenates, worst case is a duplicated physical line
(`memory-format.md:103-118`).

**`index.jsonl` does not have those semantics.** `serializeIndex()` sorts by `id` and returns the
entire file (`format.mjs:207-211`); `rebuildIndex()` writes it in one `writeFileSync`
(`store.mjs:91`). Two branches therefore present git with two full rewrites whose insertions land
at arbitrary sort positions. Union still never splits a line — each physical line is one complete
JSON object — but the merged file may come out **unsorted**, and duplication is likelier than in
the append-only case.

Union is nonetheless the correct choice, on three verified properties rather than by analogy:

1. **No reader depends on the file.** Every `indexPath` occurrence in `brain/scripts/**` is a write
   through `rebuildIndex` (`cli.mjs:88,126`, `engram.mjs:297`, `plainfiles.mjs:99,172,192,205`).
   Dedup reads `records/`, not the index, and says so explicitly (`store.mjs:97-99`). An unsorted
   or duplicated index breaks nothing.
2. **Line integrity survives.** Union's only structural hazard is a half-line; that requires a
   record spanning multiple physical lines, which the format forbids and the validator rejects
   (`memory-format.md:30-35`).
3. **Repair is one deterministic command.** `rebuildIndex()` is documented idempotent — delete and
   re-run reproduces it byte-for-byte (`store.mjs:46-48`).

The declaration mirrors the records rule and reuses its comment shape, including the note that
`union` is a git built-in requiring no per-clone registration — the distinction from
`merge=engram-manifest`, which `brain:env:init` must install and which would silently not apply
in a fresh clone.

## D2 — the test carries a negative control and a repo tripwire

`records-merge.integration.test.mjs` writes its own fixture `.gitattributes` (line 42) rather than
relying on the repo's, precisely so it proves the mechanism independently of the shipped file. The
index test follows that model — and then closes the hole that model leaves open.

Three tests in `brain/scripts/memory/lib/index-merge.integration.test.mjs`:

| # | Test | Fixture `.gitattributes` | Asserts |
|---|------|--------------------------|---------|
| 1 | union merge is clean | declares the index rule | exit 0, no markers, every line parses, both ids present, reindex → canonical (REQ-330-1 S1, REQ-330-2 S4) |
| 2 | negative control | declares **no** index rule | merge exits non-zero, conflict markers present (REQ-330-1 S2) |
| 3 | repo tripwire | — reads the real `.gitattributes` | the shipped file declares a strategy for `/.memory/index.jsonl` (REQ-330-1 S3) |

Test 2 is what makes test 1 mean anything: without it, test 1 could pass because the two branches
happened not to overlap. Test 3 is what makes both mean anything **in production** — it is the
same class of gap M10 (#335) exists to close, applied to this change's own mechanism.

Test 2 uses `spawnSync` directly and asserts on a non-zero status rather than going through the
throwing `git()` helper, since here a failing merge is the expected outcome.

## D3 — doc placement

The index's strategy belongs in `memory-format.md`'s existing **"Concurrent-append merge policy"**
section, next to the records' rule, not in a new section — the reader who hits an index conflict
looks exactly there. The text must state the full-rewrite distinction explicitly; describing the
index as "same as records" would be the naive framing this design rejects in D1, and would mislead
the next reader into expecting append-only behaviour.

`memory-format.md` lives in `brain/core/**` → **English, non-negotiable** (ADR-0009) and is a
**Tier 2 write**: the agent drafts, the human promotes. Handling is stated in tasks.md.

## Contract / API impact

No public contract or API mutation. No production code path changes. `.gitattributes` alters git's
merge behaviour for one derived, unread, regenerable file. No generation step is required.

One authority note: `.gitattributes` is repo-wide infrastructure affecting every clone's merge
behaviour, the same family as the Tier 2 examples in `agent-authorities.md` even though it is not
named there. It is not being pushed autonomously — the PR is the human gate — and it is flagged
here rather than assumed benign.

## Rejected alternatives

- **A custom merge driver for the index** (e.g. "take either side, reindex later"). Buys nothing
  union does not already give, and inherits the manifest driver's real defect: it requires
  per-clone `git config` registration, so it silently does not apply in a fresh clone until
  `brain:env:init` runs. Strictly worse for a file nothing reads.
- **`-merge` (treat as binary → always conflict).** Turns a resolvable nuisance into a mandatory
  manual step on a machine-generated file. This is the ADR-0002 pain the record format was designed
  to escape.
- **`merge=ours`.** Silently discards the other side's entries. Harmless only because reindex
  regenerates them — i.e. it relies on the same repair union relies on, while additionally being
  asymmetric and surprising. No benefit.
- **Stop committing the index (`.gitignore` it).** The genuinely tempting option, since no code
  reads it. Rejected as out of scope: `memory-format.md:26` commits it deliberately for zero-tool
  querying, so removing it is an ADR-0017-level decision, not a bug fix. Recorded in the proposal.
- **Make `share()` reindex unconditionally in this slice.** The issue's "consider also".
  `plainfiles` already does (`plainfiles.mjs:170-174`); `engram` reindexes only when it appended
  something (`engram.mjs:315-318`) and its `pull()` never reindexes (`engram.mjs:589-619`).
  Changing that contradicts a pinned test in `engram.share.test.mjs`. It is a real asymmetry and it
  gets its own issue with this evidence — not a rider on a one-line `.gitattributes` fix.
