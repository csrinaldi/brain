# Amendment draft — `memory-backend-contract.md`, the `memory:save` provenance row (issue #738)

**For**: `npm run brain:promote -- openspec/changes/issue-738-provenance-at-capture/brain-drafts/memory-backend-contract.draft.md`

> Drafted by agent, applied by the maintainer. `brain/core/**` is Tier 2 and
> `brain:promote` is the sanctioned path: it renders this draft, shows the plan,
> requires the typed word, then stages and stops.

## Why

The producer table's `memory:save` row still describes `actor` as "per #738 (a handle, never a
branch)" — a forward reference written while #738 was in flight. #738 has shipped: `actor` is now
resolved from `git config brain.actor`, a configured handle that is refused when unset. This
amendment updates the row to describe the delivered mechanism instead of the pending one; it does
not change the Provenance-from column's shape.

```brain-amendment/1
target: brain/core/methodology/memory-backend-contract.md
issue: 738
```

## Act 1 — the `memory:save` row, provenance column

```amend-find
| memory CLI — `memory:save` | an agent or human, in session | flags (`--issue`; `--supersedes` with #805), `actor` per #738 (a handle, never a branch) | the invoking checkout's `.memory/records/` | #862 memory lane (until it exists: the slice PR, as today) | next hydration today; `hydrate({recordId})` with #874 |
```

```amend-replace
| memory CLI — `memory:save` | an agent or human, in session | flags (`--issue`; `--supersedes` with #805), `actor` from `git config brain.actor` (#738, delivered — a configured handle, never a branch; refused when unset) | the invoking checkout's `.memory/records/` | #862 memory lane (until it exists: the slice PR, as today) | next hydration today; `hydrate({recordId})` with #874 |
```

### Notes for the promoter

The anchor is the whole `memory:save` producer-table row (`memory-backend-contract.md:82`),
verified to occur exactly once. The replacement changes only the Provenance-from cell; every other
cell is kept verbatim.
