# Spec — issue-998: the Brain UI surface

One requirement per PR of the chain; R998-1 is detailed because it ships first, the others state their acceptance and are detailed when their PR starts (the design carries the shapes).

### R998-1: the state vocabulary, provenance and the token block

`lib/state-vocab.mjs` MUST map every node to `{code, label, mark, className}` for exactly the states the data can produce: `planned`, `in-flight`, `done`, `blocked`, `awaiting-review`, `undeclared` (code value `unclassified`), `unreadable`, `not-computed` (roadmap `ok:false`), `unknown` (the per-node guard's output), keeping `colour.mjs`'s priority order and its throw on an unmapped state. `lib/provenance.mjs` MUST own both provenance forms: `sourceLabel`, the plain form the current page shows beside every value (`<path>:<line>`, `<path>`, the URL, or the sentence for a missing source), unchanged so today's drawer stays byte-identical; and `sourceStamp`, the design's stamp for the redesigned screens (PRs 2–6): `[repo: <path>:<line>]`, `[repo: <path>]`, `[forge: #<n>]` with the URL kept for the chip, `[git: <sha7>]`, `[link: <url>]` for any other https URL, and the sentence in brackets for a missing source; only an https URL ever becomes an href. (Amended 2026-09-17 after the cold review of PR 1: the first wording named one function for both forms.) `stateOf` MUST return the data's word as `code` and the screen's word as `label`: `unclassified` is shown as `Undeclared` (ruling 5). `app.css` MUST define a token per state (`--state-<code>-fg`, `--state-<code>-bg`), surfaces and text with the light values on bare `:root` and the design's dark values under `@media (prefers-color-scheme: dark)`, and the font stacks `--font-sans` / `--font-mono` as system stacks. No file under `static/` or `lib/` MAY reference an external URL.

#### Scenario: every state has a word, a mark and a class
- **WHEN** `stateOf(node)` is called for each of the nine codes
- **THEN** it returns a distinct `code`, a non-empty `label` and `mark`, and a `className` that exists as a `--state-<code>-*` token pair in `app.css`

#### Scenario: not computed is not unknown
- **WHEN** a node's roadmap is `{ok:false}` and another node's status is unmapped
- **THEN** the first is `not-computed` and the second throws, and the renderer's guard renders it `unknown`; the two classes differ

#### Scenario: provenance forms
- **WHEN** `sourceStamp` receives `{path:'a/b.md', line: 42}`, `{path:'a/b.md'}`, `{url:'https://github.com/o/r/issues/881'}`, `{sha:'4f9a2e1c9'}`, `{}`
- **THEN** it returns `[repo: a/b.md:42]`, `[repo: a/b.md]`, `[forge: #881]` with the URL kept, `[git: 4f9a2e1]`, and the "no source was recorded" sentence in brackets; and `sourceLabel` on the same inputs returns the plain forms the current page shows

#### Scenario: light is the base, dark is the media query, no external resource
- **WHEN** `app.css` and `index.html` are scanned
- **THEN** every token defined under `prefers-color-scheme: dark` is also defined on bare `:root`, no `http://` or `https://` reference exists, and the font stacks name no downloadable face

### R998-2: four modes, a router, keyboard

`lib/view-model.mjs` MUST define the four modes in a fixed order — `map`
("Map & tracks"), `sdd` ("SDD & slices"), `reviews` ("Reviews"), `governance`
("Governance") — and MUST expose `initialView()` (starts on `map`),
`switchMode(view, mode)` (validates the target, throws on an unmapped
mode), `nextMode(view)` (the mode `Tab` cycles to, wrapping past
`governance` back to `map`), and `keyAction(view, key, {nodes, selected})`,
which turns a keystroke into `{type: 'mode'|'select'|'close'|'none', ...}`
without touching the DOM. Only `map` renders real content in this PR;
`sdd`, `reviews` and `governance` render the said sentence naming the PR
that brings them (4, 5, 7 respectively) instead of an empty area.
`static/index.html` MUST mount a `<nav id="modes" aria-label="Modes">`
between the status bar and the degradation bands, and `app.js` MUST render
its buttons from the view model (no inline handler) with
`aria-current="page"` on the active one. `app.js` MUST attach one
`keydown` listener on `document` that routes through `keyAction`, ignoring
any Cmd/Ctrl/Alt combination and any keystroke while an input is focused.
The door's entries render `sourceStamp(source).label`, with an
`<a rel="noopener noreferrer" target="_blank">` chip when the stamp
carries an `href`; the tab-level source keeps the plain `sourceLabel`.
`static/views-owned.test.mjs` (replacing `no-management-views.test.mjs`,
whose name and `nav` prohibition no longer describe a page that has a
nav) enumerates the four modes, the placeholder sentences, and the mount
ids this PR owns.

#### Scenario: Tab cycles the four modes and wraps
- **WHEN** `Tab` fires four times starting from `map`
- **THEN** the view visits `sdd`, `reviews`, `governance` and returns to `map`

#### Scenario: only map has content, the rest say which PR brings them
- **WHEN** the router draws `sdd`, `reviews`, or `governance`
- **THEN** it renders the said sentence naming PR 4, PR 5, or PR 7 respectively, never an empty area

#### Scenario: J/K traverse the drawn nodes in reading order and wrap
- **WHEN** `j` or `k` fires with 0, 1, or many nodes drawn, with the selection at the first, the last, or none
- **THEN** it selects the next/previous node in reading order (top-to-bottom, left-to-right), wrapping at either end instead of stopping silently, and does nothing on an empty canvas

#### Scenario: Escape closes only what is open
- **WHEN** `Escape` fires with a node selected, and again with none selected
- **THEN** the first closes the door; the second is a no-op

#### Scenario: an unknown mode throws, an unknown key is a no-op
- **WHEN** `switchMode` or `nextMode` receives a mode this table does not know, and when `keyAction` receives an unmapped key
- **THEN** the first two throw and the third returns `{type: 'none'}`

#### Scenario: the absence proof enumerates this PR's own views
- **WHEN** `views-owned.test.mjs` scans `app.js` and `index.html`
- **THEN** it finds exactly the four modes and their placeholders, the five mount ids (`banners, canvas, drawer, modes, status`), the same four endpoints, and no management-view data identifier — while `nav`, `modes` and `Governance` are allowed as labels this PR does draw

### R998-3: track lanes and the `?` holding lane
Acceptance: no node is filtered; the undeclared render in a collapsed lane with a visible total and the declare snippet; epic grouping says "not data yet" until #967.

### R998-4: the SDD view
Acceptance: seven stages per change, phase-order violations named, grandfathered changes claim no stage, archived changes appear with their archive path.

### R998-5: the reviews timeline and the verdict queue
Acceptance: a round shows its findings with severity and the text it cites; an unreadable thread is a row with its reason; a PR with no verdict says "no round posted".

### R998-6: the door's six tabs, the served branch, the countdown
Acceptance: six tabs each keeping its own reason on failure; the header names the branch served; the bands show the next poll.
