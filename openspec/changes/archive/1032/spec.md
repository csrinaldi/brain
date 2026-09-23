# Spec — issue-1032-epic-clustering

### R1032-1: the board groups by the epic a node declares
`lane-model.mjs`'s `epicGrouping` MUST return `{ok:true, value:{epics,
divergentChildren, unclaimed}}`, grouping every non-epic node whose `parent`
resolves to a node declaring `kind: epic`.

#### Scenario: a slice declares its epic
- **WHEN** a node declares `parent: 878` and #878 declares `kind: epic`
- **THEN** it appears under #878's row, and nowhere else.

#### Scenario: a node declares no parent
- **WHEN** a node's `parent` is null
- **THEN** the grouping does not touch it, and it stays in its track lane as before.

#### Scenario: the parent is not an epic
- **WHEN** a node's `parent` resolves to a node that does not declare `kind: epic`
- **THEN** it is listed in `divergentChildren` with the reason the graph itself reported, never silently reparented and never dropped.

#### Scenario: the parent is not in the graph at all
- **WHEN** a node declares a `parent` this graph holds no node for
- **THEN** the reason is `parent-not-in-graph`, distinct from `parent-not-epic`, because an absence from this list is not evidence of not being an epic.

### R1032-2: nested epics stay flat, and the dropped relation is said
An epic that itself declares a parent MUST keep its own top-level row.

#### Scenario: an epic declares another epic as its parent
- **WHEN** #884 declares `kind: epic` and `parent: 878`
- **THEN** #884 leads its own cluster, is not nested under #878, and carries `nested-epic-not-supported` with the parent it declared and where that declaration came from.

### R1032-3: an epic names its tracker, or says it has none
#### Scenario: the epic declared a tracker
- **WHEN** an epic's `tracker` is a branch name
- **THEN** the row carries it with a source stamp, linked to the forge when the project is known.

#### Scenario: the epic declared none
- **WHEN** `tracker` is null — true of every epic in this repository today
- **THEN** the row says `epic-declares-no-tracker`, the resolver's own word, and the page shows those words where a branch would be. A blank line would read as "it has one and we did not show it".

### R1032-4: the model states who it did not claim
`epicGrouping.value.unclaimed` MUST name every node no epic claimed, so the
page can draw clusters and lanes together without deciding again.

#### Scenario: the board is drawn in epic clustering
- **WHEN** the page draws clusters above and track lanes below
- **THEN** it filters the lanes by `unclaimed` alone, no node is drawn twice, and no node disappears.

#### Scenario: a claimed node declared no track
- **WHEN** a node declares a `parent` an epic answers and no `track`
- **THEN** in epic clustering the `?` batch excludes it and states how many it is not showing, because it is on screen under its epic — not hidden, shown elsewhere. A batch that silently shrank would misreport how much of the graph declared no track.

#### Scenario: every node is accounted for
- **WHEN** the grouping is built
- **THEN** leading a cluster, sitting under one, and being unclaimed partition the graph — a node in none of the three would vanish from a board that trusted this answer.

### R1032-5: a grouped row is a card
A row under an epic MUST carry every field `renderNodeCard` reads, because the
page draws it with that same function.

#### Scenario: the same node in both places
- **WHEN** a node appears in a track lane and under its epic
- **THEN** `number`, `title`, `className`, `marks`, `state`, `track` and `blockedBy` are identical, and the coordinates are absent — a cluster is a grid, not a second board.

### R1032-6: the declare snippet carries the keys that exist
#### Scenario: an author reads the `?` lane's snippet
- **WHEN** the holding lane shows what to paste
- **THEN** the snippet carries `track`, `kind`, `parent`, `blocks`, `needs` and `files` — every key the parser reads and no key it does not — with a note saying `kind` is only for an epic and `parent` only for a slice of one, so the example is not read as an instruction.

#### Scenario: the caveat reaches the reader
- **WHEN** the page draws the batch's declaration block
- **THEN** the note is ON SCREEN beside the snippet. A caveat carried by the model and drawn nowhere is not a caveat; the page would show a block that, pasted as printed, declares a repository full of epics parented to one ticket.
