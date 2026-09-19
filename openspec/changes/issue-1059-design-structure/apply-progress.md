# Apply progress — issue-1059-design-structure

Nine phases, each shown to the maintainer in the running page before the next
began. Every phase is one commit.

| phase | commit | what landed |
|---|---|---|
| 1 | `422c334b` | the status bar as region 01; the light palette becomes the design's; the accent tokens |
| 2 | `97c28644` | the app shell and the chrome: mono pills with their glyphs, the queue count, the keyboard chips |
| 3 | `d12c2dc5` | a lane is a grid of cards, with the clustering bar and the legend above |
| 4 | `4fcf97f6` | the cards breathe, and each carries the stage its change reached |
| 5 | `fe812686` | the undeclared issues are the design's batch; no lane draws SVG any more |
| 6 | `210bc1c4` | the verdict queue and governance are the design's tables |
| 7 | `71c34ce8` | the drawer is the design's right panel, with the node's header and the numbered stage strip |
| 8 | `c9a9e877` | the viewer picks the theme — system, light or dark, remembered |
| 9 | `60c0925a` | the slice plan rides the panel's SDD tab, declared and said as declared |

Full suite at the end: 6075 pass / 0 fail. `npm run brain:repo:check` green
before every commit. Counted diff against the tracker: ~1 480.

## Said, because it is the kind of thing that is easier not to write down

- **The SDD artifacts were written LAST.** Phases 1 to 9 landed before this
  change had a proposal, a spec or a task list — the maintainer asked for
  phase-by-phase work in the running page, and the artifacts followed the
  code instead of leading it. It was the maintainer who noticed: the UI shows
  every change's stages, and this change had no directory to show. The spec
  was written from the region table that already existed, so it describes what
  the design asked for rather than what the code happened to do, but the order
  was wrong and the record says so.
- **Phase 1's model was written before its test.** Proven afterwards by removal
  (the suite fails without the module) and two mutations, both red. Said here
  rather than presented as a red-first cycle.
- Two guards were loosened and one tightened, each with its reason in the test
  itself: `app-source-guard`'s allowance for the SVG namespace URL is GONE
  (nothing draws SVG now — the strictest that assertion has ever been);
  `tokens.test.mjs`'s `\bwhite\b` no longer matches `white-space`, proven still
  to catch a real `color: white`; and a new token test pins that the bare
  `:root`, the guarded media query and the `[data-theme]` stamp define exactly
  the same names.
- **A ruling was reversed.** #998's ruling 4 refused a persisted theme toggle
  because it would be the page's first state outside the read model. The
  maintainer reversed it; R1059-8 records both the reversal and the
  distinction that reconciles it.

## What the page still cannot say

Three regions of the design need data that does not exist, and each says so
where the design draws it rather than guessing: the epic a served branch
belongs to, the waiting duration on a queue row, and whether a PR merged. The
first and third need tickets; the second is #880.

## A defect this change introduced, found by the maintainer clicking

Phase 6 made every verdict-queue row clickable and phase 10 made every issue in
the slice plan clickable, both calling `selectNode`. But `renderContent` drew
the panel only in the map view and force-hid it in the other three. So three of
the five ways to select a ticket could never show one: the click registered,
the state changed, and the page drew nothing.

The fix states the rule the code had violated: a panel is about a TICKET and a
mode is about the project, so the panel is drawn once, for every mode, and no
mode may force it shut — closing it is the reader's own control. A queue row
now opens its ticket without throwing the reader out of the queue.

Covered by a new assertion in `views-owned.test.mjs` that counts the calls in
`renderContent` and refuses any `mounts.drawer.hidden = true` inside it.
Mutation: removing the single call turns exactly that test red.

## Two more defects, and the reason none of them could fail a test

The mode gate above was not why the maintainer saw no panel. Two real crashes
were, and both were found by running the page instead of reading it: a
throwaway DOM shim in the scratchpad imported the real `app.js`, pointed its
`fetch` at the running server, and dispatched a card's own click listener.
The stack traces named both faults in one run.

**1. `sddForIssue` returned the raw snapshot entry, not a row.** `readChanges()`
emits `artefacts` booleans and `{ok,value}` task envelopes; a row carries seven
`stages` and two numbers. The card strip read `change.stages`, which is on NO
entry the server sends — all 179 of them. So `renderNodeSdd` threw on every
card that had a change directory, `renderLanes` died mid-board, and
`renderDrawer` never ran. The function's own docstring already said "value:
`<the change row>`"; the code disagreed with it.

The test is the story. It invented a THIRD shape — `tasks: {checked: 14}` as a
bare number, no `artefacts`, no `sliceScopes` — and asserted only `issue` and
`archived`, the two fields every shape happens to share. It now uses the same
`FULL`/`ONLY_PROPOSAL` fixtures the rest of the file uses, which are the shape
the reader really emits, and asserts the three things the strip reads.

**2. `saidList` was called seven times and defined nowhere.** Phase 5 removed
the SVG helpers, and this one sat directly above them in the same block, so it
went with them. Every branch that reports a cross-lane edge, a dropped edge or
an unreadable issue body threw a `ReferenceError`. Restored from `fe812686^`.

**The class, not just the two bugs.** D9 says `app.js` has no runner, so a
`ReferenceError` in it is not a red test — it is a blank page. A new scan in
`app-source-guard.test.mjs` now requires every identifier in call position to
be declared, imported, bound as a parameter, or a named platform global. It
caught `saidList` and nothing else. Writing it also exposed a trap worth
recording: stripping block comments before line comments lets the `/*` inside
this file's own `lib/*.mjs` prose open a comment that swallows the imports
below it, so the scan reports a dozen phantom undefined names. Line comments
are stripped first, strings last.

A DOM smoke harness would have caught all three defects on the first render
and is the real fix for this class. It is not in this change's scope.

## The page is run now, not only scanned

D9's premise was that asserting anything about `app.js` required a DOM, and a
DOM required a dependency. That premise cost three shipped defects. It was
wrong: `ui/test-support/dom.mjs` is about two hundred lines, imports nothing,
and runs the real module.

`load-app.mjs` imports the actual `static/app.js` with its `./lib/` specifiers
rewritten to the real modules, into `testTmp` and never into the repository.
The page's `setInterval` is stubbed across the import only — a real one holds
the event loop open and `node --test` hangs instead of failing, and replacing
a global timer for the whole run would reach the test runner itself.

The fixture is issue BODIES fed to the real `buildSnapshot`. Nothing in the
test describes the shape of a node or a change; the production readers decide
that. This is the direct answer to how the `stages` defect shipped.

Each of the three defects was reintroduced:

| mutation | smoke suite |
| --- | --- |
| `sddForIssue` returns the raw entry | 3 of 3 red |
| `saidList` deleted | 3 of 3 red |
| the panel drawn only in the map view | 1 red |

The second needed the fixture widened before it bit: with four tidy issues no
branch ever called `saidList`, and a mutation that leaves the suite green is
not evidence. A cross-lane edge and a body the forge refuses now ride in the
fixture, which is also the only honest way to draw those two regions.

## The finder (R1059-11)

The maintainer asked for a way to find epics, trackers and tickets.
`lib/search-model.mjs` matches by issue number, title, track and label, ranks
an exact number above everything, and caps the list while stating the total.

Two decisions worth the ink:

- **A result says it is an epic or a tracker from the DECLARATION**, never
  from the word in its title. Six issues on the live graph have "epic" in the
  title; none declares `kind`. The finder lists all six and decorates none.
- **The field is its own mount, built once.** The status bar re-renders on a
  five-second clock and `render()` runs on every stream frame, so a control
  rebuilt by either would drop the caret and erase a half-typed query under
  the reader's hands. The smoke suite pins this by asserting the input is the
  SAME element across a full render.

The notice about `kind` and `tracker` being undeclared is gated on the query
actually asking for one. A sentence about `kind` under every search for a
title is noise, and noise is how a real statement stops being read. Both
directions of that gate were mutated and each turns exactly one test red.

## One name, two things — caught before it shipped

A raw graph node from `epic-graph.mjs` carries `state` as the forge's own
word, the string `"open"`. Every node `lane-model.mjs` builds carries `state`
as a `{code, mark, label}` object from `state-vocab.mjs`. Two different things
under one name in the same page is how `row.state.code` gets written, and how
it throws at render — three times over in this very change.

A search result now calls the forge word `forgeState`, and nothing on a result
row is called `state` at all. The NAME is the guard: a comment warning against
the mistake still lets someone make it. Mutation: carrying it back as `state`
turns exactly that test red.

This was found because the delegated writer checked the live data instead of
believing the brief it was given, which had the field wrong. That is the same
discipline the `stages` defect was missing.

## The Spec tab read as empty for a day

The maintainer reported seeing no related information when clicking the
panel's tabs. The tabs were wired correctly; the Spec tab was lying.

`spec.md` for this very change used `##` for its requirement headings where
the grammar in `lib/spec-cards.mjs` declares `###`, and used bare `WHEN`/
`THEN` pairs with no `#### Scenario:` heading. The parser found no cards and
returned `{ok: true, value: []}`, which the page renders as "this tab's source
was read and has nothing in it" — about a file of 5,731 bytes, while the SDD
tab beside it reported `spec.md` present. Two tabs, one file, opposite claims.

That is `evidence-reader-empty-on-failure` exactly: the reader could not
understand the file and reported the absence of REQUIREMENTS instead of the
absence of UNDERSTANDING.

Two fixes, and the reader's is the one that matters:

- A `spec.md` with content and no requirement heading is now `{ok:false,
  reason}`, and the reason quotes the grammar so an author can fix the file
  without reading the parser. A file that really is empty still reads as
  empty, because there the empty list is the truth.
- A `WHEN` or `THEN` that attaches to no scenario is carried in `orphans`
  rather than dropped. A dropped `WHEN` is a requirement the page silently
  stops showing while its author believes it is covered.
- This change's own `spec.md` was rewritten to the declared grammar. It now
  parses to ten requirement cards.

A sweep found two more specs in the same shape, both archived: `archive/1029`
and `archive/1020`. They are not edited here — with the reader fixed they now
say what is wrong with them instead of reporting themselves as empty, which is
the outcome the anti-pattern asks for.

## Three modes, not four — and Memory (R1059-12)

The maintainer's rule, in their own words: Implementation Slices and Reviews
belong in the side panel with the ticket's information; Governance is global
access; Memory should exist at the global level.

So the mode table is `map`, `governance`, `memory`.

Nothing was deleted to get there. A project-wide verdict queue and a
project-wide slice plan are facts about the REPOSITORY, not about the ticket
in front of the reader, and the same rule that sends per-ticket detail to the
panel sends repository-wide facts to Governance. Both moved there as
sub-views, which took Governance from five to seven. The per-ticket halves
were already in the panel from phase 10, so nothing is shown twice.

The waiting count came off the mode nav. `(3)` beside "Reviews" read as three
reviews; beside "Governance" the same number reads as three governance things,
which is not what it counts. It sits on the Verdict queue sub-nav button now,
where the word beside it says what it is.

`lib/memory-model.mjs` reads the `.memory/records` ledger: 2,421 records in the
live snapshot, counted by type and by who wrote them over the FULL set rather
than the capped list, with the recent rows newest-first. Two decisions worth
recording:

- **No by-actor grouping.** An `actor` here is almost always a BRANCH, not a
  person, and `actors-model.mjs` already owns the by-actor view with its own
  reconciliation caveats. A second grouping would be a second answer.
- **Duplicates are an integrity signal, never a number.** Two record ids in
  this repository appear twice with DIVERGENT content — the same record
  disagreeing with itself. The page names the ids and the lines they sit on.

`Date.now()` is still read in exactly one place. Memory needs "now" to state a
record's age, and a second clock beside the poll indicator's could disagree
with it, so both take it from one `nowMs()` wrapper — and the guard now pins
the wrapper as well as the count.

## The harness disagreed with the browser, and every suite still passed

Driving the live page by hand — the work the harness exists to remove — showed
the Governance sub-nav rendering a button as " (1)" with its label gone.

`el('button', null, 'Verdict queue')` assigns `textContent`, then the count
span is appended. In a browser the assignment leaves a TEXT NODE, so the
button reads "Verdict queue (1)". The shim kept the assigned string in a field
beside the children and returned it only when there were none, so appending
anything erased the label. Every suite passed throughout, because the shim
agreed with itself.

`textContent` now leaves a real text node, and `test-support/dom.test.mjs`
pins that and eight other behaviours: assignment replaces, nesting
concatenates depth-first, a fragment is spent when appended, `classList`
writes through `className`, `fire` throws at a node with no listener rather
than asserting nothing, and `installDom` restores every global it replaced.

A harness is a claim about the browser. An untested one is a claim with no
evidence, and it will be believed anyway.

## A stage is a file, and the tab never said which

The maintainer, clicking a ticket: the SDD tab was not listing the files.

`buildSddTab` stamped all seven stage rows with the change DIRECTORY. So the
tab reported "design — missing" without ever naming `design.md`, and the
provenance every value on this page is supposed to carry pointed seven
different facts at one identical place. Provenance in form, useless in
substance.

Each row now carries `file` and is sourced to `${dir}/${file}`, and the panel
draws the file beside the stage name. A MISSING stage names its file too: "design
is missing" is only actionable when the reader knows what to create.

The four canonical names come from `sdd-layout.mjs`'s `ARTEFACT_FILE` rather
than being retyped — that module REFUSES a change declaring a different file
for a lifecycle stage, so a second literal here could disagree with the rule
the repository actually enforces. The three the door adds are named locally,
because that module does not own them.

The smoke harness now answers `GET /api/change/<n>` with `buildChangeView`
itself, over the same fixture repo. The panel's tabs under test are the shapes
the production reader really emits, which is the same rule the snapshot
fixture already followed.

Mutations: stamping the directory again, and dropping `file` from the row,
each turn two suites red.

## What this change hands on

Four tickets were opened for the facts this page states it cannot compute, so
each stated absence now names a ticket rather than ending the sentence:

- **#1068** — the served branch resolves to its epic. #967 made an epic
  declare its tracker; nothing reads the declaration in the other direction.
  It must never parse an epic out of a branch name.
- **#1069** — the port reads only OPEN pull requests. That costs `merged, not
  archived` AND a merged PR's whole review history, which disappears at the
  moment the decision it records becomes permanent.
- **#1070** — a PR whose branch is outside `^[a-z]+\/issue-(\d+)` joins to no
  ticket, silently. Measured here: PR #1050's `memory/<host>-<date>` branch
  joins to `null`, so its review rounds are reachable from no panel. The
  absence of a JOIN reads as the absence of REVIEWS.
- **#1071** — the panel never shows the file scope a ticket declares, though
  governance judges every diff against it.

T23 and T25 point at #1068 and #1069. T24 is #880 and T26 is #1032, both
already open.
