---
status: tasked
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

> **Revised 2026-09-05.** PR #867 landed the first version and, by referencing #864, closed
> the epic it was the contract for. A gap review against the merged tree found five
> contradictions with existing surfaces and eight non-executable scenarios (design.md §7).
> This revision closes them; the tracker must be reopened before any slice merges (tasks 0.0).

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
   gets its own: path-restricted, auto-merged where the tier allows, still a PR. Against
   `consolidation-protocol.md §5` as written. The ruling also has to answer how a records-only
   PR passes `issue-link`/`actor-check`/`brain:audit`, who holds the credential that pushes
   it (ADR-0033), and what happens to `index.jsonl` when two hosts open lanes at once
   (design.md §2 D1 table).
2. **The backend contract** (#863). A memory backend hydrates from records idempotently by
   record id, is never the first home of a capture, and owns no artifact the durable layer
   needs. Engram's adapter is measured against it. The ruling contradicts ADR-0002 ("the
   manifest stays committed; the merge driver is mandatory") and ADR-0004 ("the manifest
   remains required for all backends"), so it lands as an amendment to each, and it decides
   what happens to the `mem_save` door agents write through today.
3. **Provenance is a handle, not a branch.** Of the 94 records captured since 2026-08-29, 66
   are `@legacy` and the other 28 carry the git branch name as `actor` — none carries a
   handle. "Not `@legacy`" is not the bar; memory-format.md's "stable handle of the author"
   is (#738).

## Scope

- Includes: the requirements (spec.md), the sequence and delivery strategy (design.md), one
  task per slice with its ticket (tasks.md), and the final verification of the epic against
  spec.md using the same measurements that opened it — run by one command, `memory:audit`,
  that this epic adds first.
- Includes, as slices: #820, #862, #863, #805, #738, #247, #361, #461, #712, #714, #638;
  the closure of #795 with its acceptance 1 and 3 answered; the amendment already made to
  #313; and five slices without a ticket yet, filed by the rulings that own them:
  `memory:audit` (0.2), artifact retirement (2.4), the `mrAutoMerge` port verb (2.5), the
  four lane slices (3.1a-d) and record-first capture with the door ruling (3.2).
- Does not include: any implementation in this change. No slice lands here.

## Non-goals

- A memory gate on feature pull requests. #795 is the record of what such a gate becomes.
- Replacing engram. The contract makes it replaceable; nothing here replaces it.
- Backfilling provenance on the ~2100 `@legacy` records. #368, where the first version sent
  it, is closed `not_planned`; a backfill needs a new ticket with its own argument.
- A `topic` field in the record format. `supersedes` is the writer's declared claim; it is
  never inferred from a topic key (design.md §6).
- Auto-merge at a tier whose `requiredReviews` is 1. The lane does not carve an exception out
  of ADR-0026; at `standard`/`regulated` it waits for the approval and reports the wait.
