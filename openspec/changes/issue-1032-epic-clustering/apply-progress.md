# Apply progress — issue-1032-epic-clustering

## What the data actually held

Measured before writing anything, against the running server: two issues
declare `kind: epic` (#878 and #884), twelve declare a `parent`, and **no epic
declares a tracker**. The third fact shaped the work more than the first two —
the feature's most visible field is empty for every row it will ever draw
today, so "says it has none" is not an edge case here, it is the normal case.

And #884 is BOTH an epic and a child of #878. Nested epics are in the data, not
in a hypothetical.

## Decisions

**Nested epics stay flat**, following `roadmap-model.mjs`'s precedent from
#882's own cold review. A deeper vocabulary is exactly the "second grouping
vocabulary" the ticket forbids. The dropped relation is said on the child
epic's own row as `nested-epic-not-supported`, with the parent it declared and
whether that came from the block or the prose.

**`parent-not-epic` and `parent-not-in-graph` are different facts.**
`epic-graph.mjs` deliberately reports no divergence for a parent number it
holds no node for — not in this list is not "not an epic" — so this model
states its own honest reason there rather than borrowing one nobody reported.

**The model says who it did NOT claim.** The page draws clusters above and
lanes below, and a claimed node must not appear in both. Deciding who is
claimed is the model's job: a renderer re-deciding from `kind` and `parent`
would be a second answer to a question already answered, and the two can
disagree. A test pins that the three sets partition the graph, because a node
in none of them would vanish from a board that trusted this answer.

## Two defects caught before they shipped

**A grouped row was not a card.** The page draws an epic's slices with
`renderNodeCard`, and `groupedRow` gave neither `className` nor `blockedBy` —
so every slice would have rendered with `class="node-card undefined"` and
thrown on `blockedBy.length`. That is precisely the shape mismatch that
shipped this morning in `sddForIssue` and took a whole board down. The two
shapes are now pinned against each other in a test rather than trusted to stay
aligned by reading.

**A comment lost its subject.** Removing `canvas-model.mjs` left
`lane-model.mjs` saying "the same rule the removed / holds for the single
board". Caught by reading the result of my own edit rather than the diff.

The delegated writer closed two of its own, and reported both rather than
keeping a green mutation: a `==` that treated "parent absent from the graph"
the same as "no parent declared", swallowing a required fact; and a test whose
fixture used a reason equal to the code's own fallback, so a mutation gutting
the passthrough left it green.

## Mutations

| mutation | suite |
| --- | --- |
| the grouping condition inverted | 6 red |
| `parent-not-in-graph` renamed | 1 red |
| `nested-epic-not-supported` renamed | 2 red |
| `epic-declares-no-tracker` dropped | 1 red |
| `baseCheck.ok` flipped to true | 1 red |
| `parentSource` hardcoded to null | 2 red, separately |
| a claimed node reported unclaimed too | 2 red |
| the lanes stop filtering, so a slice is drawn twice | smoke, 1 red |
| the tracker absence stops being said | smoke, 1 red |

## Measured

Driven against the live snapshot through the DOM harness, in both modes:

| mode | cards | clusters | drawn twice |
| --- | --- | --- | --- |
| track swimlanes | 36 | 0 | none |
| epic clusters | 34 | 2 | none |

The two fewer cards are the two epics, which lead their clusters as headings
rather than as a second card saying their number and title again. Their STATE
still shows, in the same words every card uses: an epic is a node like any
other, and the one mode organised around epics must not be the only place you
cannot see how they are going.

Whole repository: 6290 tests, 6290 pass, 0 fail.
