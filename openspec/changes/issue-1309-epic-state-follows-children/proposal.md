---
status: draft
issue: 1309
---

# Proposal — epic-state-follows-children (issue 1309)

## What

An epic's lifecycle chip follows what its rollup measured about its direct children. An epic
with at least one closed or in-flight child no longer reads `○ Planned`. While the closed list
was not counted (`closed: null`), the chip claims no progress in either direction.

## Why

Issue #1309. Epic #878 reads `○ Planned` in the drawer and in Governance › Roadmap, next to its
own rollup sentence "17 / 39 children closed". The two facts sit on the same screen and
contradict each other.

The cause is that `stateOf(node, work)` (`ui/lib/state-vocab.mjs:64-78`) reads only the node's
own evidence: its roadmap state, and whether any of the four work sources names it. An epic is
rarely named by a worktree, branch, change dir or PR, because the work happens in its
children. So once every work source is ready, every epic falls through to `Planned` at `:77`.
The rollup (`ui/lib/rollup-model.mjs:35-58`) already measures the children, but nothing feeds
it to the state.

## Scope

- Includes:
  - The epic's state derived inside the ONE state function (`stateOf`, #1308 R1308-6), with the
    epic's rollup as additional evidence. There is no second state function.
  - The same chip everywhere `stateAndMarks` / `safeStateOf` already reach: the lane epic
    cluster heading, the drawer header, the drawer's children list (for a child that is itself
    an epic), and the Roadmap epic row.
  - Honest degradation. Rollup pending or failed, closed count `null`, a child's state unknown,
    or a closed list with unresolved issues each yield `— Not computed` with the reason, never
    `Planned`.
  - Roadmap rows show the state's reason as a tooltip, the same way chips already do.
- Does not include:
  - Any change to the rollup's counting, its sentence (`rollupLabel`), or the hierarchy
    adapter.
  - Nested-epic aggregation. A child epic counts as one child by its own open/closed state; its
    own children are not walked.
  - A new lifecycle word (for example "Ready to close"), unless the maintainer rules for it.
    See the MAINTAINER QUESTION lines in `design.md`.
  - Any server or snapshot change.

## Rulings honoured (epic #878)

- Never show an unmeasured value as measured. Progress is claimed only from what the rollup
  counted or from the work index. Absence is claimed (`Planned`) only when both are complete.
- The first render never waits on the forge. Local work evidence on an open child can make the
  epic `In flight` before the closed lane lands. Forge data only ever adds evidence.
