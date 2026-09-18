# Spec — issue-882: the management views

Six requirements: one for the shared row/provenance/sub-nav contract every
view is built on (R882-1), then one per view (R882-2..6), in the order the
issue body lists them. Every view follows the vocabulary `snapshot.mjs`
already established: a section is `{ok:true, value}` or `{ok:false, reason}`,
and a model built over a failed section returns its reason rather than an
empty list — never empty-on-failure.

### R882-1: the governance sub-nav and the shared row shape

`lib/governance-model.mjs` MUST define `GOVERNANCE_VIEWS`, the five sub-view
ids in the order the issue body lists them — `roadmap`, `decisions`,
`anti-patterns`, `history`, `actors` — each `{id, label}`, and
`GOVERNANCE_PLACEHOLDERS`, one said sentence per id not yet built (mirroring
`view-model.mjs`'s `PLACEHOLDERS`), so a sub-view under construction across
this ticket's own chained PRs never renders an empty area. It MUST also
export `row({title, detail, source, ...rest})`, one entry shape reused by
every one of the five view builders — `{title, detail, source: sourceLabel,
sourceStamp: sourceStamp(source), ...rest}` — built over `provenance.mjs`'s
existing `sourceLabel`/`sourceStamp` (never a second provenance shaper).
`lib/view-model.mjs`'s `PLACEHOLDERS.governance` MUST become `null` in the
first PR of this ticket's chain: `governance` is a real mode with its own
sub-router from that PR on, even while some of its five sub-views still show
their own said placeholder. `static/index.html` MUST mount a
`<nav id="governance-nav" aria-label="Governance views">` inside the
`governance` mode's content area; `app.js`'s `renderGovernance` draws its five
buttons from `GOVERNANCE_VIEWS` with `aria-current="page"` on the active one,
the same idiom `renderModes` already uses for the four top-level modes
(`app.js:105-114`) — no inline handler, no second copy of the labels. A
governance sub-view keeps the top-level `Tab`/`Esc`/`J`/`K` keyboard contract
untouched (`view-model.mjs`'s `keyAction` is not extended by this ticket);
switching between the five sub-views is mouse/Enter-activated buttons only,
each individually focusable and reachable by the browser's own Tab order —
no new global keybinding is claimed.

#### Scenario: the sub-nav is stable from the first PR, sub-views fill in after
- **WHEN** `GOVERNANCE_VIEWS` is read at any point in this ticket's delivery chain
- **THEN** it always lists exactly the five ids, in the issue's order, and a sub-view not yet built renders `GOVERNANCE_PLACEHOLDERS[id]` instead of an empty area — never a missing button, never a blank pane

#### Scenario: one row shape, every view
- **WHEN** any of the five view builders calls `row(...)`
- **THEN** the returned object carries `source` (the plain label) and `sourceStamp` (the bracketed form), both derived from the same `source` object passed in — never two competing provenance strings for one value

#### Scenario: a failed section is a said reason, never an empty pane
- **WHEN** a sub-view's underlying `snapshot.mjs` section is `{ok:false, reason}`
- **THEN** that view's model returns `{ok:false, reason}` unchanged, and `app.js` renders the reason as a `said(...)` paragraph — the same posture `renderLanes`/`renderSdd`/`renderReviews` already hold for their own sections

### R882-2: Roadmap — the epic graph grouped for real

`lib/roadmap-model.mjs` MUST define `buildRoadmapModel(graphSection,
{project} = {})`, grouping `graph.value.nodes` by epic: a node with
`kind === 'epic'` becomes a roadmap row; every node whose `parent` equals
that epic's number nests under it, carrying its roadmap state
(`planned`/`in-flight`/`done`, from `node.roadmap`, `state-vocab.mjs`'s
`stateOf`) and its `blockedBy` marks. A node with no epic parent —
`parent === null`, or a declared `parent` that resolves to a node whose own
`kind !== 'epic'` — lands in an `unlinked` bucket instead of being dropped
or silently nested under a non-epic (rule zero; the same "never filter a
node away" discipline `lane-model.mjs`'s `?` holding lane already holds for
undeclared tracks). `graph.value.declarationDivergences` entries with
`key === 'parent'` (`parent-grammar`, `parent-ambiguous`, `parent-not-epic`,
per `epic-graph.mjs`) MUST be surfaced per node as an inline warning on that
node's row, never silently absorbed into "unlinked" without saying why. The
model MUST NOT compute a timeline (no start/due dates exist anywhere in the
data): "roadmap" here is per-epic status grouping only, and the view's own
copy says so. Determinism: the same graph, with `nodes` in any order,
produces a byte-identical model.

**Amendment (cold review of PR 1, blocker):** every row MUST go through
`lib/governance-model.mjs`'s `row()` (R882-1's own shared entry shape,
"reused by every one of the five view builders") and carry a real `source`
when one is knowable — `{url: issueUrl(project, node.number)}`
(`lib/forge-url.mjs`, the SAME builder `change-route.mjs`'s `buildPrUrl` now
delegates to) when `project` is present, `source: null` —
`sourceStamp`'s own honest "no source was recorded for this value" stamp —
when it is not. `project` is `server.mjs`'s `buildMeta()` project string,
threaded from `app.js`'s `state.meta?.project`, the same field
`change-route.mjs` already reads to source a PR link (D14).

#### Scenario: an epic's declared children nest under it
- **WHEN** a node declares `kind: epic` and three other nodes declare `parent: <that node>`
- **THEN** the epic's row lists all three as children, each carrying its own roadmap state

#### Scenario: an undeclared node is never dropped
- **WHEN** a node declares no `parent` at all
- **THEN** it appears in the `unlinked` bucket, with its own roadmap state, never absent from the model

#### Scenario: a parent that is not itself an epic is said, not silently trusted
- **WHEN** a node declares `parent: <N>` and node `<N>` exists but does not declare `kind: epic`
- **THEN** the child lands in `unlinked`, carrying the `parent-not-epic` divergence from `graph.value.declarationDivergences` as its own warning — never nested under `<N>` as if it were a real epic

#### Scenario: a graph that cannot be read is a reason, not an empty roadmap
- **WHEN** `graphSection.ok` is `false`
- **THEN** `buildRoadmapModel` returns `{ok:false, reason}` unchanged

#### Scenario: determinism under shuffled input
- **WHEN** the same graph is given twice with `nodes` in different orders
- **THEN** `buildRoadmapModel` returns a byte-identical model both times

### R882-3: Decisions — the ADR table and its drift warnings

`lib/decisions-model.mjs` MUST define `buildDecisionsModel(adrsSection,
driftSection)`, one row per `adrs.value` entry — `{number, title, status,
amendments, issues, supersedes, supersededBy, source: {path}}` for a
readable ADR, `{number: null, ok:false, path, reason}` for an unreadable one,
kept in place rather than dropped (mirrors `adr-index.mjs`'s own "an
unreadable ADR is kept in place" rule). `issues` is passed through exactly as
`parseAdr` extracts it — every `#N` the file's header and amendment headings
cite — labelled "issues referenced in this ADR" rather than "driving issues":
the parser does not distinguish a driving ticket from an incidentally
mentioned one, and this model must not claim a precision the data does not
carry. When `driftSection.ok`, its `homeOnly`/`filesOnly`/`unreadable` lists
(`adr-index.mjs`'s `adrDrift`) are attached as `driftWarnings`, rendered
inline beside the table exactly as `renderSnapshotText`'s text-mode already
renders them (`snapshot.mjs:457-469`) — never a second drift computation.
Rows sort by ADR number.

#### Scenario: a readable ADR's full row
- **WHEN** `adrs.value` carries a readable ADR with two amendments and three cited issues
- **THEN** the row carries its number, title, status, both amendments, all three issues (labelled as referenced, not driving), and its own `source.path`

#### Scenario: an unreadable ADR is a row, not a gap
- **WHEN** one entry in `adrs.value` is `{ok:false, path, reason}`
- **THEN** the table still shows that row, with its path and reason, at its place in the sort — sorted last (no `number` to sort by) rather than dropped

#### Scenario: drift warnings ride beside the table, not instead of it
- **WHEN** `driftSection.ok` and its value carries one `homeOnly` and one `filesOnly` entry
- **THEN** `driftWarnings` carries both, and the table itself is unaffected by either

#### Scenario: an unreadable ADR index is the whole view's own reason
- **WHEN** `adrsSection.ok` is `false`
- **THEN** `buildDecisionsModel` returns `{ok:false, reason}` unchanged, regardless of `driftSection`

### R882-4: Anti-patterns — the catalogue and where each was found

`lib/anti-patterns-model.mjs` MUST define
`buildAntiPatternsModel(antiPatternsSection)`, one row per
`antiPatterns.value.entries` — `{id, title, scope, issues, source: {path}}`
for a readable entry, `{ok:false, path, scope, reason}` kept in place for an
unreadable one — plus `unlistable`, passed through verbatim from
`antiPatterns.value.unlistable` (a scope whose directory could not be listed
at all is said, never rendered as "zero anti-patterns in that scope"). Rows
group by `scope` (`core` before `project`, matching `ANTI_PATTERN_DIRS`'
declared order) and sort by `id` within each scope.

#### Scenario: an entry's row names every issue it cites
- **WHEN** an anti-pattern file cites two issues, one `#N` and one `ISSUE-N` (the pre-#54 convention)
- **THEN** the row's `issues` carries both, deduplicated and sorted, each rendered as its own forge link (`sourceStamp`'s `[forge: #N]` form)

#### Scenario: an unlistable scope is said, never read as empty
- **WHEN** `antiPatterns.value.unlistable` carries one entry for the `project` scope
- **THEN** the model surfaces it as its own said reason beside the `core` scope's real rows — never a silently empty "project" section

#### Scenario: the whole section unreadable is the model's own reason
- **WHEN** `antiPatternsSection.ok` is `false`
- **THEN** `buildAntiPatternsModel` returns `{ok:false, reason}` unchanged

### R882-5: History — merges, releases, ADR amendments, cross-linked to Reviews

`status/snapshot.mjs` gains a `history` section, `{ok, value:{commits, tags}}
| {ok:false, reason}`, read through a new `status/history.mjs` (`gatherHistory
Facts({root, _run})`, the same injected `_run` seam `release-debt.mjs`
already uses — one more `git` call, not a new IO primitive): `commits` is the
served branch's `git log --format='%H|%ai|%s' -n 200` (`prNumber` parsed from
a trailing `(#N)` on the subject, matching this repo's own commit-message
convention, `null` when absent — never fabricated) plus the branch's total
commit count (`git rev-list --count HEAD`), so the page can say "N of TOTAL
shown"; `tags` is `git tag --sort=-creatordate
--format='%(refname:short)|%(creatordate:iso-strict)'`. Either `git` call
failing is this section's own `{ok:false, reason}` — never a partial commit
list rendered as if it were the whole history. `lib/history-model.mjs`'s
`buildHistoryModel({history, adrs})` merges three event kinds into one
list, newest first: a `merge` event per commit (dated, its `prNumber` as a
forge source when present, a plain git source otherwise), a `release` event
per tag, and an `adr-amended` event per ADR amendment carrying a date
(`adrs.value[].amendments[].date`). **Review verdicts are deliberately
excluded from this model** (D-numbered decision in `design.md`): no field
anywhere in the data carries a review round's timestamp (`prReviews`
returns `{state, author, body}` only — `archive/881/design.md`'s D14 already
established this for the Reviews tab), so a verdict cannot be placed on a
real timeline without fabricating an order; the History view instead links to
the existing Reviews mode rather than rendering a second, undated projection
of the same rounds (the same "no second projection of the same values" ruling
`archive/881/design.md`'s item 6 already made for the design's rejected
`sources` tab).

#### Scenario: a commit naming its PR becomes a sourced merge event
- **WHEN** `history.value.commits` carries a commit whose subject ends `(#123)`
- **THEN** the corresponding `merge` event's source is `{url: '<forge PR URL>'}`, rendered through `sourceStamp` as `[forge: #123]`

#### Scenario: a commit with no PR suffix is still an event, sourced to git
- **WHEN** a commit's subject carries no trailing `(#N)`
- **THEN** the `merge` event still appears, sourced to `{sha}` (`[git: <sha7>]`), `prNumber: null` — never dropped, never guessed

#### Scenario: git history unreadable is the section's own reason
- **WHEN** either the `git log` or the `git tag` read throws
- **THEN** `history` is `{ok:false, reason}`, and the History view renders that reason, never a partial or silently-truncated list

#### Scenario: review verdicts are linked, not duplicated
- **WHEN** the History view renders
- **THEN** it shows no per-round verdict entry of its own; it renders one link to the Reviews mode instead, with the reason (no timestamp exists yet) stated in the view's own copy

### R882-6: By actor — records, reviews posted (forge-sourced, caveated), no fabricated merges

`lib/actors-model.mjs` MUST define `buildActorsModel(actorsSection,
reviewsSection)`, one row per actor — keyed by name, merging two sources so
neither can silently outrank the other: every `actors.value` row (records
authored, by type, from `aggregateActors`) AND every distinct `verdict.author`
across `reviews.value[].verdicts` that `actors.value` does not already list
(a forge-only reviewer with no memory record still gets a row, `actorKind:
null`, stated as "kind unknown — no record carries it yet"). Each row's
`reviewsPosted` is a count over `reviews.value[].verdicts` filtered to that
actor, carrying the caveat text verbatim: "source: forge review threads on
open PRs only — a merged PR's rounds are not retained until #880 lands
`type: review` records." **`prsMerged` is NOT a field this model produces**:
no VCS port verb returns a merged-PR list with an author (`mrList` is
`{number, title, headBranch}`, `state:'open'` only), so the row states its
absence in the same place a present field would render, rather than omitting
the row entirely — "PRs merged: not shown — no data source today" is itself
a said reason, not a blank. When `reviewsSection` is unreadable but
`actorsSection` is not, the model still returns actor rows built from
records, with `reviewsPosted: {ok:false, reason}` per row rather than failing
the whole view over one degraded section.

#### Scenario: a record-only actor and a forge-only actor both get a row
- **WHEN** `actors.value` lists one actor with no review rounds, and `reviews.value` carries a verdict authored by a second name absent from `actors.value`
- **THEN** both appear as their own rows; the second carries `actorKind: null` and the stated "kind unknown" reason

#### Scenario: the reviews-posted count states its own scope, every time
- **WHEN** any row's `reviewsPosted` is rendered
- **THEN** its text names the forge-open-PRs-only caveat verbatim — never a bare count with no scope said

#### Scenario: PRs merged is a stated absence, never a fabricated zero
- **WHEN** any row is rendered
- **THEN** it carries a `prsMerged` field reading `{ok:false, reason:'no data source today'}` — never a silent `0`, which would read as "merged nothing" rather than "not measured"

#### Scenario: one degraded section never blanks the other's rows
- **WHEN** `reviewsSection.ok` is `false` and `actorsSection.ok` is `true`
- **THEN** every actor row still renders from records, each with its own `reviewsPosted: {ok:false, reason}` — the whole view is not failed over one section
