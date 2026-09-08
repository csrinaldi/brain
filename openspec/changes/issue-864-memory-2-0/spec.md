---
status: tasked
issue: 864
---

# Memory 2.0 Specification

Each requirement below is proved by a measurement, not by reading the code. The
measurements are the ones that found the property failing (audit 2026-09-03, analysis
2026-09-05), re-run after the slices land — by the `memory:audit` command this epic adds
(Requirement "integrity is reported"), never by a hand query. The epic's exit is that
command's output written on the tracker issue, beside the numbers it replaces.

> **Revised 2026-09-05** after a gap review of the merged contract (PR #867). The review
> found five contradictions with surfaces that already exist (governance gates, ADR-0002/0004,
> the PR template) and eight scenarios that were not executable as written. Every revision is
> marked **[rev]** so an implementing agent can see what the first version lacked.
> design.md §7 carries the list.

## Vocabulary

- **record** — one file under `.memory/records/<yyyy-mm>-<id>.jsonl` (memory-format.md).
- **the active backend** — whatever `MEMORY_BACKEND` selects; `engram` (default) or `plainfiles`.
- **the store** — **[rev]** the set of records an agent can read at capture time: the local
  `.memory/records/` of its worktree **plus** the records at `origin/main` (the same upstream
  read `upstream-records.mjs` already performs). A record that exists only in another host's
  unmerged worktree is NOT in the store, by definition.
- **the lane** — the memory-only pull request of design.md D1.
- **verbs** — **[rev]** named as they exist: `memory:share`, `memory:pull`, `memory:save`,
  `memory:reindex`, and `cli.mjs import` (the `import` op has no npm alias; `post-merge` and
  `session:start` call it directly). A scenario that names a verb names one of these.

## Requirements

### Requirement: memory is implementation-agnostic (the test)

No property of memory may depend on which backend is active.

#### Scenario: the plainfiles test
- **WHEN** `MEMORY_BACKEND=plainfiles` and any scenario in this spec is run
- **THEN** it passes with the same outcome as under `engram`, **or** it is one of the
  scenarios the table below declares vacuous under `plainfiles`, and it passes by vacuity —
  never by being skipped silently

**[rev] Vacuity table.** Under `plainfiles` the records ARE the backend, so some scenarios
have no second thing to compare. They pass by vacuity and the exit report says so per row:

| scenario | under `plainfiles` |
|---|---|
| two hydrations, one snapshot | `import` is `rebuildIndex`; two runs yield one index entry per record — the scenario is the index's own idempotence, and it is measured, not assumed |
| measured on the live store | "rows" = `index.jsonl` entries; "distinct keys" = distinct `id` — the count is real |
| `memory:index` (reproject `brain/`) | `unsupportedOp` today, by design (obs #578). Stays out of this spec: it projects doctrine, not captures |

#### Scenario: no backend artifact is load-bearing
- **WHEN** `.memory/manifest.json`, `.memory/chunks/`, **[rev]** `.memory/legacy/`, the
  `.engram` symlink and the `merge=engram-manifest` driver line are absent
- **THEN** `session:start`, `memory:share`, `memory:pull` and `cli.mjs import` complete and
  hydrate the active backend from `.memory/records/` alone

#### Scenario: the doctrine no longer requires the artifacts **[rev]**
- **WHEN** ADR-0002 ("the manifest stays committed; the merge driver is mandatory") and
  ADR-0004 ("the manifest remains required for all backends") are read
- **THEN** each carries an amendment stating that the manifest, the chunks, the legacy chunks
  and the symlink are the engram adapter's private business, not the durable layer's

### Requirement: hydration is idempotent by record id

#### Scenario: two hydrations, one snapshot
- **WHEN** two `import` runs are driven through the same snapshot of the backend's state (the #820 shape)
- **THEN** the backend holds exactly one row per record id

#### Scenario: measured on the live store
- **WHEN** the backend is exported and `rec-` keys are counted
- **THEN** distinct keys equal rows, and `session:start` prints the count next to the recency line

### Requirement: a capture is a record before it is anything else

#### Scenario: record first
- **WHEN** an agent captures an observation during a session
- **THEN** a file exists under `.memory/records/` before the live index is updated, and the index row cites that record's id

#### Scenario: every capture door is record-first **[rev]**
- **WHEN** the tools an agent session is offered for capture are enumerated (`memory:save`,
  the engram MCP `mem_save` / `mem_session_summary`, any harness skill that wraps them)
- **THEN** each one either writes a record first, or is not offered — and
  `agent-authorities.md` Tier 1 names the record-first door, not `mem_save` and `.engram/**`

#### Scenario: no loss before durability
- **WHEN** two sessions capture the same topic before any `share`
- **THEN** two records exist — the live index's upsert-by-topic never collapses them before
  materialisation

#### Scenario: the later capture can name the earlier **[rev]**
- **WHEN** the second session's agent has the first record in its store (see Vocabulary) and
  captures a correction or a revision of it
- **THEN** it passes `--supersedes <id>` and the record carries it; **the link is declared by
  the writer, never inferred from a topic key** — the record format has no `topic` field and
  this epic does not add one (a `topic` field would be an ADR-0017 amendment; refused in
  design.md §6)

### Requirement: a record carries its provenance

#### Scenario: a fresh capture is attributed
- **WHEN** a record is captured today
- **THEN** it carries `actor`, `actorKind` and `issue`; `actor` is not `@legacy`; and **[rev]**
  `actor` is a stable handle per memory-format.md — a human handle (`@crinaldi`) or an agent
  identity (`claude-…`, the harness's model id) — **never a git branch name**: a value
  containing `/` is refused at `buildRecord` time

> **[rev] Why the stronger wording.** Measured on the 94 records captured since 2026-08-29:
> 66 `@legacy`, 28 with `actor` equal to the branch name (`plainfiles.mjs:95`,
> `actor = getBranch(root)`), 0 handles. The first version of this scenario passed on all 28.
> The epic's own record (`rec-e01ca31951bd9a19`) has
> `actor: "feat/issue-864-epicmemory-memory-20-the-format-closed-t"`.

#### Scenario: `actorKind` is measured, not door-typed **[rev]**
- **WHEN** a human runs `memory:save` from a shell, and an agent runs it from a session
- **THEN** the two records carry different `actorKind` values — `PLAINFILES_ACTOR_KIND = "agent"`
  as a constant is retired; how the kind is measured (env, harness marker, config) is #738's
  ruling, and if the answer is "sometimes unknowable" the schema gains `unknown` through an
  ADR-0017 amendment, never through a guess

#### Scenario: a correction is expressible
- **WHEN** an agent corrects a record
- **THEN** it writes a new record with `supersedes` = the corrected id, and the store (see
  Vocabulary) refuses a `supersedes` that names no record in it

### Requirement: memory reaches `main` on its own lane

#### Scenario: a record does not wait for its feature
- **WHEN** a record is captured on a worktree branch that never merges
- **THEN** the record reaches `main`

#### Scenario: every worktree on the host is collected **[rev]**
- **WHEN** two worktrees of one clone each hold records captured in their own
  `.memory/records/` (the CLI resolves its root to the worktree, `cli.mjs:38`)
- **THEN** one lane PR carries both, and after it merges neither worktree shows those files
  as untracked-and-unpushed (`staged-records-check` already refuses a byte-identical restage;
  the lane's collector removes or marks what it has shipped)

#### Scenario: feature pull requests carry no records
- **WHEN** a feature PR is opened after the lane exists
- **THEN** its diff adds nothing under `.memory/records/`, **and [rev]** no surface tells the
  author to add them: `PULL_REQUEST_TEMPLATE.md` (generated by `contributor-scaffold.mjs`),
  `ticket.nextSteps.step3` in the i18n catalogs, `brain:save`, and `pre-push`'s `share` are
  rewritten or retired for feature branches

#### Scenario: `memory-gate` under the lane **[rev]**
- **WHEN** a feature PR is opened whose session records travelled by the lane and are on
  `main` but not yet in the feature branch
- **THEN** `memory-gate`'s issue-scoped mode (`memory-retrieval.mjs`) does not report `MISS`
  — it reads the records reachable from the PR's base as well as its head, or the ruling
  states another rule; a green gate that only a rebase can produce is not a rule

#### Scenario: the lane passes the governance surface **[rev]**
- **WHEN** a lane PR is opened
- **THEN** `issue-link`, `actor-check`, `diff-size`, `phase-order` and `decision-gate` pass
  without a per-PR waiver. `issue-link` on the default branch accepts ONLY a closing keyword
  against an approved issue (`run-check.mjs:346` refuses `Part of #N` there), and a lane PR
  has no issue of its own — so the ruling picks one of: a branch-grammar exemption for
  `memory/*` recorded in `run-check.mjs`/`governance-tiers.mjs`, or a standing approved
  memory issue the lane closes idempotently; and `brain:audit` over the merged history
  reports no `issueLink` failure on lane merges

#### Scenario: the lane is path-restricted
- **WHEN** a memory-lane PR touches any path outside `.memory/records/` additions and `.memory/index.jsonl`
- **THEN** it is refused, naming the path — **[rev]** by a CI check that is a required status
  context (branch protection cannot filter paths; `staged-records-check.mjs` has the shape)

#### Scenario: two lanes, one index **[rev]**
- **WHEN** two hosts open lane PRs that both regenerate `index.jsonl`
- **THEN** the second merges without a hand-resolved conflict: the lane's merge flow updates
  the branch and reindexes (`memory:resolve-index`) before auto-merge, or the index leaves the
  lane and is regenerated on `main` by `post-merge` — the ruling picks one and the forge's
  merge button never sees two indexes

#### Scenario: the merge rule is tier-parameterised **[rev]**
- **WHEN** the repository's `governance.tier` is read
- **THEN** at `lite` (`requiredReviews: 0`) the lane auto-merges on green; at `standard` and
  `regulated` (`requiredReviews: 1`) the lane PR waits for the tier's approval and the exit
  report states the human wait separately from the pipeline latency — the spec does not
  promise auto-merge where the tier forbids it

#### Scenario: the lane holds no credential the producer should not **[rev]**
- **WHEN** the lane pushes its branch and opens or auto-merges its PR
- **THEN** it does so through the VCS port (`mrCreate` plus a new auto-merge verb in
  `vcs-contract.md`, both providers) under ADR-0033's rule: the agent session that captured
  the records never holds the poster credential

#### Scenario: latency, measured
- **WHEN** learn→main latency is measured by `memory:audit` over the records captured after the lane exists
- **THEN** p50 is stated on the tracker issue next to the 10.9 h that opened it, and
  **[rev]** at `lite` p50 ≤ 1 h and p90 ≤ 24 h (targets proposed here for #862 to ratify or
  replace with numbers; "lower than 10.9 h" is not a target)

#### Scenario: #795's open items are answered, not orphaned **[rev]**
- **WHEN** `memory-presence.mjs`'s header is read after the lane's first scenario passes
- **THEN** it cites the ruling on "should the gate be able to tell" (the answer: the lane
  makes capture visible on `main`, the gate stays repo-scoped) and states what triggers an
  export and how long a record may exist only in a backend before it is a file

### Requirement: the contract is documented in the vocabulary of records

#### Scenario: no verb is described as "engram → .memory"
- **WHEN** `harness-contract.md` (rows 27 and 32-34 and the "Implementation note"),
  `consolidation-protocol.md` §3 (zone map) and §5, **[rev]** `agent-authorities.md` Tier 1,
  `memory-format.md` §"Relationship to the live layer", `.gitignore`'s memory block and the
  PR template's memory line are read
- **THEN** every memory verb is described in terms of `.memory/records/` and "the active
  backend", and `AGENTS.md` regenerates clean from those sources

#### Scenario: the backend contract exists
- **WHEN** an adapter is written or reviewed
- **THEN** there is a contract document it cites, stating hydration idempotence, record-first
  capture, the no-artifact rule, and **[rev]** the agnosticism test verbatim

### Requirement: the store's integrity is reported, not queried by hand

#### Scenario: duplicates are audible on both sides
- **WHEN** a duplicated record id exists in the log or a duplicated key in the backend
- **THEN** the next `session:start` or `post-merge` prints it to stderr

#### Scenario: the epic's measurements are a command **[rev]**
- **WHEN** `npm run memory:audit` is run on a clone
- **THEN** it prints, from `.memory/records/` and `git log`, with no backend needed: p50/p90
  learn→main latency over a window; records-vs-distinct-ids; the `actor` shape distribution
  (`@legacy` / branch-name / handle); `issue` and `supersedes` coverage; and, when the active
  backend can be exported, `rec-` rows vs distinct keys — the same five numbers that opened
  this epic, so the exit re-runs one command instead of three hand queries
