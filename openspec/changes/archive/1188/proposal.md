# Proposal: the post-merge audit and the memory-gate evaluate one predicate, and alarms close themselves (#1188)

## Problem
On a fresh consumer, the first real merge (the lane-enable PR) passed the PR-time `memory-gate`
and then failed post-merge as `governance:audit-unrevertible`. The cursor stayed pinned, a human
was asked to run `cursor.mjs accept`, and the alarm issue (#4 in both demo repos) never closed even
after the audit recovered. Evidence: `openspec/changes/issue-1185-*/evidence/brain-test-plainfiles-{20,21,35}`, `brain-test-engram-37`.

Root cause: two predicates for one gate. `lib/merge-walk.mjs` `evaluateMerge` called
`memoryPresence(allObservations)` (repo-wide, tier-blind). The gate (`governance/run-check.mjs`
`runMemoryGateCheck`) runs issue-scoped retrieval (#1024) and, at `lite`, `GATE_MATRIX['memory-gate']`
is `detection`, so a miss is a pass with a `::warning::`. On `lite`, with no record anywhere, the gate
passed and the audit failed.

## Intent
- One predicate. The audit calls the gate's function; the divergent copy is deleted.
- An early merge (a consumer with no memory history) is never `audit-unrevertible` for lacking it.
- An alarm the workflow filed closes itself, with a comment linking the passing run, when a later run clears the condition.

## Scope
- New pure module `governance/checks/memory-gate.mjs` (the predicate moved out of `run-check.mjs`).
- `lib/merge-walk.mjs`, `brain-audit.mjs`, `brain-metrics.mjs`: use it.
- New VCS port verb `issueClose` (GitHub, GitLab); `alarm.mjs resolve`; two workflow steps.
- Not in scope: `brain-check.mjs` / `brain-ship.mjs` (#1186/#1187).
