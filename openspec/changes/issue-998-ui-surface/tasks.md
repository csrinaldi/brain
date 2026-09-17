# Tasks — issue-998: the Brain UI surface

Delivery: feature-branch-chain on the tracker `feature/issue-998-ui-surface` (created from `main` on 2026-09-16); PR n targets the tracker once PR n−1 is merged into it; the tracker merges to `main` with `size:exception` when the six PRs are in. Terminal PR: the tracker → main. Every PR: red test first, one mutation per unit, a fresh-context review before push, a posted cold-review APPROVE.

## PR 1 — state vocabulary, provenance, tokens (R998-1)

```brain-slice-scope/1
{"slice": 1, "claims": ["R998-1"], "files": ["brain/scripts/ui/lib/state-vocab.mjs", "brain/scripts/ui/lib/provenance.mjs", "brain/scripts/ui/lib/colour.mjs", "brain/scripts/ui/lib/drawer-model.mjs", "brain/scripts/ui/static/app.css", "brain/scripts/ui/static/index.html"], "terminal_pr": "the tracker feature/issue-998-ui-surface -> main"}
```

- [x] T1a. `lib/state-vocab.test.mjs`: the exhaustive matrix over the nine codes (label, mark, className), priority order, the throw on an unmapped state, `not-computed` ≠ `unknown`. RED.
- [x] T1b. `lib/state-vocab.mjs`: `stateOf(node)`; `colour.mjs` delegates to it (one table). Mutation: swap two priorities → red.
- [x] T2a. `lib/provenance.test.mjs` retargeted: the five forms; the property test over every shaper kept. RED.
- [x] T2b. `lib/provenance.mjs`: `sourceLabel`; `drawer-model.mjs` imports it. Mutation: raw URL instead of `[forge: #n]` → red.
- [x] T3a. `static/tokens.test.mjs`: every `--state-<code>-fg/bg` for every exported code; every dark token also on bare `:root`; no external URL in `app.css`/`index.html`; system font stacks. RED.
- [x] T3b. `static/app.css`: the token block; existing classes re-pointed; light values unchanged. Mutation: delete one state token → red.
- [x] T4. `lib/source-guard.test.mjs` / `static/app-source-guard.test.mjs`: the `innerHTML` assertion (if absent).
- [x] T5. `GIT_CONFIG_GLOBAL=/dev/null npm test` and `npm run brain:repo:check` green; counted diff under 1000.
- [ ] T6. `npm run memory:save -- "<title>" "<content>" --issue 998 --type decision`; stage only the record and `.memory/index.jsonl`.

## PR 2 — view model, nav, router, keyboard (R998-2)

```brain-slice-scope/2
{"slice": 2, "claims": ["R998-2"], "files": ["brain/scripts/ui/lib/view-model.mjs", "brain/scripts/ui/lib/drawer-model.mjs", "brain/scripts/ui/lib/provenance.mjs", "brain/scripts/ui/static/app.js", "brain/scripts/ui/static/index.html", "brain/scripts/ui/static/app.css"], "terminal_pr": "the tracker feature/issue-998-ui-surface -> main"}
```

- [x] T1a. `lib/view-model.test.mjs`: the four modes in order; the fixture matrix (0/1/many nodes, selected at the first/last/none) for `j`/`k`; `Tab`'s cycle and wrap; `Escape` with and without a selection; an unknown key → `none`; an unknown mode → throws. RED.
- [x] T1b. `lib/view-model.mjs`: `MODES`, `PLACEHOLDERS`, `initialView`, `switchMode`, `nextMode`, `keyAction`. Mutation: `Tab` not wrapping past `governance` → red.
- [x] T2. `static/index.html`: the `<nav id="modes" aria-label="Modes">` mount between the status bar and the banners. `static/app.js`: `renderModes` draws the four mode buttons from the view model with `aria-current="page"` on the active one; `render()` routes `map` to the existing canvas+drawer and the other three to the placeholder sentence. `static/views-owned.test.mjs` replaces `no-management-views.test.mjs` (rewritten in the same commit: the mount-id pin and the `nav` prohibition no longer describe a page that now has a nav). Mutation: the mount-id pin without `modes` → red.
- [x] T3. `app.js`: one `document` `keydown` listener routing through `keyAction`, skipping Cmd/Ctrl/Alt and any keystroke inside an input. No DOM harness exists (D9); verified by trace against `view-model.test.mjs`'s already-covered `keyAction` contract.
- [x] T4a. `lib/drawer-model.test.mjs` extended: every entry carries a `sourceStamp` alongside the unchanged `source` string. RED.
- [x] T4b. `lib/drawer-model.mjs`: `entry()` also stamps via `provenance.mjs`'s `sourceStamp`; `app.js`'s `renderEntry` shows the stamp's label and an `<a rel="noopener noreferrer" target="_blank">` chip when it carries an `href`. Mutation: drop the `https`-only href guard → red.
- [x] T5. `GIT_CONFIG_GLOBAL=/dev/null npm test` (5612/0) and `npm run brain:repo:check` green; counted diff 231/400.
- [ ] T6. `npm run memory:save -- "<title>" "<content>" --issue 998 --type decision`; stage only the record and `.memory/index.jsonl`.

## PR 3 — lane model and the `?` holding lane (R998-3)

```brain-slice-scope/3
{"slice": 3, "claims": ["R998-3"], "files": ["brain/scripts/ui/lib/lane-model.mjs", "brain/scripts/ui/static/app.js", "brain/scripts/ui/static/app.css"], "terminal_pr": "the tracker feature/issue-998-ui-surface -> main"}
```

- [x] T1a. `lib/lane-model.test.mjs`: the undeclared majority (67 of 91) lands in the `?` holding lane, collapsed by default, with a visible total; the holding lane pages at 24; a reversed edge inside a lane is kept and never treated as leaving it; a cross-lane edge is never dropped, reported with both lanes named; an edge to an unknown node is reported; every node carries a `state` word/mark alongside its existing `marks`; `epicGrouping.ok === false` with the reason; the declare snippet parses with `epic-graph.mjs`'s `parseGraphBlock`; a lane with zero nodes does not exist; the `?` lane with zero nodes says "every open issue declares a track"; the same graph shuffled (nodes and edges) gives a byte-identical model. RED (`ERR_MODULE_NOT_FOUND`).
- [x] T1b. `lib/lane-model.mjs`: `buildLaneModel(graphSection, {collapsedTracks, holdingPage})` groups nodes by declared track into lanes, each laid out via its own `layout()` call over its own subgraph; undeclared/unreadable nodes (`track === null`) land in the `?` holding lane instead. Edges are classified once over the whole graph into per-lane, cross-lane, or unknown-node buckets before any lane's own `layout()` runs. `epicGrouping` always says "not data yet (#967)". GREEN 12/12. Mutation: dropping the first holding-lane node after sorting → the exactly-once count test and the paging test red (10/12); reverted.
- [x] T2. `static/app.js`: `renderCanvas` becomes `renderLanes` — one row per lane (header with count and state chips, then that lane's own SVG board), then the `?` holding lane (header with a show/hide toggle, the declare snippet in a `<pre>`, 24 rows per page with prev/next). Cross-lane edges are said as a list under the lanes, never drawn as a line (lanes do not share a coordinate space). `drawnNodes()` (the R998-2 keyboard traversal) now walks every lane's board nodes, folding each lane's row index into a large `y` offset so reading order stays correct across stacked rows; the holding lane's paged rows are excluded (no board coordinates). `static/app.css`: lane row/header/chip/holding styles, from the existing token block. RED/GREEN: N/A — no DOM harness (D9), matching R998-2's own keyboard-listener precedent; verified by trace against `lane-model.test.mjs`'s already-covered contract. `views-owned.test.mjs` (18) and `app-source-guard.test.mjs` stayed green — 44/44 across views-owned/app-source-guard/lane-model/view-model/canvas-model.
- [x] T3. `GIT_CONFIG_GLOBAL=/dev/null npm test` and `npm run brain:repo:check` green; counted diff 395/400.
- [x] T4. `npm run memory:save -- "<title>" "<content>" --issue 998 --type decision`; stage only the record and `.memory/index.jsonl`.

## PR 4 — the SDD view and the archive reader (R998-4)

```brain-slice-scope/4
{"slice": 4, "claims": ["R998-4"], "files": ["brain/scripts/ui/lib/sdd-model.mjs", "brain/scripts/status/snapshot.mjs", "brain/scripts/ui/lib/view-model.mjs", "brain/scripts/ui/static/app.js", "brain/scripts/ui/static/app.css"], "terminal_pr": "the tracker feature/issue-998-ui-surface -> main"}
```

- [x] T1a. `status/snapshot.test.mjs` extended: `readChanges` also lists `openspec/changes/archive/<issue>` rows (`archived: true`, same shape, plus a new per-row `artefacts{}` presence map); active rows stay byte-identical (filtered assertion); a missing `archive/` dir is "no archived changes"; an archive dir that exists but cannot be listed is the whole section's reason. `brain/scripts/__fixtures__/snapshot-tree.mjs` gains one archived change (`openspec/changes/archive/9`, every artefact present, every task checked). RED (2 assertions on the not-yet-existing archive row).
- [x] T1b. `status/snapshot.mjs`: `readChanges` lists `openspec/changes/archive/` (checked via `exists()` before ever listing it — a missing dir is a fact, not an error) alongside the active dirs, through a shared `readOneChange` helper; each row's new `artefacts{}` asks the seven stage files' raw presence directly (not filtered through the tier-scoped `missing` list, since the SDD matrix always draws all seven). GREEN 17/17 across `snapshot.test.mjs`/`snapshot-cli.test.mjs`. Mutation: dropping the archived rows from the returned array → red (13/14); reverted.
- [x] T2a. `ui/lib/sdd-model.test.mjs`: a change with every artefact; one with only proposal; tasks half ticked (in-progress, not done); a grandfathered change (not-applicable across all seven, "the past is recorded, not edited"); an archived change (its own `archived: true` is the archive stage's fact, no `archive-report.md` required); a phase-order violation (tasks present without spec, agreeing with `vcs/phase-order-check.mjs`'s `evaluatePhaseOrder` on a shared fixture); totals; determinism under shuffle. RED (`ERR_MODULE_NOT_FOUND`).
- [x] T2b. `ui/lib/sdd-model.mjs`: `buildSddModel(changesSection, {tier})` — seven stages (`proposal/spec/design/tasks/apply/verify/archive`) each `present/missing/in-progress/done/not-applicable` (`STAGE_VOCAB`: mark + word), the task count, the slice plan as DECLARED SCOPE ONLY (`claims` + `terminalPr`, "PR state is not read" — `sliceScopes` carries no PR state to read), and named phase-order violations — a local, pure restatement of `phase-order-check.mjs`'s Rule A intent (not an import: that module is not browser-safe, D9). GREEN 11/11. Mutation: the phase-order violation push guarded by `if (false)` instead of `if (firstMissing !== null)` → red (8/11); reverted.
- [x] T2c. The stage-array drift guard (`lib/sdd-layout.test.mjs`) correctly caught `sdd-model.mjs`'s local `LIFECYCLE_ORDER` literal as a bare-name rival of `LIFECYCLE_STAGES`; added a REVIEWED allowlist entry stating the D9 reason, exported `LIFECYCLE_ORDER`, and pinned it equal to `LIFECYCLE_STAGES` with a new test.
- [x] T3. `ui/lib/view-model.mjs`: `PLACEHOLDERS.sdd` is now `null`, alongside `map`. `ui/static/app.js`: the router special-cases `view === 'sdd'` before the generic placeholder branch, rendering `buildSddModel`'s output — active changes first, archived ones under their own heading with their archive path, each row's seven stage cells, task count, slice plan, and named phase-order violations; every path renders through `provenance.mjs`'s `sourceStamp`. `ui/static/app.css`: the matrix's rules from the existing token block only. `views-owned.test.mjs`/`view-model.test.mjs` updated (map and sdd both have real content now). RED: `PLACEHOLDERS.sdd` asserted `null` while still the PR-4 sentence (2 failures) → GREEN 55/55 across `app-source-guard`/`views-owned`/`view-model`/`sdd-model`/`lane-model`/`canvas-model`. Mutation: `PLACEHOLDERS.sdd` set back to a placeholder string → red (15/17); reverted. `renderSdd()`/`renderSddRow()` themselves: RED/GREEN N/A — no DOM harness (D9), same precedent as R998-2/R998-3; verified by trace against `sdd-model.test.mjs`'s already-covered contract.
- [x] T4. `GIT_CONFIG_GLOBAL=/dev/null npm test` (5639/0; baseline 5624/0) and `npm run brain:repo:check` green; counted diff 371/400.
- [ ] T5. `npm run memory:save -- "<title>" "<content>" --issue 998 --type decision`; stage only the record and `.memory/index.jsonl`.

## PR 5 — findings per verdict, the reviews timeline, the queue (R998-5)
- [ ] Detailed when the PR starts (files: `brain/scripts/status/snapshot.mjs`, `lib/review-timeline.mjs`, `lib/drawer-model.mjs`, `static/app.js`).

## PR 6 — the door's six tabs, the served branch, the countdown (R998-6)
- [ ] Detailed when the PR starts (files: `brain/scripts/ui/change-route.mjs`, `brain/scripts/ui/server.mjs`, `brain/scripts/ui/poller.mjs`, `lib/banners.mjs`, `static/app.js`).

## Review Workload Forecast
Estimated changed lines: ~1900 counted across six PRs (PR 1 ≈330, PR 2 ≈300, PR 3 ≈380, PR 4 ≈360, PR 5 ≈340, PR 6 ≈300); each under the tier's 1000
400-line budget risk: Low per PR (each planned under 400); the tracker to main exceeds it by design under size:exception
Chained PRs recommended: Yes
Decision needed before apply: No

## Out of scope
The governance view (#882), the epic lanes' data (#967), review rounds as records (#880), the forge identity from `--root` (#981), a browser test runner, any write surface, tier 2 (#883), telemetry (#884).
