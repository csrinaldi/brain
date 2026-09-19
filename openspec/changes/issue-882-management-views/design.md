# Design — issue-882: the management views

This design follows `openspec/changes/issue-998-ui-surface/design.md`'s own
shape (a component→module map plus numbered decisions, D1…) because #882 is
the direct continuation of that chain: `lib/view-model.mjs`'s `governance`
mode and its placeholder ("lands in PR 7") already exist, waiting for this
ticket.

## 1. Module map

| View | New module | Reads | Renders via |
|---|---|---|---|
| shared sub-nav + row | `lib/governance-model.mjs` | — (pure table + helper) | `app.js`'s `renderGovernance` |
| Roadmap | `lib/roadmap-model.mjs` | `graph` | `renderRoadmap` |
| Decisions | `lib/decisions-model.mjs` | `adrs`, `drift` | `renderDecisions` |
| Anti-patterns | `lib/anti-patterns-model.mjs` | `antiPatterns` | `renderAntiPatterns` |
| History | `lib/history-model.mjs` | new `history` section, `adrs` | `renderHistory` |
| By actor | `lib/actors-model.mjs` | `actors`, `reviews` | `renderActors` |

One new `status/history.mjs` edge module (`gatherHistoryFacts`, pure parse +
injected `_run`) and one new `snapshot.mjs` section (`history`), additive,
beside the nine sections already there. No existing module's shape changes.

`app.js` stays wiring (D9, unchanged): each `render*` function calls its
model, renders `said(reason)` on failure, and otherwise loops over rows —
the same shape `renderSdd`/`renderReviews`/`renderLanes` already hold.
`app.css` gets one new block per view, colours from the existing
`--state-*`/`--severity-*` tokens plus new `--divergence-*` tokens (D6)
defined the same way — light on bare `:root`, redefined under
`prefers-color-scheme: dark`, never only in the media query.

## 2. Why five separate `lib/*.mjs` files, not one `management-model.mjs`

`issue-998-ui-surface/design.md`'s own component map (§4) sketched a single
`lib/management-model.mjs` taking `{adrs, antiPatterns, records, actors,
releaseDebt, drift}` and returning five projections. That shape is
reasonable for a single small PR; it is the wrong shape for a five-view
ticket delivered as a chain (§5 below): every other multi-view slice in this
codebase (`#998`'s `lane-model.mjs`, `sdd-model.mjs`, `review-timeline.mjs`,
each its own file with its own test file) keeps one concern per file so a
PR's diff and its test file are legible on their own, and so a later change
to one view's model cannot silently widen another's test surface. **D1**:
five files, one per view, plus the tiny shared `governance-model.mjs` for the
row helper and the sub-nav table — not `management-model.mjs`'s single
five-key object.

## 3. Fact 1, restated as a design decision

**D2 — the by-actor "reviews posted" column ships now, sourced from
`snapshot.reviews`, not deferred to #880.** Justification and the exact
caveat text are in `proposal.md`. The load-bearing property: when #880 lands
and `records[].type === 'review'` rows exist, `lib/actors-model.mjs`'s
`buildActorsModel` swaps its `reviewsPosted` source to
`aggregateActors`-style counting over those records (the same function that
already counts every other record type per actor) — the row **shape** does
not change, only which section feeds it and whether the caveat string is
still attached. This is the same "additive swap, no contract break" posture
`archive/881/design.md`'s D14 already used for the Reviews tab's own caveat.
**Rejected**: leaving the column out of this ticket entirely, on the
reasoning that #882 "needs: [881, 880]" in the epic body. That reading
treats `needs` as "cannot ship a single fact until every dependency ships,"
which is stronger than any other slice in this epic has read it — #998
shipped `sdd`/`reviews`/`map` content while #967's `kind`/`parent` sat
unused and #880 was still open, each gap said in band rather than blocking
the whole PR. The same posture applies here: ship what is sourced, say what
is not.

## 4. Fact 2, restated as a design decision

**D3 — the roadmap view reads `graph.value.nodes[].kind/parent/tracker`
directly; it does not wait on or depend on `lane-model.mjs`'s `epicGrouping`
field.** Measured at `status/epic-graph.mjs:701-707`: `kind`, `tracker`,
`parent`, `parentSource` have been real fields on every graph node since #967
merged, and the module's own comment names this ticket as their first
reader. `lane-model.mjs`'s `epicGrouping` staying `{ok:false, reason:'…not
data yet (#967)'}` is **that module's own unfinished business** (#998's PR 8,
blocked on #967 having merged — which it now has, but PR 8 has not shipped),
not a fact about whether the data exists. Building the roadmap view against
the raw graph fields, rather than waiting for or patching `lane-model.mjs`,
keeps this ticket's dependency surface to `graph` alone and does not require
touching a module #998's own chain still owns. **Open item, not blocking**:
once #998's PR 8 ships, `lane-model.mjs`'s `epicGrouping` and this ticket's
`roadmap-model.mjs` will both compute epic membership from the same fields;
a later cleanup could have the lane view's cross-lane-epic chips reuse
`roadmap-model.mjs`'s grouping instead of recomputing it, but that is a
follow-up, not this ticket's blocker.

## 5. The "PRs merged per actor" and "History review verdicts" gaps

Neither is fabricated. Both are named in `spec.md` (R882-6, R882-5) as
explicit stated absences rather than silently dropped facts:

- **No VCS port verb returns a merged-PR list with an author.** `mrList`
  (`github.mjs:459`, `gitlab.mjs`'s equivalent) returns `{number, title,
  headBranch}`, no author, and `readForge` only ever calls it with
  `state:'open'` (`snapshot.mjs:364`). Widening the port to add a
  `state:'closed'`/`'merged'` read and an author field is a port-owned
  change with two providers and two contract tests
  (`providers.test.mjs:191/198` is the exact precedent `archive/881
  /design.md`'s Q1 already declined to touch for the same reason) — outside
  this ticket, named as a real gap rather than approximated by, say, reading
  the git author of the merge commit (which is the person who merged, not
  necessarily the PR's author, and would silently misattribute on every
  externally-reviewed PR).
- **No review round carries a timestamp.** `prReviews` returns `{state,
  author, body}` only (`github.mjs:564`; `archive/881/design.md`'s D14
  states this explicitly for the exact same reason). A History timeline
  entry needs a date to sort by; inventing one (e.g. "the poll tick that
  first observed it") would silently assert precision the data does not
  have. So History omits verdicts and links to the Reviews mode instead,
  which already renders every round in full (R998-5) — the same "second
  projection of the same values has no new fact in it" ruling
  `archive/881/design.md`'s item 6 used to reject the design's own
  `sources` tab.

## 6. New tokens

`app.css` gains `--divergence-fg`/`--divergence-bg` (for the roadmap view's
`parent-not-epic`/`parent-ambiguous`/`parent-grammar` warnings and the
Decisions view's drift warnings — one shared visual language for "the data
disagrees with itself," distinct from `--severity-*`, which is about review
findings) — light value on bare `:root`, the design's dark value under
`prefers-color-scheme: dark`, same discipline as every other token.

## 7. Delivery plan

Tracker: `feature/issue-882-management-views`, branched from `main` (post-
#998, which is already merged — commit `2c0cead1`). Five chained PRs, each
under the `lite` tier's 1000-line budget (`brain.config.json:22`,
`governance-tiers.mjs:284`) and planned well under it so cold review stays
focused, matching #998's own per-PR discipline. Counted lines exclude
`**/*.test.mjs` and `openspec/changes/**`.

| PR | Scope | Counted (est.) | Blocked on |
|---|---|---|---|
| 1 | `lib/governance-model.mjs` (sub-nav + shared `row()`), `lib/roadmap-model.mjs`, `view-model.mjs`'s `PLACEHOLDERS.governance → null`, `app.js` governance router + sub-nav + Roadmap render, `app.css` governance/roadmap classes + `--divergence-*` tokens, `views-owned.test.mjs` updated | ~360 | — |
| 2 | `lib/decisions-model.mjs`, `app.js` Decisions render, `app.css` decisions classes | ~230 | PR 1 |
| 3 | `lib/anti-patterns-model.mjs`, `app.js` Anti-patterns render, `app.css` anti-patterns classes | ~200 | PR 1 |
| 4 | `status/history.mjs`, `snapshot.mjs`'s new `history` section, `lib/history-model.mjs`, `app.js` History render (incl. the Reviews-mode link), `app.css` history classes | ~380 | PR 1 |
| 5 | `lib/actors-model.mjs`, `app.js` By-actor render, `app.css` actors classes, `views-owned.test.mjs` finalized (governance surface complete, no PLACEHOLDERS left) | ~260 | PR 1 |

PRs 2, 3, 4 and 5 each depend only on PR 1 (the sub-nav + shared row helper)
and are independently reviewable — no cross-dependency among 2/3/4/5,
mirroring #998's own "each PR's model is pure and untangled from the others"
posture. They are listed and merged in the issue's own order (roadmap →
decisions → anti-patterns → history → actors) for review continuity, not
because a later one needs an earlier one's code.

## 8. Open questions, with recommendations

1. **Should `roadmap-model.mjs`'s "unlinked" bucket page, like
   `lane-model.mjs`'s `?` holding lane does?** Recommendation: not in this
   ticket. #967 is newly merged; `kind: epic` declarations are expected to
   be rare at first (most nodes will land in `unlinked`, the same shape the
   `?` holding lane had before this repo's issues widely declared tracks).
   Ship without paging; add it the same way `lane-model.mjs` did, if and
   when the unlinked bucket's size makes an unpaged list unusable. Flagging
   this now rather than guessing a page size against data that does not
   exist yet.
2. **Does `history`'s 200-commit / N-tag bound need to be configurable?**
   Recommendation: no, not in this ticket — state the bound and the total
   count in the UI ("200 of N shown"), the same honesty
   `archive/881/design.md`'s Q1 used for the 18-minute body-refresh bound.
   A "load more" control is a real feature; nothing in the issue body asks
   for it, and the "not a metrics product" instruction pushes toward less
   surface, not more.
3. **Should the by-actor view's per-period breakdown (the issue body says
   "per period") be a real requirement?** Recommendation: out of scope for
   this pass — `spec.md`'s R882-6 does not require it. `actors.value` rows
   already carry `first`/`last` timestamps per actor (`aggregateActors`,
   `snapshot.mjs:90-107`); a week/month bucketing is a straightforward
   follow-up over the same data once the maintainer confirms the period
   grain wanted (week? release window?). Asking rather than guessing a grain
   avoids building a bucketing UI that gets thrown away.
