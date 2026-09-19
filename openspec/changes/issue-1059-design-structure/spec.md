# Spec — issue-1059-design-structure

The design file (`design-docs/claude-design/Brain UI.dc.html`) is the
acceptance criterion. Each requirement below names one region of it and the
answer it received: **filled**, **restricted** with its reason, or
**completed** by a named ticket.

## R1059-1: the status bar is the design's region 01

The bar MUST carry, in the design's order: the wordmark, the branch served, the
stream's state, when the forge was last polled, the epic this checkout serves,
the node counts, and the poller's controls. The counts MUST come from one model
rather than a recomputation on the bar's own five-second clock.

- **WHEN** the graph holds four nodes, two of which declare a track
- **THEN** the bar reads `nodes 4 · tracked 2 · 2 undeclared`, and the two parts sum to the total.

- **WHEN** the graph section could not be read
- **THEN** the counts say their own reason and every other fact in the bar still draws.

- **WHEN** the served branch is known but no reader joins it to an epic
- **THEN** the bar says the epic is not resolved and why, and never parses an epic out of a branch name.

## R1059-2: the mode nav is region 02

Each mode MUST carry the glyph the design draws BESIDE its word, from
`view-model.mjs`'s own table — a mark alone is not a label. The verdicts mode
MUST carry the queue's own count, and the keyboard hints MUST be chips.

## R1059-3: a lane is a grid of cards, region 03

A lane MUST be a header and a grid of cards, not a drawn graph. A card MUST
carry the issue number, its state as mark AND word, its title on its own line,
what it waits on, and the stage its change reached. An edge MUST NOT be drawn:
the card that waits says so in words, and a cross-lane edge stays in the said
list beneath.

- **WHEN** a node declares `blockedBy: [881]`
- **THEN** its card reads `blocked by #881`, and no line is drawn between the two.

- **WHEN** an issue owns no change directory
- **THEN** its strip says that, rather than showing an empty strip.

## R1059-4: the undeclared issues are a batch, region 04

The `?` lane MUST be a panel stating the proportion (`N of M open issues
declared no block`), the snippet to paste to declare, the issues as tiles, and
the rest counted. Its holding-holding edges MUST be SAID rather than drawn —
this batch has no coordinate space.

## R1059-5: the verdict queue is a table, region 05

Its columns MUST be PR, issue, rounds, latest verdict, head judged and waiting,
every one carried by the queue entry itself. A thread with no round MUST fill
those columns with a stated absence, never a blank passed off as a value.

## R1059-6: governance is tables, region 06

Decisions MUST be a table of ADR, title, status, amendments and file, with the
drift warning above it. Anti-patterns MUST be a table of scope, pattern, cited
by and file. In both, an entry that could not be read MUST stay as a row across
the table with its reason.

## R1059-7: the node panel is region 08

Clicking a card MUST open a panel on the RIGHT, a sibling of the content rather
than an overlay, carrying the node's number, state, track, a link to the issue
on the forge, and its title. Its SDD tab MUST draw the seven stages NUMBERED in
lifecycle order with a mark each, and beneath them the declared slice plan.

- **WHEN** a change's `tasks.md` declares a slice plan
- **THEN** each slice says what it claims, and a note says the plan is declared and that what each PR did with its slice is not read.

- **WHEN** a change declares no plan
- **THEN** the tab says so, rather than an empty heading.

## R1059-8: the viewer chooses the theme

The page MUST offer system, light and dark. `system` MUST stamp nothing, so
`prefers-color-scheme` decides; an explicit choice MUST win in both directions.
The choice MAY be remembered per viewer, and storage that cannot be read MUST
fall back to `system` rather than throw.

This amends #998's ruling 4 ("no toggle to persist", 2026-09-16), reversed by
the maintainer on 2026-09-19. The reconciliation the original ruling did not
draw: a viewing preference is about the reader, not about the project — it
never reaches the repository and no fact on the page derives from it.

Every token the dark blocks redefine MUST be defined on bare `:root` first, and
the stamped dark theme MUST define the same names as the system one.

## R1059-9: three regions are completed by tickets, not by guesses

- the epic a served branch belongs to — the data exists (`kind`, `parent`, `tracker`, #967), no reader joins it;
- the waiting duration on a queue row — a round carries no timestamp (#880);
- `merged, not archived` — the port carries no merged-PR data.

Each MUST be stated where the design draws it, naming what is missing.
