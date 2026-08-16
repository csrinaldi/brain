# ADR-0017 Amendment 2 — draft (issue #677)

> **Tier 3 draft. Not yet promoted.** ADR-0017 is signed, so this is an in-place
> amendment, not a new ADR file.
>
> ```
> npm run brain:promote -- openspec/changes/issue-677-records-are-files/brain-drafts/adr-0017-amendment-2.draft.md
> ```
>
> The verb renders the plan, waits for the typed word, performs the acts, writes
> the `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them, and
> stops. **Your commit is the signature** (ADR-0028).
>
> `brain/project/**` is Tier 3 — prohibited for an agent **even if explicitly
> asked** — so this is a draft the verb consumes, not an edit. Promote it
> together with `memory-format.draft.md` in the same folder: the ADR carries the
> decision, that one carries the normative layout statement, and leaving either
> behind leaves the two disagreeing about where a record lives.
>
> **This amendment changes the LAYOUT, not the format.** The record schema, the
> content-addressed `id`, the append-only rule, the dedup-and-report rule and the
> index-as-authority rule all stand exactly as written. What changes is which
> file a record is written to — and therefore what a merge has to survive.

```brain-amendment/1
target: brain/project/decisions/adr-0017-memory-format-owned-by-brain.md
amendment: 2
issue: 677
home-summary: the durable log holds ONE RECORD PER FILE (`records/<yyyy-mm>-<id>.jsonl`) — `merge=union` was a local git mechanism the forge that performs the merge does not apply, so the log was conflict-free only where the driver ran; two different records are now two different paths and there is nothing to union, #677
body: ## Amendment 2 — one record per file, because the merge driver does not exist where the merge happens (issue #677)
body-end: ### Notes for the promoter
```

## Act 1 — the merge policy is the layout, not a driver

The first Decision point made union the mechanism. It named the right problem
and reached for a tool that is not present at the merge site.

```amend-find
1. **Union merge for `records/*.jsonl`.** The file is line-oriented JSONL (one complete
   record per line), so git's built-in `merge=union` concatenates both sides' appended lines
   with no conflict markers and never splits a record. (The `.gitattributes` entry
   `.memory/records/*.jsonl merge=union` is created in the implementation slice C1 — this ADR
   fixes the *policy*, not the file.)
```

```amend-replace
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
```

## Act 2 — the rejected alternatives, with the one that was not considered

The rejection of per-actor sharding was sound on its own terms and its closing
sentence over-claimed: union was conflict-free only where the driver runs.

```amend-find
Union + content-hash + dedup-at-reindex is the only
option that is both conflict-free *and* able to collapse the re-import duplicate it can create.
```

```amend-replace
Union + content-hash + dedup-at-reindex was chosen as the only option both conflict-free *and*
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
```

## Act 3 — the consequences say what is now true

```amend-find
- **Positive**: concurrent appends are conflict-free by construction (union + content-hash),
  and the index is regenerable, so the manifest's authoritative-conflict trap is gone.
```

```amend-replace
- **Positive**: concurrent appends are conflict-free by construction — **and by a construction
  that survives the forge** (Amendment 2, #677): one record per content-addressed file, so a
  merge of two captures is a merge of two distinct added paths and needs no driver. The index is
  regenerable, so the manifest's authoritative-conflict trap is gone.
```

```amend-find
- **Negative (honest residual)**: union can leave a rare duplicate physical line until the next
  reindex; queries dedup by `id`, but `wc -l` over-counts. Accepted — the alternative
  (rewriting the JSONL) breaks append-only and union safety.
```

```amend-replace
- **Negative (honest residual)**: one file per record is one filesystem entry per record —
  2052 of them on this repository at the time of Amendment 2. Measured rather than feared:
  reading the store got faster, `git status` did not move, and the packed size grew ≈15% once.
  A store that has not run `memory:split-records` still carries the month log and still
  conflicts; the migration is opt-in by design, because `.memory/**` is consumer-owned.
- **Negative (honest residual)**: a duplicate physical line can still exist — a half-migrated
  store, or the union driver resolving a divergent same-`id` pair into two lines — and survives
  in the log until the next reindex; queries dedup by `id`, but `wc -l` over-counts. Accepted —
  the alternative (rewriting the JSONL) breaks append-only.
```

## Act 4 — the Decision's own layout bullet names the real file

Found by applying this draft to a copy and reading the RESULT, not by reading
the draft: the Decision section states the layout a second time, twelve lines
above the merge policy, and the first three acts left it saying `<yyyy-mm>.jsonl`.
That is the same one-artefact-corrected-and-not-the-other gap #635 closed.

```amend-find
- **`.memory/records/<yyyy-mm>.jsonl`** — append-only, plaintext, one JSON **record** per line,
  monthly files. This is the source of truth.
```

```amend-replace
- **`.memory/records/<yyyy-mm>-<id>.jsonl`** — append-only, plaintext, **one record per file**
  since Amendment 2 (#677), one JSON record per line, named by the record's own content hash
  with the month as a prefix. This is the source of truth. (Before Amendment 2: one
  `<yyyy-mm>.jsonl` per month. Readers accept both, which is what makes the migration opt-in.)
```

## Act 5 — the anti-custom-driver passage stops leaning on the built-in one

The passage rejects a custom merge driver for `index.jsonl` because per-clone
registration is friction, and closes by pointing at the built-in union driver as
the friction-free alternative. Its conclusion stands; its example does not.

```amend-find
eliminates; `records/*.jsonl` keeps the built-in `merge=union`, which needs no per-clone
registration.
```

```amend-replace
eliminates. (Amendment 2, #677: `records/*.jsonl` still declares the built-in `merge=union`, and
it needs no per-clone registration — but a merge driver, built-in or custom, is applied by the
git that performs the merge, and the forge's merge button applies neither. So this passage's
conclusion holds for a stronger reason than the one it gave: the answer for `index.jsonl` is
`memory:resolve-index`, and the answer for `records/` is the layout, not a driver.)
```

## Amendment 2 — one record per file, because the merge driver does not exist where the merge happens (issue #677)

**Signed**: DD/MM/YYYY — <Name>

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

### Notes for the promoter

Promote `memory-format.draft.md` from the same folder in the same sitting.
`memory-format.md` is the normative layout doc and still says a record lives in
`records/<yyyy-mm>.jsonl`; the two are one correction split across the artefact
that decides and the artefact that specifies.

All four `amend-find` anchors above were verified to occur exactly once in the
target before this draft was written.
