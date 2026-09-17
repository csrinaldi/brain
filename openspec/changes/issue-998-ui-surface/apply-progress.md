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
