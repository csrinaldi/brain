---
status: draft
issue: 459
---

# Spec

## REQ-459-1 — dependencies are declared data
An issue's position in the graph MUST be read from a declared `brain-graph/1` block in its
body, parsed by the shared fenced-YAML primitives. A block of a different protocol MUST NOT
be read as a graph block.

## REQ-459-2 — absent is not empty
An issue with no declared block MUST be classified `UNCLASSIFIED`. It MUST NOT be dropped
from the graph and MUST NOT be treated as a free-standing leaf.

## REQ-459-3 — the undeclared count is reported
The summary MUST state how many issues carry no block and name them. It MUST NOT absorb
them into the startable set.

## REQ-459-4 — one edge, either end
`A needs B` and `B blocks A` MUST produce the same single edge. Declaring it from either
end MUST be sufficient; declaring it from both MUST NOT duplicate it.

## REQ-459-5 — only an OPEN prerequisite blocks
An edge from a closed issue, or from an issue absent from the set, MUST NOT mark its target
blocked.

## REQ-459-6 — an unapproved issue waits on a human
A declared, unblocked issue lacking the human approval label MUST be `AWAITING_HUMAN`, not
`READY`. Only approved, unblocked and declared is `READY`.

## REQ-459-7 — parallelisability is computed
Conflict between two ready nodes MUST be derived from their `files` claims. A declared
parallelism boolean MUST NOT be honoured.

## REQ-459-8 — undecidable reads as overlapping
A file claim the matcher cannot decide MUST be treated as an overlap, never as a
non-overlap.

## REQ-459-9 — an out-of-scope edge is drawn
An edge whose target is not in the rendered set MUST still be drawn, to a stub node. It
MUST NOT be dropped.

## REQ-459-10 — titles cannot break the diagram
Characters that terminate a mermaid label MUST be removed from the label interior, and the
gaps they leave MUST NOT be left behind as ragged whitespace.

## REQ-459-11 — the render is deterministic
Two runs over unchanged state MUST produce byte-identical output, independent of input
order.

## REQ-459-12 — outside the markers is read-only
The body write MUST replace only the marker-bounded region. Every byte outside it MUST be
unchanged. An absent region MUST be appended, never substituted for the body.

## REQ-459-13 — a partial read is refused, not drawn
If the issue list cannot be read, the verb MUST fail rather than draw a graph from what it
happened to receive. An individual unreadable body MUST land in the undeclared count.

## REQ-459-14 — the issue list is complete
`issueList` MUST return every issue matching the query on both providers, not the first
page. A short page terminates the walk.

## REQ-459-15 — what brain cannot see is said, not implied
Assignees are outside the port's return contract in this slice. The map MUST state that
absence explicitly rather than render an empty executor set.

## REQ-459-16 — no new gate
The verb MUST be read-only reporting. Nothing it emits may block a merge.
