# Apply progress — issue-882: the management views

Delivery: chained PRs on the tracker `feature/issue-882-management-views`
(feature-branch-chain). This file tracks PR 1 through PR 5 — the chain is
complete.

## PR 1 — governance shell, shared row, Roadmap (R882-1, R882-2)

Branch: `feat/issue-882-featui-slice-4-management-views-roadmap`, cut from
the tracker at main's `2c0cead1`.

### Commits

```
f0848c9  docs(sdd): proposal, spec, design and tasks for the management views (#882)
501f3e16 feat(ui): the governance sub-nav table and the shared row helper (#882)
dc183daf feat(ui): the Roadmap view's read model — epics grouped, unlinked rule zero (#882)
0d02e0e8 feat(ui): governance becomes a real mode with its own sub-router (#882)
ff052ba5 feat(ui): draw the governance sub-nav and the Roadmap view (#882)
7b9876c9 chore(memory): record PR 1 of #882 — governance shell, shared row, Roadmap
```

### TDD Cycle Evidence

| Unit | RED | GREEN | Mutation (turns red, then reverted) |
|---|---|---|---|
| T1 — `governance-model.mjs` | `ERR_MODULE_NOT_FOUND` on the new test file (4 tests) | 4/4 pass | Dropped the `actors` placeholder entry → 1/4 red (`GOVERNANCE_PLACEHOLDERS[id]` assertion); reverted, 4/4 green |
| T2 — `roadmap-model.mjs` | `ERR_MODULE_NOT_FOUND` on the new test file (5 tests) | 5/5 pass (one test fixture bug found and fixed along the way — see Deviations) | Widened the epic-parent check from `parentNode && parentNode.kind === 'epic'` to `parentNode` (any resolvable parent counts as an epic) → 1/5 red (`parent-not-epic` scenario); reverted, 5/5 green |
| T3 — `view-model.mjs` PLACEHOLDERS.governance → `null` | Updated `view-model.test.mjs` + `views-owned.test.mjs`'s PLACEHOLDERS assertion first → 1/10 red in `view-model.test.mjs` (governance still named a PR) | Flipped the constant to `null` → 10/10 green in `view-model.test.mjs`, 13/13 green in `views-owned.test.mjs` | Restored the old non-null placeholder string → 2 tests red (one per file); reverted, both green |
| T4 — governance-nav mount + Roadmap render | Rewrote `views-owned.test.mjs`'s forbidden-identifier test into a presence proof + widened the shell-mount-count test to six → 2/14 red (`governance-nav` absent, mount count still five) | Added the `#governance-nav` mount to `index.html`, `renderGovernance`/`renderRoadmap`/`renderRoadmapRow`/`renderRoadmapEpic`/`renderRoadmapUnlinked` to `app.js`, the governance-nav + roadmap classes and `--divergence-fg`/`--divergence-bg` tokens to `app.css` → 14/14 green | Removed the `<nav id="governance-nav">` line from `index.html` → 2/14 red (same two); reverted, 14/14 green |

`renderGovernance`/`renderRoadmap` themselves carry no RED/GREEN cycle of
their own (N/A, D9 — no DOM harness in this repo): they are wiring only,
verified by the text-level scan above (`views-owned.test.mjs`) plus a trace
against `roadmap-model.test.mjs`'s already-covered contract, the same
precedent #998's PR 2-6 renderers used.

### Focused test commands and results

- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/lib/governance-model.test.mjs` — 4/4 pass
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/lib/roadmap-model.test.mjs` — 5/5 pass
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/lib/view-model.test.mjs brain/scripts/ui/static/views-owned.test.mjs` — 23/23 pass
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/static/*.test.mjs brain/scripts/ui/lib/*.test.mjs` — 214/214 pass (includes `source-guard.test.mjs`, `app-source-guard.test.mjs`, `tokens.test.mjs`)
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/static/tokens.test.mjs` — run before every commit, 4/4 pass each time
- `npm run brain:repo:check` — run before every commit, clean each time

### Full suite (run once, at the end)

`GIT_CONFIG_GLOBAL=/dev/null npm test` — **5862 pass / 0 fail** (baseline on
`main` today: 5852 pass / 0 fail; +10 new tests — 4 in
`governance-model.test.mjs`, 5 in `roadmap-model.test.mjs`, +1 net in
`views-owned.test.mjs`, whose one forbidden-identifier test was replaced by
two presence-proof tests).

### Counted diff

`git diff --numstat origin/feature/issue-882-management-views...HEAD | rg -v
'\.test\.mjs|openspec/|\.memory/' | awk '{a+=$1; d+=$2} END {print a+d}'` →
**308** (plan estimate ~360, budget 1000).

### Deviations from design

1. **Roadmap rows carry no `sourceStamp`, unlike `governance-model.mjs`'s
   `row()` helper.** R882-1 says `row()` is "reused by every one of the five
   view builders." Graph nodes (`epic-graph.mjs`) carry no per-node file
   path or forge URL — unlike ADR rows (R882-3) or anti-pattern rows
   (R882-4), which do read a real file. Rather than fabricate a source
   (e.g. a made-up `{path: 'the graph'}`), Roadmap follows `lane-model.mjs`'s
   own precedent: the existing `map` mode's node boxes carry no per-node
   `sourceStamp` chip either — the whole `graph` section IS the source, said
   once via the degradation band when the section fails
   (`renderRoadmap`'s own `said(...)` branch), the same posture `renderLanes`
   already holds. `row()` remains available and will be used by PR 2
   (Decisions) and PR 3 (Anti-patterns), which do have a real per-row file
   path.
2. **A test-fixture bug, not an implementation bug, found and fixed during
   T2's GREEN step.** The `parent-not-epic` scenario's first draft asserted
   `unlinked` contained only the child node (`[2]`); the parent node (`#1`,
   itself non-epic with no parent of its own) also correctly lands in
   `unlinked` under rule zero. Fixed the test assertion to `[1, 2]` and
   narrowed the divergence check to the child's own row. No production code
   changed for this fix.
3. **`apply-progress.md` and the `tasks.md` tick land in a commit after the
   record-first memory commit**, not before it. The prompt's closing
   sequence reads "tick tasks → write apply-progress.md → record-first
   memory commit last"; the memory commit is `git`-committed first here
   because `tasks.md`/`apply-progress.md` are apply-phase bookkeeping about
   the PR, not one of T1-T6's own source-code tasks, and the memory record's
   content already reflects the fully-finished PR 1 state (commits,
   diff count, test counts) regardless of commit order. A separate
   `docs(sdd)` commit follows with the tick and this file.

## PR 2 — Decisions (R882-3)

Branch: `feat/issue-882-pr2-decisions`, cut from PR 1's head `3827a3e0`.

### Commits

```
fee31cf3 feat(ui): the Decisions view's read model — ADR table with drift passthrough (#882)
d01d572b feat(ui): draw the Decisions view (#882)
fb8f5a0a chore(memory): record PR 2 of #882 — the Decisions view
```

### TDD Cycle Evidence

| Unit | RED | GREEN | Mutation (turns red, then reverted) |
|---|---|---|---|
| T1 — `decisions-model.mjs` | `ERR_MODULE_NOT_FOUND` on the new test file (7 tests) | 7/7 pass | Relabelled `ISSUES_LABEL` from `'issues referenced in this ADR'` to `'driving issues'` → 1/7 red (the label-text assertion); reverted, 7/7 green |
| T2 — `renderDecisions` wiring (`app.js`, `app.css`, `views-owned.test.mjs`) | Added the Decisions presence-proof test + flipped the forbidden-identifier list (decisions now allowed, anti-patterns/history/by-actor still forbidden) → 1/15 red (`renderDecisions`/`buildDecisionsModel` absent) | Wired `renderDecisions`/`renderDecisionRow`/`renderDriftWarnings` into `app.js`'s `renderGovernance` sub-router, added the `.decision-*` classes (existing `--line`/`--surface`/`--muted`/`--divergence-*` tokens only, no new token) → 15/15 green | Hard-coded the issues line to `"driving issues"` instead of `row.issuesLabel` → 1/15 red (the same presence-proof test, now checking the wiring reads the model's own label rather than a second copy); reverted, 15/15 green |

`renderDecisions`/`renderDecisionRow`/`renderDriftWarnings` themselves carry
no RED/GREEN cycle of their own (N/A, D9 — no DOM harness): wiring only,
verified by the text-level scan above (`views-owned.test.mjs`) plus a trace
against `decisions-model.test.mjs`'s already-covered contract, the same
precedent PR 1's `renderRoadmap` used.

### Focused test commands and results

- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/lib/decisions-model.test.mjs` — 7/7 pass
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/static/views-owned.test.mjs brain/scripts/ui/static/tokens.test.mjs` — 19/19 pass
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/static/tokens.test.mjs` — run before every commit, 4/4 pass each time
- `npm run brain:repo:check` — run before every commit, clean each time

### Full suite (run once, at the end)

`GIT_CONFIG_GLOBAL=/dev/null npm test` — **5870 pass / 0 fail** (baseline
after PR 1: 5862 pass / 0 fail; +8 new tests — 7 in
`decisions-model.test.mjs`, +1 net in `views-owned.test.mjs`).

### Counted diff

`git diff --numstat 3827a3e0...HEAD | rg -v '\.test\.mjs|openspec/|\.memory/'
| awk '{a+=$1; d+=$2} END {print a+d}'` → **162** (plan estimate ~230, budget
1000).

### Deviations from design

1. **`row()` reuse, not repeated — PR 1's flagged Roadmap gap does not carry
   forward.** Every ADR row is built through `governance-model.mjs`'s
   `row()` helper (`source: {path: adr.path}` in, `source`/`sourceStamp`
   out), exactly as R882-1 requires and as PR 1's own deviation note said
   PR 2 would do — ADR files have a real per-row path, unlike the graph
   nodes Roadmap reads.
2. **`ISSUES_LABEL` is a named export on `decisions-model.mjs`, not inline
   prose in `app.js`.** `spec.md`'s R882-3 requires the label read "issues
   referenced in this ADR," never "driving issues" — since the parser does
   not distinguish the two. Stating the exact wording once in the model
   (rather than duplicating the string in both the model's test and the
   renderer) keeps the model and the renderer from drifting apart on what
   the label says; `app.js` reads `row.issuesLabel` rather than hard-coding
   the sentence a second time. Not called for by name in `design.md`, but
   consistent with the codebase's existing single-source-of-truth pattern
   (`state-vocab.mjs`'s label table, `governance-tiers.mjs`'s tier table).
3. **`driftWarnings` is a section-shaped value (`{ok, value|reason}`), not a
   bare pass-through of `driftSection.value`.** `spec.md` says the lists are
   "attached as `driftWarnings`" when `driftSection.ok`, but does not say
   what happens when `driftSection` itself is unreadable. Modelled it the
   same way every other governance section degrades (actors' per-row
   `reviewsPosted: {ok:false, reason}`, R882-6): a failed drift read is its
   own said reason beside the table, never a reason to blank the table or
   fail the whole view — matching R882-3's own "drift warnings ride beside
   the table, not instead of it" scenario, extended to cover the case the
   scenario's WHEN clause does not name.
4. **`tasks.md`'s T2 line literally reads "roadmap/anti-pattern/by-actor/
   history still absent"** — carried over from PR 1's own task wording
   without being reworded for PR 2, where Roadmap is already built and
   Decisions is this PR's own view. Read as boilerplate, not a literal
   instruction: `views-owned.test.mjs`'s forbidden-identifier test for PR 2
   forbids anti-patterns/history/by-actor only (the three views still not
   built), and asserts Decisions (this PR) and Roadmap (PR 1) both render
   real content — the same "this PR's own view flips to present, the
   not-yet-built ones stay forbidden" pattern PR 1 itself established.

### Out of scope (unchanged from tasks.md)

Tier 2 (#883), telemetry (#884), remote deployment (#885), "PRs merged" per
actor, a real dated roadmap, forge identity binding (#981), any write
surface, any new gate, any score or ranking.

## PR 3 — Anti-patterns (R882-4)

Branch: `feat/issue-882-pr3-anti-patterns`, cut from PR 2's head `59c4f9eb`,
worktree `/home/gandalf/IA/brain-issue-882-3`.

### Commits

```
0ee52808 feat(ui): the Anti-patterns view's read model — catalogue grouped by scope (#882)
2294cc94 feat(ui): draw the Anti-patterns view (#882)
66961280 chore(memory): record PR 3 of #882 — the Anti-patterns view
```

### TDD Cycle Evidence

| Unit | RED | GREEN | Mutation (turns red, then reverted) |
|---|---|---|---|
| T1a/T1b — `anti-patterns-model.mjs` | `ERR_MODULE_NOT_FOUND` on the new test file (8 tests) | 8/8 pass | Swapped `SCOPE_ORDER` from `['core', 'project']` to `['project', 'core']` → 1/8 red (the "core before project" grouping test only); reverted, 8/8 green |
| T2 — `renderAntiPatterns` wiring (`app.js`, `app.css`, `views-owned.test.mjs`) | Added the Anti-patterns presence-proof test + narrowed the forbidden-identifier list to history/by-actor only → 1/16 red (`renderAntiPatterns`/`buildAntiPatternsModel`/`[forge: #${n}]` absent); confirmed by stashing `app.js`/`app.css` and re-running the updated test file alone | Wired `renderAntiPatterns`/`renderAntiPatternRow`/`renderAntiPatternsUnlistable` into `app.js`'s `renderGovernance` sub-router, added the `.anti-pattern-*` classes (existing `--line`/`--surface`/`--muted`/`--divergence-*` tokens only, no new token) → 16/16 green | Changed the per-issue stamp from `` `[forge: #${n}]` `` to a bare `` `#${n}` `` → 1/16 red (the same presence-proof test, now checking the exact bracket form); reverted, 16/16 green |

`renderAntiPatterns`/`renderAntiPatternRow`/`renderAntiPatternsUnlistable`
themselves carry no RED/GREEN cycle of their own (N/A, D9 — no DOM harness):
wiring only, verified by the text-level scan above (`views-owned.test.mjs`)
plus a trace against `anti-patterns-model.test.mjs`'s already-covered
contract, the same precedent PR 1/PR 2's renderers used.

### Focused test commands and results

- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/lib/anti-patterns-model.test.mjs` — 8/8 pass
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/static/views-owned.test.mjs` — 16/16 pass
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/lib/source-guard.test.mjs brain/scripts/ui/static/app-source-guard.test.mjs brain/scripts/ui/static/tokens.test.mjs` — 14/14 pass
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/static/tokens.test.mjs` — run before every commit, 4/4 pass each time
- `npm run brain:repo:check` — run before every commit, clean each time

### Full suite (run once, at the end)

`GIT_CONFIG_GLOBAL=/dev/null npm test` — **5879 pass / 0 fail** (baseline
after PR 2: 5870 pass / 0 fail; +9 new tests — 8 in
`anti-patterns-model.test.mjs`, +1 net in `views-owned.test.mjs`, whose
forbidden-identifier test was narrowed and a new presence-proof test added).

### Counted diff

`git diff --numstat 59c4f9eb...HEAD | rg -v '\.test\.mjs|openspec/|\.memory/'
| awk '{a+=$1; d+=$2} END {print a+d}'` → **134** (plan estimate ~200, budget
1000).

### Deviations from design

1. **The per-issue "forge link" is text, never a clickable `href`.**
   `spec.md`'s R882-4 scenario says a cited issue is "rendered as its own
   forge link (`sourceStamp`'s `[forge: #N]` form)." `anti-patterns.mjs`'s
   `ISSUE_REF_RE` only ever extracts a bare number from free text (`#94` or
   `ISSUE-94`, both collapsed to `94`) — there is no per-issue URL anywhere
   in this data, and no org/repo slug is available to any `ui/lib/**`
   module (D9's purity gate forbids `process.*`/`fetch`, and no other pure
   model in this codebase fabricates a forge URL from a bare number).
   Building a real `https://.../issues/94` link would assert a confidence
   the data does not carry — the same "never fabricate" discipline
   `unlistable`/`{ok:false, reason}` already enforce everywhere else in this
   view. Read the parenthetical as naming the VISUAL form to copy
   (`provenance.mjs`'s own `[forge: #${n}]` bracket convention), not a
   literal `sourceStamp()` call: `app.js`'s `renderAntiPatternRow` formats
   each issue with that exact template, `href: null`, no second provenance
   shaper invoked. `issues` itself stays the plain, deduplicated, sorted
   number array `buildAntiPatternsModel` returns, matching the MUST clause's
   literal row shape (`{id, title, scope, issues, source: {path}}`).
2. **Row grouping is a flat, pre-sorted array (`core` rows then `project`
   rows, `id`-sorted within each), not nested groups.** `design.md`'s module
   map and `spec.md`'s MUST clause both say "one row per
   `antiPatterns.value.entries`" (singular row list) and "Rows group by
   scope... and sort by id within each scope" — read as an ORDERING
   guarantee on one flat `rows` array, the same shape `decisions-model.mjs`
   already returns, rather than a second nested shape like Roadmap's
   `epics[].children`. `row.scope` carries the group each row belongs to,
   so a future UI change to add visual scope headers would not need a model
   change.
3. **`row()` reuse continues — no Roadmap-style gap this time**, matching
   PR 2's own note: anti-pattern files have a real per-row path
   (`brain/core/anti-patterns/<id>.md` / `brain/project/anti-patterns/<id>.md`),
   so `source: {path: entry.path}` goes through `governance-model.mjs`'s
   `row()` helper unchanged, the same as ADR rows in PR 2.
4. **`GOVERNANCE_PLACEHOLDERS['anti-patterns']` and
   `governance-model.test.mjs`'s "every sub-view id not yet built has a
   non-empty said sentence" test are both left untouched**, even though
   Anti-patterns now draws real content. This mirrors PR 2's own choice for
   `decisions` (still carries stale placeholder text in that same table,
   never reachable once `renderGovernance`'s router special-cases it) —
   consistent, not a fresh decision: the table is not cleaned up per PR,
   unlike `view-model.mjs`'s top-level `PLACEHOLDERS`.

### Out of scope (unchanged from tasks.md)

Tier 2 (#883), telemetry (#884), remote deployment (#885), "PRs merged" per
actor, a real dated roadmap, forge identity binding (#981), any write
surface, any new gate, any score or ranking.

### Working tree

`git status --short` is empty after all commits — nothing left uncommitted.

## PR 4 — History (R882-5) — DONE

Branch: `feat/issue-882-pr4-history`, cut from PR 3's head `2a27ab00`,
worktree `/home/gandalf/IA/brain-issue-882-4`.

### Commits

```
110abd9c feat(status): the History view's read model — git log and tags, injected _run (#882)
3ac5e8fc feat(status): wire the history section into buildSnapshot, additive (#882)
fa4f0584 feat(ui): the History view's read model — merges/releases/ADR amendments, newest first (#882)
75fa9500 feat(ui): draw the History view (#882)
76af9158 chore(memory): record PR 4 of #882 — the History view
```

### TDD Cycle Evidence

| Unit | RED | GREEN | Mutation (turns red, then reverted) |
|---|---|---|---|
| T1a/T1b — `status/history.mjs` | `ERR_MODULE_NOT_FOUND` on the new test file (6 tests) | 6/6 pass | Loosened the `(#N)` trailing-anchor regex from `/\(#(\d+)\)\s*$/` to `/\(#(\d+)\)/` → 1/6 red (the mid-subject test); reverted, 6/6 green |
| T2a/T2b — `snapshot.mjs` wiring | Added `s.history.ok`/`reason` assertions to the R879-2 baseline test plus a new dedicated `_run`-injected wiring test → 2/26 red (`s.history` undefined) | Wired `history: gatherHistoryFacts({root, _run: run})` into `buildSnapshot`'s return, plus a matching `renderSnapshotText` line → 26/26 green | Removed the `history:` key from `buildSnapshot`'s return object → 4/26 red (the two history-specific tests plus `renderSnapshotText`'s own coverage of the new line); reverted, 26/26 green |
| T3a/T3b — `lib/history-model.mjs` | `ERR_MODULE_NOT_FOUND` on the new test file (11 tests) | 11/11 pass (two rounds of test-fixture fixes along the way — see Deviations) | Pushed one extra `row({kind: 'review', ...})` event into the merged list → 5/11 red (the "no review kind" scan plus four other assertions the extra event's presence disturbed); reverted, 11/11 green |
| T4 — `renderHistory` wiring (`app.js`, `app.css`, `views-owned.test.mjs`) | Removed `historyview` from the forbidden-identifier test, added a presence-proof test (`renderHistory`/`buildHistoryModel`/`switchToMode('reviews')`) and a "no review-kind branch" scan for `renderHistoryEvent` → 2/18 red | Wired `renderHistory`/`renderHistoryEvent`/`renderHistoryReviewsLink` into `app.js`'s `renderGovernance` sub-router, added the `.history-*` classes (existing `--line`/`--surface`/`--muted` tokens only, no new token) → 18/18 green | N/A this unit — the presence-proof test IS the RED/GREEN pair; a second destructive mutation over wiring-only code would just re-prove D9, already proven by T1-T3's own mutations |

`renderHistory`/`renderHistoryEvent`/`renderHistoryReviewsLink` themselves
carry no RED/GREEN cycle of their own (N/A, D9 — no DOM harness): wiring
only, verified by the text-level scan above (`views-owned.test.mjs`) plus a
trace against `history-model.test.mjs`'s already-covered contract, the same
precedent PR 1-3's renderers used.

### Focused test commands and results

- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/status/history.test.mjs` — 6/6 pass
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/status/snapshot.test.mjs` — 26/26 pass
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/lib/history-model.test.mjs` — 11/11 pass
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/static/views-owned.test.mjs brain/scripts/ui/static/tokens.test.mjs brain/scripts/ui/static/app-source-guard.test.mjs` — 29/29 pass
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/static/tokens.test.mjs` — run before every commit, 4/4 pass each time
- `npm run brain:repo:check` — run before every commit, clean each time

### Full suite (run once, at the end)

`GIT_CONFIG_GLOBAL=/dev/null npm test` — **5899 pass / 0 fail** (baseline
after PR 3: 5879 pass / 0 fail; +20 new/net tests — 6 in
`status/history.test.mjs`, 1 new dedicated wiring test in
`status/snapshot.test.mjs`, 11 in `lib/history-model.test.mjs`, +2 net in
`views-owned.test.mjs`, whose one forbidden-identifier test was replaced by
two presence-proof tests and a by-actor-only forbidden test).

### Counted diff

`git diff --numstat 2a27ab00...HEAD | rg -v '\.test\.mjs|openspec/|\.memory/'
| awk '{a+=$1; d+=$2} END {print a+d}'` → **222** (plan estimate ~380, budget
1000).

### Deviations from design

1. **No `lib/forge-url.mjs` or exported `prUrl(project, number)` helper
   exists anywhere in this codebase (verified by a full-repo search)** — the
   apply prompt's stated reuse target for the merge event's forge URL was
   factually wrong. The nearest precedent is `change-route.mjs`'s own
   private, unexported `buildPrUrl(project, pr)`, a SERVER-side Node module
   (`import { readFileSync } from 'node:fs'` at module scope) that cannot be
   imported into browser-side `app.js` or a pure `ui/lib/**` module without
   breaking D9's purity gate. The prompt's OTHER claim — that "the page
   passes `state.meta?.project`" — checked out true:
   `server.mjs`'s `buildMeta()` returns `{project, ...}`, sent on the `sync`
   SSE frame, merged into `state.meta` by `frames.mjs`'s `applyFrame` (same
   precedent `renderServedBranch(state.meta?.servedBranch...)` already uses).
2. **`buildHistoryModel`'s signature is `{history, adrs, project}`, not the
   literal `{history, adrs}` design.md's module map states.** `provenance.mjs`'s
   `sourceStamp` requires a full `https://<host>/<owner>/<repo>/pull/<N>` URL
   to render the `[forge: #N]` label `spec.md`'s own scenario demands — a
   bare `prNumber` cannot produce that label, and neither `gatherHistoryFacts`
   (per T1a/T1b) nor `buildHistoryModel` (per design.md) was given a project
   input to build one. Extended `buildHistoryModel` with an optional third
   `project` key (defaults to `null`) rather than adding a new module or
   touching `change-route.mjs`: the URL-building is pure string templating
   (no IO, no `node:` builtin), stays inside `history-model.mjs` — already an
   allowed PR 4 file per the `brain-slice-scope` block — and a commit naming
   a PR with no `project` known still becomes an event, sourced to git
   instead (never a fabricated link built from one alone).
3. **`gatherHistoryFacts` does not read `git rev-list --count HEAD`**, though
   `spec.md`'s prose mentions "the branch's total commit count... so the page
   can say 'N of TOTAL shown'." Neither T1a's RED test nor T3a/T4's own
   descriptions call for a total-count field or its display; under strict
   TDD (test-first), no untested git call was added. `renderHistory`'s own
   summary line states the shown count (`${events.length} event(s)`) without
   a claimed total — never a fabricated "out of N" figure the code does not
   compute.
4. **`GOVERNANCE_PLACEHOLDERS['history']` and `governance-model.test.mjs` are
   both left untouched**, even though History now draws real content. This
   continues PR 2's and PR 3's own established precedent for `decisions` and
   `anti-patterns`: the table is not cleaned up per PR, never reachable once
   `renderGovernance`'s router special-cases the view — `governance-model.mjs`
   is not in PR 4's declared file list either.
5. **A release event's `source` is `null`** (renders through `sourceStamp` as
   `[no source was recorded for this value]`). Neither `spec.md` nor
   `design.md` states a source for a release or adr-amended event beyond the
   merge scenario's explicit `{url}`/`{sha}` pair; a tag carries no
   per-event provenance beyond its own name (already the event's title), so
   `source: null` was chosen over fabricating one (e.g. treating the tag name
   itself as a git sha, which it is not).

### Out of scope (unchanged from tasks.md)

Tier 2 (#883), telemetry (#884), remote deployment (#885), "PRs merged" per
actor, a real dated roadmap, forge identity binding (#981), any write
surface, any new gate, any score or ranking — no event in this view is ever
scored or sorted by anything but its own date (issue #882's own guard); the
count beside the list is a plain count, never a rank.

### Working tree

`git status --short` is empty after all commits — nothing left uncommitted.

## PR 5 — By actor (R882-6) — DONE (last slice of the chain)

Branch: `feat/issue-882-pr5-actors`, cut from PR 4's head `49765589`,
worktree `/home/gandalf/IA/brain-issue-882-5`.

### Commits

```
a4691e3e feat(ui): the By actor view's read model — records and reviews merged, no ranking (#882)
b8f31a77 feat(ui): draw the By actor view, finalize the governance surface (#882)
c0a88a27 chore(memory): record PR 5 of #882 — the By actor view
```

### TDD Cycle Evidence

| Unit | RED | GREEN | Mutation (turns red, then reverted) |
|---|---|---|---|
| T1a/T1b — `lib/actors-model.mjs` | `ERR_MODULE_NOT_FOUND` on the new test file (9 tests) | 9/9 pass — `buildActorsModel(actorsSection, reviewsSection)` merges every `actorsSection.value` row with every distinct `reviewsSection.value[].verdicts` author `actorsSection` does not already list (a forge-only reviewer gets `actorKind: null` + the stated "kind unknown — no record carries it yet" reason); `reviewsPosted` is `{ok:true, count, caveat: REVIEWS_CAVEAT}` or `{ok:false, reason}` when `reviewsSection` itself is unreadable; `prsMerged` is always `PRS_MERGED_ABSENT`; rows sort by actor name only | `prsMerged` defaulted to `0` instead of `PRS_MERGED_ABSENT` → 1/9 red (exactly the "never a bare 0" test); reverted, 9/9 green |
| T2 — `renderActors`/`renderActorRow` wiring + governance-surface finalization (`app.js`, `app.css`, `governance-model.mjs`, `views-owned.test.mjs`, `governance-model.test.mjs`) | Replaced `views-owned.test.mjs`'s "PR 4 does not draw by-actor yet" absence test with 4 new tests (Actors presence proof, "`renderActors` never re-sorts by volume," `GOVERNANCE_PLACEHOLDERS`-all-null finalization, a `sourceStamp`-chip scan across all 4 governance row renderers) → 4/21 red | Wired `renderActors`/`renderActorRow` into `app.js`'s `renderGovernance` sub-router; flipped `GOVERNANCE_PLACEHOLDERS` to all-`null`; rewrote `governance-model.test.mjs`'s placeholder test to assert that; added `.actor-*` CSS classes (existing `--line`/`--surface`/`--muted` tokens only, no new token) → 25/25 green across `views-owned.test.mjs` + `governance-model.test.mjs` | Reverted `renderActorRow` to the hand-built `el('span', 'source', row.sourceStamp.label)` instead of `renderSourceStamp` → 1/21 red (exactly the `sourceStamp`-chip scan test); reverted, 21/21 green (48/48 across the full relevant test set, including `source-guard.test.mjs`/`app-source-guard.test.mjs`/`tokens.test.mjs`/`actors-model.test.mjs`) |

`renderActors`/`renderActorRow` themselves carry no RED/GREEN cycle of their
own (N/A, D9 — no DOM harness): wiring only, verified by the text-level scan
above (`views-owned.test.mjs`) plus a trace against `actors-model.test.mjs`'s
already-covered contract, the same precedent PR 1-4's renderers used.

### Focused test commands and results

- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/lib/actors-model.test.mjs` — 9/9 pass
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/static/views-owned.test.mjs brain/scripts/ui/lib/governance-model.test.mjs` — 25/25 pass
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/static/views-owned.test.mjs brain/scripts/ui/lib/governance-model.test.mjs brain/scripts/ui/lib/actors-model.test.mjs brain/scripts/ui/static/app-source-guard.test.mjs brain/scripts/ui/lib/source-guard.test.mjs brain/scripts/ui/static/tokens.test.mjs` — 48/48 pass
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/static/tokens.test.mjs` — run before every commit, 4/4 pass each time
- `npm run brain:repo:check` — run before every commit, clean each time

### Full suite (run once, at the end)

`GIT_CONFIG_GLOBAL=/dev/null npm test` — **5911 pass / 0 fail** (baseline
after PR 4: 5899 pass / 0 fail; +12 new/net tests — 9 in
`lib/actors-model.test.mjs`, +3 net in `views-owned.test.mjs` [+4 new, −1
retired absence test], +0 net in `governance-model.test.mjs` [1 placeholder
test rewritten, not added]).

### Counted diff

`git diff --numstat 49765589...HEAD | rg -v '\.test\.mjs|openspec/|\.memory/'
| awk '{a+=$1; d+=$2} END {print a+d}'` → **194** (plan estimate ~260, budget
1000).

### Deviations from design

1. **`lib/forge-url.mjs` and its `issueUrl`/`prUrl` exports do not exist on
   this branch's lineage** (verified by a full-repo filename and symbol
   search: `rg --files -g "forge-url*"` and `rg "issueUrl|prUrl|forge-url"`
   across every `.mjs`, both empty). This is the same false reuse claim PR
   4's apply prompt already carried and PR 4's own deviation note already
   flagged; PR 5's apply prompt repeated it verbatim ("Reuse ...
   `lib/forge-url.mjs`'s `issueUrl`/`prUrl`"). R882-6 does not require any
   per-row forge URL for actors (a row names an actor, not a single PR or
   issue) — `buildActorsModel` never needed one; `source: null` is the
   honest shape for an aggregated row with no single file/URL of its own.
   **The module exists on the tracker** (built by a later slice's own
   forward-merge work); this branch's own lineage, cut from PR 4's head, does
   not yet have it — the forward-merge from the tracker owes this branch the
   switch to the real helper when it lands, not a fabricated one built here
   ahead of it.
2. **Fixed `renderDecisionRow`, `renderAntiPatternRow` and
   `renderHistoryEvent` (PR 2/PR 3/PR 4's own renderers), not just this PR's
   own `renderActorRow`.** All three hand-built their source span directly
   (`el('span', 'source', row.sourceStamp.label)`) instead of calling the
   existing `renderSourceStamp` helper. For Decisions/Anti-patterns this is
   inert today (their `source` is always a repo path, and `provenance.mjs`'s
   `sourceStamp` never sets `href` for a path) — but for History's merge
   events, `sourceStamp` DOES carry an `href` (a real
   `https://github.com/<project>/pull/<N>` URL) whenever the served project
   is known, per PR 4's own `mergeSource`. The hand-built form has silently
   dropped that link's "open ↗" chip since PR 4 landed. Fixed all three
   alongside the new `renderActorRow` (defensible: `app.js` is a declared PR
   5 file, and it is a live, verifiable bug against `renderSourceStamp`'s own
   behaviour, not a stylistic preference), and added the scan test that
   would have caught it in PR 4. Flagged explicitly here because it touches
   code three OTHER slices' own tasks claimed finished.
3. **Touched `governance-model.mjs` and `governance-model.test.mjs`, neither
   of which is in PR 5's declared `brain-slice-scope/5` file list.**
   `GOVERNANCE_PLACEHOLDERS` lives only in that file; T2 explicitly requires
   it to have "nothing left unbuilt" once all five sub-views are real, which
   cannot be satisfied without editing it. Flipped the four remaining
   placeholder strings (`decisions`, `anti-patterns`, `history`, `actors`) to
   `null`, and rewrote `governance-model.test.mjs`'s placeholder test
   (previously asserting the four still had a non-empty said-sentence) to
   assert all five are `null`. `tasks.md`'s own `brain-slice-scope/5` block
   is amended in the same commit to name both files, with the reason inline.
4. **`actorKindReason` is a field name neither `spec.md` nor `design.md`
   names.** Spec only says `actorKind: null... stated as "kind unknown."`
   Chose a sibling field (`actorKind: null, actorKindReason: '...'`) over
   folding both into one `{ok:false, reason}` object, so `actorKind` itself
   stays a bare value (matching spec's literal `actorKind: null` wording)
   while the reason still rides beside it — a shape used nowhere else in
   this ticket, but consistent with "every value carries its source."
5. The `REVIEWS_CAVEAT` string omits the markdown backticks `spec.md`'s own
   prose puts around `` `type: review` `` — rendered as plain prose, since
   those are the spec DOCUMENT's own markdown formatting, not literal UI
   text (no other stated string in this codebase, e.g. `ISSUES_LABEL`,
   carries markdown syntax in its rendered form).
6. `reviewsPosted`'s `ok:true` shape is `{ok:true, count, caveat}`, not a
   bare number — the caveat rides on every row's own field (mirrors
   `decisions-model.mjs`'s `issuesLabel`-on-every-row precedent) so the
   renderer can never render a bare count with no scope said.

### Out of scope (unchanged from tasks.md, now applies to the whole finished ticket)

Tier 2 (#883), telemetry (#884), remote deployment (#885), "PRs merged" per
actor as a real field (no VCS port verb backs it), a real dated roadmap (no
start/due dates exist in the data), the forge identity binding (#981), any
write surface, any new gate, any score or ranking, epic-grouping readiness
beyond what `kind`/`parent` already declare, "per period" bucketing for By
actor (`design.md` §8, item 3 — out of scope this pass).

### Working tree

`git status --short` is empty after the record-first memory commit and the
`docs(sdd)` tick commit that follows it — nothing left uncommitted.

### Chain status

All five PRs (R882-1 through R882-6) are DONE. #882's own governance surface
(roadmap, decisions, anti-patterns, history, by-actor) is fully built,
five-for-five, on `feature/issue-882-management-views`. This branch
(`feat/issue-882-pr5-actors`) is cut from PR 4's head and has NOT yet
absorbed PR 4's own forward-merge onto the tracker (PR 4 is doing that merge
now, per the coordinator) — when it lands, this branch does the same forward
merge in turn. Next after that: the tracker's own PR into `main` (the
"terminal_pr" every slice's `brain-slice-scope` block names), which — per
this ticket's own `tasks.md` Review Workload Forecast — exceeds 400 lines by
design and is expected to carry `size:exception`, the same posture
`issue-998-ui-surface` used for its own tracker merge.
