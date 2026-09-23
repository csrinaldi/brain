# Amendment draft — `consolidation-protocol.md` §3, the zone map names records (issue #863)

**For**: `npm run brain:promote -- openspec/changes/issue-863-backend-contract/brain-drafts/consolidation-protocol.draft.md`

> Drafted by agent, applied by the maintainer via `brain:promote` (Tier 2 doctrine).
> §5 (memory synchronization, "once the MR is merged") is **not** touched here — it is #862's
> to rewrite when the lane is ruled.

## Why

The zone map's memory row names `.engram/**` and a merge driver: the adapter's symlink and a
mechanism `.gitattributes` no longer needs (one record per file, #677). The zone is the
record log.

```brain-amendment/1
target: brain/core/methodology/consolidation-protocol.md
issue: 863
```

## Act 1 — the zone-map row

```amend-find
| `.engram/**`                         | Agent or human    | create, update         | Merge driver content-addressed                  |
```

```amend-replace
| `.memory/records/**`                 | Agent or human    | create (append-only)   | One content-addressed record per file (ADR-0017 A2); corrections are new records with `supersedes`; never edited, never deleted (`memory-backend-contract.md`) |
```

### Notes for the promoter

One anchor, verified to occur exactly once. The table's column widths in the replacement are
not aligned to the original's padding on purpose — markdown does not need it and the padded
form is what made the anchor fragile.
