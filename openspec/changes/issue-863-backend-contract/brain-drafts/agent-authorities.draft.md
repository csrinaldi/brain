# Amendment draft — `agent-authorities.md`, Tier 1 names the durable layer, not the adapter (issue #863)

**For**: `npm run brain:promote -- openspec/changes/issue-863-backend-contract/brain-drafts/agent-authorities.draft.md`

> Drafted by agent, applied by the maintainer via `brain:promote` (Tier 2 doctrine).

## Why

Tier 1 grants an agent authority over `.engram/**` — a gitignored symlink that exists only
under one backend, and the very write path `memory-backend-contract.md` rule 2 declares
non-durable. The authority an agent needs is over the durable layer's producer path.

```brain-amendment/1
target: brain/core/methodology/agent-authorities.md
issue: 863
```

## Act 1 — the live-memory line

```amend-find
- Create/modify files in `.engram/**` (live memory)
```

```amend-replace
- Capture memory as records: `npm run memory:save` (a record under `.memory/records/` first, then the active backend is hydrated from it — `memory-backend-contract.md` rule 2). The backend's own MCP write (`mem_save`) is working memory for the change in flight, non-durable by definition: nothing exports it.
```

### Notes for the promoter

One anchor, verified to occur exactly once. `AGENTS.md` regenerates from this document (it is
one of the SOURCE_DOCS), so the same sentence reaches every agent that reads it.
