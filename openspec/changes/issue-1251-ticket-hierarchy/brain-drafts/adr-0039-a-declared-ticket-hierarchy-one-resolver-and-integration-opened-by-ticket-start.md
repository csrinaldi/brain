# ADR-0039 — A declared ticket hierarchy: one resolver, a `move` that keeps the sources together, and the integration that `ticket:start` opens

> **status:** proposed — rulings of 2026-10-02 and 2026-10-07 on #1251, pending human promotion | **date:** 2026-10-07 | **owner:** @crinaldi
> **relates to:** ADR-0020 (port widening is a decision), ADR-0029 (two sources, one graph), ADR-0032 (the `brain-graph/1` tag), ADR-0034 (lanes), ADR-0035 (a branch name is a claim), ADR-0037 (who merges), ADR-0038 (one config shape per axis, with its Amendments 1-2), ADR-0040 (the owned team config); `brain/core/methodology/harness-contract.md` (`ticket:start` row); `brain/core/methodology/agent-authorities.md`; maintainer rulings on #1251, 2026-10-02 and 2026-10-07; #697, #930, #967, #1121, #1130, #1199, #1206, #1257, #1293, #1335

> **Tier 2 draft.** `brain/project/decisions/**` is human-promoted (`agent-authorities.md` Tier 2).
> Promote with `npm run brain:promote -- <this path>`: the verb writes the house header, adds the
> `brain/HOME.md` entry `decision-gate` requires, regenerates `AGENTS.md` and stages all three.
> Committing them is the signature. The number `0039` is still free on `origin/main` at `fe27c260`
> (ADR-0038 and ADR-0040 exist there; no ref carries another `adr-0039-*`). The filename and the H1
> carry the same number, which `brain:promote` checks (`DRAFT_BASENAME_RE`, `H1_RE`). The
> `brain/HOME.md` line the verb derives from this H1 is, as a draft:
>
> - [ADR-0039](project/decisions/adr-0039-a-declared-ticket-hierarchy-one-resolver-and-integration-opened-by-ticket-start.md) — A declared ticket hierarchy: one resolver, a `move` that keeps the sources together, and the integration that `ticket:start` opens
>
> **ADR-0038 is on `main` now** (#1114, PR #1296), so the placement of `hierarchy` inside the
> `vcs` axis object no longer waits on another tracker.
>
> This ADR names amendments to ADR-0029, ADR-0032, ADR-0035, to the `harness-contract.md`
> `ticket:start` row and to `agent-authorities.md`, and edits none of them. Each is a separate
> draft, promoted after this ADR.

## Context

Brain can say that one issue is an epic and that another issue's parent is that epic. It cannot
say anything else about a hierarchy, and it cannot open the integration a hierarchy implies.
Measured on `main` at `fe27c260`, paths under `brain/scripts/` unless noted.

### What exists

| Surface | What it does today |
|---|---|
| `status/epic-graph.mjs:371` `parseGraphBlock` | Reads the ` ```brain-graph/1 ` block (ADR-0032): `track`, `kind`, `tracker`, `parent`, `blocks`, `needs`, `files`. `declaredParent` (`:297`) also reads a prose `Parent: #N` line. |
| `status/epic-graph.mjs:492` | `kind` is read verbatim and **only `'epic'` carries meaning**; no other level exists. A `parent` that does not declare `kind: epic` is a `parent-not-epic` divergence (`:729`). |
| `status/epic-graph.mjs:117` `TRACKER_GRAMMAR` | A `tracker:` must match `^feature\/…`; anything else is refused as `tracker-grammar`. |
| `status/epic-graph.mjs:507` | A `tracker:` on a node whose `kind` is not `epic` is carried and honoured nowhere (`tracker-without-kind-epic`). |
| `status/hierarchy-adapter.mjs` | #1199's stand-in for this ADR's resolver: the `{ issues, divergences }` contract over today's `kind` and `parent`, `milestone` always `null`. The snapshot exposes it as `hierarchy` (`status/snapshot.mjs:553`). |
| `lib/ticket-base.mjs:57` `resolveBase` | The base of a new slice is the parent's `tracker`, **one hop**, and only when that parent declares `kind: epic`. Otherwise `main`. It refuses one thing: an explicit `--base main` against a declared tracker, with `--off-tracker` as the named opt-out (`:141-143`). |
| `governance/checks/base-branch.mjs` | The `base-branch` gate (#967) is the backstop for the same one-hop rule, and it requires a tracker PR to target the default branch: "a tracker integrates into the default branch, it does not stack onto another tracker". |
| `ticket-start.mjs:114`, `:146` | Requires a `type:*` label (#1206), maps it to a prefix (`lib/branch-type.mjs`) and composes `{type}/issue-{N}-{slug}` (`lib/branch-grammar.mjs`). |
| `lib/branch-grammar.mjs:16` `CANONICAL_BRANCH_RE` | The one owner of branch parsing (#697): `^([a-z]+)\/issue-(\d+)(?:-(.*))?$`. |
| `brain-ship.mjs:63` | The PR body always ends `Closes #<issue>`, and the base is always the default branch. |
| `axes/vcs/adapters/github.mjs:221-240` | `issueRelations` deliberately does **not** read sub-issues: containment is not ordering (ADR-0029 Decision 2). No adapter reads GitLab epics, the work-item hierarchy, a native milestone or a GitHub issue type. |
| `axes/vcs/adapters/github.mjs:497` | `issueList` returns `state` and `body` since #1257, each `null` when unreadable, never coerced. |
| `axes/vcs/adapters/github.mjs:742`, `gitlab.mjs:1308` | `mrCreate` takes `{ title, body, head, base, labels }`. **No draft flag.** |
| `axes/vcs/adapters/github.mjs:1078`, `gitlab.mjs:1040` | `issueClose` exists on both providers. |
| `status/epic-render.mjs:9-10`, `status/epic-map.mjs` | `brain:epic:map` writes a marker-bounded region (`<!-- brain:epic:map BEGIN/END -->`) into an epic body, proven contained by `replaceMapRegion`/`outsideRegion` (ADR-0029 Decision 3). |
| `governance/checks/lane.mjs:15`, `governance/checks/archive-sweep.mjs:79` | The lanes are anchored regexes: `^memory\/…`, `^auto-archive\/\d{4}-\d{2}-\d{2}$`. |

### What is missing

1. **Levels beyond `epic`.** There is no milestone, release or feature level, and no way for a
   consumer to declare its own. Nothing says which level may be the parent of which.
2. **Milestones.** No verb reads or writes a forge milestone. This repository has none:
   `gh api repos/csrinaldi/brain/milestones?state=all` returned 0 on 2026-10-02, the same
   measurement `status/release-debt.mjs:4` records.
3. **Trackers are created by hand.** `ticket:start` reads a `tracker:` someone wrote; it never
   creates the branch, and no draft PR collects the parent's work.
4. **More than one hop.** A ticket under an epic under a milestone cannot reach the milestone's
   tracker; `resolveBase` stops at the first parent, and only if it is an epic.
5. **Staleness on move.** Re-parenting a ticket or changing its level means editing a block,
   labels, a native milestone and a branch by hand. Nothing notices when one is left behind.
6. **Changes made in the forge are invisible.** A sub-issue added in GitHub's UI, a GitLab epic
   link or a native milestone assignment never reaches brain (#1251, item 11, 2026-10-07).
7. **The parent's list of children is hand-written and drifts.** The #878 audit of 2026-10-07
   found children missing from the body. `brain:epic:map 878 --dry-run --no-relations` took 3m35s
   over 168 open issues, mapped the whole repository rather than the epic's subtree, read open
   issues only, and printed Spanish text hard-coded in the module (#704) (#1251, item 12).

## Decision

### 1. `vcs.hierarchy` declares the levels

The hierarchy is declared inside the `vcs` axis object, beside `default` and `providers`.
ADR-0038 §1 allows this: settings that belong to the axis, not to a provider, stay beside them.

- **`levels` is an ordered list, and its order is the nesting.** A level's parent is always a
  higher level, that is, one earlier in the list. **Skipping a level is allowed**: a ticket may
  have a milestone as its parent when an `epic` level exists between them. **Inverting the order
  is never allowed.**
- **A level entry declares how the level is expressed in the forge:**
  - `name`: the level's name, which is also the block's `kind` value;
  - `label`: a searchable label, `level:<name>` (decision 2);
  - `native`: the forge construct that **mirrors** the level, for example `"milestone"`
    (decision 4). A mirror is read for drift only (decisions 3 and 5);
  - `branch`: the pattern of the branch segment this level contributes (decision 9);
  - `integration`: the level integrates its children on a tracker branch (decision 7). Its value
    is `{ "draftPr": <boolean> }`.
- **A level must declare `label`, `native`, or both.** A config that breaks this is refused. A
  level expressed by neither exists only inside the body block, so the forge cannot search for it
  and the drift check has no second source to compare the block with.
- **A level entry has no `parent` key.** The order is the only statement of nesting, so a second
  statement could only agree with it or contradict it.
- **`vcs.hierarchy.default` names the level an issue resolves to when no source names one, and it
  is required** (ruling Q7, 2026-10-07). It is one key holding a level `name`, in ADR-0038 §1's
  shape: not a `default: true` flag on a level, because a flag can be set on zero levels or on two
  and a single key cannot. A `default` that names no level in `levels` is refused. **Resolving to
  the default is not drift**; a `level:*` label that contradicts the block is (decision 3).
- **No level pattern may claim a lane** (ruling Q9, 2026-10-07). Config validation refuses a level
  whose `branch` pattern starts with `memory` or `auto-archive`: such a branch would claim
  ADR-0034's or ADR-0035's lane and its `issue-link` exemption.
- **The body block always carries `kind` and `parent`.** `kind` names a level from `levels`;
  `parent` is an issue number, as today (`PARENT_KEY_GRAMMAR`, `epic-graph.mjs:135`).

**What owning the key means (ADR-0038, ADR-0040).** `vcs` has no `.env` level and no user layer
(ADR-0038 §2 and Amendment 1; ADR-0040 section 2), so `vcs.hierarchy` is a team setting only and
is validated on the team layer alone. A change to it is a change to `brain.config.json` and passes
the `team-config-reviewed` gate like any other. An agent never edits it in an existing repository
(`agent-authorities.md` Tier 3): `ticket:start`, `move` and the drift check write issues,
branches and PRs, never the config.

### 2. Level labels are `level:*`, never `type:*`

`type:*` already means the kind of change. `ticket:start` and `brain:ship` read it, and #1206
requires it. Reusing the namespace for the level would make `type:epic` both a change type and a
hierarchy level, and `deriveBranchType` would fall back to `feat` for it. Level labels use
`level:<name>`.

### 3. One resolver: `lib/ticket-hierarchy.mjs`

One module resolves the hierarchy, and every reader calls it: `status/epic-graph.mjs`, the
snapshot and the UI (#1199), `ticket:start`, `move`, the drift check and the children region
(decision 10). No consumer derives a level, a parent, a tracker or a milestone on its own. It
replaces `status/hierarchy-adapter.mjs`, whose contract it keeps.

```text
resolveHierarchy({ issues, config, forgeLoad, native }) -> {
  issues: Map<number, {
    level:       string | null,
    levelSource: 'block' | 'label' | 'native' | 'default' | null,
    parent:      number | null,
    children:    number[],
    tracker:     string | null,
    milestone:   { number, title, state, native } | 'none' | null,
    state:       'open' | 'closed' | null,
    divergences: { source, field, expected, found }[],
  }>,
  divergences: { issues: number[], field, ... }[],
}
```

- **Level precedence: block > label > native > default** (ruling Q2, 2026-10-07). The first source
  that names a level is the level, and `levelSource` says which one it was. **Every disagreement
  between sources is a divergence**, whichever wins. Falling through to `vcs.hierarchy.default` is
  not one (ruling Q7).
- **`parent` comes from the block (or its prose `Parent: #N` line) and from nothing else.**
  Native containment never resolves a parent (ruling Q11, decision 5).
- **`state` is tri-state: `'open' | 'closed' | null`.** `null` means brain could not read it
  (ADR-0029 Decision 1). It never means open. A rollup counts an unknown child as unknown, never
  as done and never as not done.
- **`milestone` is `object | 'none' | null`** (ruling Q8, 2026-10-07). The object is the nearest
  ancestor whose level is `milestone` (decision 4): `{ number, title, state, native }`, where
  `native` is the mirror's own reading, `{ number, title, state, dueOn } | 'none' | null`.
  `'none'` means the chain was read to its root and holds no milestone. `null` means brain could
  not read it, and **an unmeasured milestone is never displayed as "no milestone"**.
- **`children: number[]`** is the inverse of `parent`, computed once by the resolver. It includes
  closed children when the closed lane is loaded. No consumer inverts `parent` itself.
- **The resolver is hierarchy only.** Ordering and scope (`track`, `blocks`, `needs`, `files`)
  stay in `epic-graph`. Each field has exactly one source module.
- **Partial input is normal** (agreed with #1199 on #1251, 2026-10-02). The input carries
  `forgeLoad: { open: { state, at, reason? }, closed: { state, at, reason? } }`, each lane
  `'pending' | 'complete' | 'failed'`, and the closed lane may also be `'disabled'`. An issue not
  loaded yet has `state: null`. **A parent that is referenced but not loaded is a divergence only
  when the lane that would hold it is `complete`**; until then the entry carries `state: null` and
  no divergence, so a view never flashes false divergences while it loads. An incremental `since=`
  refresh keeps `complete`; a `failed` after a `complete` keeps the last complete data and reports
  its age. The native lane of decision 5 follows the same rule.
- **Divergences live in two places:** on each issue's entry, `{ source, field, expected, found }`;
  and at the top level, for one that belongs to no single issue, for example a level inversion
  between a parent and a child, naming the issues involved.

**A disagreement between the block, the labels and the native mirrors is data, never silence**
(ADR-0029 Decision 2). The resolver reports it and never repairs it.

### 4. A milestone is an issue; the forge's milestone is its mirror

(ruling Q4, option D, 2026-10-07)

- **A brain milestone is an issue whose block declares `kind: milestone`.** Its children declare
  `parent: <N>`, exactly as an epic's do. Milestone membership is therefore ordinary ancestry, and
  the block is its source of truth (ruling Q2).
- **The forge's native milestone object is a mirror with the same name.** Brain creates it and
  assigns the subtree's issues to it, for example on `move`, so the forge UI shows the grouping.
  Brain reads it back for drift only (ruling Q11): a native assignment that disagrees with the
  ancestry is a divergence on the issue, never a reason to change `parent`.
- **The native object is not an issue on GitHub or GitLab.** So it cannot be a node, cannot carry a
  block and cannot be a PR's `Closes` target. The milestone issue is all three.

This **supersedes** the 2026-10-02 reading recorded in the previous draft, under which the native
milestone was authoritative and a `native: "milestone"` level had no issue behind it.

### 5. Native containment is read for drift only

(ruling Q11, option B, 2026-10-07)

- **Brain reads the forge's native containment**: GitHub sub-issues, GitLab epics and the
  work-item hierarchy, and the native milestone. It compares them with the resolved hierarchy and
  reports each disagreement as a divergence. **It never resolves a parent from them.**
- **A provider or tier that has no such construct is "unmeasured", never "no children".** The
  entry's native reading is `null`, and it manufactures no divergence, the rule ADR-0029 Decision 2
  already applies to an unreadable `issueRelations`.
- **The read costs one forge call per issue, so it runs in a cached background lane.** No first
  render waits on it (the #1199 UI rule); the lane reports its own `forgeLoad`-shaped state.
- **It can be upgraded to a union source later**, in ADR-0029's framing, by a new decision. This one
  does not take it.

### 6. Staleness: `brain:ticket:move` and a drift check

- **`brain:ticket:move`** re-parents a ticket or changes its level. It rewrites every source
  together, through the VCS port: the body block (`kind`, `parent`), the `level:*` labels, the
  native milestone mirror (decision 4) and the branch (decision 9). It is the writer that keeps the
  mirrors in step; it never writes `brain.config.json`.
- **A drift check** in `brain:doctor` (#1130) and `brain:governance-status` reports every issue
  whose sources disagree. Its input is the resolver's two `divergences` lists, including decision
  5's native ones; it computes nothing of its own. A manual edit in the forge UI, for example a
  label removed or a sub-issue added by hand, is therefore reported as drift.
- **The same doctor counts the open branches and PRs that still use the legacy branch grammar**
  (decision 9, ruling Q6).

### 7. The integration lifecycle, opened by `ticket:start`

- **A level may declare `integration`.** Its tracker branch is the node's branch path with the
  fixed `tracker` leaf (decision 9). `draftPr: true` means the tracker has a draft PR that collects
  the node's work.
- **A milestone integrates too** (ruling Q5, option A, 2026-10-07). Epics integrate into the
  milestone's tracker, and the milestone's tracker integrates into `main`:
  `release-1.13/tracker` above `release-1.13/epic-878/tracker` above the tickets. The reason is the
  maintainer's: a set of epics makes a release, integrating them straight into `main` can break it,
  and parallel milestones integrating into `main` would contaminate each other.
- **`brain:ticket:start N` resolves the nearest ancestor of `N` whose level declares
  `integration`.** This replaces `resolveBase`'s single hop to a `kind: epic` parent. A tracker
  integrates into its nearest integrating ancestor's tracker, or into `main` when it has none.
- **When trackers are missing, `ticket:start` creates the whole missing chain under one
  confirmation** (ruling Q1, option A, 2026-10-07). It first prints a plan that lists every branch
  it will push and every draft PR it will open, top-down. On "yes" it, for each missing tracker
  from the highest down:
  1. pushes the tracker branch from its own parent's tracker, or from `main`;
  2. opens the draft PR, head the tracker, base that same parent branch, body `Closes #<node>`,
     when the level declares `draftPr: true`;
  3. writes `tracker: <branch>` into the node's block.

  On "no" nothing remote happens, and the operator gets today's behaviour: base `main`, with the
  reason said.
- **It then creates the ticket's worktree on a branch off the nearest tracker.** The ticket's PR
  targets that tracker.
- **Remote branch creation and PR creation are Tier 2** (`agent-authorities.md`). The single
  confirmation covers exactly the plan it printed; anything not in the plan is not authorised.
- **A child merged into a tracker is closed by a post-merge step** (ruling Q3, option B,
  2026-10-07). Closing keywords act only on merges into the default branch (GitHub's documented
  behaviour; GitLab's is unmeasured and must be measured before this slice). So when a child's PR
  merges into a tracker, a post-merge step calls `issueClose` through the port, and the rollup is
  exact. At `lite` it is a reported Tier 2 act. **The child's PR body keeps `Closes #<child>`** as
  a backstop for the final merge to `main`, and adds `Part of #<parent>`.
- **When all of an integrating node's children are closed,** brain reports that its draft PR is
  ready. A child whose `state` is `null` holds the report back and is named as unknown.
- **Integration PRs follow the declared autonomy mode like any PR** (ruling Q10, option A,
  2026-10-07). ADR-0037 applies unchanged: the producer never approves or merges, in any mode, and
  there is no exception per PR kind. Brain itself holds no merge verb.

### 8. A hotfix starts from `main` and is not a level

(ruling Q1-hotfix, option A, 2026-10-07)

- **A hotfix is a ticket started explicitly from `main`**, `ticket:start N --base main`, on an
  issue labelled `hotfix`. No tracker chain is created even when the issue has a parent; the parent
  is tracking only.
- **Hotfix is not a level.** There is no `kind: hotfix`, and `hotfix` is not a `level:*` label.
- **After it merges into `main`, brain looks for open trackers behind `main`** and proposes one
  "merge main into tracker" PR for each. Each is merged with `--merge`, never squashed: a squash
  drops `main`'s ancestry from the tracker (#1293). Opening each PR is Tier 2, like any PR.

### 9. Hierarchical branch names

- **A branch is its ancestors' segments joined by `/`, followed by its own leaf.**
  - A node that integrates has the fixed leaf `tracker`: `release-1.13/tracker`,
    `release-1.13/epic-878/tracker`.
  - A ticket's leaf is its own segment: `release-1.13/epic-878/issue-56-slug`.
  - A ticket with no ancestor has its segment alone: `issue-56-slug`.
- **A level without `branch` contributes no segment** (ruling Q5, 2026-10-07).
- **Why a fixed `tracker` leaf.** Git cannot hold a ref that is both a leaf and a directory. With
  `refs/heads/release-1.13` as a branch, `refs/heads/release-1.13/epic-878/…` cannot be created.
  With the `tracker` leaf, `release-1.13` is only ever a directory.
- **Each level configures its segment pattern** in `branch`, for example `"epic-{number}"` or
  `"issue-{number}-{slug}"`. Where the milestone segment's `1.13` comes from is open (Open
  question 6).
- **The change type leaves the branch name.** It comes only from the `type:*` label (#1206), which
  `ticket:start` already requires. The branch parsers (`lib/branch-grammar.mjs`, #697, and its
  readers) adapt.
- **The legacy grammar stays accepted while it is in use** (ruling Q6, option A, 2026-10-07).
  `{type}/issue-{N}-{slug}` is parsed for as long as any open branch or PR uses it. The doctor
  counts them (decision 6), and the alias is removed in the minor after that count reads 0.
  `capture-provenance` and the snapshot read the canonical form only ("durable writes never
  guess", `branch-grammar.mjs:8`), so the new form is canonical in that module from the first
  slice, not a lenient fallback.
- **A branch name is a claim, never the proof** (ADR-0035). A branch path that disagrees with the
  resolver is drift, reported by decision 6, and never a reason to re-parent anything.
- **`move` renames a branch only when no PR is open on it.** When one is open, `move` leaves the
  branch alone, and the drift check reports the stale name.
- **The lane branches keep their names**, and no level may produce them (decision 1, ruling Q9):
  `memory/<host>-<date>` (ADR-0034 L1) and `auto-archive/<date>` (ADR-0035).

### 10. A generated children region in the parent's body, for humans only

(ruling Q12, option A, 2026-10-07)

- **The parent's body carries a generated children region**: its subtree, closed children
  included, each child's state, and the rollup. It is rendered from the resolver and the cached
  lanes, never from one forge call per child, and is rewritten after merges by the same writer
  module as #1335.
- **It sits between HTML comment markers, outside any `brain-graph/1` fence**, and its text says
  that it is generated by brain, not read, and not to be edited. It uses no fence that looks like a
  declaration (ADR-0032).
- **It is not a contract. No brain tool reads its contents**, and a test pins that. The writer
  locates its own markers to replace the region, under ADR-0029 Decision 3's containment proof,
  and parses nothing between them.
- **The contract stays the child's `parent:`.** A tool that needs an issue's children reads the
  resolver, for example `brain:snapshot --json`'s `hierarchy.children`.
- **A versioned, readable list was rejected.** Making the region a contract would need a versioned
  definition like `brain-graph/1`, and it would be a second declaration of the same relation the
  child's `parent:` already declares.

### 11. `issueList` carries `state` and `body`

`issueList` returns `state` (`'open' | 'closed' | null`) and `body` (`string | null`, never coerced
to `''` when unread) on every entry, as an additive widening, the same move #930 made for `mrList`.
**This shipped in #1257**, and it is what lets one paginated call give the resolver every issue's
block and state. It is recorded here because the resolver depends on it.

## Config examples

### A valid hierarchy

```json
{
  "vcs": {
    "default": "github",
    "providers": { "github": {} },
    "hierarchy": {
      "default": "ticket",
      "levels": [
        { "name": "milestone", "label": "level:milestone", "native": "milestone",
          "branch": "release-{name}", "integration": { "draftPr": true } },
        { "name": "epic", "label": "level:epic", "branch": "epic-{number}",
          "integration": { "draftPr": true } },
        { "name": "feature", "label": "level:feature" },
        { "name": "ticket", "label": "level:ticket", "branch": "issue-{number}-{slug}" }
      ]
    }
  }
}
```

The milestone is an issue (decision 4) with a label, a native mirror, a branch segment and an
integration. `{name}` is the placeholder whose source is Open question 6. `feature` declares no
`branch`, so it contributes no segment (ruling Q5) and does not integrate. `ticket` is where an
issue with no level lands.

### Refused: a level that declares a parent, here an inverted one

```json
{ "vcs": { "default": "github", "providers": { "github": {} },
  "hierarchy": { "default": "ticket", "levels": [
    { "name": "epic", "label": "level:epic", "parent": "ticket" },
    { "name": "ticket", "label": "level:ticket" } ] } } }
```

Refused because a level entry has no `parent` key (decision 1). The same inversion in issue data
(an epic whose `parent:` is a ticket) is not a config error: the resolver reports it as a top-level
divergence naming both issues.

### Refused: a level expressed by neither `label` nor `native`

```json
{ "vcs": { "default": "github", "providers": { "github": {} },
  "hierarchy": { "default": "ticket", "levels": [
    { "name": "epic", "branch": "epic-{number}", "integration": { "draftPr": true } },
    { "name": "ticket", "label": "level:ticket" } ] } } }
```

Refused because only the body block could say that an issue is an epic (decision 1).

### Refused: no default, a default that names no level, a lane-shaped segment

```json
{ "vcs": { "default": "github", "providers": { "github": {} },
  "hierarchy": { "default": "story", "levels": [
    { "name": "drop", "label": "level:drop", "branch": "memory-{number}" },
    { "name": "ticket", "label": "level:ticket" } ] } } }
```

Refused twice: `default` names `story`, which is not a level (a missing `default` is refused the
same way, ruling Q7), and `drop`'s pattern starts with `memory` (ruling Q9).

## Worked example: `ticket:start` under milestone → epic → ticket

The valid config above. Three issues, all open:

| Issue | Labels | Block |
|---|---|---|
| #1300 | `level:milestone`, `type:feature` | `kind: milestone` (name `1.13`) |
| #878 | `level:epic`, `type:feature` | `kind: epic`, `parent: 1300` |
| #56 | `level:ticket`, `type:bug` | `kind: ticket`, `parent: 878` |

No tracker exists yet, and no block carries `tracker:`. The operator runs
`npm run brain:ticket:start -- 56`.

**1. Resolve.**

```text
issues:
  1300 → { level: 'milestone', levelSource: 'block', parent: null, children: [878],
           tracker: null, milestone: 'none', state: 'open', divergences: [] }
  878  → { level: 'epic', levelSource: 'block', parent: 1300, children: [56], tracker: null,
           milestone: { number: 1300, title: '1.13', state: 'open', native: null },
           state: 'open', divergences: [] }
  56   → { level: 'ticket', levelSource: 'block', parent: 878, children: [], tracker: null,
           milestone: { number: 1300, ... }, state: 'open', divergences: [] }
divergences: []
```

`native: null` because the native lane has not loaded yet: unmeasured, not "no mirror".

**2. Plan, then one confirmation.** The nearest integrating ancestor of #56 is #878, and #878's
own integrating parent is #1300. Neither tracker exists, so `ticket:start` prints the whole chain
and asks once (ruling Q1):

| # | Action | Head | Base | PR body |
|---|---|---|---|---|
| 1 | push branch | `release-1.13/tracker` | from `main` | — |
| 2 | open draft PR | `release-1.13/tracker` | `main` | `Closes #1300` |
| 3 | write `tracker: release-1.13/tracker` into #1300's block | — | — | — |
| 4 | push branch | `release-1.13/epic-878/tracker` | from `release-1.13/tracker` | — |
| 5 | open draft PR | `release-1.13/epic-878/tracker` | `release-1.13/tracker` | `Closes #878` |
| 6 | write `tracker: release-1.13/epic-878/tracker` into #878's block | — | — | — |
| 7 | create worktree and local branch | `release-1.13/epic-878/issue-56-<slug>` | from `release-1.13/epic-878/tracker` | — |

An ancestor is created before its child, because a child's tracker branches from its parent's. A
node's draft PR is opened before its block is written, so a failed PR leaves no `tracker:` naming
a branch nobody collects.

**3. Later.** `brain:ship` on #56's branch opens a PR with base `release-1.13/epic-878/tracker`
and a body carrying `Closes #56` and `Part of #878`. When it merges, the post-merge step closes #56
(ruling Q3). When every child of #878 is closed, brain reports #878's draft PR ready; it merges into
`release-1.13/tracker` under the declared autonomy mode (ruling Q10), and #1300's PR later merges
into `main` the same way.

**A hotfix beside it.** #57, labelled `hotfix`, with `parent: 878`, is started with
`ticket:start 57 --base main`. No tracker is touched. After its PR merges into `main`, brain finds
`release-1.13/tracker` and `release-1.13/epic-878/tracker` behind `main` and proposes one "merge
main into tracker" PR for each, to be merged with `--merge` (ruling Q1-hotfix).

## Consequences

### Positive

- **A hierarchy is data a consumer declares,** not an `epic` special case in three modules
  (`epic-graph.mjs`, `ticket-base.mjs`, `base-branch.mjs`).
- **One resolver, one answer.** The UI, the map, `ticket:start`, `move`, the drift check and the
  children region read the same level, parent, tracker and milestone.
- **Integration stops being manual,** and parallel milestones stop sharing `main` as their
  integration point.
- **Drift is visible,** including changes made only in the forge UI (decision 5).
- **The children list stops drifting,** because no human maintains it and no tool trusts it.
- **Branches are searchable by ancestry.** `git branch --list 'release-1.13/*'` lists one
  milestone's work.

### Negative

- **The branch scheme changes for every consumer.** Every branch parser accepts both forms while
  the legacy one is in use (ruling Q6): `lib/branch-grammar.mjs` and its readers, `TRACKER_GRAMMAR`
  (`epic-graph.mjs:117`, which today refuses anything outside `feature/…`), `status/stranded.mjs`'s
  `feature/` prefix oracle and the `base-branch` gate.
- **The `base-branch` gate's tracker rule reverses.** Today a tracker PR must target the default
  branch and may not stack onto another tracker. Under ruling Q5 an epic's tracker targets its
  milestone's tracker. The gate learns the nearest-integrating-ancestor rule from the resolver.
- **`hierarchy-adapter.mjs`'s contract changes in one field.** `milestone` becomes
  `object | 'none' | null`; its consumers (the snapshot and `ui/lib/{rollup,lane,inflight}-model.mjs`) adapt.
- **Renaming the head branch of an open PR is UNVERIFIED** on both forges, so `move` refuses it
  (decision 9).
- **The VCS port widens,** which is a decision under ADR-0020's rule. Each widening is additive and
  lands in its slice with its contract tests: a draft flag on `mrCreate`; creating a native
  milestone and assigning an issue to it; reading native containment (GitHub sub-issues, GitLab
  epics and work items) and native milestone membership; and whatever renaming a remote branch
  needs.
- **`ticket:start` gains remote writes.** The single confirmation is their cost.
- **Writing `tracker:` and the children region rewrites parts of a human-authored body.** Each
  needs ADR-0029 Decision 3's containment proof: everything outside the key, or outside the
  markers, is byte-identical.
- **`brain:ship` must learn the base** and add `Part of #<parent>` beside `Closes #<child>`.
- **The `Closes` backstop is UNVERIFIED.** Whether a `Closes #56` in a child PR still closes #56
  when the tracker reaches `main` depends on the merge method of both PRs (a squash commit message,
  a merge commit). It must be measured; the post-merge `issueClose` is the primary path.
- **A native-containment read costs one call per issue,** paid in a background lane and cached.
- **The first drift report on an existing repository will be noisy,** for ADR-0029's reason:
  every issue that was never labelled with a level is a block-only claim until someone reconciles
  it.

## Rejected alternatives

**`type:*` as the level label.** One label namespace cannot mean both the change type and the
level.

**The native milestone as an authoritative, issue-less level** (this draft's 2026-10-02 reading).
It cannot be a node, carry a block, be a PR's `Closes` target or own a tracker. Ruling Q4 replaced
it with a milestone issue and a mirror.

**Native containment as a parent source.** Ruling Q11 keeps it for drift. Sub-issues exist only on
GitHub, a forge-UI click would silently re-parent work, and a union source is a later decision in
ADR-0029's framing.

**A versioned, machine-readable children list in the parent's body.** A second declaration of the
relation `parent:` already declares (ruling Q12).

**A branch that is both a leaf and a prefix.** Git cannot store it; the fixed `tracker` leaf is the
price of hierarchical names.

**Flat branch names.** They say nothing about where the ticket sits.

**A `hotfix` level.** A hotfix is a way of starting a ticket, not a place in the hierarchy (ruling
Q1-hotfix).

## What this does NOT close

- **No code changes here.** The resolver, the config shape and its validation, the `ticket:start`
  chain, `move`, the drift check, the native lane, the children region, the post-merge close, the
  hotfix follow-up and the branch scheme are the slices in #1251.
- **`brain:doctor` does not exist yet.** It is #1130. Until it lands, the drift check reports
  through `brain:governance-status` alone, and the legacy-branch count has no home.
- **#1335's writer does not exist yet.** The children region (decision 10) waits on it.
- **GitLab's closing behaviour on a non-default target is unmeasured**, and must be measured before
  the post-merge close is built (ruling Q3).
- **Renaming an open PR's head** stays unmeasured, and `move` refuses it.
- **Native constructs other than the milestone mirror and containment,** such as GitHub issue
  types as a level source, are not defined here.
- **The questions below are not ruled.** Nothing in this ADR decides them by default.
- **The merge.** Nothing here gives any agent a merge verb (ADR-0037).

## Amendments this requires (none are made here)

- **ADR-0029.** Its Decision 2 ("neither wins", the union) governs blocking edges and is unchanged
  for them. For the hierarchy fields, ruling Q2 sets a precedence (block > label > native >
  default) with every disagreement reported, and ruling Q11 reads native containment, which
  Decision 2 deliberately left unread, for drift only and never into the blocking graph. The union
  for hierarchy is named as a later upgrade.
- **ADR-0032.** The `brain-graph/1` format gains levels: `kind` names any declared level, not only
  `epic`, `milestone` included; `tracker:` is honoured on any level that declares `integration`;
  `TRACKER_GRAMMAR` admits the hierarchical scheme.
- **ADR-0035.** Its rule that a branch name is a claim extends from the two lanes to the
  hierarchical branch path: ancestry in a name is a claim, and the resolver's sources are the
  proof.
- **`brain/core/methodology/harness-contract.md`, the `brain:ticket:start` row.** The branch is no
  longer `{type}/issue-{number}-{slug}`; the base is the nearest integrating ancestor's tracker; the
  verb may propose creating the missing chain under one confirmation; a hotfix is
  `--base main` on a `hotfix` issue.
- **`brain/core/methodology/agent-authorities.md`.** The post-merge `issueClose` of a child merged
  into a tracker (ruling Q3), and the "merge main into tracker" proposals after a hotfix (ruling
  Q1-hotfix), each need a row saying who executes them and at which tier (Open question 5).

## Open questions for the maintainer

The 2026-10-07 rulings settle the twelve questions this draft and #1251 listed. Checking them
against this ADR, ADR-0029/0032/0034/0035/0037/0038/0040 and the code on `main` leaves the ones
below. This draft takes no position on them.

1. **Is `native` a level source, or drift only?** Ruling Q2 orders the level sources block > label
   > native > default. Ruling Q11 makes native constructs drift-only, and native data arrives in a
   background lane, so a level resolved from it would change after first render.
   (a) native may name a level when the block and the label are silent, never a parent;
   (b) native is compared only, and the level precedence is block > label > default.
2. **A hotfix and the `base-branch` gate.** A hotfix PR targets `main` while its parent declares a
   tracker, which the gate fails today as a slice on the wrong base. Exempting it by the `hotfix`
   label is a label that bypasses a hard gate, the shortcut `workflow-governance.md` and ADR-0035
   refuse. (a) honour the label only when a non-author applied it, refused at `regulated`, as
   `skip:memory-gate` is honoured (#1024); (b) no exemption: a hotfix issue must not declare a
   parent, and the relation is kept as a prose "see also"; (c) the gate's exemption is earned by
   content, for example the PR is opened by `ticket:start --base main` on a `hotfix` issue and the
   head carries no tracker segment, with the label as a claim only.
3. **`--base main` versus `--off-tracker`.** `resolveBase` refuses an explicit `--base main`
   against a declared tracker today, and names `--off-tracker` as the opt-out. Ruling Q1-hotfix
   spells the hotfix `ticket:start N --base main`. (a) `--base main` is accepted on a `hotfix`
   issue and still refused otherwise; (b) a hotfix uses `--off-tracker`, and the ruling's spelling
   is shorthand; (c) `--off-tracker` is retired and `--base main` on any issue means "off the
   chain".
4. **An existing consumer with no `vcs.hierarchy`.** Ruling Q7 makes `hierarchy.default`
   required. ADR-0038 §7 promises that no consumer changes behaviour on upgrade, and ADR-0040
   Amendment 1 blocks a `brain:upgrade` rewrite of `brain.config.json` on GitLab at `standard` and
   `regulated` until #1281. (a) an absent `vcs.hierarchy` means today's behaviour (`epic` and
   `ticket`, one hop, legacy branches) and the requirement applies once a hierarchy is declared;
   (b) a migration writes a two-level `{ epic, ticket }` hierarchy with `default: "ticket"`, which
   then needs `level:epic` labels or reports every existing epic as drift; (c) refuse until
   declared, as ADR-0038 §3 does for an axis.
5. **Who closes a child, and at which tier.** Ruling Q3 calls the post-merge `issueClose` "a
   reported Tier 2 act at `lite`". Tier 2 means confirm before executing, which a post-merge step
   cannot do, and it runs as the CI automation identity, not as an agent. (a) the post-merge
   workflow closes at every tier and reports it, and `agent-authorities.md` records it as an
   automation act; (b) it closes and reports at `lite`, and at `standard` and `regulated` it
   proposes and a human confirms; (c) it closes at every tier, and a human confirms only when the
   rollup would complete a node.
6. **Where the milestone segment's name comes from.** Ruling Q5's example is
   `release-1.13/tracker`, and decision 4 gives the native mirror "the same name". The block has no
   name key. (a) a new `brain-graph/1` key, for example `name: 1.13`, which ADR-0032's amendment
   adds; (b) the issue's title; (c) the issue number, so `release-1300/tracker`, and `1.13` lives
   only in the mirror's title. A title or name can change after a tracker exists, which is a branch
   rename that `move` refuses while a PR is open.
7. **The `milestone` field's shape under rulings Q4 and Q8.** This draft reads Q8's object as the
   nearest `kind: milestone` ancestor, with the native mirror's own reading nested as
   `native: object | 'none' | null`, and the due date taken from the mirror for display only. Is
   that the intent, or is Q8's object the native mirror itself?
8. **One body region or two.** The parent's body already has `brain:epic:map`'s marker-bounded
   region (ADR-0029 Decision 3), written by `epic-render.mjs`. Ruling Q12 names #1335's writer, which
   is `brain:ticket:declare`, the block writer. (a) the children region replaces the map region and
   reuses its markers and containment proof; (b) a second marker pair beside it, written by the
   same proven region writer; (c) #1335's module gains the region writer, and the map region is
   retired.
9. **The alias window for `feature/…` trackers.** Ruling Q6 covers `{type}/issue-{N}-{slug}`.
   `TRACKER_GRAMMAR` accepts only `feature/…`, and this repository's trackers use it. (a) the same
   count-to-zero rule; (b) ADR-0038 §7's one-minor alias; (c) `feature/…` stays accepted
   indefinitely as a free-form tracker.
10. **Who marks a draft integration PR ready.** A draft cannot be merged. Ruling Q10 applies
    ADR-0037's modes to integration PRs, and in mode B the platform merges when every gate passes.
    (a) a human marks it ready; (b) brain proposes it (Tier 2) when the rollup completes; (c) in
    modes B and C the automation marks it ready when the rollup completes.
