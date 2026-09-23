# ADR-0017 Amendment 1 — draft (issue #635)

> **Tier 2 draft. Not yet promoted.** ADR-0017 is signed, so this is an in-place
> amendment, not a new ADR file.
>
> ```
> npm run brain:promote -- openspec/changes/issue-635-doctrine-catches-up-to-code/brain-drafts/adr-0017-amendment-1.draft.md
> ```
>
> The verb renders the plan, waits for the typed word, performs §1c's three acts,
> writes the `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them,
> and stops. **Your commit is the signature** (ADR-0028).
>
> `brain/project/**` is Tier 3 — prohibited for an agent **even if explicitly
> asked** — so this is a draft the verb consumes, not an edit. Promote it
> together with `memory-format.draft.md` in the same folder: the ADR carries the
> decision, that one carries the normative schema statement, and leaving either
> behind restores the contradiction this amendment exists to close.
>
> **This amendment does NOT change the decision.** The format stays brain-owned,
> the log stays append-only, union stays the merge policy. It records a premise
> that is false and a MUST NOT that was re-scoped in a code comment.

```brain-amendment/1
target: brain/project/decisions/adr-0017-memory-format-owned-by-brain.md
amendment: 1
issue: 635
home-summary: duplicate lines are not necessarily byte-identical — brain's own round-trip widens the unhashed `source`, so a divergent pair is reported and resolved first-wins, never refused; and the churn rule governs the diff, not the write, with the cross-file caveat named, #635
body: ## Amendment 1 — duplicates are not byte-identical, and the churn rule governs the diff (issue #635)
body-end: ### Notes for the promoter
```

## Act 1 — the dedup rule describes what the code does

The premise is false and brain itself disproves it. `computeRecordId` excludes
`source` as incidental provenance, and `renderFuente` prepends `issue #N` to a
`source` that does not already cite the issue — documented as free *because*
`source` is hash-excluded. Re-executed for this draft with in-tree production
code only (`buildRecord` → `importRecord` → `exportObservation`):

```
original      : {"issue":405,"source":"PR #405"}
round-tripped : {"issue":405,"source":"issue #405 / PR #405"}
same id?       true   bytes differ? true
```

Pinned on `main` by `store.duplicates.test.mjs::roundtrip-divergence`.

```amend-find
   same record; because those lines are byte-identical and share an `id`, `index.jsonl` is keyed
   by `id` and collapses them losslessly. The JSONL stays strictly append-only (never
   rewritten — preserving union safety and clean `git log .memory/`); the index is the dedup
   authority.
```

```amend-replace
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
```

## Act 2 — the churn discipline states what it actually governs

`rebuildIndex` has **always** written the whole file, so the literal reading of
"rewrite" was never satisfied by any implementation this ADR has had. What must
stay proportional is the *diff*.

```amend-find
`memory:share` / `memory:reindex` **MUST NOT rewrite the whole `index.jsonl` on every run** — the
ADR-0002 export-churn that rewrote the entire manifest each `memory:share` and blocked a raw
`git pull`. The index is stable-ordered by `id`; a reindex adds/updates only the entries for
newly appended records and leaves every other entry byte-identical, so `git diff index.jsonl` is
proportional to the *new* records, not to the store size.
```

```amend-replace
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
```

## Amendment 1 — duplicates are not byte-identical, and the churn rule governs the diff (issue #635)

**Signed**: DD/MM/YYYY — <Name>

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

### Notes for the promoter

Promote `memory-format.draft.md` from the same folder in the same sitting.
`memory-format.md` is the normative schema doc and currently states the same
false premise; the two are one correction split across the artefact that decides
and the artefact that specifies.

Both `amend-find` anchors above were verified to occur exactly once in the
target before this draft was written.
