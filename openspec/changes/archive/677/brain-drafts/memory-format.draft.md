# Amendment draft — `memory-format.md`, the layout and the merge policy (issue #677)

**For**: `npm run brain:promote -- openspec/changes/issue-677-records-are-files/brain-drafts/memory-format.draft.md`

> Drafted by agent, applied by the maintainer. `brain/core/**` is Tier 3 —
> prohibited **even if explicitly asked** — and `brain:promote` is the sanctioned
> path: it renders this draft, shows the plan, requires the typed word, then
> **stages and stops**. Running the printed `git commit` is the human signature.

## Why

`memory-format.md` is the **normative** layout doc. It says a record lives in
`records/<yyyy-mm>.jsonl` and that `merge=union` is what keeps concurrent appends
conflict-free. Since #677 neither is true of the shipped code: a record lives in
`records/<yyyy-mm>-<id>.jsonl`, and the union driver is a local convenience the
forge that performs the merge does not apply.

This is the companion of the ADR-0017 Amendment 2 draft in the same folder. They
should be promoted together — the ADR carries the decision, this carries the
normative statement — and leaving either behind leaves the two disagreeing about
where a record lives.

Every anchor below was verified to occur **exactly once** in the target.

## Act 1 — the layout tree shows one file per record

```amend-find
    2026-07.jsonl        # append-only, plaintext, one record per line
    2026-06.jsonl
```

```amend-replace
    2026-07-rec-0004371da1717b3d.jsonl   # one record, one file, one line
    2026-07-rec-00599b20655216d6.jsonl
    2026-06-rec-02301d83082c52e8.jsonl
```

## Act 2 — the source-of-truth bullet names the real file

```amend-find
- **`records/<yyyy-mm>.jsonl`** — the **source of truth**. Append-only: a record is never
  edited or deleted in place; corrections are new records with `supersedes`. One complete JSON
  record per line (JSONL) — the per-line integrity is what makes union merge safe (below). A
  record MUST occupy **exactly one physical line**: because `content` is Markdown and may contain
  newlines, those newlines MUST be escaped (`\n`). This is a hard requirement — `merge=union` is
  line-based, so a record spanning multiple physical lines could be split by a union merge; the
  validator rejects any multi-line record.
```

```amend-replace
- **`records/<yyyy-mm>-<id>.jsonl`** — the **source of truth**. **One record per file** since
  #677: the content-addressed `id` IS the filename, with the month kept as a prefix so the log
  still sorts and greps by month. Append-only: a record is never edited or deleted in place;
  corrections are new records with `supersedes`. A record MUST occupy **exactly one physical
  line**: because `content` is Markdown and may contain newlines, those newlines MUST be escaped
  (`\n`). This is a hard requirement — it is what keeps a record recoverable line-by-line, and
  what keeps the union driver safe on the one case it still resolves; the validator rejects any
  multi-line record.

  **Readers accept both layouts, and always have.** Every reader globs `*.jsonl` under
  `records/` and parses line by line, so a store still holding `<yyyy-mm>.jsonl` month files, a
  store split into per-record files, and any mixture of the two read identically. `.memory/**`
  is consumer-owned, so brain never rewrites it on upgrade: a repository moves to the new layout
  by running `memory:split-records`, and one that does not keeps working exactly as before —
  it just keeps the merge conflict the split removes.
```

## Act 3 — the schema sentence points at the record file

```amend-find
Each line of a `records/<yyyy-mm>.jsonl` file is exactly one JSON object:
```

```amend-replace
Each line of a `records/<yyyy-mm>-<id>.jsonl` file — one line, since #677 — is exactly one JSON
object:
```

## Act 4 — the merge policy states the mechanism that actually runs

```amend-find
Two branches (or two actors) appending to the same `records/<yyyy-mm>.jsonl` collide on the
file's trailing region — a textual conflict on every merge. This is the reincarnation of the
ADR-0002 manifest problem. It is resolved structurally:
```

```amend-replace
Two branches (or two actors) capturing memory in parallel used to collide on the trailing region
of the same `records/<yyyy-mm>.jsonl` — a textual conflict on every merge after the first, and
the reincarnation of the ADR-0002 manifest problem. It is resolved structurally, and since #677
by the LAYOUT rather than by a merge driver:
```

```amend-find
1. **Union merge.** `records/*.jsonl` uses git's built-in `merge=union` (declared via
   `.gitattributes` in slice C1). Because each line is one complete record, union concatenates
   both sides' appended lines with no conflict markers and never produces a half-record.
```

```amend-replace
1. **One record per file** (#677). A record is written to `records/<yyyy-mm>-<id>.jsonl`, so two
   branches capturing different records write two different paths and git merges them with no
   driver, no attribute and no configuration. There is nothing to union.

   `records/*.jsonl` still carries git's built-in `merge=union` in `.gitattributes`, **demoted
   to a convenience**: a `.gitattributes` merge driver is a LOCAL mechanism, and the merge that
   lands work in this repository is performed by the forge's merge button, which does not apply
   it. The old policy was therefore conflict-free everywhere except where it was needed. What
   the attribute still earns is the one residual case below — a same-`id` pair whose bytes
   diverge — which it turns into a two-line file the reindex deduplicates and reports instead of
   a conflict. It must not be cited as making the log conflict-free.

   **The residual conflict, named:** two branches writing the same `id` with divergent bytes are
   the same filename with different content, and that conflicts where the driver is absent. It
   is confined to one file holding one record, and both sides of it are the same record by
   construction — `id` hashes the meaning. The month layout put every record in the file at the
   mercy of the same resolution.
```

## Act 5 — the rejected alternatives record the one that was adopted

```amend-find
**Rejected alternatives.** *Per-actor sharding* (`records/<yyyy-mm>-<actor>.jsonl`) avoids
distinct-actor conflicts but fragments the layout, complicates reindex/query with a merge-sort,
still conflicts on same-actor-two-branches, and leaks actor identities into filenames (a
public-repo concern). *Manual conflict resolution* reintroduces the ADR-0002 pain on a
machine-generated log and does not scale to parallel agents. See
ADR-0017 for the full
comparison.
```

```amend-replace
**Rejected alternatives.** *Per-actor sharding* (`records/<yyyy-mm>-<actor>.jsonl`) avoids
distinct-actor conflicts but fragments the layout, complicates reindex/query with a merge-sort,
still conflicts on same-actor-two-branches, and leaks actor identities into filenames (a
public-repo concern). *Manual conflict resolution* reintroduces the ADR-0002 pain on a
machine-generated log and does not scale to parallel agents.

**Adopted instead (#677):** *one file per record* — the shape sharding was reaching for, keyed
by the content hash rather than by the actor. It answers every objection above: the filename is
a hash, so no identity leaks; no merge-sort is needed, because the ids ARE the filenames and the
index is already stable-ordered by `id`; and same-actor-two-branches does not conflict, because
two different records are two different files. See ADR-0017 Amendment 2 for the full comparison
and the measurements.
```

## Act 6 — the index's `file` field points at the record file

```amend-find
`supersedes`, and the `records/<yyyy-mm>.jsonl` file it lives in). It is:
```

```amend-replace
`supersedes`, and the `records/<yyyy-mm>-<id>.jsonl` file it lives in). It is:
```

## Act 7 — the anti-custom-driver passage stops leaning on the built-in one

Found by applying this draft to a copy and reading the RESULT. The passage's
conclusion — no custom driver for `index.jsonl` — stands; the example it closes
on does not, because the forge applies neither kind.

```amend-find
  eliminates); `records/*.jsonl` keeps the built-in `merge=union`, which needs no per-clone
  registration.
```

```amend-replace
  eliminates). `records/*.jsonl` still declares the built-in `merge=union` and it needs no
  per-clone registration — but since #677 that is not why the records log is safe: a merge
  driver, built-in or custom, is applied by the git that performs the merge, and the forge's
  merge button applies neither. The answer for `index.jsonl` is regeneration; the answer for
  `records/` is the layout.
```

```brain-amendment/1
target: brain/core/methodology/memory-format.md
issue: 677
```
