# Amendment draft — `memory-backend-contract.md`, the `memory:save` provenance row (issue #738)

**For**: `npm run brain:promote -- openspec/changes/archive/738/brain-drafts/memory-backend-contract.draft.md`

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
`actor` per #738 (a handle, never a branch)
```

```amend-replace
`actor` from `git config brain.actor` (#738, delivered — a configured handle, never a branch; refused when unset)
```

### Notes for the promoter

The anchor is scoped to just the Provenance-from cell's `actor` phrase inside the
`memory:save` producer-table row (`memory-backend-contract.md:82`), not the whole row —
verified to occur exactly once. It is deliberately narrower than the full row because
issue #874's Amendment 1
(`openspec/changes/archive/874/brain-drafts/memory-backend-contract.save.draft.md`)
also anchors on that same row (one of its four acts anchors the WHOLE row, to rewrite
its Hydration cell). Promoting either draft first changes text the other's anchor was
built against, so **promote #874's Amendment 1 first, then this 738 draft** — the
ratified order. This draft's own narrow anchor does not touch the Hydration cell, so it
still matches exactly once against the row as #874's Amendment 1 leaves it.
