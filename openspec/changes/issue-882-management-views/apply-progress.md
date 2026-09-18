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
3827a3e0 docs(sdd): tick PR 1 tasks and record apply progress (#882)
bda16bea feat(ui): forge-url.mjs — the one place an issue/PR number becomes a URL (#882)
2db66977 refactor(ui): change-route.mjs's buildPrUrl delegates to forge-url.mjs (#882)
fe56dc22 fix(ui): Roadmap rows go through row() and carry a real source (#882 cold review blocker)
464de455 fix(ui): wire the Roadmap row's source stamp, restore the adrs guard (#882 cold review)
288192a8 docs(sdd): append fresh-context review fixes to PR 1 apply progress (#882)
5af54910 fix(ui): an unknown roadmap state is said, never thrown (#882 cold review #1037 correction 1)
dca0271d docs(ui): spec.md R882-2 amendments for corrections 1/2, forge-url.mjs editorial note (#882 cold review #1037)
```

Commits bda16bea..288192a8 are the fresh-context review's fixes (see
"Fresh-context review before push" below). Commits 5af54910..dca0271d are
the cold review of PR #1037's fixes (see "Cold review of PR #1037" below).

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
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/lib/view-model.test.mjs brain/scripts/ui/static/views-owned.test.mjs` — 24/24 pass (corrected from an earlier miscount of 23/23 — see "Fresh-context review before push" below)
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/static/*.test.mjs brain/scripts/ui/lib/*.test.mjs` — 214/214 pass (includes `source-guard.test.mjs`, `app-source-guard.test.mjs`, `tokens.test.mjs`)
- `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/ui/static/tokens.test.mjs` — run before every commit, 4/4 pass each time
- `npm run brain:repo:check` — run before every commit, clean each time

### Full suite (run once, at the end)

`GIT_CONFIG_GLOBAL=/dev/null npm test` — **5870 pass / 0 fail** (baseline on
`main` today: 5852 pass / 0 fail; +18 new tests over the two apply passes —
4 in `governance-model.test.mjs`, 8 in `roadmap-model.test.mjs` (5 original
+ 3 from the cold-review fix), +2 net in `views-owned.test.mjs` (one
forbidden-identifier test replaced by two presence-proof tests, plus one
more added by the cold-review fix), 4 in the new `forge-url.test.mjs`).

### Counted diff

`git diff --numstat origin/feature/issue-882-management-views...HEAD | rg -v
'\.test\.mjs|openspec/|\.memory/' | awk '{a+=$1; d+=$2} END {print a+d}'` →
**359** (plan estimate ~360, budget 1000; was 308 before the cold-review
fixes).

### Deviations from design

1. ~~**Roadmap rows carry no `sourceStamp`, unlike `governance-model.mjs`'s
   `row()` helper.**~~ **RESOLVED — see "Fresh-context review before push"
   below.** This deviation was the review's blocker: it followed
   `lane-model.mjs`'s map-view precedent (no per-node stamp) instead of
   R882-1's own "`row()` is reused by every one of the five view builders."
   A fresh-context reviewer correctly rejected that precedent — the map mode
   is not one of R882-1's five view builders, and issue #882's acceptance 2
   requires every row to link to its source. Fixed: every roadmap row now
   goes through `row()` and carries a real issue URL when a project is known.
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

### Fresh-context review before push: REVISE → fixed

A fresh-context review of PR 1 before push returned REVISE — one blocker,
one warning, one minor. All three fixed, in the four commits listed above.

1. **BLOCKER — Roadmap rows shipped with no provenance.** `roadmap-model.mjs`
   defined its own row shape and never called `governance-model.mjs`'s
   `row()`; `app.js` rendered `#N title` as plain text, no stamp, no link.
   R882-1 says `row()` is "reused by every one of the five view builders"
   and issue #882's acceptance 2 requires every row to link to its source.
   The reviewer's own premise check found neither `Reviews` nor `SDD` mode
   stamps a forge URL today either — no existing precedent either way — so
   this needed building correctly here, not deferred. Fixed:
   - New pure `brain/scripts/ui/lib/forge-url.mjs` (`issueUrl`, `prUrl`) —
     the one place an issue/PR number becomes a forge URL. `change-route.mjs`'s
     pre-existing `buildPrUrl` now delegates to `prUrl` so there is one
     definition, not two.
   - `buildRoadmapModel(graphSection, {project} = {})` — a new optional
     `project` argument, documented as an amendment in `spec.md` R882-2. Every
     row now goes through `row()` and sources to `{url: issueUrl(project,
     node.number)}` when `project` is known, `source: null` (`sourceStamp`'s
     own honest "no source was recorded" stamp) when it is not.
   - `app.js` passes `state.meta?.project` (the same field `server.mjs`'s
     `buildMeta()` already exposes and `change-route.mjs` already reads for
     the drawer's PR links) and `renderRoadmapRow` now renders
     `row.sourceStamp` through the existing `renderSourceStamp` helper.
   - Tests: `forge-url.test.mjs` (4 tests, both branches of both builders);
     `roadmap-model.test.mjs` gained 3 tests (sourced-with-project,
     unsourced-without-project, epic row sourced too); `views-owned.test.mjs`
     gained a scan asserting `renderRoadmapRow` applies
     `renderSourceStamp(row.sourceStamp)`. Each unit's own mutation is in the
     TDD Cycle Evidence above (T1/T2/T3/T4 numbering continues: this is work
     beyond T1-T6, done as its own RED→GREEN→mutation cycle per unit, not
     reusing PR 1's original task numbers).
2. **WARNING — the rewritten `views-owned.test.mjs` dropped the
   `/\badrs?\b/i` forbidden-identifier pattern with no replacement**, so
   nothing would have caught Decisions-view text leaking in ahead of PR 2.
   Fixed: restored `/\badrs?\b/i` alongside the other four forbidden patterns
   in the "this PR does not draw them yet" test.
3. **MINOR — `apply-progress.md` claimed 23/23 for the `view-model.test.mjs`
   + `views-owned.test.mjs` pair; the real count at that point was 24/24**
   (T4 added a second presence test — the original count was written before
   that addition was accounted for). Corrected above to 24/24, with a note
   that it is now 25/25 after this review round's own added test.

Full suite after these fixes: 5870 pass / 0 fail (was 5862 before this
round). Counted diff after these fixes: 359 (was 308 before). Every gate
(`brain:repo:check`, `tokens.test.mjs`) stayed green before each of the four
fix commits, same as PR 1's original six.

### Cold review of PR #1037 (head 288192a8): APPROVE with two corrections, both fixed

The cold review of PR #1037 (the fresh-context-review-fixed head, `288192a8`)
returned APPROVE with two corrections and one editorial. Both corrections
fixed, in commits `5af54910` and `dca0271d`; the editorial addressed as a
one-sentence comment, no behavior change.

1. **Correction 1 — `roadmapRow` called `stateOf(node)` directly, which
   THROWS on an unknown `node.status` or an unmapped roadmap state**
   (`state-vocab.mjs`), and `buildRoadmapModel` had no guard: one such node
   would throw out of `renderRoadmap()` inside `render()` and blank the
   whole governance canvas — empty-on-failure in its worst form. Fixed per
   the reviewer's own recommendation: a new `safeStateOf(node)` catches the
   throw and falls back to the `unknown` vocabulary entry, carrying the
   caught message as the row's own `stateReason` — the same guard
   `lane-model.mjs`'s `stateAndMarks` already holds for this exact throw.
   The rest of the rows draw unaffected. Wired all the way to the screen:
   `app.js`'s `renderRoadmapRow` renders `row.stateReason` (a new
   `.roadmap-state-reason` class, `var(--warn)`, no new token) so the said
   reason is not left unused in the model. Tests: `roadmap-model.test.mjs`
   gained 2 tests (unknown status, unmapped roadmap state — both prove
   `model.ok === true` and the bad row's own `stateReason`, while a sibling
   good row is unaffected); `views-owned.test.mjs` gained a scan asserting
   `renderRoadmapRow` reads `row.stateReason`. `spec.md` R882-2 gained an
   amendment paragraph and a new scenario. Mutation: reverted `roadmapRow`
   to call `stateOf(node)` directly (no guard) → both new model tests failed
   via the exact same thrown error the reviewer described; reverted, green.
   A second mutation removed the `row.stateReason` rendering in `app.js` →
   the new scan test red; reverted, green.
2. **Correction 2 — an epic whose `parent` is another epic was listed flat
   with the parent link silently dropped**, because `childrenByEpic` only
   ever collects non-epic nodes. Decided (recommendation 1 of the two the
   reviewer offered): keep `epics` FLAT — it stays a list, not a tree, since
   a real nested-epic structure (arbitrary depth, cycles to guard against)
   is a bigger change than this ticket's "per-epic status grouping, no
   timeline" scope — and SAY the dropped relation as a
   `{key: 'parent', value: <parent's number>, reason:
   'nested-epic-not-supported'}` divergence on the child epic's own row,
   reusing the exact shape and rendering `parent-not-epic` already has. Said
   why in `roadmap-model.mjs`'s own module-header comment and in a new
   `spec.md` R882-2 amendment + scenario. Test: `roadmap-model.test.mjs`
   gained 1 test (an epic declaring another epic as `parent` still gets its
   own top-level row, carrying the divergence; the parent epic's own row
   carries none). Mutation: restored the silent drop (bypassed
   `epicParentDivergence`) → the new test red (asserted `[]` where the
   divergence should be); reverted, green.
   - **Implementation note**: both corrections' `roadmap-model.mjs` code and
     tests were authored together before being split into commits, so
     `5af54910` (titled "correction 1") actually carries BOTH corrections'
     implementation; correction 2's own mutation (above) was run and
     verified independently regardless of that commit-boundary mislabel.
     `spec.md`'s amendments for both corrections landed together in the
     following commit, `dca0271d`.
3. **Editorial (not fixed here, ticket already exists)** — `forge-url.mjs`'s
   `https://github.com/` literal now stamps a github.com link for every
   roadmap row too, widening the platform-agnostic debt from PRs to issues.
   Added one sentence to `forge-url.mjs`'s header comment naming #1035 as
   the owner of fixing both builders' forge-host literal at once; no
   behavior change.

Full suite after these fixes: 5874 pass / 0 fail (was 5870 before this
round; baseline main: 5852). Counted diff after these fixes: 412 (was 359
before; plan estimate ~360, budget 1000 for this tier). UI test-file glob
count unchanged at 31 (no new test files this round, only existing ones
extended). `brain:repo:check` and `tokens.test.mjs` stayed green before
every commit in this round.

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

### Merge onto PR 1's head (the tracker, after #1037)

PR 2 was cut from PR 1's pre-review head, so the tracker's version of `roadmap-model.mjs`, `app.js`, `app.css`, `views-owned.test.mjs` and the SDD documents won each conflict, with PR 2's own diff applied on top — the procedure this repository uses for a sibling cut before a squash, never a rebase.

One debt from the fresh review of PR 3 was paid here rather than left to accumulate: `renderDecisionRow` rendered `row.sourceStamp` by hand (`el('span','source', label)`), which silently drops the "open ↗" chip the moment a stamp carries an href — and PR 1's head made hrefs real. Both governance renderers now go through `renderSourceStamp`, pinned by a scan test that also forbids the hand-built span. RED 17/18 → GREEN 344/344 across the UI glob; mutation: the hand-built span restored → that test red, reverted.

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

### Merge onto the tracker (after PR 2, #1038)

PR 3 was cut before PR 1's review fixes, so the tracker's version won each conflict with PR 3's own diff applied on top. The debt its own fresh review named was paid here: `forge-url.mjs` exists on the tracker now, so `buildAntiPatternsModel(section, {project})` stamps each cited ticket through `sourceStamp({url: issueUrl(project, n)})` — the same builder the roadmap rows use — and keeps today's bare `[forge: #N]` words when no project is known, rather than the roadmap's "no source was recorded" text, which would be wrong for a bare citation. The renderer draws one chip per citation instead of one joined text node, so a citation with a project behind it is individually clickable, and both governance renderers plus this one are pinned to `renderSourceStamp` by the shared scan test.

RED 8/9 on the model (a project given must produce a real href) → GREEN 354/354 across the UI glob. Mutations: the model ignoring `project` → its test red; the renderer joining the stamps into one text node instead of chips → the scan test red (a first attempt that only disabled the branch left the scanned line in place and proved nothing — said here because a mutation that passes is not evidence). Both reverted.

## PR 4 — History (R882-5) — DONE

Branch: `feat/issue-882-pr4-history`, cut from PR 3's own local (pre-squash)
head `2a27ab00`, worktree `/home/gandalf/IA/brain-issue-882-4`.

### Commits (before the forward-merge)

```
110abd9c feat(status): the History view's read model — git log and tags, injected _run (#882)
3ac5e8fc feat(status): wire the history section into buildSnapshot, additive (#882)
fa4f0584 feat(ui): the History view's read model — merges/releases/ADR amendments, newest first (#882)
75fa9500 feat(ui): draw the History view (#882)
76af9158 chore(memory): record PR 4 of #882 — the History view
49765589 docs(sdd): tick PR 4 tasks and record apply progress (#882)
```

### TDD Cycle Evidence

| Unit | RED | GREEN | Mutation (turns red, then reverted) |
|---|---|---|---|
| T1a/T1b — `status/history.mjs` | `ERR_MODULE_NOT_FOUND` on the new test file (6 tests) | 6/6 pass | Loosened the `(#N)` trailing-anchor regex from `/\(#(\d+)\)\s*$/` to `/\(#(\d+)\)/` → 1/6 red (the mid-subject test); reverted, 6/6 green |
| T2a/T2b — `snapshot.mjs` wiring | Added `s.history.ok`/`reason` assertions to the R879-2 baseline test plus a new dedicated `_run`-injected wiring test → 2/26 red (`s.history` undefined) | Wired `history: gatherHistoryFacts({root, _run: run})` into `buildSnapshot`'s return, plus a matching `renderSnapshotText` line → 26/26 green | Removed the `history:` key from `buildSnapshot`'s return object → 4/26 red; reverted, 26/26 green |
| T3a/T3b — `lib/history-model.mjs` | `ERR_MODULE_NOT_FOUND` on the new test file (11 tests) | 11/11 pass | Pushed one extra `row({kind: 'review', ...})` event into the merged list → 5/11 red (the "no review kind" scan plus four assertions the extra event disturbed); reverted, 11/11 green |
| T4 — `renderHistory` wiring | Removed `historyview` from the forbidden-identifier test, added a presence-proof test → 2/18 red | Wired `renderHistory`/`renderHistoryEvent`/`renderHistoryReviewsLink` into `renderGovernance`'s sub-router, `.history-*` CSS classes → 18/18 green | N/A this unit — wiring-only, D9 |

### Full suite (once, before the forward-merge)

`GIT_CONFIG_GLOBAL=/dev/null npm test` → **5899 pass / 0 fail** (baseline
after PR 3's local pre-squash head: 5879 pass / 0 fail).

### Counted diff (before the forward-merge)

`git diff --numstat 2a27ab00...HEAD | rg -v '\.test\.mjs|openspec/|\.memory/'
| awk '{a+=$1; d+=$2} END {print a+d}'` → **222** (plan estimate ~380, budget
1000).

### Fresh-context review before push: REVISE → fixed

A fresh-context review of PR 4 returned REVISE with two blockers and two
warnings, plus one open question. Fixed in order:

1. **BLOCKER — a trailing `(#N)` is a citation, not a PR number.** Measured
   against this repository's real log: of 200 commits, 147 carry a trailing
   `(#N)`, and 17 of those resolve to `#882` — the issue, because this
   chain's own unsquashed commits cite the driving issue that way. There is
   no textual signal separating a squash suffix from a hand-written
   citation. Renamed the field `prNumber` → `citedRef` throughout
   `status/history.mjs`, `status/history.test.mjs`, `lib/history-model.mjs`
   and `lib/history-model.test.mjs`; the rendered text and every doc/comment
   now say "cites #N", never "PR #N". `spec.md`'s R882-5 gained an Amendment
   naming this explicitly, the same way R882-6 already states the "PRs
   merged" gap instead of approximating it, plus a scenario asserting no
   event's text contains the word "PR". Mutation: restored the word "PR" (in
   a comment reachable by the new scan) and a `prNumber` field on the merge
   event → both scan tests red; reverted.
2. **BLOCKER — `apply-progress.md`'s Deviation 1 and the memory record
   falsely claimed `forge-url.mjs` "does not exist anywhere in this
   codebase."** True only of the stale branch point this slice was cut
   from — it shipped in PR 1 (#1037) and PR 3 already imports it on the
   tracker. This section's own rewrite (above, and the merge commit) says
   what was actually true. For the memory record: a direct in-place edit
   of `.memory/records/2026-09-rec-5b341c1225525cea.jsonl`'s content was
   tried first and committed, then caught by the full suite —
   `real-store-roundtrip.integration.test.mjs`'s REQ-C4-1 failed
   ("recomputed id 'rec-e9d5efb8cac6efc2' does not match the stored id"):
   a record's id is a content hash, so hand-editing content in place
   breaks it. Reverted that edit in a following commit and instead saved a
   NEW record (`rec-a85afb2bcfe4d641`) with `--supersedes
   rec-5b341c1225525cea`, the store's own correction mechanism.
3. **WARNING — `history-model.mjs` hand-built its own
   `` `https://github.com/${project}/pull/${n}` `` template.** Post-merge,
   imports `prUrl` from `lib/forge-url.mjs` instead — one definition, not
   two that can drift. Kept the `{sha}` fallback for a commit with no
   citation. Pinned with a source-level test asserting `history-model.mjs`
   contains no literal `https://github.com/`.
4. **WARNING — `renderHistoryEvent` hand-built `el('span', 'source', ...)`,
   dropping the "open ↗" chip every other governance row carries.** Now
   calls `renderSourceStamp(event.sourceStamp)`, the same helper
   `renderRoadmapRow`/`renderDecisionRow`/`renderAntiPatternRow` use.
   `renderHistoryEvent` added to `views-owned.test.mjs`'s shared
   `renderSourceStamp` scan alongside those three.
5. **Open question — R882-5's prose asked for "N of TOTAL shown," which
   `gatherHistoryFacts` never read.** Decision: dropped the phrase rather
   than add an untested `git rev-list --count` call under strict TDD;
   `spec.md` amended to say this slice states the shown count only.

### Commits (the fresh-context-review round, after the forward-merge)

```
fca6d7b2 chore(merge): forward-merge the tracker (PR 1-3 squashed + cold-review fixes) into PR 4 (#882)
4cacc75d fix(ui): History cites a reference, never asserts "PR" — cited link through forge-url.mjs, real source stamp (#882 cold review of PR 4)
81945bf6 docs(memory): correct the PR 4 record's false forge-url.mjs claim (#882 cold review of PR 4) — REVERTED, see 285cb3bd
285cb3bd fix(status): a citedRef fixture in snapshot.test.mjs still said prNumber, and revert a broken direct memory-record edit (#882)
70bf426c docs(memory): record the corrected forge-url.mjs claim, superseding rec-5b341c1225525cea (#882 cold review of PR 4)
```

### Full suite (after the forward-merge and all fixes)

`GIT_CONFIG_GLOBAL=/dev/null npm test` → **5915 pass / 0 fail** (up from
5899 before the merge; the tracker's own PR 1-3 fixes plus this round's new
scan tests account for the difference). `brain:repo:check` and
`tokens.test.mjs` stayed green before every commit in this round.

### Counted diff against the tracker (after the merge and all fixes)

`git diff --numstat origin/feature/issue-882-management-views...HEAD | rg -v
'\.test\.mjs|openspec/|\.memory/' | awk '{a+=$1; d+=$2} END {print a+d}'` →
**241**.

### Working tree

`git status --short` is empty after all commits — nothing left uncommitted.

### Next / coordination note

A concurrent apply pass built PR 5 (By actor, R882-6) from PR 4's
PRE-merge, pre-fix head (`49765589`) — before this branch's forward-merge
and fresh-context-review fixes landed. PR 5's own record independently
found and fixed the same `renderHistoryEvent`→`renderSourceStamp` defect
(warning 4 here) and repeated this branch's now-corrected
`forge-url.mjs`-does-not-exist claim (true only at that same stale cut
point). Whoever integrates PR 5 onto this branch (or onto the tracker)
needs to reconcile: PR 5's `history-model.mjs` still carries `prNumber`,
not `citedRef`, and still hand-builds the forge URL rather than importing
`prUrl` — this branch's fixes are not yet in PR 5's lineage.

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

### Merge onto the tracker (after PR 4, #1040)

PR 5 was cut from PR 4's pre-merge head, so the tracker's version won each conflict with PR 5's own diff applied on top. Two of PR 5's own edits were correctly DROPPED rather than reapplied, exactly as its fresh review predicted: `renderDecisionRow`'s switch to `renderSourceStamp` is already on the tracker (PR 2 did it), and `renderAntiPatternRow`'s fix was written against the old `row.issues` shape while the tracker has moved to `row.issueStamps`, one chip per citation. Reapplying either verbatim would have undone shipped work.

What survived is PR 5's own: `actors-model.mjs` and its test, `renderActorRow`, the governance placeholders all nulled, and the finalized `views-owned.test.mjs`. UI, history and snapshot suites 413/413 after the merge.

Found while verifying and filed rather than folded in: five renderers outside this chain (`renderSddRow` ×4 and `renderTab`, both from #998) still hand-build the source label and would drop an href the same way — #1041 owns closing the class everywhere and generalising the scan test so it stops enumerating renderers by hand.

## Cold review of the tracker PR (#1043, head fa777b22): three findings fixed

The tracker's own review returned REVISE: the known `budget` blocker (#752, the control does not honour `size:exception`) plus three findings, all real and all fixed on a child branch rather than on the tracker itself.

- **correction 1 — the timeline's order was undefined.** `byDateDesc` subtracted `Date.parse` results with no NaN guard, so an event dated `'x'` sorted ahead of one dated 2027 and the comparator was inconsistent. Two things compounded it: git hands back `%ai` (`YYYY-MM-DD HH:MM:SS +0200`), which is not ISO 8601 and which no specification requires a browser to parse, and this module ships to the browser (D9); and the ADR-amendment path guarded its date by truthiness only. Fixed in `0978d8a8`: a total, stable order, an unparseable date kept at the end with its own said reason, never first and never dropped.
- **correction 2 — the commit list was capped and the page never said so.** `gatherHistoryFacts` reads a fixed number of commits while tags and ADR amendments are uncapped, so an older release appeared with no merges around it and nothing explained why — against this change's own rule that a partial list is never shown as the whole. Fixed in `79026cfa`: the section carries `cap: {requested, reached, total}`, the total read through the SAME injected `_run` seam and degraded to `null` when it cannot be read, and `capNote` says "the newest N commits of TOTAL" when the total is known, the weaker "the newest N commits; older merges are not listed" when it is not, and nothing at all under the cap. The page renders it beside the count. Mutations: the section dropping `cap` → 3 red; `reached` hard-coded true → 1 red; `capNote` warning under the cap → 1 red. A FIRST mutation attempt here did not bite — a regex that matched nothing — and is said rather than hidden: a mutation that leaves the suite green is not evidence.
- **correction 3 — two namespaces, one table.** Rows are keyed by the memory record's actor (`@someone`) and by the forge review's author login (`someone`), which are different strings for what may be the same human, and nothing warned. Fixed: a row whose only evidence is a forge login carries `evidenceNote` saying exactly that and that the two namespaces are not reconciled; the page renders it. No mapping is invented — inventing one would merge two people as easily as it would join one. Mutations: the note dropped from the model → red; the page not rendering it → red.

Suites after the three: 404/404 across the UI and history globs, `npm run brain:repo:check` green.

## Cold review of the tracker PR, round 2 (#1043, head 4261e4fe): three findings fixed

The `budget` blocker is the standing one (#752). The other three were real, and two of them were introduced by the round-1 fixes themselves — worth saying, because a fix that adds its own silence is exactly what a second round is for.

- **correction 1 — the model stated a reason the view dropped.** Round 1 gave every event with an unreadable date a `dateUnparseable` sentence explaining why it sits at the end; `renderHistoryEvent` printed only the date, so the reader saw an undated event at the bottom with no explanation. The page now renders it. Mutation: the page drops the reason again → red.
- **correction 2 — "merge" was an overclaim.** `gatherHistoryFacts` runs `git log` with no `--merges` and no `--first-parent`, so EVERY commit on the branch becomes an event, and every one of them was labelled `merge`. That is the same overclaim the `citedRef` work already refused for "PR": the log selects commits, so the event is a `commit`. Renamed through the model, its tests and the spec; a test asserts nothing on the event calls it a merge. Mutation: the kind restored to `merge` → 3 red.
- **correction 3 — the total counted something else.** `git rev-list --count HEAD` counts what is REACHABLE FROM HEAD, which on a shallow or detached checkout is not the branch's history, so `capNote` could print "the newest 200 commits of 200" as if that were everything. The sentence now says what the number counts, and a total equal to the cap — which carries no information — falls back to the weaker honest phrasing. Mutation: a total equal to the cap printed anyway → red.

Suites after the three: 407/407 across the UI and history globs.

## Cold review of the tracker PR, round 3 (#1043, head 009781ab): two findings fixed

- **correction — a fabricated zero, and a test that had pinned it.** `reviewsPostedOf` returned `counts.get(actor) ?? 0`, and `counts` is keyed by the FORGE's author logins. So a person recorded as `@alice` who reviews as `alice` read "reviews posted: 0" — a claim this data cannot back, the same fabricated zero the module's own header refuses for `prsMerged`, and the very gap the namespaces note was added for one round earlier. A name the forge never used now carries the stated absence and its reason, never a number.
  Worth saying plainly: an existing test from PR 5 asserted `{ok: true, count: 0, caveat}` for exactly this case — the contract itself encoded the defect. It is superseded here with the reason in the test's own text, and R882-6 amended, rather than quietly edited.
- **editorial — a shallow checkout's count is not the history.** `git rev-list --count HEAD` counts the fetched depth on a shallow clone, so the note could quote a number that understates the history while sounding precise. The shallow flag now travels WITH the count rather than correcting it, and the sentence says the checkout is shallow instead of quoting the number at all.

Suites: 408/408 across the UI and history globs; full suite 5949/0.

## Cold review of the tracker PR, round 4 (#1043, head 150f5691): three findings fixed

- **correction — a parser mangled a malformed line instead of saying so.** `parseTagList('v1')` returned `{name: 'v', date: 'v1'}`: `indexOf` answers -1, and slicing on that drops the name's last character and leaks the rest into the date, so a release would render under a wrong title with a nonsense date and nothing would report it. Both parsers now KEEP a malformed line (rule zero) and name its own problem on the row. The existing row literals gained the new key rather than the key being smuggled in.
- **correction — the summary implied a join the data never performs.** Round 3 made the review count attributable only to names the forge itself used, which is right; the summary still read "records and open-PR review threads", as if the two were one list. It now says they are listed side by side and not joined.
- **editorial — same-day order was an accident of parsing.** An ADR amendment carries a date only (UTC midnight); a commit or tag carries a time with an offset. Two same-day events of different kinds therefore ordered by how the string parsed, which looked deliberate and was not. The model states the rule and the page says it.

Suites: 440/440 across the UI, history and snapshot globs; full suite 5954/0.

Four rounds, and it is worth naming the pattern rather than burying it: every round found something real, and in two of them the defect had been introduced by the previous round's own fix. The chain of reviews is doing the work it exists for.
