# ADR-0039 — A declared ticket hierarchy: one resolver, a `move` that keeps the sources together, and the integration that `ticket:start` opens

> **status:** proposed — rulings of 2026-10-02 on #1251, pending human promotion | **date:** 2026-10-02 | **owner:** @crinaldi
> **relates to:** ADR-0020 (port widening is a decision), ADR-0029 (two sources, one graph), ADR-0032 (the `brain-graph/1` tag), ADR-0034 (lanes), ADR-0035 (a branch name is a claim), ADR-0037 (who merges), ADR-0038 (one config shape per axis; on the #1114 tracker, not yet on `main`); `brain/core/methodology/harness-contract.md` (`ticket:start` row); maintainer rulings on #1251, 2026-10-02; #697, #930, #967, #1121, #1130, #1199, #1206

> **Tier 2 draft.** `brain/project/decisions/**` is human-promoted (`agent-authorities.md` Tier 2).
> Promote with `npm run brain:promote -- <this path>`: the verb writes the house header, adds the
> `brain/HOME.md` entry `decision-gate` requires, regenerates `AGENTS.md` and stages all three.
> Committing them is the signature. The number `0039` was free on `origin/main` at `cef42973`
> (highest: 0037) and on `origin/feature/issue-1114-axis-ports` (highest: 0038). The
> `brain/HOME.md` line the verb derives from this H1 is, as a draft:
>
> - [ADR-0039](project/decisions/adr-0039-a-declared-ticket-hierarchy-one-resolver-and-integration-opened-by-ticket-start.md) — A declared ticket hierarchy: one resolver, a `move` that keeps the sources together, and the integration that `ticket:start` opens
>
> **ADR-0038 is cited by number and is not on `main`.** It was promoted on the #1114 tracker
> (`feature/issue-1114-axis-ports`). This ADR places `hierarchy` inside the `vcs` axis object that
> ADR-0038 §1 defines, so it must be promoted after ADR-0038 reaches `main`, or together with it.
>
> This ADR names amendments to ADR-0029, ADR-0032, ADR-0035 and to the `harness-contract.md`
> `ticket:start` row, and edits none of them. Each is a separate draft, promoted after this ADR.

## Context

Brain can say that one issue is an epic and that another issue's parent is that epic. It cannot
say anything else about a hierarchy, and it cannot open the integration a hierarchy implies.
Measured on `main` at `cef42973`, paths under `brain/scripts/` unless noted.

### What exists

| Surface | What it does today |
|---|---|
| `status/epic-graph.mjs:371` `parseGraphBlock` | Reads the ` ```brain-graph/1 ` block (ADR-0032): `track`, `kind`, `tracker`, `parent`, `blocks`, `needs`, `files`. |
| `status/epic-graph.mjs:492` | `kind` is read verbatim and **only `'epic'` carries meaning**; no other level exists. |
| `status/epic-graph.mjs:117` `TRACKER_GRAMMAR` | A `tracker:` must match `^feature\/…`; anything else is refused as `tracker-grammar`. |
| `status/epic-graph.mjs:507` | A `tracker:` on a node whose `kind` is not `epic` is carried and honoured nowhere (`tracker-without-kind-epic`). |
| `lib/ticket-base.mjs:57` `resolveBase` | The base of a new slice is the parent's `tracker`, **one hop**, and only when that parent declares `kind: epic` (`:33`, `:116`). Otherwise `main`. |
| `governance/checks/base-branch.mjs:31` | The `base-branch` gate (#967) is the backstop for the same one-hop rule. |
| `ticket-start.mjs:114`, `:143`, `:146` | Requires a `type:*` label (#1206), maps it to a prefix (`lib/branch-type.mjs:40`, falling back to `feat`) and composes `{type}/issue-{N}-{slug}` (`lib/branch-grammar.mjs:86`). |
| `lib/branch-grammar.mjs:16` `CANONICAL_BRANCH_RE` | The one owner of branch parsing (#697): `^([a-z]+)\/issue-(\d+)(?:-(.*))?$`. Readers: `brain-ship.mjs`, `brain-next.mjs`, `brain-start.mjs`, `status/snapshot.mjs`, `status/remote-changes.mjs`, `memory/lib/capture-provenance.mjs`. |
| `brain-ship.mjs:61`, `:317` | The PR body always ends `Closes #<issue>`, and the base is always the default branch. |
| `axes/vcs/adapters/github.mjs:183` | `issueRelations` deliberately does **not** read sub-issues: containment is not ordering (ADR-0029 Decision 2). |
| `axes/vcs/adapters/github.mjs:453-477`, `gitlab.mjs:606-634` | `issueList` returns `{ number, title, labels, assignees }`, **no `state`** (`vcs-contract.md:28`). `issueView` already carries `state` (`github.mjs:127`, `gitlab.mjs:154`). |
| `axes/vcs/adapters/github.mjs:688`, `gitlab.mjs:1280` | `mrCreate` takes `{ title, body, head, base, labels }`. **No draft flag.** |
| `governance/checks/lane.mjs:15`, `governance/checks/archive-sweep.mjs:82` | The lanes are anchored regexes: `^memory\/…`, `^auto-archive\/\d{4}-\d{2}-\d{2}$`. |

### What is missing

1. **Levels beyond `epic`.** There is no `release`, `feature` or `ticket`, and no way for a
   consumer to declare its own. Nothing says which level may be the parent of which.
2. **Milestones.** No verb reads a forge milestone, and no field carries one. This repository has
   none: `gh api repos/csrinaldi/brain/milestones?state=all` returned 0 on 2026-10-02, the same
   measurement `status/release-debt.mjs:4` records.
3. **`state` on a list.** `issueList` cannot say whether an issue is open, so no rollup can say
   that all of an epic's children are closed without one `issueView` per child.
4. **Trackers are created by hand.** `ticket:start` reads a `tracker:` someone wrote; it never
   creates the branch, and no draft PR collects the epic's work.
5. **More than one hop.** A ticket under a feature under a release cannot reach the release's
   tracker; `resolveBase` stops at the first parent, and only if it is an epic.
6. **Staleness on move.** Re-parenting a ticket, changing its level or moving it to another
   milestone means editing a block, labels, a native milestone and a branch by hand. Nothing
   notices when one of them is left behind.

## Decision

### 1. `vcs.hierarchy` declares the levels

The hierarchy is declared inside the `vcs` axis object, beside `default` and `providers`
(ADR-0038 §1: settings that belong to the axis, not to a provider, stay beside them).

- **`levels` is an ordered list, and its order is the nesting.** A level's parent is always a
  higher level, that is, one earlier in the list. **Skipping a level is allowed**: a ticket may
  have an epic as its parent when a `feature` level exists between them. **Inverting the order is
  never allowed.**
- **A level entry declares how the level is expressed in the forge:**
  - `name`: the level's name, which is also the block's `kind` value;
  - `native`: a forge-native construct, for example `"milestone"`;
  - `label`: a searchable label, `level:<name>` (decision 2);
  - `branch`: the pattern of the branch segment this level contributes (decision 7);
  - `integration`: the level integrates its children on a tracker branch (decision 6). Its value is
    `{ "draftPr": <boolean> }`.
  - `default: true`: the level an issue resolves to when no source names one (decision 3's
    `levelSource: 'default'`).
- **A level must declare `label`, `native`, or both.** This is a rule, and a config that breaks it
  is refused. The ruling says each level declares how it is expressed in the forge, "`native` …
  and/or a searchable `label`", and "and/or" means at least one. The reason is the drift check: a
  level expressed by neither exists only inside the body block. The forge cannot search for it, and
  decision 5's drift check has no second source to compare the block with, so the level would be
  a claim that nothing can verify.
- **A level entry has no `parent` key.** The order is the only statement of nesting, so a second
  statement could only agree with it or contradict it.
- **The body block always carries `kind` and `parent`.** `kind` names a level from `levels`;
  `parent` is an issue number, as today (`epic-graph.mjs:135`).

### 2. Level labels are `level:*`, never `type:*`

`type:*` already means the kind of change. `ticket:start` (`ticket-start.mjs:114`) and `brain:ship`
(`brain-ship.mjs:38`, via `findTypeLabel`) read it, and #1206 requires it. Reusing the namespace
for the level would make `type:epic` both a change type and a hierarchy level, and
`deriveBranchType` would fall back to `feat` for it (`branch-type.mjs:40`). Level labels use
`level:<name>`.

### 3. One resolver: `lib/ticket-hierarchy.mjs`

One module resolves the hierarchy, and every reader calls it: `status/epic-graph.mjs`, the UI
(#1199), `ticket:start`, `move` and the drift check. No consumer derives a level, a parent or a
tracker on its own.

```text
resolveHierarchy(...) -> {
  issues: Map<number, {
    level:       string | null,
    levelSource: 'block' | 'label' | 'native' | 'default' | null,
    parent:      number | null,
    children:    number[],
    tracker:     string | null,
    milestone:   { number, title, state, dueOn } | null,
    state:       'open' | 'closed' | null,
    divergences: { source, field, expected, found }[],
  }>,
  divergences: { issues: number[], field, ... }[],
}
```

The ruling fixed `{ level, parent, tracker, milestone, state, divergences[] }`. **The first
consumer, the UI (#1199), asked for the refinements below. They refine the ruled shape and reverse
none of it**, and they are part of this decision:

- **`state` is tri-state: `'open' | 'closed' | null`.** `null` means brain could not read it
  (ADR-0029 Decision 1). It never means open. A rollup counts an unknown child as unknown, never
  as not done and never as done.
- **`levelSource`** records where the level came from: `'block'`, `'label'`, `'native'` or
  `'default'`. A level that fell to the `default: true` level is then distinguishable from a
  declared one.
- **`children: number[]`** is the inverse of `parent`, computed once by the resolver. No consumer
  inverts `parent` itself.
- **`milestone`** is `{ number, title, state, dueOn } | null`, not a bare number.
- **The resolver is hierarchy only.** It returns `level`, `levelSource`, `parent`, `children`,
  `tracker`, `milestone`, `state` and `divergences`. Ordering and scope (`track`, `blocks`,
  `needs`, `files`) stay in `epic-graph`. Each field has exactly one source module.
- **Divergences live in two places:**
  - on each issue's entry, `divergences[]`, each `{ source, field, expected, found }`;
  - at the top level, beside the map, for a divergence that belongs to no single issue, for
    example a level inversion between a parent and a child. Each entry names the issues involved.

**A disagreement between the block, the labels and the native relations or milestone is data,
never silence** (ADR-0029 Decision 2). The resolver reports it and never repairs it.

### 4. The native milestone is authoritative

Milestone membership lives in the forge's native milestone. The block mirrors it. When the two
differ, the native value is the resolver's `milestone`, and the difference is reported as a
divergence on the issue. This is the one field where a source wins: ADR-0029 refused precedence
for edges because both sources were human claims about the same relation, and a milestone is
assigned and displayed by the forge, which the block only copies.

### 5. Staleness: `brain:ticket:move` and a drift check

- **`brain:ticket:move`** re-parents a ticket, changes its level, or moves it to another
  milestone. It rewrites every source together, through the VCS port: the body block (`kind`,
  `parent`, the mirrored milestone), the `level:*` labels, the native milestone and the branch
  (decision 7).
- **A drift check** in `brain:doctor` (#1130) and `brain:governance-status` reports every ticket
  whose sources disagree. Its input is the resolver's two `divergences` lists; it computes nothing
  of its own. A manual edit in the forge UI, for example a label removed or a milestone changed by
  hand, is therefore reported as drift.

### 6. The integration lifecycle, opened by `ticket:start`

- **A level may declare `integration`.** Its tracker branch is the node's branch path with the
  fixed `tracker` leaf (decision 7). `draftPr: true` means the tracker has a draft PR that collects
  the node's work.
- **`brain:ticket:start N` resolves the nearest ancestor of `N` whose level declares
  `integration`.** This replaces `resolveBase`'s single hop to a `kind: epic` parent.
- **If that ancestor's tracker branch does not exist,** `ticket:start`:
  1. creates it from its own parent's integration branch, or from `main` when no higher ancestor
     integrates;
  2. opens the ancestor's draft PR, head the tracker, base that same parent branch, body
     `Closes #<ancestor>`, when the level declares `draftPr: true`;
  3. writes `tracker: <branch>` into the ancestor's block.
- **It then creates the ticket's worktree on a branch off that tracker.** The ticket's PR targets
  the tracker and carries `Part of #<ancestor>`.
- **Remote branch creation and PR creation are Tier 2** (`agent-authorities.md`): `ticket:start`
  proposes each one and waits for confirmation. Neither is ever silent.
- **When all of an integrating node's children are closed,** brain reports that its draft PR is
  ready. **The merge stays human.** A child whose `state` is `null` holds the report back and is
  named as unknown.

### 7. Hierarchical branch names

- **A branch is its ancestors' segments joined by `/`, followed by its own leaf.**
  - A node that integrates has the fixed leaf `tracker`: `release-12/tracker`,
    `release-12/feature-34/tracker`.
  - A ticket's leaf is its own segment: `release-12/feature-34/issue-56-slug`.
  - A ticket with no ancestor has its segment alone: `issue-56-slug`.
- **Why a fixed `tracker` leaf.** Git cannot hold a ref that is both a leaf and a directory. With
  `refs/heads/release-12` as a branch, `refs/heads/release-12/feature-34/…` cannot be created,
  because `release-12` would have to be a directory and a file at once. With the `tracker` leaf,
  `release-12` is only ever a directory.
- **Each level configures its segment pattern** in `branch`, for example `"release-{number}"` or
  `"issue-{number}-{slug}"`.
- **The change type leaves the branch name.** It comes only from the `type:*` label (#1206), which
  `ticket:start` already requires. The branch parsers in `brain-ship.mjs`, `ticket-start.mjs` and
  `lib/branch-grammar.mjs` (#697) adapt.
- **A branch name is a claim, never the proof** (ADR-0035). The resolver's sources are the block,
  the labels and the native milestone. A branch path that disagrees with them is drift, reported by
  decision 5, and never a reason to re-parent anything.
- **`move` renames a branch only when no PR is open on it.** When one is open, `move` leaves the
  branch alone, and the drift check reports the stale name.
- **The lane branches keep their names:** `memory/<host>-<date>` (ADR-0034 L1, `lane.mjs:15`) and
  `auto-archive/<date>` (ADR-0035, `archive-sweep.mjs:82`).

### 8. `issueList` gains `state`

`issueList` returns `state` on every entry, as an additive widening: the same move #930 made for
`mrList`. On both providers it is the `'open' | 'closed'` enum `issueView` already normalises to
(`github.mjs:127`, `gitlab.mjs:154`), and `null` when the payload carries no readable state.
#1199 implements it.

## Config examples

### A valid hierarchy

```json
{
  "vcs": {
    "default": "github",
    "providers": { "github": {} },
    "hierarchy": {
      "levels": [
        { "name": "milestone", "native": "milestone" },
        { "name": "release", "label": "level:release", "branch": "release-{number}",
          "integration": { "draftPr": true } },
        { "name": "epic", "label": "level:epic", "branch": "epic-{number}",
          "integration": { "draftPr": true } },
        { "name": "feature", "label": "level:feature", "branch": "feature-{number}",
          "integration": { "draftPr": true } },
        { "name": "ticket", "label": "level:ticket", "branch": "issue-{number}-{slug}",
          "default": true }
      ]
    }
  }
}
```

The `milestone` level is expressed only natively. It declares no `branch` and no `integration`, so
in this draft it contributes no branch segment (Open question 5). `release`, `epic` and `feature`
each integrate their children with a draft PR. `ticket` is where an issue with no level lands.

### Refused: a level that declares a parent, here an inverted one

```json
{
  "vcs": {
    "default": "github",
    "providers": { "github": {} },
    "hierarchy": {
      "levels": [
        { "name": "epic", "label": "level:epic", "parent": "ticket" },
        { "name": "ticket", "label": "level:ticket", "default": true }
      ]
    }
  }
}
```

Refused because a level entry has no `parent` key (decision 1): the order is the only statement of
nesting. The example shows why. The order says an epic is above a ticket and the key says the
reverse, and the config cannot honour both. The same inversion in issue data (an epic whose
`parent:` is a ticket) is not a config error. The resolver reports it as a top-level divergence
naming both issues.

### Refused: a level expressed by neither `label` nor `native`

```json
{
  "vcs": {
    "default": "github",
    "providers": { "github": {} },
    "hierarchy": {
      "levels": [
        { "name": "epic", "branch": "epic-{number}", "integration": { "draftPr": true } },
        { "name": "ticket", "label": "level:ticket", "branch": "issue-{number}-{slug}",
          "default": true }
      ]
    }
  }
}
```

Refused because `epic` is expressed in the forge by neither a label nor a native construct
(decision 1). Only the body block could say that an issue is an epic, so the forge cannot search
for epics, and the drift check has nothing to compare the block with.

## Worked example: `ticket:start` under release → epic → ticket

The config above. Three issues, all open, all members of milestone 7 (`v1.2`):

| Issue | Labels | Block |
|---|---|---|
| #12 | `level:release`, `type:feature` | `kind: release` |
| #34 | `level:epic`, `type:feature` | `kind: epic`, `parent: 12` |
| #56 | `level:ticket`, `type:fix` | `kind: ticket`, `parent: 34` |

The `feature` level is skipped between #34 and #56, which decision 1 allows. No tracker exists yet,
and no block carries `tracker:`. The operator runs `npm run brain:ticket:start -- 56`.

**1. Resolve.** The resolver returns, for these three issues:

```text
issues:
  12 → { level: 'release', levelSource: 'block', parent: null, children: [34],
         tracker: null, milestone: { number: 7, title: 'v1.2', state: 'open', dueOn: '2026-11-01' },
         state: 'open', divergences: [] }
  34 → { level: 'epic', levelSource: 'block', parent: 12, children: [56],
         tracker: null, milestone: { number: 7, ... }, state: 'open', divergences: [] }
  56 → { level: 'ticket', levelSource: 'block', parent: 34, children: [],
         tracker: null, milestone: { number: 7, ... }, state: 'open', divergences: [] }
divergences: []
```

The nearest integrating ancestor of #56 is #34 (`epic` declares `integration`). Its tracker would
be `release-12/epic-34/tracker`, and it does not exist. Its own parent, #12, also integrates, and
`release-12/tracker` does not exist either.

**2. Propose.** Before any remote write, `ticket:start` prints the plan and asks for confirmation
(Tier 2). Nothing below happens on a "no".

**3. Create, in this order:**

| # | Action | Head | Base | PR body |
|---|---|---|---|---|
| 1 | push branch | `release-12/tracker` | from `main` | — |
| 2 | open draft PR | `release-12/tracker` | `main` | `Closes #12` |
| 3 | write `tracker: release-12/tracker` into #12's block | — | — | — |
| 4 | push branch | `release-12/epic-34/tracker` | from `release-12/tracker` | — |
| 5 | open draft PR | `release-12/epic-34/tracker` | `release-12/tracker` | `Closes #34` |
| 6 | write `tracker: release-12/epic-34/tracker` into #34's block | — | — | — |
| 7 | create worktree and local branch | `release-12/epic-34/issue-56-<slug>` | from `release-12/epic-34/tracker` | — |

An ancestor is created before its child, because a child's tracker branches from its parent's. The
draft PR of a node is opened before its block is written, so a failed PR leaves no `tracker:` that
names a branch nobody collects. Steps 1-3 run only because #12's tracker was missing: whether
`ticket:start` creates a missing tracker above the nearest one, or refuses, is Open question 1.

**4. Later.** `brain:ship` on #56's branch opens a PR with head
`release-12/epic-34/issue-56-<slug>`, base `release-12/epic-34/tracker`, and a body carrying
`Part of #34`. When #56 and every other child of #34 are closed, brain reports that #34's draft PR
is ready. A human merges it into `release-12/tracker`, and later merges #12's draft PR into `main`.

## Consequences

### Positive

- **A hierarchy is data a consumer declares,** not an `epic` special case in three modules
  (`epic-graph.mjs:507`, `ticket-base.mjs:116`, `base-branch.mjs`).
- **One resolver, one answer.** The UI, the map, `ticket:start`, `move` and the drift check read
  the same level, parent and tracker, and none of them re-derives one.
- **Integration stops being manual.** The first `ticket:start` under an integrating node creates
  its tracker and draft PR, after confirmation, and writes the tracker into the block that
  `resolveBase` and `base-branch` already read.
- **Drift is visible.** A label removed or a milestone changed in the forge UI shows up in
  `brain:doctor` and `governance-status` instead of rotting quietly.
- **Branches are searchable by ancestry.** `git branch --list 'release-12/*'` lists one release's
  work.

### Negative

- **The branch scheme changes for every consumer.** Today's branches are
  `{type}/issue-{N}-{slug}`; this repository's own head is
  `feat/issue-1251-featvcs-a-declared-ticket-hierarchy-with`. **Every branch parser accepts both
  forms for a window**: `lib/branch-grammar.mjs` and its six readers, `TRACKER_GRAMMAR`
  (`epic-graph.mjs:117`, which today refuses anything outside `feature/…`) and the `base-branch`
  gate. The length of the window is Open question 6. `capture-provenance` and the status snapshot
  read the canonical form only ("durable writes never guess", `branch-grammar.mjs:8`), so the new
  form must be canonical in that module from the first slice, not a lenient fallback.
- **Renaming the head branch of an open PR is UNVERIFIED** on both GitHub and GitLab. Whether the
  forge retargets the open PR or closes it has not been measured here and must be measured before
  `move` is built. Until then, **`move` refuses to rename a branch while a PR is open on it**
  (decision 7), and the drift check reports the stale name.
- **The VCS port widens,** which is a decision under ADR-0020's rule. The widenings this decision
  implies, each additive: `state` on `issueList` (decision 8), a milestone on `issueView`/`issueList`,
  a verb that sets an issue's milestone, a draft flag on `mrCreate`, and whatever renaming a remote
  branch needs. Each lands in its slice with its contract tests.
- **`ticket:start` gains remote writes.** It has only read the forge and written local git until
  now. The Tier 2 confirmation is the cost of that, and an operator who answers "no" gets today's
  behaviour: no tracker, base `main`.
- **Writing `tracker:` rewrites part of a human-authored body.** ADR-0029 Decision 3 allowed
  `issueUpdate` only behind a containment proof for the map region (`replaceMapRegion`,
  `outsideRegion`). A key written inside the `brain-graph/1` block needs its own proof that
  everything outside that key is byte-identical.
- **`brain:ship` must learn the base.** Today it always targets the default branch with
  `Closes #N` (`brain-ship.mjs:61`, `:317`). Under a tracker it targets the tracker and adds
  `Part of #<ancestor>`.
- **The first drift report on an existing repository will be noisy,** for ADR-0029's reason: every
  issue that was never labelled with a level is a block-only claim until someone reconciles it.

## Rejected alternatives

**`type:*` as the level label.** `type:*` is the kind of change, read by `ticket:start` and
`brain:ship` and required by #1206. `type:epic` would be a level to the resolver and an unmapped
change type to `deriveBranchType`, which falls back to `feat` (`branch-type.mjs:40`). One label
namespace cannot mean two things.

**GitHub sub-issues as the parent source.** ADR-0029 Decision 2 kept them out of the blocking
graph because containment is not ordering: a slice is part of its epic, not a blocker on it. That
reason does not reject containment as a parent source, but three others do. Sub-issues exist only
on GitHub, so a GitLab consumer would have a hierarchy with a missing source. ADR-0029's
Consequences say that reading containment is "a new decision with a new shape", and these rulings
did not take it: the block's `parent` is the declared source, labels and the milestone are the
forge's. And a fourth, unread source would be one more thing for `move` to keep in agreement.

**A branch that is both a leaf and a prefix.** `release-12` as a tracker and
`release-12/epic-34/…` as its children cannot coexist: git stores `refs/heads/release-12` as a
file, and the children need it as a directory. The fixed `tracker` leaf is the price of
hierarchical names.

**Flat branch names** (`issue-56-slug`, or today's `{type}/issue-{N}-{slug}`). They work, and git
never refuses them. But they say nothing about where the ticket sits, so finding one release's
work needs a forge query instead of `git branch --list 'release-12/*'`. The ruling chose names
that are searchable by ancestry.

## What this does NOT close

- **No code changes here.** The resolver, the config shape and its validation, `ticket:start`'s
  initialisation, `move`, the drift check and the branch scheme are the slices in #1251.
- **`brain:doctor` does not exist yet.** It is #1130. Until it lands, the drift check reports
  through `brain:governance-status` alone.
- **Renaming an open PR's head** stays unmeasured, and `move` refuses it (Consequences).
- **Who closes a child issue** whose PR merges into a tracker rather than the default branch
  (Open question 3).
- **Native constructs other than a milestone,** such as GitLab epics or GitHub issue types. This ADR
  defines `native: "milestone"` only, because it is the only one the rulings name
  (Open question 4).
- **The merge.** Brain reports that a draft PR is ready and never merges it. Nothing here gives any
  agent a merge verb (ADR-0037).

## Amendments this requires (none are made here)

- **ADR-0029.** The resolver is the second-source merge for hierarchy fields, with per-issue and
  top-level divergences; and the milestone is the one field where the native source wins
  (decision 4).
- **ADR-0032.** The `brain-graph/1` format gains levels: `kind` names any declared level, not only
  `epic`; `tracker:` is honoured on any level that declares `integration`; `TRACKER_GRAMMAR` admits
  the hierarchical scheme; and the block mirrors the milestone.
- **ADR-0035.** Its rule that a branch name is a claim extends from the two lanes to the
  hierarchical branch path: ancestry in a name is a claim, and the resolver's sources are the
  proof.
- **`brain/core/methodology/harness-contract.md`, the `brain:ticket:start` row** (line 31): the
  branch is no longer `{type}/issue-{number}-{slug}`, the base is the nearest integrating
  ancestor's tracker rather than `--base <tracker>` or `feature/v2.0.0`, and the verb may propose
  creating that tracker and its draft PR.

## Open questions for the maintainer

The rulings do not settle these. This draft takes no position on them except where it says
"this draft reads".

1. **A missing tracker above the nearest one.** Ruling 6 creates the nearest integrating ancestor's
   branch "from its own parent's integration branch (or `main`)". When that parent's branch is also
   missing, does `ticket:start` create it too (the worked example's reading), or refuse and name
   the missing tracker?
2. **Which level source wins when they disagree.** Ruling 4 makes the milestone native-authoritative.
   Nothing rules on `level`. This draft reads the `levelSource` enum's order (block, then label,
   then native, then `default`) as the reading order and reports every disagreement, but that order
   is proposed, not ruled.
3. **Closing a child issue.** A PR that targets a tracker does not close its issue on merge on
   GitHub, whose closing keywords act only on the default branch (per GitHub's documentation; not
   measured here). GitLab is unmeasured. Ruling 6's "when all children are closed" then depends on
   someone closing them. Does `brain:ship` keep `Closes #N` beside `Part of #<ancestor>`, and does
   something call `issueClose` when a child PR merges into a tracker?
4. **What `native` may name, and what a native-only level is.** Is `"milestone"` the only value
   for now? Is a native-only level's node a forge milestone rather than an issue, so that
   membership in it is the `milestone` field and never `parent`? May such a level declare
   `integration`, given that a draft PR closes an issue (`Closes #<ancestor>`) and a milestone is
   not one?
5. **A level with no `branch`.** Does it contribute no segment (this draft's reading for the
   `milestone` level), or must every level declare one?
6. **The alias window.** How long do parsers accept today's `{type}/issue-{N}-{slug}` and
   `feature/…` trackers: one minor version, as ADR-0038 §7 gives its aliases, or until no open
   branch uses the old form?
7. **The `default` level's spelling and cardinality.** #1199 asked for a `default: true` level.
   ADR-0038 rejected a per-provider `default: true` flag because a flag can be set on zero entries
   or on two. Should this be `hierarchy.default: "<level name>"` for the same reason? Either way:
   is a default level required, and is an issue that resolves through it (`levelSource: 'default'`,
   no `level:*` label) reported as drift or accepted?
8. **`null` milestone.** `milestone: null` cannot tell "no milestone" from "brain could not read
   it", the distinction ADR-0029 Decision 1 requires for `assignees`. Is an unreadable milestone a
   per-issue divergence, or does the field need a third value?
9. **Branch patterns that collide with a lane.** Should config validation refuse a `branch`
   pattern whose first segment could produce `memory/` or `auto-archive/`, so a hierarchical branch
   can never claim a lane?
10. **Integration PRs and the autonomy modes.** Ruling 6 says the merge of a draft PR stays human.
    In ADR-0037's mode B the platform merges a change when every gate passes. Does ruling 6 hold
    in every mode for integration PRs, or does it mean only that brain itself never merges?
