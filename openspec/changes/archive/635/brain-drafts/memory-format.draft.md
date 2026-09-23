# Amendment draft — `memory-format.md`, the dedup-at-reindex point

**For**: `npm run brain:promote -- openspec/changes/issue-635-doctrine-catches-up-to-code/brain-drafts/memory-format.draft.md`

> Drafted by agent, applied by the maintainer. `brain/core/**` is Tier 3 —
> prohibited **even if explicitly asked** — and `brain:promote` is the sanctioned
> path: it renders this draft, shows the plan, requires the typed word, then
> **stages and stops**. Running the printed `git commit` is the human signature.

## Why

`memory-format.md` is the **normative schema doc**, and lines 155-156 currently
assert something a test on `main` disproves:

> *"Those lines are **byte-identical** and share an `id`, so `index.jsonl`
> (keyed by `id`) collapses them **losslessly**."*

`id` excludes `source` from the hash, and `renderFuente` widens `source` on
round-trip. Re-executed for this draft with in-tree production code only:

```
original      : {"issue":405,"source":"PR #405"}
round-tripped : {"issue":405,"source":"issue #405 / PR #405"}
same id?       true   bytes differ? true
```

So the normative doc contradicts `store.duplicates.test.mjs::roundtrip-divergence`,
which passes on `main`. A schema doc that a test disproves is worse than one that
is merely vague: it reads as verified.

This amendment is the companion of the ADR-0017 draft in the same folder. They
should be promoted together — the ADR carries the decision, this carries the
schema statement, and leaving either behind restores the contradiction.

The anchor below was verified to occur **exactly once** in the target.

```brain-amendment/1
target: brain/core/methodology/memory-format.md
issue: 635
```

## Act 1 — the dedup point stops asserting byte-identity

```amend-find
3. **Dedup at reindex.** Union's one failure mode is a duplicated physical line when both
   branches wrote the same record. Those lines are byte-identical and share an `id`, so
   `index.jsonl` (keyed by `id`) collapses them losslessly. The JSONL stays **strictly
   append-only** — never rewritten — which preserves union safety and a clean
   `git log .memory/records/`. The index, not the log, is the dedup authority.
```

```amend-replace
3. **Dedup at reindex.** Union's one failure mode is a duplicated physical line when both
   branches wrote the same record. Repeated lines share an `id`, so `index.jsonl` (keyed by
   `id`) collapses them — **first-wins**, the earliest line of the earliest month file, which is
   what the read path already resolved to — and the collapse is **REPORTED**, never silent
   (#574/#598).

   They are **not necessarily byte-identical**. `id` hashes the record's meaning and excludes
   `source` as incidental provenance, so brain's own export→import→export returns the same `id`
   with widened bytes. Such a pair is **divergent**: counted on its own channel and resolved
   first-wins, never refused — refusing it would refuse records brain itself writes. See
   `store.duplicates.test.mjs::roundtrip-divergence`.

   Refusal is reserved for a line whose bytes do not hash to its own `id` (tampered or stale);
   that gate is unchanged and fail-closed. The JSONL stays **strictly append-only** — never
   rewritten — which preserves union safety and a clean `git log .memory/records/`. The index,
   not the log, is the dedup authority.
```
