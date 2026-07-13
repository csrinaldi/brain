# Draft — zone-map addition for `docs/inbox/**` (consolidation-protocol.md §3)

> **DRAFT — human-promote into `brain/core/methodology/consolidation-protocol.md` §3.**
> This file lives in `openspec/changes/issue-196-ci-context-impl/brain-drafts/`
> (Tier-2 draft zone). No agent may write it directly into `brain/core/**`
> (ADR-0015 L6 / agent-authorities.md). A human reviews and promotes it following
> the ADR-0013 draft → review → promotion flow.

## Context

`docs/inbox/**` is already in active use in this repo as a landing zone for
human/agent drafts (e.g. `docs/inbox/PLAN-adapters-v3.md`), but the consolidation
protocol's zone map (§3) does not currently list it, leaving its write authority and
enforcement undocumented.

## Proposed row

Add to the zone-map table in `brain/core/methodology/consolidation-protocol.md` §3:

| Zone | Who writes | Allowed operations | Enforcement |
|------|---------------|----------------------|-------------|
| `docs/inbox/**` | Agent or human | create, update | None — draft/inbox zone, not a flight zone; content is promoted out (to `docs/`, `openspec/changes/**`, or `brain/` via the normal Tier-2 human-gate flow) rather than consumed in place |

## Rationale

- `docs/inbox/**` is neither `brain/**` (human-only) nor `openspec/changes/**` (the
  SDD flight zone) — it is a lower-ceremony scratch area for material that has not
  yet been triaged into either.
- No new enforcement mechanism is proposed; it follows the same "None" enforcement
  as `openspec/changes/**` and `openspec/changes/*/brain-drafts/**` — freeform until
  promoted.
- This is a documentation-only addition (no code, no gate change) and does not
  interact with ADR-0014's 400-line budget or `governance.ignoreList`.
