---
status: applying
issue: 879
---

# Spec — the read model and `brain:snapshot --json` (#879)

## Requirements

### R879-1: one snapshot, one shape, no re-derivation

The module `brain/scripts/status/snapshot.mjs` exports `buildSnapshot()` returning
`{generatedAt, tier: "committed", graph, changes, prs, reviews, records, adrs,
antiPatterns, actors, releaseDebt, drift}`. It composes brain's existing pure
functions (`buildGraph`, the `sdd-layout` accessors, `deriveTasks`,
`parseVerdict`, `readRecords`, `releaseDebt`) and the two new readers. It parses
no CLI stdout and invents no path.

#### Scenario: module and verb agree
- **WHEN** `npm run brain:snapshot -- --json --now <iso>` runs on a tree and
  `buildSnapshot({ root, now })` is called on the same tree with the same clock
- **THEN** the printed JSON parses to an object deep-equal to the module's return

#### Scenario: nothing is written
- **WHEN** the snapshot is computed
- **THEN** no file under the root changes, and the port it was handed had no write verb called

### R879-2: every section says whether it could be read

Every top-level section is `{ok: true, value}` or `{ok: false, reason}` — the
`field`/`uncomputable` shape `brain:status` already prints. A section never
collapses "could not read" into `[]` or `null`.

#### Scenario: fresh clone, no forge
- **WHEN** no VCS port or project can be resolved
- **THEN** `graph`, `prs` and `reviews` are `{ok: false, reason}` naming the cause, and `changes`, `records`, `adrs`, `antiPatterns`, `actors`, `releaseDebt` and `drift` are computed from the tree

#### Scenario: missing records dir
- **WHEN** `.memory/records/` is absent
- **THEN** `records` and `actors` are `{ok: false, reason}` naming the path — never `[]`

#### Scenario: forge reachable, one PR thread unreadable
- **WHEN** `mrList` answers and `prReviews` fails for one PR
- **THEN** `reviews.value` carries that PR as `{pr, ok: false, reason}` and the other PRs' verdicts intact

### R879-3: ADRs are parsed from the prose convention

`readAdrIndex()` yields, per file under `brain/project/decisions/adr-NNNN-*.md`,
`{number, title, status, date, amendments[{n, date, issue, summary}], supersedes[],
supersededBy, issues[], path}`. The status comes from the `**Status**:` line, the
amendments from the `## Amendment N — summary (issue #N)` headings.

#### Scenario: an amended ADR
- **WHEN** an ADR carries `## Amendment 2 — the canonical flow points at the lane (issue #862)`
- **THEN** `amendments` holds `{n: 2, issue: 862, summary: "the canonical flow points at the lane"}` with the date read from the status line's `amended dd/mm/yyyy` when present

#### Scenario: an unparseable ADR is "could not read", never absent
- **WHEN** a file matches the ADR name pattern and has no title line or no status line
- **THEN** the index carries `{path, ok: false, reason}` for it, in place, and the section is still `ok: true`

### R879-4: anti-patterns are enumerated with their tickets

`readAntiPatterns()` yields `{id, title, scope: "core"|"project", path, issues[]}`
per file under `brain/core/anti-patterns/` and `brain/project/anti-patterns/`,
excluding each `README.md`; `issues` are the ticket numbers the file cites
(`#N` and `ISSUE-N`).

#### Scenario: both scopes, one list
- **WHEN** core holds eight files and project holds none
- **THEN** the list has eight entries with `scope: "core"`, and an absent project dir is reported on the section, not fabricated as empty

### R879-5: the roadmap is derived per node

Each graph node gains `roadmap: {ok, value: "planned"|"in-flight"|"done", evidence}`
from its state, the open PRs whose head branch names the issue
(`<type>/issue-<N>...`) and the latest parsed verdict on such a PR.

#### Scenario: the three states
- **WHEN** a node is closed → `done`; open with an open PR naming it → `in-flight`; open with no such PR → `planned`
- **THEN** `evidence` names the PR number and verdict where one exists

#### Scenario: PRs unreadable
- **WHEN** `prs` is `{ok: false}`
- **THEN** every OPEN node's `roadmap` is `{ok: false, reason}` — "planned" is not asserted from a list that could not be read — and closed nodes are still `done`

### R879-6: actors are one aggregation over records

`actors.value` holds one row per `actor`: `{actor, actorKind, records, byType,
first, last}`, humans and agents in one shape, sorted by actor.

#### Scenario: two actors, three records
- **WHEN** records carry `@a` (two, `decision` and `bugfix`) and `@b` (one)
- **THEN** `@a` has `records: 2`, `byType: {decision: 1, bugfix: 1}`, `first` and `last` the min and max `ts`

### R879-7: the drift check reports, never gates

`drift.value` is `{homeOnly[], filesOnly[], unreadable[]}`: ADRs `brain/HOME.md`
lists that the parser cannot read (by path), ADR files HOME.md does not list, and
files the parser refused. The text mode prints it as a warning; the exit code is 0.

#### Scenario: HOME.md lists an ADR whose file does not parse
- **WHEN** HOME.md links `adr-0099-x.md` and the file lacks a status line
- **THEN** `homeOnly` names `project/decisions/adr-0099-x.md` and the verb exits 0

### R879-8: changes are read through the layout accessor

`changes.value` holds one row per non-archived dir under `openspec/changes/`:
`{id, issue, slug, dir, missing[], tasks: {checked, open, next}, sliceScopes}`,
with `missing` from `missingRequiredArtifacts` and `sliceScopes` from
`parseSliceScopes`.

#### Scenario: a change with an unreadable tasks.md
- **WHEN** a change dir has no `tasks.md`
- **THEN** its `tasks` is `{ok: false, reason}`; `missing` names `tasks.md` at `standard`, where the tier requires it, and not at `lite`, where only `spec.md` is required — the tier decides the set, the reader never holds one
