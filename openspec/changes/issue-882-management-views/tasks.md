# Tasks — issue-882: the management views

Delivery: chained PRs on the tracker `feature/issue-882-management-views`
(branch from `main`, post-#998). PR n targets the tracker once PR n−1 is
merged into it (feature-branch-chain, same discipline as
`issue-998-ui-surface/tasks.md`); the tracker merges to `main` with
`size:exception` when all five are in. Terminal PR: the tracker → main. Every
PR: red test first, one mutation per unit, a fresh-context review before
push, a posted cold-review APPROVE.

## PR 1 — governance shell, shared row, Roadmap (R882-1, R882-2)

```brain-slice-scope/1
{"slice": 1, "claims": ["R882-1", "R882-2"], "files": ["brain/scripts/ui/lib/governance-model.mjs", "brain/scripts/ui/lib/roadmap-model.mjs", "brain/scripts/ui/lib/view-model.mjs", "brain/scripts/ui/static/app.js", "brain/scripts/ui/static/index.html", "brain/scripts/ui/static/app.css", "brain/scripts/ui/static/views-owned.test.mjs"], "terminal_pr": "the tracker feature/issue-882-management-views -> main"}
```

- [x] T1a. `lib/governance-model.test.mjs`: `GOVERNANCE_VIEWS` is the five ids
      in order; `GOVERNANCE_PLACEHOLDERS` has a non-empty sentence for every
      id not yet real; `row(...)` derives both `source` and `sourceStamp`
      from one `source` input, matching `provenance.mjs`'s own shapers. RED.
- [x] T1b. `lib/governance-model.mjs`: the table + `row()` helper. Mutation:
      drop one placeholder entry → red.
- [x] T2a. `lib/roadmap-model.test.mjs`: an epic's declared children nest
      under it; an undeclared node lands in `unlinked`; a `parent-not-epic`
      divergence is surfaced on the child's row, never silently nested; a
      graph section `{ok:false}` passes its reason through unchanged;
      determinism under shuffled `nodes`. RED (`ERR_MODULE_NOT_FOUND`).
- [x] T2b. `lib/roadmap-model.mjs`: `buildRoadmapModel(graphSection)` —
      groups by `kind === 'epic'` / `parent`, reads
      `declarationDivergences` for `key === 'parent'` per node, no timeline
      computed. Mutation: the `parent-not-epic` check removed → red.
- [x] T3. `lib/view-model.mjs`: `PLACEHOLDERS.governance` → `null`.
      `view-model.test.mjs` updated: `governance` now has real content, the
      same assertion shape PR 3/4/5 of #998 used when `sdd`/`reviews` went
      real. Mutation: the placeholder left non-null → red.
- [x] T4. `static/index.html`: `<nav id="governance-nav">` mounted inside the
      `governance` mode's content area. `static/app.js`: `renderGovernance`
      draws the five sub-nav buttons from `GOVERNANCE_VIEWS`
      (`aria-current="page"` on the active one, no inline handler — mirrors
      `renderModes`); the router renders `renderRoadmap` for the `roadmap`
      sub-view and `said(GOVERNANCE_PLACEHOLDERS[id])` for the other four.
      `static/app.css`: governance-nav + roadmap classes, `--divergence-fg`/
      `--divergence-bg` tokens (light on bare `:root`, dark under
      `prefers-color-scheme`). `static/views-owned.test.mjs`: the forbidden-
      identifier test (`:55-61`) replaced with a presence proof — the
      governance sub-nav mount id exists, `roadmap` renders real content,
      the other four still say their own placeholder, and `decisionsview`/
      `anti-pattern`/`by-?actor`/`historyview` identifiers still do not exist
      (this PR does not draw them yet). RED → GREEN. `renderGovernance`/
      `renderRoadmap` themselves: RED/GREEN N/A — no DOM harness (D9), same
      precedent as #998's PR 2-6 renderers; verified by trace against
      `roadmap-model.test.mjs`'s covered contract.
- [x] T5. `GIT_CONFIG_GLOBAL=/dev/null npm test` and
      `npm run brain:repo:check` green; counted diff under 1000.
- [x] T6. `npm run memory:save -- "<title>" "<content>" --issue 882 --type decision`; stage only the record and `.memory/index.jsonl`.

## PR 2 — Decisions (R882-3)

```brain-slice-scope/2
{"slice": 2, "claims": ["R882-3"], "files": ["brain/scripts/ui/lib/decisions-model.mjs", "brain/scripts/ui/static/app.js", "brain/scripts/ui/static/app.css", "brain/scripts/ui/static/views-owned.test.mjs"], "terminal_pr": "the tracker feature/issue-882-management-views -> main"}
```

- [x] T1a. `lib/decisions-model.test.mjs`: a readable ADR's full row; an
      unreadable ADR kept as its own row, sorted last; `driftWarnings`
      carries `homeOnly`/`filesOnly`/`unreadable` verbatim; `adrsSection.ok
      === false` passes its reason through regardless of `driftSection`.
      RED.
- [x] T1b. `lib/decisions-model.mjs`: `buildDecisionsModel(adrsSection,
      driftSection)`. Mutation: `issues` mislabeled as "driving issues" in a
      test string → the label-text assertion red; reverted (keeps the model
      honest about what the parser actually distinguishes).
- [x] T2. `static/app.js`: `renderDecisions` — the ADR table, drift warnings
      inline beside it. `static/app.css`: decisions classes, existing token
      block only. `views-owned.test.mjs`: `decisionsview`-style identifier
      check flips from "forbidden" to "present, and roadmap/anti-pattern/
      by-actor/history still absent."
- [x] T3. `GIT_CONFIG_GLOBAL=/dev/null npm test` and
      `npm run brain:repo:check` green; counted diff under 1000.
- [x] T4. `npm run memory:save -- "<title>" "<content>" --issue 882 --type decision`; stage only the record and `.memory/index.jsonl`.

## PR 3 — Anti-patterns (R882-4)

```brain-slice-scope/3
{"slice": 3, "claims": ["R882-4"], "files": ["brain/scripts/ui/lib/anti-patterns-model.mjs", "brain/scripts/ui/static/app.js", "brain/scripts/ui/static/app.css", "brain/scripts/ui/static/views-owned.test.mjs"], "terminal_pr": "the tracker feature/issue-882-management-views -> main"}
```

- [x] T1a. `lib/anti-patterns-model.test.mjs`: a row citing both `#N` and
      `ISSUE-N` forms, deduplicated; an unlistable scope said beside the
      other scope's real rows; the whole section unreadable passes its
      reason through. RED.
- [x] T1b. `lib/anti-patterns-model.mjs`:
      `buildAntiPatternsModel(antiPatternsSection)` — grouped `core` before
      `project`, sorted by `id` within each. Mutation: the group order
      swapped → red.
- [x] T2. `static/app.js`: `renderAntiPatterns`. `static/app.css`:
      anti-patterns classes. `views-owned.test.mjs` updated the same way PR
      2 updated it.
- [x] T3. `GIT_CONFIG_GLOBAL=/dev/null npm test` and
      `npm run brain:repo:check` green; counted diff under 1000.
- [x] T4. `npm run memory:save -- "<title>" "<content>" --issue 882 --type decision`; stage only the record and `.memory/index.jsonl`.

## PR 4 — History (R882-5)

```brain-slice-scope/4
{"slice": 4, "claims": ["R882-5"], "files": ["brain/scripts/status/history.mjs", "brain/scripts/status/snapshot.mjs", "brain/scripts/ui/lib/history-model.mjs", "brain/scripts/ui/static/app.js", "brain/scripts/ui/static/app.css", "brain/scripts/ui/static/views-owned.test.mjs"], "terminal_pr": "the tracker feature/issue-882-management-views -> main"}
```

- [x] T1a. `status/history.test.mjs`: `gatherHistoryFacts` parses a fixture
      `git log`/`git tag` output into `{commits, tags}`; a commit whose
      subject ends `(#123)` carries `prNumber: 123`; one without carries
      `null`; either `_run` throwing is `{ok:false, reason}`. RED.
- [x] T1b. `status/history.mjs`: `gatherHistoryFacts({root, _run})`, same
      injected-`_run` seam `release-debt.mjs` uses. Mutation: the `(#N)`
      regex loosened to match mid-subject → the trailing-anchor test red.
- [x] T2a. `status/snapshot.test.mjs` extended: `buildSnapshot`'s returned
      object carries a `history` section built from `gatherHistoryFacts`,
      additive beside the nine existing sections; every existing section
      stays byte-identical (filtered assertion, same discipline #998's PR 4
      used for the archive-reader addition). RED.
- [x] T2b. `status/snapshot.mjs`: wire `history` into `buildSnapshot`'s
      return. Mutation: `history` left out of the return object → the
      snapshot-shape test red.
- [x] T3a. `lib/history-model.test.mjs`: a commit with a PR suffix becomes a
      `merge` event sourced to `{url}`; one without, sourced to `{sha}`; a
      tag becomes a `release` event; an ADR amendment with a date becomes an
      `adr-amended` event; all three kinds merge newest-first; `history.ok
      === false` passes its reason through; no verdict entry is ever
      produced (scan the returned events for a `kind === 'review'` — none
      exists). RED.
- [x] T3b. `lib/history-model.mjs`: `buildHistoryModel({history, adrs})`.
      Mutation: a verdict-shaped event accidentally included → the "no
      review kind" scan test red; reverted.
- [x] T4. `static/app.js`: `renderHistory` — the merged list, plus a plain
      link to the `reviews` mode with the stated reason (no timestamp
      exists for a round yet). `static/app.css`: history classes.
      `views-owned.test.mjs` updated: `historyview`-style identifier now
      present; the link to `reviews` mode is asserted by scan (no duplicate
      review-round rendering inside the history pane).
- [x] T5. `GIT_CONFIG_GLOBAL=/dev/null npm test` and
      `npm run brain:repo:check` green; counted diff under 1000.
- [x] T6. `npm run memory:save -- "<title>" "<content>" --issue 882 --type decision`; stage only the record and `.memory/index.jsonl`.

## PR 5 — By actor (R882-6)

```brain-slice-scope/5
{"slice": 5, "claims": ["R882-6"], "files": ["brain/scripts/ui/lib/actors-model.mjs", "brain/scripts/ui/static/app.js", "brain/scripts/ui/static/app.css", "brain/scripts/ui/static/views-owned.test.mjs"], "terminal_pr": "the tracker feature/issue-882-management-views -> main"}
```

- [x] T1a. `lib/actors-model.test.mjs`: a record-only actor and a
      forge-only actor both get a row, the second `actorKind: null` with the
      stated reason; `reviewsPosted`'s text carries the open-PRs-only
      caveat verbatim; every row's `prsMerged` is the stated-absence shape,
      never a bare `0`; `reviewsSection.ok === false` degrades per-row, not
      the whole view. RED.
- [x] T1b. `lib/actors-model.mjs`: `buildActorsModel(actorsSection,
      reviewsSection)`. Mutation: `prsMerged` defaulted to `0` instead of
      the stated-absence object → red (the "never a bare 0" test).
- [ ] T2. `static/app.js`: `renderActors`. `static/app.css`: actors classes.
      `views-owned.test.mjs` **finalized**: all five sub-view identifiers
      present, `GOVERNANCE_PLACEHOLDERS` has nothing left unbuilt, the
      original forbidden-identifier test from `#998`'s
      `views-owned.test.mjs:55-61` is now fully inverted into a presence
      proof for the whole governance surface.
- [ ] T3. `GIT_CONFIG_GLOBAL=/dev/null npm test` and
      `npm run brain:repo:check` green; counted diff under 1000.
- [ ] T4. `npm run memory:save -- "<title>" "<content>" --issue 882 --type decision`; stage only the record and `.memory/index.jsonl`.

## Review Workload Forecast

Estimated changed lines: ~1430 counted across five PRs (PR 1 ≈360, PR 2 ≈230,
PR 3 ≈200, PR 4 ≈380, PR 5 ≈260); each well under the `lite` tier's 1000-line
budget per PR.
400-line budget risk: Low per PR (each planned under 400, PR 1 and PR 4 the
largest at ~360-380); the tracker to main exceeds 400 by design, chained
under `size:exception`, same posture as `issue-998-ui-surface`.
Chained PRs recommended: Yes — five independent view models, each reviewable
against its own `snapshot.mjs` section(s) alone; PRs 2-5 depend only on PR 1
(the shared sub-nav/row helper), not on each other.
Decision needed before apply: No — the two open facts (reviews-posted
sourcing, epic-grouping data readiness) are resolved in `proposal.md`/
`design.md` with recommendations, not left as blocking questions. The three
items in `design.md` §8 ("open questions") are scoping calls, not blockers —
each has a recommendation and none gates PR 1 starting.

## Out of scope

Tier 2 (#883), telemetry (#884), remote deployment (#885), "PRs merged" per
actor as a real field (no VCS port verb backs it — see `design.md` §5), a
real dated roadmap (no start/due dates exist in the data), the forge identity
binding (#981), any write surface, any new gate, any score or ranking.
