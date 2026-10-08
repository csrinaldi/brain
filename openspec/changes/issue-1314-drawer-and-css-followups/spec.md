---
status: draft
issue: 1314
---

# Spec: drawer-and-css-followups

Scenario grammar: each scenario carries one `WHEN` and one `THEN`, with an optional `GIVEN`.

## #1314 Visual polish

### R1314-1: A blocker is printed once
A blocked card, and the drawer of a blocked node, MUST name its blockers in exactly one element.

#### Scenario: A blocked card
- **GIVEN** node 882 is blocked by #881
- **WHEN** its card is rendered
- **THEN** the text "blocked by #881" occurs once in the card

#### Scenario: A blocked epic head
- **GIVEN** epic 878 is blocked by #907 and epic clustering is shown
- **WHEN** the epic's cluster is rendered
- **THEN** the text "blocked by #907" occurs once in the cluster, in the same line a card uses

### R1314-2: The drawer header names the change dir and branch; tab counts are measured
The drawer head MUST carry the change dir and the branch the tabs read when each is known, and
say so when it is not. A tab MUST show a count only when its source was fully read; a tab that
failed, or whose source is partly pending, MUST show no count.

#### Scenario: Counts from measured data
- **GIVEN** tasks.md has 14 of 18 items done and two review rounds were read
- **WHEN** the tab bar is rendered
- **THEN** the buttons read "Tasks 14/18" and "Reviews 2", and each carries a title naming its source

#### Scenario: A pending thread blanks the count
- **GIVEN** one review thread is not read yet
- **WHEN** the tab bar is rendered
- **THEN** "Reviews" shows no number

#### Scenario: A truncated spec.md blanks the count
- **GIVEN** spec.md is larger than the document cap and its cards cover only the read part
- **WHEN** the tab bar is rendered
- **THEN** "Spec" shows no number and no title claiming a total; the tab still says it is truncated

#### Scenario: An unreadable stage blanks the stages count
- **GIVEN** a stage document of the SDD tab could not be read
- **WHEN** the tab bar is rendered
- **THEN** "SDD" shows no x/y

### R1314-3: No drift is a quiet line
The Decisions view MUST draw the drift band only when there is drift or the drift could not be computed.

#### Scenario: Nothing drifts
- **GIVEN** HOME.md and the parser agree
- **WHEN** Decisions is rendered
- **THEN** no `decision-drift` element exists and one quiet line says "adr drift: none"

### R1314-4: A superseded ADR reads Superseded
The status column MUST read "Superseded (by ADR-NNNN)" for an ADR the parser reports as
superseded; the file's own status line is the chip title.

### R1314-5: The summary matches the clustering
In epic clustering the page MUST NOT print the track-lane summary. It prints one summary of
the declared epics, the lanes holding unclaimed nodes and the holding lane count.

## #1318 Table-cell guard

### R1318-1: The guard reads rendered classes
A fake-DOM render of Decisions, Anti-patterns, Memory and the Verdict queue MUST collect the
className of every rendered `td`, `th` and `tr`; no `app.css` rule whose last compound names
one of those classes MAY set `display`.

#### Scenario: Mutation
- **GIVEN** `.queue-row { display: block }` or `.openable { display: flex }` is added
- **WHEN** the guard runs
- **THEN** it fails and names the class

### R1318-2: R1310-1 is worded with MUST NOT
Spec R1310-1 reads "A CSS rule ... MUST NOT set display".

## #1321 Theme control rule

### R1321-1: Controls inherit the font
The base control rule MUST carry `font: inherit` for `button`, `select` and `input`, pinned by a test.

### R1321-2: Both dark palettes pass contrast
The contrast test MUST compute its pairs for the `prefers-color-scheme: dark` block as well as `[data-theme='dark']`, and the two blocks MUST hold identical values for every token it uses.

## #1330 Clamp padding

### R1330-1: The fake DOM clamps
A fake scroller MUST have a `clientHeight` and MUST clamp `scrollTop` to `flowHeight - clientHeight`. It stays documented as synthetic.

### R1330-2: The padding value is asserted
The tab-click test MUST assert the panel `minHeight` equals the body `clientHeight`; the mutation `${0}px` MUST fail.
