# Amendment draft — `harness-contract.md`, the memory verbs in the vocabulary of records (issue #863)

**For**: `npm run brain:promote -- openspec/changes/issue-863-backend-contract/brain-drafts/harness-contract.draft.md`

> Drafted by agent, applied by the maintainer. `brain/core/**` is Tier 2 and
> `brain:promote` is the sanctioned path: it renders this draft, shows the plan,
> requires the typed word, then stages and stops.

## Why

The verbs table describes memory as "local engram" three times and calls the symlink "an
implementation-agnostic detail". Under `MEMORY_BACKEND=plainfiles` none of those sentences is
true, and the memory 2.0 spec (#864) requires every memory verb to be described in terms of
`.memory/records/` and "the active backend".

```brain-amendment/1
target: brain/core/methodology/harness-contract.md
issue: 863
```

## Act 1 — `session:start`

```amend-find
| `npm run brain:session:start` | `session:start` | — | Session context loader: restores manifest churn, hydrates local engram, resolves active change and ticket memory. Read-only, local-only, no network. |
```

```amend-replace
| `npm run brain:session:start` | `session:start` | — | Session context loader: hydrates the active memory backend from `.memory/records/`, resolves the active change and ticket memory, reports memory recency. Read-only, local-only, no network. (The manifest-churn restore it performed until #864 task 2.4 was the engram adapter's, not the layer's.) |
```

## Act 2 — the three memory verbs

```amend-find
| `npm run memory:share` | — | — | Exports local engram → `.memory/` (versioned in git). Run before pushing. |
| `npm run memory:pull` | — | — | Imports `.memory/` → local engram. Brings the team's memory. |
| `npm run memory:index` | — | — | Reprojects `brain/` → local engram. Needed when ADRs or glossary change. |
```

```amend-replace
| `npm run memory:share` | — | — | Materializes what `.memory/records/` does not yet hold and rebuilds `index.jsonl`; reports the duplicate accounting. Under record-first (#864 task 3.2) it exports nothing from the backend. |
| `npm run memory:pull` | — | — | `git pull`, then hydrates the active backend from `.memory/records/` (idempotent by record id — `memory-backend-contract.md` rule 1). Brings the team's memory. |
| `npm run memory:index` | — | — | Re-projects `brain/` doctrine into the active backend, where the backend supports it (`plainfiles` does not, by design). Needed when ADRs or glossary change. |
| `npm run memory:save` | — | — | The producer path: writes a record to `.memory/records/` first (provenance, `--issue`, `--supersedes`), then hydrates the active backend from it. `memory-backend-contract.md` rule 2. |
| `npm run memory:audit` | — | — | The five numbers of memory 2.0 (#870) from records and `git log` alone; the backend row degrades to a stated reason. |
```

## Act 3 — the implementation note stops calling a symlink agnostic

```amend-find
`.memory/` is the canonical directory versioned in git for the team's materialized memory.
The binding to engram (current implementation) uses a symlink `/.engram → .memory/`, so that
engram writes to `.engram/` (its internal convention) and files land in `.memory/`.
```

```amend-replace
`.memory/records/` is the canonical, versioned record log — the durable truth (ADR-0017);
whatever `MEMORY_BACKEND` selects is a derived index hydrated from it
(`memory-backend-contract.md`). Anything a backend needs privately in the tree — engram's
`.engram → .memory` symlink, its manifest, its chunk directory — is created by that backend's
`setup`, is gitignored, and is never load-bearing for a reader of the records (rule 3; all
four retire under #864 task 2.4).
```

### Notes for the promoter

All three anchors verified to occur exactly once. The `memory:save` and `memory:audit` rows are
additions inside the same table (Act 2), not a new table.
