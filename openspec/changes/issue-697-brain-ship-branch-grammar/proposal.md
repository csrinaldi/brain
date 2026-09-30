# Proposal: brain:ship reads the branch grammar brain:ticket:start emits (#697)

## Problem
`brain:ship` extracted the issue number with `/\/(\d+)-/`, which cannot parse `{type}/issue-{N}-{slug}`, the canonical shape `brain:ticket:start` emits (harness-contract.md). 76 of the last 100 merged branches use it; 1 matched. Reproduced on fresh consumers in the 1.9.0 demo.

## Approach
One shared pure parser, `brain/scripts/lib/branch-grammar.mjs#parseIssueBranch`, accepting the canonical shape and the legacy `{prefix}/{N}-{slug}` shape. `brain:ship` and `brain:next` route through it. The refusal message names both shapes and points to `brain:ticket:start`.

## Decisions
- `ticket-start.mjs` is NOT changed: its shape is the documented one.
- `brain-start.mjs` keeps emitting the legacy shape for now (the parser accepts it, so nothing breaks). Retiring or documenting `brain:start` is a separate decision that touches docs and `brain/core`; left open.
- Not in scope: `claude/{slug}` branches (issue point 4, reading the number from the PR body) and #602.
- Labels: after parsing, `brain:ship` needs the issue to carry a `type:*` label that also exists on the remote (label preflight). Label creation belongs to #1163.

## Readers reviewed
Fixed: `brain-ship.mjs` (`resolveIssueNumber`, `titleFromBranch`), `brain-next.mjs` (`issueFromBranch`, routed). Already correct, untouched: `capture-provenance.mjs#ISSUE_BRANCH_RE` (canonical only, pure and pinned by its own tests), `session-start.mjs#deriveChangeFromBranch` (`issue-(\d+)`), `sweep.mjs` (memory-lane branches, unrelated grammar).
