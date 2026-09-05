---
status: draft
issue: 864
---

# Design: #864 — memory 2.0

## 1. The frame every slice is designed inside

**Records are the concept; the backend is a derived index** (ADR-0002; ADR-0017:13). The
test of any design choice in this epic: *does it hold under `MEMORY_BACKEND=plainfiles`?* If
a property holds only because engram's store is machine-global, it is a leak of one
implementation into the concept, not a feature of memory. Same-machine "instant sharing" is
the canonical example: it fails the test, so no slice may rely on it.

Consequences already drawn from the frame:

- Records are the **only** channel. Their learn→main latency is memory's latency.
- The records layer is concurrency-safe by construction (one file per record, content-hash
  id). Every concurrency defect measured — import race, upsert-loss, manifest churn — lives
  in the adapter. No slice fixes an adapter defect by touching the records layer, or the
  reverse.
- Provenance lives **in the record** at capture, never in a backend's session id.

## 2. The two rulings, and their shape

### D1 — the memory lane (#862)

Memory leaves the feature's pull request and gets its own, still a PR:

- trigger: session end or a cadence — never `pre-push` of a feature branch;
- branch `memory/<host>-<yyyy-mm-dd>` (grammar finalised in #862);
- path-restricted to additions under `.memory/records/` + regenerated `index.jsonl`;
- validated by what exists — hash integrity (`rebuildIndex`) and secret scrub — and
  auto-merged on green; size-exempt already (`brain.config.json:21`);
- review is asynchronous: disagreement is a `supersedes` record. **#805 is therefore a
  prerequisite of auto-merge**, not a neighbour.

Rejected: *push straight to `main`* — 62% of the store is claims (`architecture` +
`decision`), ADR-0014 §9 and `pre-commit` (#788) refuse `main`, and the undo does not exist
yet. Rejected: *wait for the feature* — that is the measured p50 10.9 h / p90 400 h, and the
loss of every unmerged branch's memory.

### D2 — the backend contract (#863)

A document beside `vcs-contract.md`, cited by every adapter:

1. hydration from records is idempotent by record id;
2. the backend is never the first home of a capture — the agent's write produces a record
   (the `memory:save` path), and the backend is hydrated from it;
3. the backend owns no artifact the durable layer needs — manifest, chunks, symlink are
   the adapter's private business and leave the tree and the hooks (#247 becomes the
   path, not the tail).

Engram's adapter is measured against it and fails 1 and 2 today. #820's **fix** is
compliance with 1; what ships under #820 now is mitigation (skip-and-say around `import`)
and must say so.

## 3. Dependency graph

```
#820 mitigation ──────────────────────────────────────────┐
                                                          │
#862 lane ruling ──► #805 supersedes ──► lane impl ───────┤
                 └──► #738 provenance ──┐                  ├──► verify #864 against spec.md
#863 contract ─────► #247 chunks ──────┴► record-first ───┤
                 └──► #361 reindex parity                  │
#461 · #712 · #714 · #638 (independent hardening) ────────┘
```

- Wave 0: #820 mitigation.
- Wave 1: #862, #863 (rulings; may run in parallel).
- Wave 2: #805, #738, #247 (prerequisites; may run in parallel once their ruling lands).
- Wave 3: lane implementation (under #862), record-first capture (under #863).
- Wave 4: #361, #461, #712, #714, #638.
- Close #795 in favour of #862 when the lane's first scenario passes.

## 4. Delivery strategy: stacked-to-main

Every slice is its own change (`openspec/changes/issue-<n>-<slug>/`), its own worktree
(`brain:ticket:start <n>`), its own PR **to `main`**. No tracker branch.

Why not `feature-branch-chain`: the slices are independent tickets with standalone value
(#805 is useful the day it lands, whether or not the lane exists), and this repo's own
evidence (#795, #796) is that work held off `main` strands what it carries — including, with
bitter irony, the memory records of the work itself. A tracker branch for a memory epic
would reproduce the defect the epic exists to close.

Each slice PR checks its box in this change's `tasks.md` (one line; conflicts are trivially
resolvable). Verification of the epic is the last task, run against `spec.md`.

## 5. How completion is verified

`brain:change:verify issue-864-memory-2-0` when every slice task is checked. The spec's
scenarios are the measurements that opened the epic; each is re-run and its number written
on #864 beside the number it replaces. The epic closes when every scenario passes under
**both** backends (the agnosticism requirement), not when the last slice merges.

## 6. What this design refuses

- A gate that blocks a feature push on memory grounds.
- Any slice whose correctness depends on engram's store being machine-global.
- Backfilling `@legacy` here (#368).
