---
status: proposed
issue: 330
epic: 313
artifact_store: openspec
topic_key: sdd/issue-330-memory-index-merge-strategy/proposal
---

# Proposal: give `.memory/index.jsonl` a merge strategy (issue 330)

Issue #330. Epic #313. Change folder: `openspec/changes/issue-330-memory-index-merge-strategy/`.

## Intent

`.gitattributes` assigns a merge strategy to every committed file under `.memory/` **except**
`index.jsonl`:

- `/.memory/manifest.json` → `merge=engram-manifest` (custom driver, registered by `brain:env:init`)
- `/.memory/records/*.jsonl` → `merge=union` (git built-in, no per-clone registration)
- `/.memory/index.jsonl` → **nothing** — falls back to default text merge

So the one file with no assigned strategy conflicts on every parallel branch that ran
`memory:share`, which the memory-gate makes near-certain since it effectively requires a memory
write per slice. Observed 2026-07-25 merging `main` into `chore/issue-325-persist-loose-artifacts`:
the manifest driver and the records union both resolved silently, and `index.jsonl` was the only
conflict.

The fix is one `.gitattributes` line. The work in this change is the **evidence** that the line is
correct and stays wired: a real three-way-merge regression test, a negative control proving the
attribute is what resolves the conflict, and a tripwire proving the repo's own `.gitattributes`
actually carries it.

## Grounding — what the code says (verified, not assumed)

Three findings from reading the implementation shift this change away from a naive "same as
records" framing:

1. **`index.jsonl` is not append-only.** `serializeIndex()` (`brain/scripts/memory/lib/format.mjs:207-211`)
   emits the whole file sorted by `id`, and `rebuildIndex()` (`brain/scripts/memory/lib/store.mjs:91`)
   writes it with a single `writeFileSync`. It is a **deterministic full rewrite**, not an append.
   Union's behaviour on it therefore differs from `records/*.jsonl`: entries interleave at arbitrary
   sort positions and the merged file may come out **unsorted**, not merely duplicated.

2. **Nothing reads `index.jsonl`.** Every `indexPath` site in `brain/scripts/**` is a *write* through
   `rebuildIndex` (`cli.mjs:88,126`, `backends/engram.mjs:297`, `backends/plainfiles.mjs:99,172,192,205`).
   `readRecordIds()` explicitly documents `records/` — not the index — as the authoritative dedup
   source (`store.mjs:97-99`). No reader depends on the index's ordering, so a transiently unsorted
   index has no correctness consequence.

3. **Self-healing is already partly in place, and is backend-asymmetric.**
   `plainfiles` reindexes unconditionally in `share()`, `pull()`, `save()` and `setup()`.
   `engram`'s `share()` reindexes **only when at least one new record was appended**
   (`engram.mjs:315-318`), and `engram`'s `pull()` does not reindex at all
   (`engram.mjs:589-619` — `git pull` + `importMemory`, no index step).

Together these make `merge=union` the right strategy and make its worst case harmless: the file is
derived, regenerable, unread, and `memory:reindex` restores the canonical byte-for-byte form.

## Scope

In scope:

- One line in `.gitattributes`: `/.memory/index.jsonl merge=union`, mirroring the records rule and
  its comment, including the note that `union` is a git built-in needing no per-clone registration.
- `brain/scripts/memory/lib/index-merge.integration.test.mjs` — a real temp-git three-way merge over
  `index.jsonl`, modelled on the existing `records-merge.integration.test.mjs`, with a **negative
  control** (same scenario without the attribute → conflicts) and a **repo tripwire** (the shipped
  `.gitattributes` really carries the rule).
- `brain/core/methodology/memory-format.md` — document the index's merge strategy alongside the
  records', and state the union-on-a-rewritten-file consequence (possible unsorted/duplicated
  entries until the next reindex) rather than implying append-only semantics.

Out of scope — recorded, not silently dropped:

- **Changing `share()` to reindex unconditionally.** The issue's "consider also". On `plainfiles` it
  is already true; on `engram` it would change a contract pinned by an existing test
  (`engram.share.test.mjs` asserts no reindex when there is nothing to append). Deferred to a
  follow-up issue with the backend asymmetry (finding 3) as its evidence.
- **Un-committing the index** (gitignore it, since nothing reads it). That contradicts
  `memory-format.md:26`'s deliberate "committed for zero-tool querying" and is an ADR-0017-level
  decision, not a bug fix.

## Why now

Every open parallel branch is exposed until this lands, and this repo currently has 25+ live
worktrees. The epic #313 body promotes #330 to be done next for exactly this reason: it is cheap,
it unblocks nothing, and the exposure is continuous.

## Risk

Low. Test-and-config only; no production code path changes. The one behavioural surface is git's
merge of a derived file that no code reads and that a single documented command regenerates.
