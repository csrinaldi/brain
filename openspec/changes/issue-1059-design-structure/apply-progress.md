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
