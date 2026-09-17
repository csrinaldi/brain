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

`lib/lane-model.mjs` MUST define `buildLaneModel(graphSection, {collapsedTracks, holdingPage})`, grouping every node by its declared track into `lanes` (sorted by track name), each laid out with its own `layout()` call over its own subgraph — a lane is a grouping, not a second layout engine, and `layout.mjs` MUST NOT be extended for it. A node with no declared track (`track === null`, including an unreadable one) MUST land in the `?` holding lane instead, never be dropped; the holding lane starts collapsed (`collapsedTracks` defaults to `Set(['?'])`) and pages its nodes at 24 per page. An edge MUST be classified exactly once, before any lane's own layout runs, into: internal to a lane (both endpoints share a track, passed to that lane's `layout()`), cross-lane (endpoints in different lanes, reported in `crossEdges` naming both tracks, never dropped and never passed to a layout call), or to an unknown node (reported in `droppedEdges`). Every node MUST carry `state: {code, label, mark}` from `state-vocab.mjs`'s `stateOf`, alongside its existing `marks`. `epicGrouping` MUST always be `{ok:false, reason:'kind and parent are not data yet (#967)'}` — `node.kind`/`node.parent` carry no data until #967 lands (proposal.md ruling 5). `app.js`'s `renderLanes` (replacing `renderCanvas`) MUST render one row per lane — a header with the track, its node count, and a `mark word × n` chip per state present — then that lane's own SVG board, then the `?` holding lane last: a header with a show/hide toggle, the exact `brain-graph/1` declare snippet in a `<pre>`, and 24 rows per page with prev/next while expanded. A cross-lane edge MUST be said as text under the lanes (`#a → #b crosses lanes X → Y`), never drawn as a line — lane boards do not share a coordinate space.

#### Scenario: the undeclared majority is never dropped
- **WHEN** 67 of 91 open issues declare no track
- **THEN** all 67 land in the `?` holding lane, which starts collapsed with its total visible, and every node still lands in exactly one lane or the holding lane

#### Scenario: a reversed edge stays inside its lane
- **WHEN** two nodes in the same track declare edges in both directions
- **THEN** the lane's own board keeps both edges, one marked `reversed`, and neither is reported as crossing lanes

#### Scenario: a cross-lane edge is reported, never drawn
- **WHEN** an edge's two endpoints declare different tracks
- **THEN** it is kept in `crossEdges` naming both tracks and appears nowhere in either lane's own `edges`; the page says it as text under the lanes, not as a line

#### Scenario: an edge to an unknown node is said, not swallowed
- **WHEN** an edge's `to` (or `from`) is not any node's number
- **THEN** it is reported in `droppedEdges` with reason `unknown node`

#### Scenario: epic grouping says it has no data yet
- **WHEN** `buildLaneModel` runs against any graph
- **THEN** `epicGrouping` is always `{ok:false, reason:'kind and parent are not data yet (#967)'}`, never a faked grouping

#### Scenario: the declare snippet is a real declaration
- **WHEN** the holding lane's `declareSnippet` is read back through `epic-graph.mjs`'s `parseGraphBlock`
- **THEN** it parses into a non-empty `track`, `blocks: []`, `needs: []`, `files: []` — the exact shape an author pastes to leave the `?` lane

#### Scenario: an empty holding lane says why
- **WHEN** every open issue declares a track
- **THEN** the `?` lane still exists, with `count: 0` and the note "every open issue declares a track" instead of a blank expanded area

#### Scenario: determinism under shuffled input
- **WHEN** the same graph is given twice with `nodes` and `edges` in different orders
- **THEN** `buildLaneModel` returns a byte-identical model both times

### R998-4: the SDD view

`status/snapshot.mjs`'s `readChanges` MUST list `openspec/changes/archive/<issue>` rows alongside the active `openspec/changes/<issue-N-slug>` ones, `archived: true`, same shape, plus a per-row `artefacts` map naming which of the seven stage files actually exist (asked directly, never filtered through the tier-scoped `missing` list — the SDD view always draws all seven, tier or no tier). A missing `archive/` dir is "no archived changes" (`exists()` checked before ever listing it); an archive dir that exists but cannot be listed is this whole section's reason, the same posture `CHANGES_ROOT` itself already has. `lib/sdd-model.mjs`'s `buildSddModel(changesSection, {tier})` MUST turn that section into one row per change with seven stage cells (`proposal, spec, design, tasks, apply, verify, archive`), each `present`, `missing`, `in-progress`, `done`, or `not-applicable` (`STAGE_VOCAB`: a mark plus a word, never a blank cell); a grandfathered change claims none of the seven ("the past is recorded, not edited" — `not-applicable` across all); an archived change's own `archived: true` IS its archive stage's fact, no `archive-report.md` required to prove it moved. The slice plan renders DECLARED SCOPE ONLY (proposal.md ruling: "PR state is not read") — a slice's claimed requirement ids and its terminal PR, nothing about whether that PR is open, merged, or exists. Phase order is evaluated as a local, pure restatement of `vcs/phase-order-check.mjs`'s Rule A intent (a later lifecycle artefact present while an earlier one is absent) rather than an import of that module, which is not browser-safe (D9: `node:child_process`/`node:fs` at module scope, and `sdd-model.mjs` is loaded directly by `app.js`). `app.js`'s `sdd` mode router draws this model — active changes first, archived ones under their own heading with their archive path — with every path rendered through `provenance.mjs`'s `sourceStamp`; `app.css` styles the matrix from the existing token block only.

#### Scenario: the archive reader lists both kinds of change dir
- **WHEN** `readChanges` runs against a tree carrying both active `openspec/changes/<issue-N-slug>` dirs and one `openspec/changes/archive/<issue>` dir
- **THEN** the returned rows include the archived one (`archived: true`, `dir` pointing at the archive path, `missing`/`tasks`/`artefacts` computed the same way), and every active row stays byte-identical to before

#### Scenario: a missing archive directory is a fact, not a failure
- **WHEN** `openspec/changes/archive/` does not exist at all
- **THEN** `readChanges` still succeeds, with zero archived rows — never an `uncomputable` section

#### Scenario: an unreadable archive directory fails the whole section
- **WHEN** `openspec/changes/archive/` exists but cannot be listed (a real I/O error, not absence)
- **THEN** `readChanges` returns `{ok:false, reason}` naming that failure — the same posture a failure to list `openspec/changes` itself already has

#### Scenario: seven stages, five words
- **WHEN** `buildSddModel` computes a change's stages
- **THEN** each of `proposal, spec, design, tasks, apply, verify, archive` is exactly one of `present`, `missing`, `in-progress`, `done`, or `not-applicable`, each with a mark and a word from `STAGE_VOCAB`

#### Scenario: a grandfathered change claims no stage
- **WHEN** `buildSddModel` computes a change whose `grandfathered` flag is `true`
- **THEN** all seven stages are `not-applicable`, and no phase-order violation is computed for it either — the past is recorded, not edited

#### Scenario: an archived change needs no archive-report.md to prove it moved
- **WHEN** `buildSddModel` computes a change with `archived: true`
- **THEN** its `archive` stage is `present`, sourced at the change's own (archive) `dir`, whether or not an `archive-report.md` file exists there

#### Scenario: a later artefact present while an earlier one is missing is named
- **WHEN** a change has `tasks.md` (and `design.md`) but no `spec.md`
- **THEN** `phaseOrder.violations` names `tasks` (and `design`) against the missing `spec` stage — and `vcs/phase-order-check.mjs`'s enforced `evaluatePhaseOrder` agrees the same configuration is a Rule A failure

#### Scenario: absence beyond the first stage present is not a violation
- **WHEN** a change has only `proposal.md`, nothing later
- **THEN** `phaseOrder.violations` is empty — every later stage is simply absent, not present out of order

#### Scenario: the slice plan never claims to know PR state
- **WHEN** a change's `tasks.md` carries a `brain-slice-scope/N` block
- **THEN** the model's `slices` entry carries the slice's claimed requirement ids and its terminal PR only — nothing about whether that PR is open, merged, or exists

### R998-5: the reviews timeline and the verdict queue

`status/snapshot.mjs`'s `reviewRows` MUST carry each verdict's `findings` as the shaped array `parseVerdict` already extracts (`{id, severity, evidenceExcerpt, cites, file, line}`, `evidence` truncated to its first 240 characters), never a count, plus a separate `findingCount`. `file`/`line` ARE real emitted fields — `verdict.mjs`'s `renderVerdict` posts them per finding when `hasUsableAnchor` holds (issue #405, REQ-405-2), measured directly on PR #1006's posted verdict (head e1c4aab3, a finding citing `brain/scripts/governance/run-check.mjs:556`); an earlier revision of this requirement read only the protocol prose and wrongly declared them absent. `line` is a non-negative integer parsed from its scalar; either field is `null` when the verdict carried no usable anchor for that finding. A verdict whose `findings:` block is malformed (`parseVerdict`'s `malformed` names it) keeps `findings: []` with the reason visible in `malformed`, never silently equal to "no findings were declared". `lib/review-timeline.mjs`'s `buildReviewTimeline(reviewsSection, prsSection, {issue?})` MUST turn the `{prs, reviews}` snapshot sections into `{threads, queue, totals}` — one thread per PR, its rounds oldest first, each round's findings grouped by severity (`bySeverity`, any severity string kept, never filtered against a closed vocabulary); a thread with zero rounds says so (`noRound: true`) rather than reading as approved; an unreadable thread is a row carrying its reason, never a skip. The queue holds only threads whose latest verdict is REVISE or which have no round at all — the two "waiting on a verdict right now" cases — ordered oldest-PR-first, each entry's `wait` naming the head sha that has no verdict, or the literal `'no round posted'` when there was never a round to name one from. `app.js`'s `reviews` mode router draws the queue first, then one card per PR thread with its rounds and findings; `lib/drawer-model.mjs`'s `reviewEntries` gains one child row per finding, each showing its severity, alongside the existing per-round entry.

#### Scenario: findings survive the round trip as an array, not a count
- **WHEN** `reviewRows` parses a verdict whose block carries two findings
- **THEN** the verdict's `findings` is a two-element array (`id`, `severity`, `evidenceExcerpt`, `cites`, `file`, `line` per entry) and `findingCount` is `2`

#### Scenario: a finding's own file:line anchor survives, when the verdict carried one
- **WHEN** a finding's block carries `file`/`line` (`hasUsableAnchor` held when the verdict was rendered)
- **THEN** the shaped finding carries both, `line` as a number; a finding without a usable anchor has both `null` — never dropped, never fabricated

#### Scenario: a malformed findings block is named, not silently empty
- **WHEN** a verdict's `findings:` block is unreadable (`parseVerdict` reports `malformed: ['findings']`)
- **THEN** `reviewRows` keeps `findings: []` and `malformed` still names `'findings'` — indistinguishable from "no findings" only if a reader ignores `malformed`

#### Scenario: a round's findings are grouped by severity, any value kept
- **WHEN** a round carries findings whose severities include one value outside the declared protocol vocabulary
- **THEN** `bySeverity` carries a count for that value too — an unknown severity is said, never dropped

#### Scenario: a thread with no round is distinct from an unreadable one
- **WHEN** a PR has posted zero verdicts (the reviews section is readable and simply has no rows for that PR)
- **THEN** its thread has `noRound: true` and an empty `rounds` array — never the same shape as a thread whose reviews could not be read at all

#### Scenario: an unreadable thread is a row with its reason
- **WHEN** a PR's review thread could not be read (`reviews.value` carries `{pr, ok:false, reason}` for it)
- **THEN** the thread appears with `unreadable: {reason}` and empty `rounds` — never skipped, never folded into "no round posted"

#### Scenario: the queue holds exactly the two waiting cases, oldest first
- **WHEN** the timeline has one thread with no round, one whose latest round is REVISE, one whose latest round is APPROVE, and one unreadable
- **THEN** the queue contains only the first two, ordered by ascending PR number, each carrying a `wait` (the no-round thread's `wait` is `'no round posted'`; the REVISE thread's `wait` is its latest round's head sha)

#### Scenario: the reviews tab shows a finding per row, with its severity and its own source when it has one
- **WHEN** the drawer's Reviews tab renders a round with findings
- **THEN** each finding is its own child entry naming its severity and id, its excerpt and `cites` in the detail, and its source — its own `{path: file, line}` anchor when the finding carried one, the round's own source otherwise (D14, `issue-881-ui-server-canvas/design.md:633`, is about a per-ROUND anchor to the underlying forge comment, which the provider does drop; it says nothing about a finding's own `file`/`line`, which the verdict body carries directly — R998-5's earlier text over-applied D14 to findings, corrected here)

### R998-6: the door's six tabs, the served branch, the countdown
Acceptance: six tabs each keeping its own reason on failure; the header names the branch served; the bands show the next poll.
