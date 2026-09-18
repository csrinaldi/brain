# Proposal — issue-882: the management views (roadmap, decisions, anti-patterns, history, by actor)

Parent: #878 (Brain UI) — slice 4, Wave B. `needs: [881, 880]` per the epic
body; #881 (the server, the canvas, the six-tab door) shipped as #970, and its
follow-on #998 (the redesigned surface — lanes, the SDD view, the reviews
timeline) shipped as #1028 and already reserves this ticket's landing spot:
`lib/view-model.mjs`'s fourth mode is `governance`, and its placeholder reads
*"the governance view is not built yet — it lands in PR 7"* — PR 7 of #998's
own chain, which #998's `design.md` explicitly left to this ticket. #880
(review rounds as `type: review` memory records) is **still open** — see
"Fact 1" below for how this proposal handles that.

## What this ticket owns (issue #882 body, verbatim scope)

1. **Roadmap** — the epic graph as tracks over time, planned / in-flight /
   done per node, from `snapshot.graph` and the roadmap derivation (#879).
2. **Decisions** — the ADR table: number, title, status, amendments, driving
   issues; a click opens the ADR. Drift-check warnings shown inline.
3. **Anti-patterns** — the catalogue, with the tickets where each was found.
4. **History** — a timeline of merges, releases (tags), ADRs and review
   verdicts, from git, PR merge events and records.
5. **By actor** — humans and agents in one schema (`actor`/`actorKind`):
   records authored, reviews posted (#880), PRs merged, per period.

## What it must NOT become

A metrics product. Counts sit beside the list they count; nothing here is
scored or ranked (issue #882's own words). No new gate, no write surface.

## Two facts this proposal resolves, not defers

**Fact 1 — "reviews posted" cannot wait for #880.** The issue body cites #880
for the by-actor reviews column, but #880 has not shipped: there is no
`type: review` memory record yet. The alternative the data already supports is
`snapshot.reviews` — the forge review threads `readForge()` already reads
(`status/snapshot.mjs:362-384`), each verdict carrying its `author`. That
source is real and sourced, but it is scoped to **open PRs only**
(`readForge` calls `mrList({state:'open'})`, `snapshot.mjs:364`) — a merged
PR's review thread is gone from the next poll. **Recommendation: ship the
column now, sourced from `snapshot.reviews`, with the scope said in the row's
own text** — the exact posture `archive/881/design.md`'s D14 already took for
the Reviews tab's own caveat ("source: forge comments, until #880 lands
`type: review` records"). When #880 lands, the source swaps to
`records[].type === 'review'` (which the by-actor model already reads for
every OTHER record type) and the row's caveat text simply goes away — no
contract change on the view side. Never shipping the column until #880 lands
would leave "who reviewed what" the one fact in this ticket's whole surface
that stays an empty area for an indeterminate wait, which is the posture
`evidence-reader-empty-on-failure.md` forbids for a computable-with-caveats
fact.

**Fact 2 — epic grouping is real data now, not a placeholder.** #998's
`lib/lane-model.mjs` still hardcodes `epicGrouping: {ok:false, reason:'kind
and parent are not data yet (#967)'}` — but #967 merged (`c8b3cd95`,
"feat(governance): an epic's tracker is data…") and `epic-graph.mjs` has
carried `kind`, `tracker`, `parent`, `parentSource` on every graph node since:
measured at `status/epic-graph.mjs:701-707`, whose own comment reads *"Nothing
else in the tree reads them yet — the verb and the gate that do arrive in the
next two slices, and **the UI's node projection is #882's**."* That sentence
names this ticket by design. So the roadmap view groups by epic **for real**:
a node with `kind === 'epic'` is a roadmap row; a node whose `parent` names
that epic nests under it; `graph.value.declarationDivergences` already
reports `parent-grammar`, `parent-ambiguous` and `parent-not-epic` per node
(`epic-graph.mjs:519-541`, `:727-730`) and the roadmap view surfaces those as
inline warnings, the same "say it, never fabricate it" posture the ADR drift
check and the `?` holding lane both already use. This view does **not**
depend on `lane-model.mjs`'s own `epicGrouping` field catching up (that field
is PR 8 of #998's chain, a different view's concern — the track-lanes map);
#882 reads `graph.value.nodes[].kind/parent/tracker` directly.

## What changes

- `lib/view-model.mjs`: `PLACEHOLDERS.governance` becomes `null`; the
  `governance` mode renders real content.
- Five new pure `lib/*.mjs` models, one per view, each `{ok, value|reason}`
  over an existing (or one new) `snapshot.mjs` section — see `design.md`.
- One new `snapshot.mjs` section, `history`, reading two more git calls
  (`git log`, `git tag`) through the same injected `_run` seam
  `release-debt.mjs` already uses — no new IO primitive, the same seam.
- `app.js` grows a governance sub-nav (five buttons, same idiom as the four
  top-level modes) and one `render*` function per view.
- `app.css` grows the governance/roadmap/decisions/anti-patterns/history/
  actors classes, colours from the existing token block only.
- `static/views-owned.test.mjs` is extended (not rewritten — the four-mode
  nav, the six tabs and the endpoint list all stay exactly as #998 left
  them): the forbidden-identifier test that currently asserts "no roadmap,
  decisions, anti-pattern or by-actor/history view identifier exists"
  (`views-owned.test.mjs:55-61`) is replaced, PR by PR, with a presence
  proof enumerating exactly what has shipped so far.

## What does not change

`snapshot.mjs`'s existing sections (`graph`, `adrs`, `antiPatterns`, `records`,
`actors`, `releaseDebt`, `drift`, `prs`, `reviews`) keep their shapes; this
ticket only reads them and adds one new section (`history`) beside them,
additively. No existing route, mode, tab or keybinding changes.

## Scope

In scope: the five views listed above, read-only, committed tier only, on top
of `snapshot.mjs`'s existing sections plus one new `history` section.

## Non-goals

- Tier 2 (local overlay, uncommitted state) — #883.
- Telemetry, live agent heartbeats — #884.
- Remote deployment, access control — #885.
- "PRs merged" per actor, as its own fact — see `design.md`'s open questions:
  no VCS port verb returns a merged-PR list with an author today (`mrList`
  is `{number, title, headBranch}`, no author field, and is scoped to
  `state:'open'`; a merge event is read from `history`'s git log instead,
  which carries no author either — only the commit's author, which the repo's
  squash-merge convention makes the last committer, not necessarily the PR's
  author). Declared out of scope rather than approximated with a fact the
  data cannot back — the same discipline #998's proposal used for the 5
  design fields it declared absent by rule zero.
- A real per-node roadmap **timeline** (dates, durations, ETAs) — the data
  has no due dates or start dates anywhere; "roadmap" here is a status board
  grouped by epic (planned / in-flight / done, #879's roadmap derivation),
  not a Gantt chart. Said plainly in `design.md` rather than implied by the
  issue title.
- The forge identity binding (#981) — an actor's forge username and a
  record's `actor` field are matched by string equality only; no identity
  resolution is attempted here.
- Any write surface, any new gate, any score or ranking.

## Acceptance (issue #882's own words)

1. "Where is the epic, what is blocked, who did what this week" is answerable
   from these views alone (epic exit 3).
2. Every row links to its source: the ADR file, the issue, the PR, the record
   id.

```brain-graph/1
track:    UI
blocks:   [885]
needs:    [881, 880]
files:    ["brain/scripts/ui/**", "brain/scripts/status/snapshot.mjs"]
```
