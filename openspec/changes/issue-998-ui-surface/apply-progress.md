# Apply progress — issue-998: the Brain UI surface

## PR 1 — state vocabulary, provenance, tokens (2026-09-16, applied inline by the orchestrator: the sub-agent models were rate-limited)

Commits on `feat/issue-998-featui-the-brain-ui-surface-per-the-desi` off `origin/feature/issue-998-ui-surface` (4d47e2f9 = main):

| sha | unit | RED → GREEN | mutation |
|---|---|---|---|
| b43ab2e0 | the change dir: proposal (the issue), design (the map's sections 2–5), spec (R998-1 detailed, R998-2..6 by acceptance), tasks | — | — |
| 59dbf65f | `lib/state-vocab.mjs`: nine states as code + word + mark + class in colour.mjs's priority; `colour.mjs` becomes the class-only view of the same table | ERR_MODULE_NOT_FOUND → 18/18 across state-vocab, colour, canvas-model | swapping the blocked and not-computed priorities → the priority test red |
| 1d5080e1 | `lib/provenance.mjs`: `sourceLabel` moved (plain form kept, drawer-model re-exports), `sourceStamp` renders `[repo: path:line]`, `[forge: #n]` with the href, `[git: sha7]`, `[link: url]`; only https becomes an href | ERR_MODULE_NOT_FOUND → 22/22 across provenance, drawer-model, source-guard | the raw URL instead of the forge stamp → the stamp test red |
| 74ce22dd | `static/app.css`: the token block on bare `:root` with the page's previous colours (light is the base), the design's dark palette under `prefers-color-scheme: dark` redefining only those names, `--font-sans`/`--font-mono` system stacks, node rules re-pointed | 0/3 → 13/13 across tokens, app-source-guard, state-vocab | deleting one state token → two token tests red |
| 771b9eee | `static/app-source-guard.test.mjs`: no `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` in `app.js` | green on today's page (an absence guard) | injecting an innerHTML assignment → red |

Full suite under `GIT_CONFIG_GLOBAL=/dev/null`: see the PR body for the count (tracker baseline: main at 4d47e2f9). `npm run brain:repo:check` green before every commit. Counted diff: see the PR body.

### Deviations from the plan, said
- The spec's R998-1 text says `sourceLabel` renders the stamp forms. It does not: `sourceLabel` keeps the plain form the current page shows beside every value (six drawer-model assertions pin it), and the stamp forms live in `sourceStamp`, which PRs 2–6 use for the redesigned screens. Amended in this batch after the cold review of PR 1 (judgment:cold-1): R998-1 now names both functions.
- `[link: url]` is a fifth form for an https URL that is not a forge issue or PR (the design named only three); a `javascript:` URL stays text with no href.
- The `unknown` state's class is the renderer's existing `node-unknown`; its mark `✕` is not from the design's table (which has no unknown row).

### Carried
- PR 2 renders `sourceStamp` on the new screens and amends R998-1's wording.
- The design's `APPROVED` / `REVISE` rows are round verdicts, not node states (ruling 2): the timeline in PR 5 owns them; state-vocab has no such codes on purpose.

### Cold review of PR 1 (#1001, head 95fd27cc): REVISE → fixed
- cold-1 (blocker): the spec said `sourceLabel` renders the stamps; the code keeps the plain form there and renders the stamps in `sourceStamp`. The spec was the defect: R998-1 amended to name both.
- cold-2 (blocker): `stateOf` returned `code: 'undeclared'`; ruling 5 keeps `unclassified` as the code value and `Undeclared` as the label. Fixed with a test that pins code and label apart; the token names follow the code (`--state-unclassified-*`).
- cold-3 (correction): the drawer and other surfaces hard-coded `#fff`; every surface now reads `var(--surface)`, pinned by a test that finds no literal white outside the token block.

## PR 2 — view model, nav, router, keyboard (2026-09-17)

Branch `feat/issue-998-pr2-views` off `df780d60` (PR 1, approved as #1001, pending merge into the tracker `feature/issue-998-ui-surface`):

| sha | unit | RED → GREEN | mutation |
|---|---|---|---|
| b22be65e | docs: tasks.md T1-T6 + R998-2's detailed scenarios in spec.md | — | — |
| d5c40ddf | `lib/view-model.mjs`: `MODES` (map, sdd, reviews, governance), `PLACEHOLDERS` naming PR 4/5/7, `initialView`/`switchMode`/`nextMode`, `keyAction(view, key, {nodes, selected})` — Tab cycles+wraps, Escape closes only with a selection, j/k traverse in reading order and wrap at both ends | ERR_MODULE_NOT_FOUND → 10/10 | `nextMode`'s `% length` dropped → the Tab-cycle test red (9/10) |
| ebbb5122 | the `<nav id="modes">` mount (`index.html`) + `render()`'s mode router (`app.js`): `map` draws the existing canvas+drawer, the other three draw the placeholder `said()` sentence; `no-management-views.test.mjs` replaced by `views-owned.test.mjs` (its name and blanket `\bnav\b` prohibition no longer describe a page that now has one) | 2/7 (`#modes` missing, only 4 mount ids) → 18/18 across views-owned/app-source-guard/tokens | the 5-mount-id pin reverted to 4 → red (6/7) |
| 9be6c2e8 | one `document` `keydown` listener wired through `keyAction`, skipping Cmd/Ctrl/Alt and any keystroke inside an input/textarea/contentEditable | N/A — no DOM harness (D9); the decision logic (`keyAction`) is already covered 10/10 by `view-model.test.mjs`; 24/24 across views-owned/app-source-guard/view-model stayed green | N/A, same reason |
| b1c53541 | stamps in the door: `drawer-model.mjs`'s `entry()` adds `sourceStamp` alongside the unchanged `source` string (additive — R998-1's byte-identical page stays byte-identical); `app.js`'s `renderEntry` shows the stamp's label and an `<a rel="noopener noreferrer" target="_blank">` chip when it carries an href | 2/14 (`sourceStamp` missing) → 42/42 across drawer-model/views-owned/app-source-guard/tokens/view-model | `entry()` stamps `sourceStamp(null)` instead of `sourceStamp(source)` → 2/14 red |

Full suite under `GIT_CONFIG_GLOBAL=/dev/null`: 5612/0 (PR 1 left it at 5611/0; net +11 view-model, +2 drawer-model, +7 views-owned, −5 no-management-views removed, plus each file's own subtests). `npm run brain:repo:check` green before every commit. Counted diff `df780d60...HEAD` (tests and `openspec/changes/**` excluded): 231/400.

### Deviations from the design/tasks sketch, said
- `design.md`'s "Component → module map" row for the nav/router (`{view, snapshot, selectedIssue} -> {views:[{id,label,badge,ok,reason}], active}`) is a stale sketch predating the detailed R998-2 acceptance this batch implements against; no badge/ok/reason shape exists anywhere in this PR. The shipped shape is simpler: a view IS the current mode id, and `keyAction` is the only thing that turns a keystroke into an action.
- The slice-scope file list grew from the design's four files (`view-model.mjs`, `app.js`, `index.html`, `views-owned.test.mjs`) to also touch `drawer-model.mjs`, `provenance.mjs` (import only, unchanged) and `app.css`: rendering `sourceStamp` per entry needed the raw source carried alongside the existing plain label, and the nav + chip needed a few style rules. Both are additive, non-breaking changes to files `design.md` did not list for this PR but did already assign to PR 1 (`provenance.mjs`) or a later PR's extension (`drawer-model.mjs`); no existing consumer's shape changed.
- `nav mount + router` and `the owned-views guard` were shipped as one commit, not two: splitting them would have left an intermediate commit with `no-management-views.test.mjs`'s mount-id pin failing on the page's own new markup — not a commit that "still makes sense" on its own (work-unit-commits checklist).
- The `keyboard` work unit has no RED/GREEN/mutation of its own: this repo has no DOM test harness (D9) and the pure decision logic it wires (`keyAction`) is already fully covered by `view-model.test.mjs`. Stated as `N/A` rather than fabricated.

### Carried
- `sdd`, `reviews`, `governance` render only the placeholder sentence this PR ships (naming PR 4, 5, 7); their real content is out of scope here.
- The governance mode's content (the management views of #882) stays out of scope per `tasks.md`; only the tab and its placeholder exist.
- `drawer-model.mjs`'s `TAB_IDS` growing a fifth tab (`sdd`) and `reviewEntries` gaining `findings[]`/`severity` are PR 5/6's work per the design's module map; untouched here.

### Fresh review of PR 2 before push: REVISE → fixed
- Major: the active mode button hard-coded `#eef1f8`, illegible in dark. A `--surface-active` token (light and dark) replaces it, and the token test now forbids ANY colour literal outside the token block, not only white.
- Warning: `.memory/index.jsonl` gained two lines: this PR's record and `rec-deaea7613…` (issue #955), a record file already on the tracker that its index had never listed; `memory:save` re-indexed it. Kept: an index that lists every record on disk is the correct state; noted here rather than reverted.
- Minor: T6 was done but unticked; ticked.
## PR 3 — track lanes and the `?` holding lane (2026-09-17)

Branch `feat/issue-998-pr3-lanes` off 998e7369 (PR 2). Commits: fe590bb0 `lib/lane-model.mjs` + test (RED ERR_MODULE_NOT_FOUND → GREEN 12/12; mutation: dropping the first holding-lane node turns the exactly-once and paging tests red); 834a1cba `renderCanvas` becomes `renderLanes`, lane styles from tokens (no DOM harness: verified by trace against the model's contract, 44/44 across the ui guards); 5774365d tasks ticked and R998-3 scenarios; ab9eee9f + 25b1d6b2 the memory record `rec-a6ba1a6a6fe52dd3`. Full suite 5624/0; counted diff 395 (the map planned 380; the lite budget is 1000).

Deviations, said: `width`/`height` are per lane (independent rows, no shared coordinate space); `buildLaneModel` takes `{collapsedTracks, holdingPage}` (the paging needed a home); `canvas-model.mjs` is no longer imported by `app.js` and stays only for its own test — dead code to remove in PR 8 or a follow-up, not silently.

Fresh review before push: APPROVE. Its warning that this section was missing from the file is what this section closes; its second warning (the dead module) is the carry above; its suggestion (`holdingPage` clamps silently in both directions) is left as is: spec-conformant, said here.

### Cold review of PR 3 (#1005): REVISE → fixed

- blocker: measured with `buildLaneModel` on two known nodes whose track is null and one edge `{from:1,to:2}` — the returned model had `holding.count=2`, `lanes=[]`, `crossEdges=[]`, `droppedEdges=[]`: the edge landed in no bucket and was not said anywhere (`lane-model.mjs:142`, the `if (fromTrack == null) continue;` branch for same-track null/null edges). R998-3 says every edge is classified exactly once into internal, cross-lane, or unknown-node; this branch silently skipped the case where both endpoints are undeclared.

Fix (`c7aab45`): the holding lane is now a lane for edge classification too. An edge between two holding nodes is internal to the holding lane — collected into `holdingEdges`, filtered to the current page's node numbers, laid out with one `layout()` call over that page's own subgraph (mirroring how a track lane lays itself out), and exposed as `holding.edges` (with `holding.boardNodes`/`width`/`height` alongside it) plus a page-independent `holding.edgeCount` for the collapsed header. An edge between a holding node and a declared-track node was already routed into `crossEdges` with `fromTrack ?? '?'` (pre-existing, unaffected). `value.edgeSummary = {laneInternal, holdingInternal, crossLane, unknownNode, total}` is the classification invariant made visible: `total` is the sum of the four, which must equal the input edge count.

RED → GREEN: added three tests to `lane-model.test.mjs` — the measured case (`holding.edges.length === 1`, `edgeSummary` deep-equal to `{laneInternal:0, holdingInternal:1, crossLane:0, unknownNode:0, total:1}`); a holding→track edge (`crossEdges` names `?`/`A`, `edgeSummary.crossLane === 1`); an `edgeSummary` assertion added to the existing 91-node fixture test (sums to 0, its edge count). RED 11/14 → GREEN 14/14. Mutation: reverted the fix (`if (fromTrack == null) { continue; }`, dropping the `holdingEdges.push`) → 13/14, the measured-case test red; reverted back to GREEN 14/14.

`app.js` (untested — no DOM harness, D9, same precedent as PR2/PR3's other render changes, verified by trace against the now-covered model contract): the holding lane's collapsed header shows `holding.edgeCount`; expanded, a board section draws `holding.edges` via the same `renderLaneBoard` a track lane uses, fed `holding.boardNodes`/`width`/`height`; the map's summary line gained a second `<p class="edge-summary">` saying all four `edgeSummary` counts and the total.

Verification: `lane-model.test.mjs` alone 3× GREEN (14/14 each run); the full UI glob (`brain/scripts/ui/**/*.test.mjs` `brain/scripts/ui/*.test.mjs`) 3× GREEN (251/251 each run); `npm run brain:repo:check` green; full suite `GIT_CONFIG_GLOBAL=/dev/null npm test` 5626/0 (was 5624/0, +2 new tests). Counted diff `origin/feature/issue-998-ui-surface...HEAD` (the whole PR3, excluding `*.test.mjs`/`openspec/`/`.memory/`): 437 (was 395 before this round; the lite budget is 1000).

Deviation from the review's literal ask, said: the review's prose named `holding.edges` without specifying whether it is scoped to the current page or the whole holding set. It is scoped to the current page (`holding.edgeCount` carries the full total instead) — the same page-boundary a track lane's own `layout()` call respects, and the only board coordinates this model has computed for holding nodes; laying every page's edges out in one shared space would need a `holdingPage`-independent coordinate space this model does not have and R998-3 never asked for.
## PR 4 — the SDD view and the archive reader (R998-4) (2026-09-17)

Branch `feat/issue-998-pr4-sdd` off `25b1d6b2` (PR 3 of #998, under review):

| sha | unit | RED → GREEN | mutation |
|---|---|---|---|
| 0f51b9a1 | `status/snapshot.mjs`: `readChanges` also lists `openspec/changes/archive/<issue>` rows (`archived: true`, same shape as the active rows, plus a new per-row `artefacts{}` map) through a shared `readOneChange` helper | RED → 17/17 | dropping the archived rows from the returned array → red (13/14) |
| 7e128e7f | `lib/sdd-model.mjs` + test: `buildSddModel(changesSection, {tier})` — seven stages each present/missing/in-progress/done/not-applicable, task count, slice plan (DECLARED SCOPE ONLY), named phase-order violations | RED → 11/11 | reverted |
| 681a1037 | `lib/view-model.mjs`/`static/app.js`/`static/app.css`: the sdd view router branch renders `buildSddModel`'s output | RED 2 failures → GREEN 55/55 | reverted; `renderSdd()`/`renderSddRow()` themselves: N/A (D9) |
| 46053526 | fix: stage-array drift guard allowlist entry for `sdd-model.mjs`'s local `LIFECYCLE_ORDER`, pinned equal to `sdd-layout.mjs`'s `LIFECYCLE_STAGES` | — | — |
| a3cacf3f | docs: tasks.md T1-T4 ticked + R998-4's nine scenarios | — | — |
| fe9a9878 / 072c0861 | memory record; tasks T5 ticked | — | — |

Full suite `GIT_CONFIG_GLOBAL=/dev/null npm test`: 5639/0 (PR 3 left it at 5624/0; +15 new tests). `npm run brain:repo:check` green before every commit. Counted diff `25b1d6b2...HEAD` (tests, `openspec/changes/**` excluded): 371/400.

### Deviations from the design/tasks sketch, said
- Slice rows carry `claims`, not `files`: `sdd-layout.mjs`'s `parseSliceScopes` validates and keeps `slice`/`claims`/`terminal_pr` from the `brain-slice-scope/N` block — `claims` is what a reviewer judges a slice against, and what survives the parse.
- Only issue-numbered `archive/<issue>` dirs become rows — the pre-convention dated-slug and named archive dirs this repo still carries are not eligible (said explicitly in `snapshot.mjs`'s `ARCHIVE_ID_RE` comment; the review round below turns "not eligible" into "not silently dropped").
- `sdd-model.mjs` restates `LIFECYCLE_ORDER` as a local literal rather than importing `sdd-layout.mjs`'s `LIFECYCLE_STAGES` (D9: that module reads `node:fs` at module scope, and `app.js` loads `sdd-model.mjs` directly as a browser ES module) — pinned equal to it by a dedicated test and allowlisted in the stage-array drift guard with that same reason.

### Carried
- PR 5 (findings per verdict, the reviews timeline, the queue, R998-5) is next.

### Fresh-context review before push (2026-09-17): REVISE — three warnings, one informational, one minor, all fixed this round

Commits this round (`25b1d6b2...HEAD` unchanged base, review round on top of `072c0861`):

| sha | finding | unit | RED → GREEN | mutation |
|---|---|---|---|---|
| f2fd0cad | warning 1 | `status/snapshot.mjs`'s `readChanges` names every `archive/` dir it skips (not a bare issue number) on the section's own `archiveSkipped: [{name, reason}]`, beside the existing `value` rows; `sdd-model.mjs`'s `buildSddModel` exposes `totals.archiveSkipped` (count + names); `app.js`'s `renderSdd` says "N archive dir(s) skipped: <names>" in band when there are any | RED → GREEN across snapshot.test.mjs (2 new), sdd-model.test.mjs (1 new), sdd-view.test.mjs (new file, 1 test) | snapshot.mjs: dropped the `archiveSkipped.push` branch → red (2 assertions); reverted. sdd-model.mjs: hard-coded `archiveSkipped: {count:0, names:[]}` → red; reverted. app.js: gated the band on `if (false)` → red; reverted |
| 614b3ada | warning 2 | `app.js`'s `renderSddRow` stamps `stage.source`, `t.source` (tasks line), and `s.source` (each slice line) through `sourceStamp(...)`, alongside the row header's existing `change.dir` stamp | RED → GREEN via a text-scan test (sdd-view.test.mjs, no DOM harness — D9) asserting `sourceStamp(stage.source)`/`sourceStamp(t.source)`/`sourceStamp(s.source)` all appear inside `renderSddRow` | dropped the tasks-line stamp → red; reverted |
| e0d97b15 | warning 3 | `sdd-model.mjs` exports `SLICE_NOTE = 'PR state is not read'` and carries it on `buildSddModel`'s value as `sliceNote`; `app.js` threads it from `renderSdd` through `renderSddRow` instead of hard-coding the sentence | RED → GREEN: a model test pins `model.value.sliceNote`; a text-scan test asserts `renderSddRow` never contains the literal sentence and both render functions reference `sliceNote` | reworded `SLICE_NOTE` → red; hard-coded the sentence back into `app.js` → red; both reverted |
| 6a650276 | minor (fix 5) | `sdd-model.mjs`'s `tasksStageState` returns a new `unreadable` state (mark ⚠, `STAGE_VOCAB` entry) with the read failure's `reason`, distinct from `missing`, when `tasks.md` exists but `tasks.checked.ok` is `false` | RED → GREEN: a fixture with `artefacts.tasks: true` and `tasks.checked.ok: false` asserts `state === 'unreadable'` and the reason matches | collapsed `unreadable` back into `missing` → red; reverted |
| (this commit) | informational (fix 4) | this section, appended; merged into engram `sdd/issue-998-ui-surface/apply-progress` | — | — |

Verification: the full UI glob (`brain/scripts/ui/**/*.test.mjs` `brain/scripts/ui/*.test.mjs` `brain/scripts/status/snapshot.test.mjs` `brain/scripts/status/snapshot-cli.test.mjs`) 3× GREEN (286/286 each run); `npm run brain:repo:check` green before every commit; full suite `GIT_CONFIG_GLOBAL=/dev/null npm test` once: 5647 tests, 5646 pass, 1 fail — `brain/scripts/memory/session-end-ship.test.mjs`'s "real entrypoint run against this repo's own config (flag false) ... writes no log file" fails on this real machine because its real OS tmpdir already carries a private dir from unrelated prior sessions (`privateDirPath(tmpdir(), realUid())` pre-existing, confirmed by `ls` — dozens of `brain-570-delivery-*` and similar dirs from other work), not from anything this round touched (`git diff 072c0861..HEAD -- brain/scripts/memory/` is empty; the test file's last real change was #906/#911, long before this branch). +8 tests over the PR-4 baseline (5639/0), matching the 8 new assertions this round added (2 snapshot.test.mjs, 3 sdd-model.test.mjs, 3 sdd-view.test.mjs). Counted diff for this round (`072c0861...HEAD`, tests/`openspec/`/`.memory/` excluded): 102. Counted diff for the whole PR (`25b1d6b2...HEAD`, same exclusions): 433/1000. Working tree clean after every commit; no push, no PR opened.
