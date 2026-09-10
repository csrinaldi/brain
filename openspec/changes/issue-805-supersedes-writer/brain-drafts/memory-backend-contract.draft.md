# Amendment draft — `memory-backend-contract.md`, the record-first correction sequence (issue #805)

**For**: `npm run brain:promote -- openspec/changes/issue-805-supersedes-writer/brain-drafts/memory-backend-contract.draft.md`

> Drafted by agent, applied by the maintainer. `brain/core/**` is Tier 2 and
> `brain:promote` is the sanctioned path: it renders this draft, shows the plan,
> requires the typed word, then stages and stops.

## Why

The Deletion section already rules that a wrong record is corrected by a new record carrying
`supersedes` — but it does not spell out the sequence an operator follows once `--supersedes`
exists (#805). This amendment appends the four-step, record-first correction sequence right after
the ruling it follows from; it does not change the ruling.

```brain-amendment/1
target: brain/core/methodology/memory-backend-contract.md
issue: 805
```

## Act 1 — the correction sequence, appended after the deletion ruling

```amend-find
**Records are never deleted.** A wrong record is corrected by a new record carrying
`supersedes` (#805) — the only correction the durable layer admits.
```

```amend-replace
**Records are never deleted.** A wrong record is corrected by a new record carrying
`supersedes` (#805) — the only correction the durable layer admits.

The correction is record-first, in this order: (1) `memory:save --supersedes <id>` writes the
correcting record; (2) the lane ships it — `memory:share` or the record-first save path
materializes it into the active backend; (3) the stale record is left untouched in
`.memory/records/` — nothing is edited or removed; (4) `memory:reindex` regenerates
`.memory/index.jsonl` from records alone, so the correction is visible to every reader that
walks the index.
```

### Notes for the promoter

The anchor is the whole two-line sentence closing the Deletion section
(`memory-backend-contract.md:94-95`), verified to occur exactly once. The replacement keeps those
two lines verbatim and only appends the four-step sequence — containment inside its own
replacement keeps `brain:promote` idempotent (`free = f − r×k = 0` once applied).
