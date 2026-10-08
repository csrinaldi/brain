---
status: draft
issue: 1309
---

# Spec — epic-state-follows-children (issue 1309)

"Epic" means a graph node with `kind === 'epic'`. "Rollup" means `epicRollup(hierarchy,
forgeLoad, epic)` (`ui/lib/rollup-model.mjs`). "Work evidence" is #1308's four sources, read
through `workIndex`. An "in-flight child" is a direct child whose hierarchy state is `open` and
which at least one work source names.

The maintainer ruled all four design questions on 2026-10-05; see `design.md`.

## Requirements

**R1309-1 — One authority.** An epic's state is computed by `stateOf`, the same function every
other node uses, with the rollup as additional evidence. No caller derives an epic state on its
own. The cluster heading, the drawer header, the children list and the Roadmap row agree.

**R1309-2 — Precedence.** #1308's precedence holds, with `Ready to close` inserted: `Unreadable > Done > Blocked >
Awaiting review [label renamed to Awaiting approval by #1379] > Ready to close > In flight > Not computed > Planned`. The rollup only adds evidence at the `Ready to close`,
`In flight` and `Not computed` steps. A closed epic reads `Done`. A blocked epic reads
`Blocked`, whatever its children say.

**R1309-3 — Progress from closed children.** An open epic whose rollup counted at least one
closed child (`closed > 0`) reads `◐ In flight`. The reason is the rollup sentence.

**R1309-4 — Progress from in-flight children.** An open epic with at least one in-flight child
reads `◐ In flight`, even when the closed count is `null`. The reason names the child or
children.

**R1309-5 — No claim from an uncounted list.** When the rollup is unavailable, or `closed` is
`null`, or any child's state is unknown, or the closed list has unresolved issues, and R1309-3
and R1309-4 do not apply, the epic reads `— Not computed`. The reason uses the rollup's own
words. It never reads `Planned`.

**R1309-6 — Planned only when measured.** An open epic reads `○ Planned` only when all of the
following hold: the rollup counted `closed === 0`, no child's state is unknown, nothing is
unresolved, no child is in flight, the epic has no work evidence of its own, and every work
source is ready.

**R1309-7 — All children closed.** An open epic whose rollup counted every direct child closed
(`closed === total > 0`) reads `◉ Ready to close`. The reason says that all N children are closed and
the epic is still open. It sits after Awaiting review [label renamed to Awaiting approval by #1379] and before In flight (D137); it is never `Done`.

**R1309-8 — Reason visible on the Roadmap.** A Roadmap row whose state carries a reason shows
it as the row chip's tooltip, as cards and drawer chips already do.

## Scenarios

### S1 — no started children
- GIVEN open epic E has 3 open children, the closed lane is complete with 0 closed children,
  and all work sources are ready and name neither E nor its children
- THEN E reads `○ Planned` in the cluster heading, the drawer header and the Roadmap row

### S2 — some children closed (the #878 shape)
- GIVEN open epic #878 has 39 direct children, 17 of them closed, and the closed lane is
  complete
- THEN #878 reads `◐ In flight` with reason "17 / 39 children closed" everywhere it is shown

### S3 — rollup uncounted, nothing in flight
- GIVEN the closed lane is pending (`closed: null`), and no open child of E is in flight
- THEN E reads `— Not computed` with reason "counting closed children…" (the rollup's words)
- WHEN the closed lane lands with 2 closed children
- THEN E reads `◐ In flight`

### S4 — rollup uncounted, a child in flight
- GIVEN the closed lane is pending and a local worktree names open child C of E
- THEN E reads `◐ In flight` without waiting for the closed lane

### S5 — only in-flight children
- GIVEN the closed lane is complete with 0 closed children, and a PR names open child C
- THEN E reads `◐ In flight` with a reason naming `#C`

### S6 — all children closed, epic open
- GIVEN every direct child of open epic E is closed, and the lane is complete
- THEN E reads `◉ Ready to close` with the reason "all N children closed; the epic is still open"

### S7 — hierarchy or forgeLoad unavailable
- GIVEN the hierarchy section is pending
- THEN epic E with no own work evidence reads `— Not computed`, and the reason names the
  pending section

### S8 — precedence holds
- GIVEN open epic E has 5 closed children and an open blocker
- THEN E reads `⊘ Blocked`
- GIVEN epic E is closed
- THEN E reads `● Done`

### S9 — unknown child state or unresolved closed issues
- GIVEN the lane is complete with 0 closed children, and one child's state is unknown (or
  `unresolved > 0`)
- THEN E reads `— Not computed`, never `Planned`

### S10 — a non-epic is unaffected
- GIVEN a ticket node (no `kind: epic`) that has children in the hierarchy
- THEN its state is exactly #1308's, and the rollup is not consulted
