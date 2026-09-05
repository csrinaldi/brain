---
status: draft
issue: 864
---

# Proposal: #864 — memory 2.0, the pipeline the format left open

## What

Own team memory as one system — from an agent's capture to another machine's reader —
until five properties hold and are proved by measurement, and until the concept
(`.memory/records/`) is separable from its implementation (engram today, `plainfiles`
already, anything tomorrow).

Nothing here is implemented in this change. This change is the epic's contract: the
requirements every slice is verified against, the design that sequences them, and the task
list that maps each slice to its ticket. Slices ship as their own changes and PRs.

## Why

#313 closed "MEMORY" as a cluster on 2026-08-16. What closed was the **format** (ADR-0017
Amendment 2: one record per file, content-hash id, fail-closed index, secret scrub). The
**pipeline** was measured on 2026-09-03/05 and is open on every axis that matters to the
purpose ADR-0002 states:

| property the purpose needs | records layer | engram adapter |
|---|---|---|
| durable, `git clone`-recoverable | kept | — |
| concurrent writers safe | by construction | **import race fired 3× (#820)**; upsert-loss before `share` |
| timely across machines | **p50 10.9 h, p90 400 h** learn→main (n=337) | hides it on one machine — a leak |
| survives the feature | **dies with an unmerged branch** (#795/#796) | — |
| attributable | last 7 d: **80% `@legacy`, 80% no `issue`, 100% no `supersedes`** | project-wide export mixes authors |

The doctrine is explicit about which layer is the concept — ADR-0017:13, *"the live layer is
a derived index"* — and the code runs the other way: the agent writes into the backend, and
`share` exports later, through the backend's private transport (`.memory/chunks`). Every
concurrency and loss defect above lives in that inverted direction.

## Decisions this epic asks for (owned by child tickets)

1. **The lane** (#862, `needs-decision`). Memory stops riding the feature's pull request and
   gets its own: path-restricted, auto-merged, still a PR. Against `consolidation-protocol.md
   §5` as written.
2. **The backend contract** (#863). A memory backend hydrates from records idempotently by
   record id, is never the first home of a capture, and owns no artifact the durable layer
   needs. Engram's adapter is measured against it.

## Scope

- Includes: the requirements (spec.md), the sequence and delivery strategy (design.md), one
  task per slice with its ticket (tasks.md), and the final verification of the epic against
  spec.md using the same measurements that opened it.
- Includes, as slices: #820, #862, #863, #805, #738, #247, #361, #461, #712, #714, #638;
  the closure of #795; the amendment already made to #313.
- Does not include: any implementation in this change. No slice lands here.

## Non-goals

- A memory gate on feature pull requests. #795 is the record of what such a gate becomes.
- Replacing engram. The contract makes it replaceable; nothing here replaces it.
- Backfilling provenance on the ~2100 `@legacy` records (#738 criterion 5 → #368).
