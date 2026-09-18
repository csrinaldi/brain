# Explore — issue-967: an epic's tracker (and the epic itself) as data

Worktree read: `/home/gandalf/IA/brain-issue-967` (branch `feat/issue-967-featgovernance-an-epics-tracker-is-data`, off origin/main baa14b98). No shell; every claim below is a file read.

## Context

#967 owns three mechanisms (H1/H2/H3 of the accepted design doc `~/.claude/projects/-home-gandalf-IA-brain/design-docs/tracker-enforcement-hardening.md`):
1. H1 — the `brain-graph/1` block accepts `tracker:` on an epic, plus (comment of 2026-09-16) `kind: epic` and a parsed `parent`.
2. H2 — `brain:ticket:start` resolves the base from the epic instead of defaulting to `main`.
3. H3 — a `base-branch` governance gate refuses a slice PR against `main`.

#564 owns the WRITTEN rule (Tier 3 prose). #713's stranded surface is the complement — and it has ALREADY landed (`brain/scripts/status/stranded.mjs`), which changes one of #967's open questions (see "Tracker PR" below).

## Current state (file:line)

### The block parser — `brain/scripts/status/epic-graph.mjs`

- `GRAPH_PROTOCOL = 'brain-graph/1'` (:68). Selection is by fence TAG first word (:168, ADR-0032), not by an interior scalar.
- `parseGraphBlock` (:164-274) returns `{track, blocks, needs, files}` or `{ok:false,error}` or `null`. Absent / malformed / hidden are three distinct answers (:177-254) — a lot of guard surface, none of it key-schema related.
- Field reads (:259-273): `nums(key)`/`strs(key)` wrap `scalar(block,key)` + `parseJsonScalar`; `track = scalar(block,'track')`.
- **Forward compatibility is free.** `scalar` (`brain/scripts/review/lib/yaml-block.mjs:65-68`) is `new RegExp('^'+key+':[ \\t]*(\\S.*)$','m')` — it reads only the keys a caller names and there is no unknown-key validation anywhere in the parser. An older brain consuming a body that carries `kind:`/`tracker:`/`parent:` ignores them silently; nothing chokes. Confirmed also that `^track:` cannot match a `tracker: feature/x` line (the `e` breaks the literal), so the two keys do not collide in either direction.
- Node construction `buildGraph` (:394-407): `{number, title, labels, state, track, files, declared, sources, assignees}`; then `blockedBy`/`status` (:436-443), `conflictsWith`/`filesUnknown` (:454-465). `track` is the only block-derived scalar on the node. New scalars land in the same object literal.
- `divergences` (:423-427) compares declared vs native edges and only when a native read happened (:419-422). `foreignRelations` (:363, :381) counts cross-repo native relations.
- Tests live in **`brain/scripts/status/epic-map.test.mjs`** (there is no `epic-graph.test.mjs`): `parseGraphBlock` asserted with `assert.deepEqual(g, {track, needs, blocks, files})` at :39-41, :91, :97, :103, :174, :180. **Every one of those deepEqual assertions breaks the moment the return object grows a key** — that is the real cost of H1's parser change, and it is mechanical.

### The snapshot — `brain/scripts/status/snapshot.mjs`

- `readForge` (:184-229): `issueList` → per-issue `issueView` → `buildGraph(issues)`. Note it never passes `relations`, so the snapshot graph has **no native-relation source at all** (`divergences` is always `[]` there); only `brain:epic:map` reads `issueRelations` (`epic-map.mjs:106`).
- The unreadable-node reset at :211-212 enumerates the block-derived fields by hand: `{...n, ok:false, reason, status:UNREADABLE, declared:null, track:null, files:[], sources:[]}`. **Any new block-derived field must be added here too**, or an unreadable node would carry a `tracker`/`kind` it never declared — exactly the `evidence-reader-empty-on-failure` shape the comment at :198-204 was written to close.
- Parity test `snapshot-cli.test.mjs:16-28` compares verb JSON to module return over a fixture tree with **no VCS port** ("graph not computed — no VCS port", asserted at :39). It therefore does NOT cover graph node fields. The coverage that matters is `snapshot.test.mjs:133-215`, which injects a fake port (`{issueList, issueView}` literals, bodies as inline `brain-graph/1` strings). #967's acceptance "the snapshot's parity test covers the two fields" must be read as *that* test, not `snapshot-cli.test.mjs`.
- **The UI consumers do not exist yet.** `brain/scripts/ui/**`, `canvas-model.mjs`, `drawer-model.mjs` — none present in the tree (#881 unlanded). H1 has no downstream renderer to update; the snapshot is the whole consumer surface today.

### `Parent: #N` — convention or inference?

- No code reads it. `rg` for `Parent:` across `brain/scripts/**` returns zero readers.
- It is a real and enforced convention in the **#864 family**: `openspec/changes/issue-864-memory-2-0/design.md:145` and `archive/862/tasks.md:124` ("Every issue body states `Parent: #864` in prose, never a closing keyword"), verified against filed issues in `archive/862/verify-report.md:72`.
- But its SHAPE is not stable:
  - It is not always line-initial: `openspec/changes/issue-337-efficacy-probes/proposal.md:3` reads `Issue: #337 — M10 Phase 3. Parent: #335. Epic: #313.`
  - That same line shows **`Parent` is not necessarily the epic**: #337's parent is #335 (an intermediate slice group) while its epic is #313, under a separate `Epic:` key.
  - Trailing prose is normal: `Parent: #864 (memory 2.0), task 1.2 (Wave 1).`
- Of the four ticket bodies available to this exploration (#967, #564, #713, #878), **zero carry a `Parent:` line**. #967 asserts #881's body does; that could not be verified without the forge.
- `needs:` does not point at the epic for a slice: #967 itself states #881 declares `needs: [879]` (its predecessor slice), and #878's own block is `needs: []`. So the `needs`-edge fallback resolves to a sibling, not a parent, in the one instance we have.

**What a parser can rely on**: the literal string `Parent: #<digits>`, case as written, appearing somewhere in the body, with arbitrary text after the number. **What it cannot rely on**: line position, that the target is an epic, that it is the only such line, that `Epic:` is absent, or that `needs` reaches the epic.

### The verb — `brain/scripts/lib/ticket-args.mjs` + `brain/scripts/ticket-start.mjs`

- `parseTicketArgs` (:49-72) is pure. `--base` absent → `'main'` (:60-61). **The return shape cannot express "the caller asked for main" vs "nobody asked"** — both yield `baseBranch:'main'`. H2's refusal rule requires that distinction, so `parseTicketArgs` must gain `baseExplicit` (or return `baseBranch:null` when absent). This is the smallest load-bearing change in the whole ticket.
- `WORKTREE_FLAG`/`IN_PLACE_FLAG` (:35,:40); contradictory modes refused, never resolved (:58). Id rule: first all-numeric arg that is not `--base`'s value (:66).
- `ticket-start.mjs` is a **top-level script with no exported function**: it reads `process.argv` at :35, calls `process.exit` on every error path, and performs git/network work at module scope. There is no `ticket-start.test.mjs` in the tree — only its leaves are tested (`ticket-args.test.mjs`, `ticket-branch.test.mjs`, `checkout-freshness.mjs`). #967's acceptance "fixture-tested in `ticket-args.test.mjs` **and the verb's test**" therefore requires either extracting a new pure leaf or making `ticket-start.mjs` importable. The house precedent is #782's own: move the decision into a leaf (`lib/ticket-args.mjs`) so the default can be tested without a repo.
- The issue read is `vcs.issueView({project, number:id})` (:93), which already returns `body` (`github.mjs:106-130`). **The epic lookup needs one additional `issueView` call, no new port verb.**
- Base is used at :132-142 (`git fetch <remote> base:refs/remotes/origin/base`, then `startPoint = origin/<base>`) and nowhere else. Branch grammar: `${branchType}/issue-${number}-${slug}` (:119), slug capped at 40 chars (:109-117). Freshness warning at :155-173 — **warns, never refuses** (:151-154 explains why), a directly applicable precedent for the warn-vs-refuse question in H2.
- Every operator-facing string goes through `t('ticket.…')` (36 `ticket.*` keys in `brain/scripts/i18n/en.mjs`), and `i18n/coverage.test.mjs:96-98` asserts `es.mjs` has an entry for **every** key in `en.mjs`. New refusal/reason messages cost en+es pairs.
- Gotcha for H2's tests: `ticket-args.test.mjs:88-118` contains **doctrine-oracle tests** that read `brain/core/methodology/harness-contract.md` and assert on the `brain:ticket:start` row. Adding a similar oracle for a doctrine line that the maintainer has not yet signed would ship a red test. The good news: harness-contract.md:28 ALREADY says `<tracker>` "is the integration base … not `main`, while an epic is in flight" — H2 needs no new doctrine, only a reader.

### The gates

- Registration is a **five-place** act. `brain/scripts/vcs/governance-checks.mjs:27-28` states it flatly: "When adding a job: add a GATE_MATRIX row (governance-tiers.mjs) AND add the job to governance.yml in the same commit, or the drift-guard test turns red." Concretely a new `base-branch` job touches:
  1. `governance-checks.mjs:41-54` `GOVERNANCE_JOBS` (append at the end — `governance-checks.test.mjs`'s order guard asserts governance.yml's job order equals this array exactly).
  2. `vcs/governance-tiers.mjs:151-235` `GATE_MATRIX` (a row per tier; `requiredJobs(tier)` at :505-509 is derived from it, and REQ-TIER-8's drift guard asserts the key set equals `GOVERNANCE_JOBS` in both directions).
  3. `.github/workflows/governance.yml` — a job block in the shape of `issue-link:` (:46-75) or `diff-size:` (:85-102): checkout + one `run: node brain/scripts/governance/run-check.mjs <name>` with an `env:` block.
  4. `brain/scripts/ci/gitlab-governance.yml` — the mirror stanza (`issue-link` at :122-126).
  5. `brain/scripts/governance/run-check.mjs` — the handler, the `if (checkName === …)` dispatch (:542-547), and `SUBCOMMAND_PORT_REACH` (:483-488). `run-check.test.mjs` T7 asserts that manifest sorted-equals the dispatched names in both directions.
- Plus `brain/scripts/vcs/lib/workflow-auth.mjs`: a subcommand declared `true` in `SUBCOMMAND_PORT_REACH` must declare `VCS_TOKEN` in its workflow step `env:` or the guard reports "reaches the VCS PORT and does not declare VCS_TOKEN (#479)" (:566-567). `base-branch` must fetch the epic, so it is a port-reaching subcommand.
- Plus an operational step nobody can automate away: a new REQUIRED context needs `npm run brain:protect` re-run by an admin (`workflow-governance.md`'s operator reference; `checkContexts(tier)` derives from the same matrix).
- **Check shape.** Two precedents: `checks/diff-size.mjs` is a 23-line pure function over raw numstat, all wiring in `run-check.mjs:428+`; `checks/issue-link.mjs` is a 33-line pure predicate over the body, with the base-awareness living entirely in `runIssueLinkCheck` (`run-check.mjs:314-410`). The second is the shape a base-branch rule fits.
- **`runIssueLinkCheck` already holds every input the new rule needs**: `ctx.body`, `ctx.targetBranch`, `ctx.defaultBranch`, `ctx.sourceBranch`, `ctx.provider`, `ctx.repo`, the extracted issue number (:380), and an injectable `fetchIssue` (:388) that already fetched the linked issue. `issue-link` is already `SUBCOMMAND_PORT_REACH: true` and its workflow step already declares `VCS_TOKEN`, `PR_NUMBER`, `BASE_BRANCH`, `DEFAULT_BRANCH`, `BASE_SHA`, `HEAD_SHA`.
- **Tier**: `detection-policy.mjs:49-57` `mapDetectionToWarning` downgrades a `pass:false` (never an `uncomputable`) to a warned pass when `resolveGatePolicy(gate,tier) === 'detection'`; `run-check.mjs:581-585` applies it once, in `main`.
- **The gate table is CODE, not doctrine.** `GATE_MATRIX` is the authority. `brain/core/methodology/workflow-governance.md` carries a four-invariant table that restates `diff-size`'s budgets **by hand and says so** (AGENTS.md:451-463, "#496 … Doctrine restating a value the code owns is a drift risk accepted deliberately here"). Decisive precedent: `lane-paths` and `lane-scrub` (#905) were added to `GOVERNANCE_JOBS` and `GATE_MATRIX` and are **absent from that four-invariant table**. So a new gate does NOT require a Tier-3 edit. Doctrine is optional for H3.

### Port verbs for parent/epic

- `issueView` (`github.mjs:106-130`) returns `{number,title,labels,body,author,assignees,state,stateReason}` — body included, so the block is reachable with the verbs that exist.
- `issueRelations` (`github.mjs:202-228`) reads `dependencies/blocking` + `dependencies/blocked_by`. Its docstring at :183-187 is a standing ruling: "**Sub-issues (`/issues/:n/sub_issues`) are deliberately NOT read.** They are a CONTAINMENT relation … not an ordering one" (ADR-0029 Decision 2). GitHub's native sub-issue API is used **nowhere** in the tree.
- A new verb is a Tier-3 doctrine act: `brain/core/methodology/vcs-contract.md` carries the verb table (`issueRelations` row at :106) and `vcs/providers/vcs.contract.test.mjs` is a parameterized suite run against BOTH providers with JSON fixtures — a new verb means a GitHub impl, a GitLab impl, two fixtures, a contract row (draft for the maintainer) and contract tests.

### The tracker-PR question and "is this branch a tracker"

- **`stranded.mjs` already answers "what is a tracker", and it answers by prefix.** `strandedTrackers` (:19-28) filters `b.name.startsWith('feature/')`, and the header records the maintainer's 02/09 ruling: "only `feature/*` trackers count (a WIP task branch is not a chain), and the surface REPORTS". So there are two candidate oracles for "this PR's head IS a tracker": the `feature/` prefix already in the tree, or a `tracker:` value declared by some open epic (data-driven, but it costs an `issueList` + N `issueView` calls inside a PR gate).
- The "must the tracker PR exist from day one" question is partly settled by that same module: GitHub cannot open a PR with an empty diff, and a tracker that is ahead of `main` with no PR carrying it is **already reported** by `gatherStranded` (:39-60). "Opened when it has a diff, surfaced by `stranded` until it is" is an answer the tree already implements; requiring it from day one is not expressible on GitHub.
- A third default nobody has named yet: `brain-ship.mjs:259` opens the PR with `base: config?.project?.defaultBranch ?? 'main'`, and `memory/lane/ship.mjs:206` hardcodes `base:'main'`. Even with H2 and H3, the PR-open step still points at `main` by default; H3 catches it at PR time rather than the verb refusing at open time. Out of #967's stated scope — worth naming so it is a decision and not an omission.

## Constraints (quoted)

- `AGENTS.md:158-159` (Tier 3, prohibited): "Commit directly to `brain/core/**` or `brain/project/**` — the knowledge half, whatever its subdirectories are called." Every doctrine line ships as a draft under `openspec/changes/issue-967-tracker-as-data/brain-drafts/`.
- `AGENTS.md:145-147` (Tier 2, confirm): "Push to any branch", "Create or merge an MR", "Modify `.gitlab-ci.yml`, settings.xml, CODEOWNERS — infrastructure changes". The GitHub workflow edit is the same class.
- `harness-contract.md:28` / `AGENTS.md:223`: "`<tracker>` is the integration base (e.g. `feature/v2.0.0`), not `main`, while an epic is in flight." The rule H2 implements is already written.
- `AGENTS.md:233-239`: the isolated worktree is what `brain:ticket:start` does with no flags (#782); `--in-place` is the named opt-out "and the verb says which mode it took" — the precedent for H2 saying which base it took and why.
- `AGENTS.md:444-449`: the four invariants and their jobs. `AGENTS.md:491-493`: "The constant `GOVERNANCE_JOBS` … is the single source of truth for these names. A drift-guard unit test reads `governance.yml` and asserts the YAML job names match the constant — fail-closed on any mismatch."
- `AGENTS.md:447`: tier budgets — lite **1000**, standard 400, regulated 200. `brain.config.json:17` declares **`"tier": "lite"`**, and `:18-29` ignores `**/*.test.mjs`, `openspec/changes/**`, `AGENTS.md` and `.memory/**` from the counted diff.
- `AGENTS.md:529-541`: "L1 enforces observable outputs … It does NOT enforce judgment." A base-branch rule is an output check (base equals a declared field), which is inside the line.

## Options

### A. Where `parent` comes from

| Option | Is it data? | Cost | Notes |
|---|---|---|---|
| A1 `Parent: #N` prose line | inference over prose | Low — a regex in `parseGraphBlock`'s caller, zero port work | The only source that exists on today's bodies. Shape is unstable (mid-line, `Epic:` variant, parent ≠ epic in #337). Reads prose the block was invented to stop reading. |
| A2 `needs:` edge to a `kind: epic` node | data, but the wrong edge | Low code, high wrongness | Measured counter-example: #881 needs 879 (a sibling), #878 needs nothing. Resolves to a sibling in the one instance we have. Also needs the whole issue set in memory — the verb only fetches one issue. |
| A3 GitHub sub-issues | data, native | High — new port verb ×2 providers, 2+ fixtures, a Tier-3 `vcs-contract.md` row, contract tests | Contradicts a standing ruling (`github.mjs:183-187`, ADR-0029 D2) that sub-issues are containment and stay out of the graph. That ruling is about EDGES; `parent` is containment, so the ruling arguably supports using them here — but it is a decision, not a detail. |
| A4 a new `parent: N` key in the block | data, same mechanism as `tracker:` | Low code, high migration | One `nums`-style read. Costs a hand edit of every child issue body, and until edited every node's `parent` is null. |

Not mutually exclusive: A4 as the authority with A1 as a named fallback is expressible, at the cost of two resolution paths to test.

### B. Gate shape

| Option | Pros | Cons | Effort |
|---|---|---|---|
| B1 extend `issue-link` | Zero CI wiring, zero `GOVERNANCE_JOBS`/`GATE_MATRIX`/`brain:protect` churn. The wrapper already has `targetBranch`, `defaultBranch`, the extracted issue number and a port-reaching `fetchIssue`. Already `required` at every tier (NEVER_TIERED). | Conflates two invariants in one job name; a red `issue-link` no longer means "no approved ticket". #564 explicitly refuses to change which keyword `issue-link` demands — adding a different rule to the same job is adjacent to that refusal and needs the maintainer's word. Reverting only the new rule must turn exactly its own test red; harder inside a shared handler. | Low |
| B2 new `base-branch` job | One job, one invariant, one name; matches #967's literal text and `diff-size`'s precedent; the revert-proof is clean. | Five registration sites + workflow-auth's `VCS_TOKEN` rule + a `brain:protect` re-run; two more drift guards to satisfy; +~30 YAML lines across two CI files. | Medium |

**The tier tension, either way**: #967 asks for "detection at `lite`, required from `standard`". brain declares `lite` (`brain.config.json:17`). A `detection`-at-lite base-branch gate would have **warned** on the #881 PR, not refused it — which is the outcome this ticket exists to prevent, on this repo. `issue-link` and `diff-size` are `required` at `lite` precisely because they are never-tiered. This needs an explicit ruling before design.

### C. Verb refusal vs warning

| Option | Pros | Cons |
|---|---|---|
| C1 refuse `--base main` when a tracker is declared, unless `--off-tracker` | Makes the wrong thing unexpressible rather than merely discouraged — #782's stated lesson ("a rule enforced by memory, and memory is what fails", `ticket-args.mjs:12-14`). | A wrong refusal is a stopped session (`ticket-start.mjs:152-153`). Needs a resolution path that fails OPEN when the epic is unreachable: if `issueView` on the parent throws, the verb must fall back to `main` with a stated reason, never refuse on an unreadable epic. |
| C2 warn and proceed | Matches the freshness warning already in the file (:168-173); zero risk of blocking work. | This ticket exists because a warning nobody reads is what let #953 land on `main`. The maintainer's line — "no puedo yo recordarte siempre como trabajar" — is an argument against C2. |

C1 with a fail-open-on-unreadable clause is the shape the repo's own precedents point at; the decision is the proposal's.

## Open questions for the proposal

1. **Ancestor resolution.** With `Parent: #335` and `Epic: #313` on one line (#337), which does the resolver follow? Walk `parent` upward until a node with `kind: epic` or a declared `tracker`, or take the first hop only?
2. **Is `Epic: #N` a synonym for `Parent: #N`?** Both spellings exist in the tree.
3. **Tier of the gate at `lite`** — detection (as #967 says) or required (as the failure it exists to prevent demands, on the repo that declares `lite`)?
4. **Gate shape** — B1 or B2, given #564's refusal to touch `issue-link`'s keyword policy.
5. **Tracker oracle** — `feature/` prefix (already ruled for `stranded.mjs`) or a declared `tracker:` matched against `headRefName` (costs a forge scan in a PR gate)?
6. **Tracker PR timing** — proposed answer: "opened when it has a diff; `stranded.mjs` reports it until then." Needs ratification, since #967 lists it as a thing the change must settle.
7. **`tracker:` on a non-epic** (a large feature with no slices) — allowed or refused?
8. **Refusal spelling and fail-open rule** for H2 (`--off-tracker`? what happens when the epic body is unreadable?).
9. **Scope boundary**: `brain-ship.mjs:259` and `memory/lane/ship.mjs:206` also default to `main`. In or out?
10. **Where the H1 doctrine line lands.** There is **no `brain-graph/1` spec under `brain/core/**`** — `rg brain-graph brain/core` returns nothing; the block's only doctrine home is ADR-0032/ADR-0029 under `brain/project/decisions/` (also Tier 3). So the draft target is an ADR amendment or #564's rule text, not a spec file that exists.

## Suggested delivery seam

Counted lines exclude `**/*.test.mjs` and `openspec/changes/**` (`brain.config.json:18-29`), so the gate budget (1000 at `lite`) is not the binding constraint — the 400-line **review** budget is, and it counts what a human reads.

| Unit | Files | Counted (prod) | With tests |
|---|---|---|---|
| A — parser + snapshot fields | `status/epic-graph.mjs` (parse + node), `status/snapshot.mjs:211-212` reset | 40-70 | +120-160 (`epic-map.test.mjs` deepEquals all need the new keys; `snapshot.test.mjs` fake-port cases) |
| B — verb resolves the base | `lib/ticket-args.mjs` (`baseExplicit`, `--off-tracker`), a new pure leaf `lib/base-resolution.mjs`, `ticket-start.mjs` wiring, `i18n/en.mjs`+`es.mjs` | 180-230 | +150-200 |
| C — the gate | `governance/checks/base-branch.mjs` (or the `issue-link` extension), `run-check.mjs` handler+dispatch+manifest, `governance-checks.mjs`, `governance-tiers.mjs`, `.github/workflows/governance.yml`, `ci/gitlab-governance.yml` | 180-240 (B2) / 90-130 (B1) | +150-220 |

Total: roughly 400-540 counted production lines, 900-1200 lines of review. **One PR is out of the question for review load; a chain is the right shape, and the dependency is real rather than cosmetic** — B and C both READ the `tracker`/`parent` fields A creates, so A must land first.

Recommended: a **feature-branch chain on `feature/issue-967`**, three child PRs (A → B → C), the tracker PR to `main` opened once A has landed on it and it has a diff. This is the convention #967 itself is written to enforce; delivering it stacked onto `main` would be the ticket contradicting its own content. The `feature/` prefix also makes the chain visible to `stranded.mjs` if it stalls.

Note for planning: this worktree's branch is `feat/issue-967-…`, created off `origin/main` — **not** off a `feature/issue-967` tracker. If the chain is chosen, the tracker branch has to be created and this branch rebased onto it before PR #1.

## Ready for proposal

**Yes**, with nine open questions attached. The code map is complete, the costs are measured, no blocker was found, and the two genuinely load-bearing forks — the `parent` source (A1..A4) and the gate's tier at `lite` — are product/doctrine decisions that belong to the proposal round, not to exploration.

Two findings the proposal must not lose:
- `parseTicketArgs` cannot currently express "the caller asked for `main`" vs "nobody asked" (`ticket-args.mjs:60-61`). H2's refusal rule is unimplementable until that changes.
- `ticket-start.mjs` has no test and no exported entry point. "The verb's test" in the acceptance criteria requires a seam that does not exist yet.
