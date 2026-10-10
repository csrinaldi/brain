---
status: draft
issue: 1314
---

# Design: drawer-and-css-followups

## Decisions

### D177: One home for a blocker (#1314)
`lane-model.mjs` `stateAndMarks` stops pushing a "blocked by" mark. `blockedBy` is already a field of
the node, drawn by `node-blocked` on the card and `drawer-blocked` in the drawer; the mark was a second
copy of the same fact.

### D178: The drawer header is a model fact, tab counts are measured (#1314)
`drawer-model.mjs` adds `header: {changeDir, branch, from}` and a `count: {text, title} | null` per tab.
Counts: Spec = requirement cards, SDD = stages present of the stages listed, Tasks = `done/total` only when
`progress.ok`, Reviews = rounds only when no thread is unreadable or pending, Records = entries. A failed
tab has `count: null`. The branch is the worktree or origin branch the tabs read; the served HEAD has no branch the
page knows, so it says "served HEAD". The "change dir:" note leaves the body for the head.

### D179: No drift is not an alert (#1314)
`renderDriftWarnings` draws the band only for drift or a failed computation; "none" is a `note` line.

### D180: Status is derived from supersession (#1314)
`decisions-model.mjs` adds `statusShown` and `statusClass` to a readable row: `Superseded (by ADR-NNNN)` when
`supersededBy` is set, the parser's word otherwise. `statusLine` rides as the chip title. The file column no
longer repeats "superseded by", so the fact has one wording.

### D181: The lane summary is a model function (#1314)
`lane-model.mjs` exports `laneSummary(value, clustering)`. Track mode keeps today's line. Epic mode counts
epics, lanes that still hold an unclaimed node, and the holding count (already net of claimed nodes). The cluster
view stops printing its own "declared epic(s)" line.

### D182: The table guard renders (#1318)
A new render test loads the app against the fake DOM, drives the four views and collects the className
of every `td`, `th`, `tr` (including classes added by `classList.add`, which the fake DOM must record in
`className`). The source scan stays as a cheap second net, with its claim narrowed to literal arguments.

### D183: Ship font: inherit (#1321)
`app.css` gets `font: inherit` on the base control rule, as D118 decided. The contrast test reads both dark
blocks and also asserts identical values.

### D184: The fake DOM clamps scrollTop (#1330)
`dom.mjs` gives an element `clientHeight` (settable; default 0) and `scrollHeight` from its layout flow;
`scrollTop` assignment clamps to `[0, max(0, flowHeight - clientHeight)]`. Synthetic: it models only the clamp, not layout.

### D185: Cold review round 1 of PR #1403 (#1314)
Spec count: `buildSpecTab` adds `truncated: true` beside the note when the read was cut; `drawer-model.mjs`
shows no Spec count then (no count, like Tasks, rather than a partial "12+"). A field, not the note's text.
Sweep of the other counts: SDD blanks when a stage row carries `unreadable: true` (new field on
`buildSourcedSddTab`, set where the row already said "could not be read"); Reviews already blank on any
unreadable or pending thread, and the poller's REVIEW_CAP rotation leaves uncached PRs as `pending` rows
(snapshot.mjs NOT_FETCHED_YET), so it is unaffected; Records reads every file with no cap (a corrupt line is
skipped silently by `readRecords`, a pre-existing gap with no signal to gate on), unaffected here; Tasks was
already blank on truncation. Epic head: D177 removed the blocker mark from `stateAndMarks`, which the epic
cluster head rendered; the head now draws `epic.blockedBy` once in the card's `node-blocked` line.

## Contract / API impact
None. `drawer-model.mjs` and `lane-model.mjs` gain additive fields.

## Alternatives rejected
- Drop `font: inherit` from D118: the issue allows it, but UA fonts on controls are the defect class D118 targets.
- Print the branch for the served HEAD: not measured by the page, so it would be an invented value.
