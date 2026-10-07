# ADR-0039 — A declared ticket hierarchy: one resolver, a `move` that keeps the sources together, and the integration that `ticket:start` opens

> **status:** proposed — rulings of 2026-10-02 and 2026-10-07 (Q1-Q12, Q1-hotfix, C1-C10, N1-N5, M1-M4, R1) on #1251, pending human promotion | **date:** 2026-10-07 | **owner:** @crinaldi
> **relates to:** ADR-0018 (the GitLab governance fragment), ADR-0020 (port widening is a decision), ADR-0029 (two sources, one graph), ADR-0032 (the `brain-graph/1` tag), ADR-0034 (lanes), ADR-0035 (a branch name is a claim), ADR-0037 (who merges), ADR-0038 (one config shape per axis, with its Amendments 1-2), ADR-0040 (the owned team config); `brain/core/methodology/harness-contract.md` (`ticket:start` row); `brain/core/methodology/agent-authorities.md`; maintainer rulings on #1251, 2026-10-02 and 2026-10-07; #697, #930, #967, #1121, #1130, #1199, #1206, #1257, #1293, #1335

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
> This ADR names amendments to ADR-0026, ADR-0029, ADR-0032, ADR-0035, ADR-0018,
> `workflow-governance.md`, the `harness-contract.md` `ticket:start` row and `agent-authorities.md`,
> and edits none of them. Each is a separate draft, promoted after this ADR. The ones drafted beside
> this file, and the ones still owed, are listed under "Amendments this requires".

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
| `axes/vcs/adapters/github.mjs:742`, `gitlab.mjs:1308` | `mrCreate` takes `{ title, body, head, base, labels }`. **No draft flag**, and no verb marks a draft ready. |
| `axes/vcs/adapters/github.mjs:1078`, `gitlab.mjs:1040` | `issueClose` exists on both providers. |
| `status/epic-render.mjs:9-10`, `status/epic-map.mjs` | `brain:epic:map` writes a repo-wide, marker-bounded region (`<!-- brain:epic:map BEGIN/END -->`) into an epic body, proven contained by `replaceMapRegion`/`outsideRegion` (ADR-0029 Decision 3). |
| `.github/workflows/governance-postmerge.yml` | Runs after merges with `GITHUB_TOKEN` holding `issues: write`; it already sweeps closed changes into the archive (ADR-0035). |
| `governance/checks/lane.mjs:15`, `governance/checks/archive-sweep.mjs:79` | The lanes are anchored regexes: `^memory\/…`, `^auto-archive\/\d{4}-\d{2}-\d{2}$`. |

**Who can act after a forge merge.** A forge merge happens on the server. A git `post-merge` hook
is client-side and never fires on it. What does run is forge CI: a GitHub workflow has
`GITHUB_TOKEN`, and a GitLab job has `CI_JOB_TOKEN`, which cannot write issues. So any step
"after a merge" in this ADR is a CI workflow running as the automation identity, never a local
hook and never an agent.

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
5. **Nothing closes a child merged into a tracker.** Closing keywords act only on merges into the
   default branch, so a child merged into a tracker stays open and the parent's rollup is wrong.
6. **Staleness on move.** Re-parenting a ticket or changing its level means editing a block,
   labels, a native milestone and a branch by hand. Nothing notices when one is left behind.
7. **Changes made in the forge are invisible.** A sub-issue added in GitHub's UI, a GitLab epic
   link or a native milestone assignment never reaches brain (#1251, item 11, 2026-10-07).
8. **The parent's list of children is hand-written and drifts.** The #878 audit of 2026-10-07
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
    (decision 4). A mirror is read for drift only and never supplies a value (decisions 3 and 5);
  - `branch`: the pattern of the branch segment this level contributes (decision 9);
  - `integration`: the level integrates its children on a tracker branch (decision 7). Its value
    is `{ "draftPr": <boolean> }`.
- **A level must declare `label`, `native`, or both.** A config that breaks this is refused. A
  level expressed by neither exists only inside the body block, so the forge cannot search for it
  and the drift check has no second source to compare the block with.
- **A level entry has no `parent` key.** The order is the only statement of nesting, so a second
  statement could only agree with it or contradict it.
- **`vcs.hierarchy.default` names the level an issue resolves to when no source names one, and a
  declared hierarchy must carry it** (ruling Q7, 2026-10-07). It is one key holding a level `name`,
  in ADR-0038 §1's shape: not a `default: true` flag on a level, because a flag can be set on zero
  levels or on two and a single key cannot. A missing `default`, or one that names no level in
  `levels`, is refused. **Resolving to the default is not drift**; a `level:*` label that
  contradicts the block is (decision 3).
- **No level pattern may claim a lane** (ruling Q9, 2026-10-07). Config validation refuses a level
  whose `branch` pattern starts with `memory` or `auto-archive`: such a branch would claim
  ADR-0034's or ADR-0035's lane and its `issue-link` exemption.
- **The body block always carries `kind` and `parent`.** `kind` names a level from `levels`;
  `parent` is an issue number, as today (`PARENT_KEY_GRAMMAR`, `epic-graph.mjs:135`).

**When `vcs.hierarchy` is absent** (ruling C4, 2026-10-07). Brain keeps today's implicit
two-level model, `epic` above `ticket`, and writes no migration. Q7's required `default` applies
only once a project declares `vcs.hierarchy`. No consumer changes behaviour on upgrade (ADR-0038
§7), and no `brain:upgrade` rewrite of `brain.config.json` is needed, so ADR-0040 Amendment 1's
GitLab block on such rewrites does not arise.

What the implicit model keeps and what it gains (ruling N1, option C, 2026-10-07):

- **It keeps today's branches and trackers:** hand-made `feature/…` tracker branches, one hop
  from a ticket to its epic's `tracker:`, and `{type}/issue-{N}-{slug}` ticket branches.
  `ticket:start` creates no tracker chain for it.
- **It gains the close workflow (decision 7) and the generated children region (decision 10)**,
  because each only reads the `tracker:` an epic already declares and the resolver's children, and
  renames nothing. The `integration-ready` gate runs there too, detection-only at every tier
  (ruling M1, decision 7).
- **Its branch grammar is never retired** (ruling N2, decision 9).

**What owning the key means (ADR-0038, ADR-0040).** `vcs` has no `.env` level and no user layer
(ADR-0038 §2 and Amendment 1; ADR-0040 section 2), so `vcs.hierarchy` is a team setting only and
is validated on the team layer alone. A change to it is a change to `brain.config.json` and passes
the `team-config-reviewed` gate like any other. An agent never edits it in an existing repository
(`agent-authorities.md` Tier 3): `ticket:start`, `move`, the drift check and the close workflow
write issues, branches and PRs, never the config.

### 2. Level labels are `level:*`, never `type:*`

`type:*` already means the kind of change. `ticket:start` and `brain:ship` read it, and #1206
requires it. Reusing the namespace for the level would make `type:epic` both a change type and a
hierarchy level, and `deriveBranchType` would fall back to `feat` for it. Level labels use
`level:<name>`.

### 3. One resolver: `lib/ticket-hierarchy.mjs`

One module resolves the hierarchy, and every reader calls it: `status/epic-graph.mjs`, the
snapshot and the UI (#1199), `ticket:start`, `move`, the drift check, the close workflow and the
children region (decision 10). No consumer derives a level, a parent, a tracker or a milestone on
its own. It replaces `status/hierarchy-adapter.mjs`, whose contract it keeps.

```text
resolveHierarchy({ issues, config, forgeLoad, native }) -> {
  issues: Map<number, {
    level:       string | null,
    levelSource: 'block' | 'label' | 'default' | null,
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

- **Level precedence: block > label > default** (ruling Q2, 2026-10-07, as narrowed by ruling C1,
  2026-10-07). The first source that names a level is the level, and `levelSource` says which one
  it was. **Native data never supplies a level.** A native construct that implies a level is
  compared with the resolved one, and a disagreement is a reported divergence, never a resolved
  value. So nothing a background lane loads can change a level after first render. **Every
  disagreement between sources is a divergence**, whichever wins. Falling through to the default
  is not one (ruling Q7).
- **`parent` comes from the block (or its prose `Parent: #N` line) and from nothing else.**
  Native containment never resolves a parent (ruling Q11, decision 5).
- **`state` is tri-state: `'open' | 'closed' | null`.** `null` means brain could not read it
  (ADR-0029 Decision 1). It never means open. A rollup counts an unknown child as unknown, never
  as done and never as not done.
- **`milestone` is `object | 'none' | null`** (ruling Q8, 2026-10-07; shape confirmed by ruling
  C7, 2026-10-07). The object is the nearest ancestor whose level is `milestone` (decision 4):
  `{ number, title, state, native }`, where `native` is the mirror's own reading,
  `{ number, title, state, dueOn } | 'none' | null`. The due date is read from the mirror, because
  the milestone issue has none. `'none'` means the chain was read to its root and holds no
  milestone. `null` means brain could not read it, and **an unmeasured milestone is never
  displayed as "no milestone"**.
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
  ancestry is a divergence on the issue, never a reason to change `parent`. The close workflow
  closes the mirror when the milestone closes (decision 7, ruling C5).
- **The human name lives in the issue's title and in the mirror's title**, never in a branch
  (ruling C6, decision 9).
- **The native object is not an issue on GitHub or GitLab.** So it cannot be a node, cannot carry a
  block and cannot be a PR's `Closes` target. The milestone issue is all three.

This **supersedes** the 2026-10-02 reading recorded in an earlier draft, under which the native
milestone was authoritative and a `native: "milestone"` level had no issue behind it.

### 5. Native containment is read for drift only

(ruling Q11, option B, 2026-10-07; ruling C1, 2026-10-07)

- **Brain reads the forge's native containment**: GitHub sub-issues, GitLab epics and the
  work-item hierarchy, and the native milestone. It compares them with the resolved hierarchy and
  reports each disagreement as a divergence. **It never resolves a parent or a level from them.**
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
- **The same doctor counts the open branches and PRs that still use a legacy grammar**
  (decision 9, rulings Q6 and C9).

### 7. The integration lifecycle

**Opened by `ticket:start`.**

- **A level may declare `integration`.** Its tracker branch is the node's branch path with the
  fixed `tracker` leaf (decision 9). `draftPr: true` means the tracker has a draft PR that collects
  the node's work.
- **A milestone integrates too** (ruling Q5, option A, 2026-10-07). Epics integrate into the
  milestone's tracker, and the milestone's tracker integrates into `main`:
  `release-1300/tracker` above `release-1300/epic-878/tracker` above the tickets. The reason is the
  maintainer's: a set of epics makes a release, integrating them straight into `main` can break it,
  and parallel milestones integrating into `main` would contaminate each other.
- **`brain:ticket:start N` resolves the nearest ancestor of `N` whose level declares
  `integration`.** This replaces `resolveBase`'s single hop to a `kind: epic` parent. A tracker
  integrates into its nearest integrating ancestor's tracker, or into `main` when it has none. An
  issue with no parent starts from `main`, as today.
- **When trackers are missing, `ticket:start` creates the whole missing chain under one
  confirmation** (ruling Q1, option A, 2026-10-07). It first prints a plan that lists every branch
  it will push and every draft PR it will open, top-down. On "yes" it, for each missing tracker
  from the highest down:
  1. pushes the tracker branch from its own parent's tracker, or from `main`;
  2. opens the draft PR, head the tracker, base that same parent branch, when the level declares
     `draftPr: true`. Its body is `Closes #<node>`, plus `Part of #<parent>` when the base is a
     tracker (ruling N3);
  3. writes `tracker: <branch>` into the node's block.

  On "no" nothing remote happens, and the operator gets today's behaviour: base `main`, with the
  reason said.
- **It then creates the ticket's worktree on a branch off the nearest tracker.** The ticket's PR
  targets that tracker, with `Closes #<ticket>` and `Part of #<parent>` (ruling N3).
- **Remote branch creation and PR creation are Tier 2** (`agent-authorities.md`). The single
  confirmation covers exactly the plan it printed; anything not in the plan is not authorised.

**Closed by one rule, at every level** (ruling C5, 2026-10-07; replaces ruling Q3's wording).

- **When a node's integration PR merges into its parent's target, a tracker or `main`, that node's
  issue closes.**
  - A ticket's PR merged into the epic's tracker closes the ticket.
  - The epic's tracker merged into the milestone's tracker closes the epic and deletes the epic's
    tracker branch.
  - The milestone's tracker merged into `main` closes the milestone, deletes its tracker branch and
    closes the native milestone mirror.
- **The mechanism is a forge CI workflow, not a hook and not an agent.** On GitHub it runs on
  `pull_request` `closed` with `merged == true`, when the base is a tracker or `main`, with
  `GITHUB_TOKEN` holding `issues: write` (which `governance-postmerge.yml` already has) and the
  `contents: write` a branch deletion needs. It acts as the automation identity at every tier, and
  it reports what it did. `agent-authorities.md` records it as an automation act
  (`agent-authorities-hierarchy-close.draft.md`, for the maintainer to sign).
- **On GitLab, `CI_JOB_TOKEN` cannot write issues.** The project needs a project access token in a
  CI variable for the GitLab governance fragment, and the fragment documents it (ADR-0018). Without
  it the job reports that it could not close and does nothing else.
- **The safety net is `day:start`.** Under the user's own credentials it lists every PR merged into
  a tracker whose issue is still open, so a workflow that did not run (a fork PR's read-only token,
  a missing GitLab variable, an outage) is seen the next morning.
- **Every PR keeps `Closes #<own issue>`** (ruling N3, option B, 2026-10-07; this supersedes the
  C5 reading in an earlier draft, under which a PR into a tracker carried no `Closes`). On a PR into
  `main` it is the forge's own close, and the workflow's close is a no-op. On a PR into a tracker
  the forge does not act on it, because GitHub closes only off the default branch, so **the
  keyword is the signal the close workflow reads to know which issue to close**. `Part of #<parent>`
  is added as context. `issue-link` is unchanged.
- **The workflow executes a keyword only when the resolver confirms it** (ruling M2, option A,
  2026-10-07). It closes `#N` only when the resolver places N under the node whose tracker is the
  PR's base. Any other closing keyword in the body is not executed; it is reported. The body is
  author-editable, so a keyword in it is a claim, and the resolver's sources are the proof
  (ADR-0035). On a PR into `main` the forge executes the keyword itself, as it always has; the
  workflow closes nothing there and only does the deletions and the mirror close C5 names.
- **A node merged early is not closed** (ruling N4, fallback B, 2026-10-07). If an integration PR
  merges while its node is not Ready to close, at `lite`, on the implicit model, or through an admin
  override, the workflow does not close the issue and does not delete the tracker. It reports the
  node as "merged but open".
- **A merged-but-open node closes through a remainder PR** (ruling M3, option C, 2026-10-07). Its
  tracker stays live, and its open children keep integrating into it. When a child integrates into
  the tracker of a merged-but-open node, a NEW draft integration PR is needed for the remainder:
  head the same tracker, base the same target, `Closes #<node>`. That PR is marked ready at Ready to
  close (ruling C10), passes `integration-ready`, and its merge closes the node and deletes the
  tracker (ruling C5). **If the node's last child closes while the tracker has no commits its target
  lacks** (`git rev-list <target>..<tracker>` is empty), there is nothing to integrate, so brain
  closes the node and deletes the tracker directly (unchanged by ruling R1).
- **A human authors the remainder PR** (ruling R1, option B, 2026-10-07). The close workflow does
  not open it; it only reports the merged-but-open node. **`day:start` proposes it under the user's
  credentials, as a Tier 2 act**: it shows the PR (head the live tracker, base its target,
  `Closes #<node>`) and creates it only after the human confirms. The human is therefore the PR's
  author, so ADR-0037's producer rule holds in every mode, and no second automation identity is
  introduced. In a non-interactive run (no TTY, or CI), `day:start` only reports. The reasons are
  measured: a PR opened with `GITHUB_TOKEN` triggers no workflow run, so its required checks would
  never report (`governance-postmerge.yml:577-581`, #1106); and a PR authored by the automation
  identity that merges in mode B would be merged by its producer.
- **The same step rewrites the children region** (ruling N5, option C, 2026-10-07). When the
  workflow closes an issue, it rewrites the parent's generated children region (decision 10) in the
  same run, as the same automation identity.

**Marked ready by the same automation** (ruling C10, 2026-10-07).

- **When every child of an integrating node is closed, the C5 workflow marks the node's draft PR
  ready**, at every tier. A child whose `state` is `null` holds this back and is named as unknown.
- **Marking ready is not merging.** The merge follows the declared autonomy mode like any PR
  (ruling Q10, option A, 2026-10-07): ADR-0037 applies unchanged, the producer never approves or
  merges, and there is no exception per PR kind. Brain itself holds no merge verb.

**Guarded by a new gate, `integration-ready`** (ruling N4, option C, 2026-10-07).

- **It refuses to merge an integration PR before its node is Ready to close**, that is, while any
  child of the node is open or unknown (`state: null`).
- **It judges by content, through the resolver, never by branch name** (ADR-0035): a PR is an
  integration PR when its head is the `tracker:` its issue's block declares, and the node's
  readiness is the resolver's rollup of that issue's children.
- **It runs in every project, and blocks only where a hierarchy is declared** (ruling M1, option C,
  2026-10-07). With `vcs.hierarchy` declared it is tiered by position, as ADR-0026 tiers a gate:
  detection at `lite`, required at `standard` and `regulated` (ruling N4). On the implicit model
  (no `vcs.hierarchy`) it is detection-only at every tier. When a PR merges past it, the close
  workflow falls back as above: no close, no deletion, "merged but open", and a remainder PR
  (ruling M3).
- **The gate's name, `integration-ready`, is this draft's proposal.** It joins `GOVERNANCE_JOBS`
  and the tier table through the `workflow-governance.md` and ADR-0026 drafts.

### 8. A hotfix has no parent and is not a level

(ruling Q1-hotfix, option A, 2026-10-07, as corrected by rulings C2 and C3, 2026-10-07)

- **A hotfix is an issue with no parent, labelled `hotfix`.** It may mention the epic it relates to
  in prose, but never as a parent declaration: no `parent:` key and no `Parent: #N` line (ruling
  C2).
- **It starts from `main` because it has no parent**, like any parentless issue: plain
  `ticket:start N`, no new flag (ruling C3). The `hotfix` label only marks it. `--off-tracker` is
  unchanged. This supersedes the earlier `ticket:start N --base main` wording.
- **`base-branch` needs no exemption.** With no parent there is no tracker to demand, and the PR
  goes to `main`. No label bypasses a gate.
- **Accepted cost (ruling C2):** a hotfix is not counted in its epic's rollup and does not appear
  in its children region.
- **Hotfix is not a level.** There is no `kind: hotfix`, and `hotfix` is not a `level:*` label.
- **After it merges into `main`, brain looks for open trackers behind `main`** and proposes one
  "merge main into tracker" PR for each. Each is merged with `--merge`, never squashed: a squash
  drops `main`'s ancestry from the tracker (#1293). Opening each PR is Tier 2, like any PR.

### 9. Hierarchical branch names

- **A branch is its ancestors' segments joined by `/`, followed by its own leaf.**
  - A node that integrates has the fixed leaf `tracker`: `release-1300/tracker`,
    `release-1300/epic-878/tracker`.
  - A ticket's leaf is its own segment: `release-1300/epic-878/issue-56-slug`.
  - A ticket with no ancestor has its segment alone: `issue-56-slug`.
- **A level without `branch` contributes no segment** (ruling Q5, 2026-10-07).
- **A segment comes from the issue number, never from a name** (ruling C6, 2026-10-07). The
  milestone's segment is `release-{number}`, so `release-1300`, not the milestone's human name. A
  number never changes, so the segment is never renamed and the block needs no name key. The name
  lives in the issue title and the native mirror (decision 4).
- **Why a fixed `tracker` leaf.** Git cannot hold a ref that is both a leaf and a directory. With
  `refs/heads/release-1300` as a branch, `refs/heads/release-1300/epic-878/…` cannot be created.
  With the `tracker` leaf, `release-1300` is only ever a directory.
- **Each level configures its segment pattern** in `branch`, for example `"epic-{number}"` or
  `"issue-{number}-{slug}"`.
- **The change type leaves the branch name.** It comes only from the `type:*` label (#1206), which
  `ticket:start` already requires. The branch parsers (`lib/branch-grammar.mjs`, #697, and its
  readers) adapt.
- **The legacy grammars stay accepted while they are in use** (ruling Q6, option A, and ruling C9,
  option A, 2026-10-07). In a repository that declared a hierarchy, `{type}/issue-{N}-{slug}` and
  `feature/…` trackers are parsed for as long as any open branch or PR there uses them. The doctor
  counts them (decision 6). `capture-provenance` and the snapshot read the
  canonical form only ("durable writes never guess", `branch-grammar.mjs:8`), so the new form is
  canonical in that module from the first slice, not a lenient fallback.
- **The window is per repository, and only for one that declared a hierarchy** (ruling N2,
  option C, 2026-10-07). `{type}/issue-{N}-{slug}` and `feature/…` ARE the implicit model's
  grammar, and they are never removed for a project without `vcs.hierarchy`. The count-to-zero
  applies only to a repository that declared `vcs.hierarchy`, and only to that repository: once its
  count reads 0, the legacy forms stop being accepted there, and keep being accepted everywhere
  else.
- **A branch name is a claim, never the proof** (ADR-0035). A branch path that disagrees with the
  resolver is drift, reported by decision 6, and never a reason to re-parent anything.
- **`move` renames a branch only when no PR is open on it.** When one is open, `move` leaves the
  branch alone, and the drift check reports the stale name.
- **The lane branches keep their names**, and no level may produce them (decision 1, ruling Q9):
  `memory/<host>-<date>` (ADR-0034 L1) and `auto-archive/<date>` (ADR-0035).

### 10. A generated children region in the parent's body, for humans only

(ruling Q12, option A, 2026-10-07, as corrected by ruling C8, option A, 2026-10-07)

- **The parent's body carries a generated children region**: its subtree, closed children
  included, each child's state, and the rollup. It is rendered from the resolver and the cached
  lanes, never from one forge call per child. It applies to every project, a project on the
  implicit model included (ruling N1).
- **The close workflow rewrites it in the same step that closes an issue** (ruling N5, option C,
  2026-10-07). **`day:start` regenerates it under the user's credentials as the safety net**, for
  when the workflow failed or is not configured, for example GitLab without its token. That write is
  **Tier 1** for an agent that runs `day:start` (ruling M4, option A, 2026-10-07): the region is
  generated, the bytes outside it are proven identical, and it is not a contract.
  `agent-authorities.md` names it (the `agent-authorities-hierarchy-close.draft.md` draft).
- **It replaces the repo-wide `brain:epic:map` region in epic bodies** (ruling C8). It is written
  by the existing region writer, `replaceMapRegion`, under its `outsideRegion` proof that every
  byte outside the markers is unchanged (ADR-0029 Decision 3). The repo-wide graph stays a printed
  report (`brain:epic:map --dry-run`) and the UI, and is never written into an issue body again.
- **#1335 stays block-only.** `brain:ticket:declare` writes the `brain-graph/1` block; the region
  writer writes the region. Two writers, one job each. (Ruling Q12's text named #1335's writer for
  the region; ruling C8 corrects it.)
- **It sits between HTML comment markers, outside any `brain-graph/1` fence**, and its text says
  that it is generated by brain, not read, and not to be edited. It uses no fence that looks like a
  declaration (ADR-0032).
- **It is not a contract. No brain tool reads its contents**, and a test pins that. The writer
  locates its own markers to replace the region and parses nothing between them.
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
          "branch": "release-{number}", "integration": { "draftPr": true } },
        { "name": "epic", "label": "level:epic", "branch": "epic-{number}",
          "integration": { "draftPr": true } },
        { "name": "feature", "label": "level:feature" },
        { "name": "ticket", "label": "level:ticket", "branch": "issue-{number}-{slug}" }
      ]
    }
  }
}
```

The milestone is an issue (decision 4) with a label, a native mirror, a branch segment from its
number and an integration. `feature` declares no `branch`, so it contributes no segment (ruling Q5)
and does not integrate. `ticket` is where an issue with no level lands.

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

### Refused: a default that names no level, a lane-shaped segment

```json
{ "vcs": { "default": "github", "providers": { "github": {} },
  "hierarchy": { "default": "story", "levels": [
    { "name": "drop", "label": "level:drop", "branch": "memory-{number}" },
    { "name": "ticket", "label": "level:ticket" } ] } } }
```

Refused twice: `default` names `story`, which is not a level (a declared hierarchy with no
`default` is refused the same way, ruling Q7), and `drop`'s pattern starts with `memory` (ruling
Q9). A config with no `vcs.hierarchy` at all is not refused: it runs the implicit model (ruling C4).

## Worked example: `ticket:start` under milestone → epic → ticket

The valid config above. Three issues, all open:

| Issue | Title | Labels | Block |
|---|---|---|---|
| #1300 | `Release 1.13` | `level:milestone`, `type:feature` | `kind: milestone` |
| #878 | (an epic) | `level:epic`, `type:feature` | `kind: epic`, `parent: 1300` |
| #56 | (a fix) | `level:ticket`, `type:bug` | `kind: ticket`, `parent: 878` |

No tracker exists yet, and no block carries `tracker:`. The operator runs
`npm run brain:ticket:start -- 56`.

**1. Resolve.**

```text
issues:
  1300 → { level: 'milestone', levelSource: 'block', parent: null, children: [878],
           tracker: null, milestone: 'none', state: 'open', divergences: [] }
  878  → { level: 'epic', levelSource: 'block', parent: 1300, children: [56], tracker: null,
           milestone: { number: 1300, title: 'Release 1.13', state: 'open', native: null },
           state: 'open', divergences: [] }
  56   → { level: 'ticket', levelSource: 'block', parent: 878, children: [], tracker: null,
           milestone: { number: 1300, ... }, state: 'open', divergences: [] }
divergences: []
```

`native: null` because the native lane has not loaded yet: unmeasured, not "no mirror". When it
loads, nothing above changes except `native` and any divergence it reports (ruling C1).

**2. Plan, then one confirmation.** The nearest integrating ancestor of #56 is #878, and #878's
own integrating parent is #1300. Neither tracker exists, so `ticket:start` prints the whole chain
and asks once (ruling Q1):

| # | Action | Head | Base | PR body |
|---|---|---|---|---|
| 1 | push branch | `release-1300/tracker` | from `main` | — |
| 2 | open draft PR | `release-1300/tracker` | `main` | `Closes #1300` |
| 3 | write `tracker: release-1300/tracker` into #1300's block | — | — | — |
| 4 | push branch | `release-1300/epic-878/tracker` | from `release-1300/tracker` | — |
| 5 | open draft PR | `release-1300/epic-878/tracker` | `release-1300/tracker` | `Closes #878`, `Part of #1300` |
| 6 | write `tracker: release-1300/epic-878/tracker` into #878's block | — | — | — |
| 7 | create worktree and local branch | `release-1300/epic-878/issue-56-<slug>` | from `release-1300/epic-878/tracker` | — |

An ancestor is created before its child, because a child's tracker branches from its parent's. A
node's draft PR is opened before its block is written, so a failed PR leaves no `tracker:` naming
a branch nobody collects. #878's PR targets a tracker, so the forge will not act on its
`Closes #878`; the close workflow reads it instead (ruling N3).

**3. Later.** `brain:ship` on #56's branch opens a PR with base `release-1300/epic-878/tracker`,
`Closes #56` and `Part of #878` (ruling N3). When it merges, the close workflow reads `Closes #56`,
closes #56 and rewrites #878's children region in the same step (rulings C5, N5). When every child
of #878 is closed, the workflow marks #878's draft PR ready (ruling C10), and `integration-ready`
passes (ruling N4); it merges into `release-1300/tracker` under the declared autonomy mode (ruling
Q10), and the workflow then closes #878, deletes `release-1300/epic-878/tracker` and rewrites
#1300's region. Had #878's PR merged while #56 was still open, at `lite`, #878 would stay open,
its tracker would stay, and brain would report it as merged but open; #56's merge into the live
tracker would be reported by the workflow, and the next `day:start` would propose a remainder PR
for #878, created on the operator's confirmation; its merge closes #878 (rulings M3, R1). When #1300's PR
merges into `main`, the forge executes its `Closes #1300`, and the workflow deletes its tracker and
closes the native milestone `Release 1.13` (rulings C5, M2).

**A hotfix beside it.** #57, labelled `hotfix`, says "related to #878" in prose and declares no
parent. Plain `ticket:start 57` starts it from `main` (ruling C3). No tracker is touched, and #57
does not count in #878's rollup (ruling C2). After its PR merges into `main`, brain finds
`release-1300/tracker` and `release-1300/epic-878/tracker` behind `main` and proposes one "merge
main into tracker" PR for each, to be merged with `--merge`.

## Consequences

### Positive

- **A hierarchy is data a consumer declares,** not an `epic` special case in three modules
  (`epic-graph.mjs`, `ticket-base.mjs`, `base-branch.mjs`), and a consumer that declares nothing
  keeps today's behaviour.
- **One resolver, one answer.** The UI, the map, `ticket:start`, `move`, the drift check, the close
  workflow and the children region read the same level, parent, tracker and milestone. No
  background load changes a resolved level or parent.
- **Integration stops being manual,** from opening a chain to closing it, and parallel milestones
  stop sharing `main` as their integration point.
- **Rollups are exact,** because a merged child closes on merge at every level.
- **Drift is visible,** including changes made only in the forge UI (decision 5).
- **The children list stops drifting,** because no human maintains it and no tool trusts it.
- **Branches are searchable by ancestry and never renamed for a title change.**
  `git branch --list 'release-1300/*'` lists one milestone's work.

### Negative

- **The branch scheme changes for every consumer that declares a hierarchy.** Every branch parser
  accepts both forms (rulings Q6, C9, N2): `lib/branch-grammar.mjs`
  and its readers, `TRACKER_GRAMMAR` (`epic-graph.mjs:117`, which today refuses anything outside
  `feature/…`), `status/stranded.mjs`'s `feature/` prefix oracle and the `base-branch` gate.
- **The `base-branch` gate's tracker rule reverses.** Today a tracker PR must target the default
  branch and may not stack onto another tracker. Under ruling Q5 an epic's tracker targets its
  milestone's tracker. The gate learns the nearest-integrating-ancestor rule from the resolver.
- **`hierarchy-adapter.mjs`'s contract changes in two fields.** `milestone` becomes
  `object | 'none' | null`, and `levelSource` has no `'native'`. Its consumers (the snapshot and
  `ui/lib/{rollup,lane,inflight}-model.mjs`) adapt.
- **A new CI workflow writes issues and bodies and deletes branches** as the automation identity,
  at every tier, in every project, on the implicit model too (ruling N1). Its token scope (`issues: write`, `contents: write`) is a cost, and on GitLab a project
  access token is a secret the project must create and rotate.
- **A hotfix is invisible to its epic's rollup and children region** (ruling C2). A forge-native
  link from the hotfix to the epic, for example a sub-issue added by hand, is reported as drift,
  because the block declares no parent.
- **`brain:epic:map` stops writing issue bodies.** The repo-wide region in existing epic bodies is
  replaced by the children region the first time the writer runs on each.
- **Renaming the head branch of an open PR is UNVERIFIED** on both forges, so `move` refuses it
  (decision 9). Ruling C6 removes the commonest reason to rename, a title change.
- **The VCS port widens,** which is a decision under ADR-0020's rule. Each widening is additive and
  lands in its slice with its contract tests: a draft flag on `mrCreate`; a verb that marks a draft
  ready; creating, assigning and closing a native milestone; reading native containment (GitHub
  sub-issues, GitLab epics and work items) and native milestone membership; deleting a remote
  branch; and whatever renaming a remote branch needs.
- **`ticket:start` gains remote writes.** The single confirmation is their cost.
- **Writing `tracker:` and the children region rewrites parts of a human-authored body.** Each
  needs ADR-0029 Decision 3's containment proof: everything outside the key, or outside the
  markers, is byte-identical.
- **`brain:ship` must learn the base** and add `Part of #<parent>` beside `Closes #<issue>` on a
  PR into a tracker.
- **A new gate, `integration-ready`,** blocks an early integration merge at `standard` and
  `regulated` where a hierarchy is declared. At `lite`, and on the implicit model at every tier
  (ruling M1), an early merge is possible; its cost is a node reported as merged but open, and a
  remainder PR a human must confirm in `day:start` before the node can close (rulings M3, R1).
  Until someone runs `day:start` interactively, the node stays open.
- **A closing keyword in a PR body is no longer enough off `main`.** The workflow closes only what
  the resolver confirms (ruling M2), so a child whose block does not declare its parent stays open
  after a tracker merge, and is reported.
- **Two legacy grammars live on indefinitely** for every project without `vcs.hierarchy` (ruling
  N2), so the branch parsers keep both forms for good, not for a window.
- **A native-containment read costs one call per issue,** paid in a background lane and cached.
- **The first drift report on an existing repository will be noisy,** for ADR-0029's reason:
  every issue that was never labelled with a level is a block-only claim until someone reconciles
  it.

## Rejected alternatives

**`type:*` as the level label.** One label namespace cannot mean both the change type and the
level.

**The native milestone as an authoritative, issue-less level** (the 2026-10-02 reading). It cannot
be a node, carry a block, be a PR's `Closes` target or own a tracker. Ruling Q4 replaced it with a
milestone issue and a mirror.

**Native data as a level source** (ruling C1). A level that a background lane could change after
first render, from a source ruling Q11 already made drift-only.

**Native containment as a parent source.** Ruling Q11 keeps it for drift. Sub-issues exist only on
GitHub, a forge-UI click would silently re-parent work, and a union source is a later decision in
ADR-0029's framing.

**A migration that writes a hierarchy into every consumer's config** (ruling C4). The implicit
model already describes them, and a migration would rewrite `brain.config.json` for no change in
behaviour.

**A label that exempts a hotfix from `base-branch`** (ruling C2). A label that bypasses a hard gate
is the shortcut `workflow-governance.md` and ADR-0035 refuse; a hotfix declares no parent instead.

**A milestone segment from its name** (ruling C6). A name changes, a branch would then need a
rename, and `move` refuses that while a PR is open.

**A versioned, machine-readable children list in the parent's body.** A second declaration of the
relation `parent:` already declares (ruling Q12).

**A git `post-merge` hook as the closing mechanism.** It is client-side and never fires on a forge
merge (ruling C5).

**A branch that is both a leaf and a prefix.** Git cannot store it; the fixed `tracker` leaf is the
price of hierarchical names.

**Flat branch names.** They say nothing about where the ticket sits.

**A `hotfix` level.** A hotfix is a parentless ticket with a label, not a place in the hierarchy.

## What this does NOT close

- **No code changes here.** The resolver, the config shape and its validation, the `ticket:start`
  chain, `move`, the drift check, the native lane, the children region, the close workflow, the
  hotfix follow-up and the branch scheme are the slices in #1251.
- **`brain:doctor` does not exist yet.** It is #1130. Until it lands, the drift check reports
  through `brain:governance-status` alone, and the legacy-branch counts have no home.
- **The `agent-authorities.md`, `workflow-governance.md` and ADR-0026 changes are drafts,** not
  doctrine, until the maintainer signs them.
- **GitLab's close path needs a token the project must provide.** Until it does, the GitLab
  workflow reports and does nothing, and `day:start` is the only net.
- **Renaming an open PR's head** stays unmeasured, and `move` refuses it.
- **Native constructs other than the milestone mirror and containment,** such as GitHub issue
  types, are not defined here.
- **The questions below are not ruled.** Nothing in this ADR decides them by default.
- **The merge.** Nothing here gives any agent a merge verb (ADR-0037).

## Amendments this requires (none are made here)

Promoted after ADR-0039, in this order. "Drafted" means the draft is beside this file and
`planAmendment` accepts it against the target on `main`; "owed" means it is still to be written.

1. **`brain/core/methodology/agent-authorities.md`** — **drafted**,
   `agent-authorities-hierarchy-close.draft.md`. The close workflow (ruling C5), its branch
   deletions, its ready-marking (ruling C10) and its children-region rewrite (ruling N5) are
   automation acts, run by the automation identity at every tier, not agent acts; and
   `day:start`'s regeneration of the region is Tier 1 for an agent (ruling M4).
2. **ADR-0026, Amendment 11** — **drafted**, `adr-0026-amendment-11.draft.md`. A row for
   `integration-ready` in the tier table: detection at `lite`, required at `standard` and
   `regulated` where `vcs.hierarchy` is declared; detection-only at every tier on the implicit model
   (rulings N4, M1).
3. **`brain/core/methodology/workflow-governance.md`** — **drafted**,
   `workflow-governance-integration-ready.draft.md`. A fifth invariant row, `integration-ready`,
   with its scope: judged through the resolver by content, never by branch name, no label bypass,
   and the close workflow's merged-but-open fallback (ruling N4).
4. **ADR-0029** — **owed**. Its Decision 2 ("neither wins", the union) governs blocking edges and is
   unchanged for them. For the hierarchy fields, rulings Q2 and C1 set a precedence (block > label >
   default) with every disagreement reported, and ruling Q11 reads native containment, which
   Decision 2 deliberately left unread, for drift only and never into the blocking graph. The union
   for hierarchy is named as a later upgrade. Its Decision 3 changes too (ruling C8): `brain:epic:map`
   no longer writes its repo-wide region into issue bodies; the same proven region writer writes the
   generated children region instead, from the close workflow and from `day:start` (ruling N5).
5. **ADR-0032** — **owed**. The `brain-graph/1` format gains levels: `kind` names any declared
   level, not only `epic`, `milestone` included; `tracker:` is honoured on any level that declares
   `integration`; `TRACKER_GRAMMAR` admits the hierarchical scheme in a repository that declared a
   hierarchy and keeps `feature/…` (ruling N2). The block gains no name key (ruling C6).
6. **ADR-0035** — **owed**. Its rule that a branch name is a claim extends from the two lanes to the
   hierarchical branch path: ancestry in a name is a claim, and the resolver's sources are the
   proof. `integration-ready` is a second gate judged by content under that rule.
7. **ADR-0018** — **owed**. The GitLab governance fragment documents the project access token
   variable the close job needs, because `CI_JOB_TOKEN` cannot write issues.
8. **`brain/core/methodology/harness-contract.md`, the `brain:ticket:start` row** — **owed**. With a
   declared hierarchy the branch is no longer `{type}/issue-{number}-{slug}`, the base is the
   nearest integrating ancestor's tracker, and the verb may propose creating the missing chain under
   one confirmation; without one, today's row stands (ruling N1). A parentless issue, a hotfix
   included, starts from `main`.

## Open questions for the maintainer

The rulings of 2026-10-07 (Q1-Q12, Q1-hotfix, C1-C10, N1-N5, M1-M4, R1) settle every question
earlier drafts listed. Checking R1 against M3 leaves one. This draft takes no position on it.

1. **Who executes M3's direct close** (ruling R1 against M3's direct-close branch). M3 closes a
   merged-but-open node and deletes its tracker "directly" when its last child closes and the
   tracker has no commits its target lacks. That branch fires when the last child closes without a
   merge (a child closed as not planned, or moved away by `move`): no PR merges, so the close
   workflow, which runs on a merged PR, never fires. R1 moved the sibling act, the remainder PR, to
   `day:start` under the user's credentials; it left this one "unchanged", with no actor.
   Options: (a) the close workflow also runs on the `issues` `closed` event and performs the direct
   close as the automation identity, the same identity and tier as C5's closes and deletions;
   (b) `day:start` proposes the direct close and the tracker deletion as a Tier 2 act, shown and
   confirmed like the remainder PR, and only reports in a non-interactive run; (c) `day:start`
   performs it without asking, as a Tier 1 act, because nothing is left to integrate.
