# Tasks — issue-1059-design-structure

Worked in phases, each reviewed by the maintainer before the next began. The
phases are the design's own regions, not a code-shaped breakdown.

## Phase 1 — the status bar (R1059-1)
- [x] T1. `lib/header-model.mjs` + test: the counts split the graph into tracked and undeclared and sum to the total; an unreadable graph costs the header its counts and nothing else; the served branch carries its source and its refusal; the epic is stated as unresolved, never parsed from a branch name.
- [x] T2. The light palette becomes the design's slate ramp; `--accent`, `--accent-quiet` and `--live` are added to BOTH palettes. The dark block already carried the design's values and is untouched.
- [x] T3. `renderStatus` builds from the model. Scan test: the six facts of region 01 each have a place in the bar.

## Phase 2 — the shell and the chrome (R1059-2)
- [x] T4. `body` becomes a full-height column on the ground colour; the bar and nav go mono.
- [x] T5. `MODES` gains each mode's glyph (the table is the buttons, so the glyph belongs there); the nav draws pills, the queue count and the keyboard chips.

## Phase 3 — the lanes as cards (R1059-3)
- [x] T6. A lane node carries its `title` and `blockedBy` apart from its label. RED first.
- [x] T7. `renderLaneCards`/`renderNodeCard` replace the SVG board; the clustering bar and the legend are drawn above, the legend built from `state-vocab.mjs` itself.

## Phase 4 — the card's SDD strip, and air (R1059-3)
- [x] T8. `sddForIssue` finds the one change an issue owns, and says so when there is none. RED first.
- [x] T9. The strip renders at the foot of each card; the lane header becomes a line above its grid rather than a box around it.

## Phase 5 — the undeclared batch (R1059-4)
- [x] T10. The holding lane carries the `total` it is part of, so both numbers come from one place. RED first.
- [x] T11. The batch replaces the lane: proportion, declare snippet, tiles, the rest counted, the edges said. The last SVG leaves the page, and `app-source-guard`'s allowance for the SVG namespace URL is removed with it.
- [x] T12. `tokens.test.mjs`'s `\bwhite\b` matched `white-space`; the match now stops at a hyphen, proven still to catch `color: white`.

## Phase 6 — the queue and governance as tables (R1059-5, R1059-6)
- [x] T13. A queue entry carries rounds, the latest verdict and the head judged. RED first.
- [x] T14. The queue, decisions and anti-patterns become tables with one anatomy; an unreadable entry spans the row with its reason.

## Phase 7 — the node panel (R1059-7)
- [x] T15. `nodeSummaryFor` gives the panel the same node a card shows, from the same `stateAndMarks`. RED first.
- [x] T16. The drawer becomes a sibling of the content at `min(470px, 100%)`, stacking below it on a narrow screen; its header carries the number, state, track, forge link and close.
- [x] T17. The SDD entries carry their position and mark, so a gap in the lifecycle is visible.

## Phase 8 — the viewer's theme (R1059-8)
- [x] T18. `lib/theme.mjs` + test: three choices, anything unknown reads as system, and only an explicit choice stamps the document. RED first.
- [x] T19. The CSS gains the guarded media query and the `[data-theme]` stamps; a new token test pins that all three blocks define the same names.
- [x] T20. The bar offers the select, the choice is applied before the first render, and unreadable storage falls back to system.

## Phase 9 — the slice plan (R1059-7)
- [x] T21. `change-route.mjs` carries the declared slice plan on the sdd tab, with the note that PR state is not read. RED first.
- [x] T22. The drawer model and the panel draw it beneath the stages.

## Still open (R1059-9)
- [ ] T23. The served branch resolves to its epic — needs a reader; ticket to open.
- [ ] T24. The waiting duration — #880.
- [ ] T25. `merged, not archived` — the port carries no merged-PR data; ticket to open.
- [ ] T26. Epic clustering — #1032, open and approved.

## Review Workload Forecast
Counted lines: ~1 480 across nine phases, all in the render layer and its
models. Over the `lite` budget of 1 000, so the tracker merges under
`size:exception` the way #998 and #882 did; the phases themselves were
reviewed by the maintainer as they landed.
