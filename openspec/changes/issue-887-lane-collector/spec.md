---
status: proposed
issue: 887
---

# Lane Collector Specification (#887)

Refines `archive/862/spec.md`'s requirement "the collector uses plumbing with deterministic
dedup (C2)" (owning slice: 3.1a, ADR-0034 L4+C2) into the collector's own testable contract.
D1–D7 ratified 2026-09-09 (`sdd/issue-887-lane-collector/ruling`).

## Requirements

### Requirement: candidate selection is narrow and structural (D5)

The collector MUST enumerate every `git worktree list --porcelain` stanza, including the main
checkout. Per worktree, `git status --porcelain -- .memory/records` MUST classify an
untracked (`??`), `origin/main`-absent, `validateRecord`-clean record as a candidate.
`.memory/index.jsonl` MUST NEVER be a candidate. A tracked-and-modified (` M`) record MUST be
skipped and reported with reason `modified-tracked`, never collected. `prunable`/`bare`
stanzas MUST be skipped without running `worktree prune`.

#### Scenario: a clean untracked record is a candidate
- GIVEN a worktree holds an untracked, valid record file absent from `origin/main`
- WHEN the collector enumerates worktrees
- THEN the file is a candidate

#### Scenario: modified-tracked, invalid, and on-main are all skipped
- GIVEN a tracked-and-modified record, an invalid record, and a record already on `origin/main`
- WHEN the collector runs
- THEN each is skipped with its own reason (`modified-tracked`, `invalid`, `already-on-main`)
  and none is collected

#### Scenario: index.jsonl is never a candidate
- GIVEN a worktree's `.memory/index.jsonl` is untracked
- WHEN the collector enumerates candidates
- THEN it is excluded by filename grammar, never appearing in `collected` or `skipped`

#### Scenario: main checkout is a worktree; prunable/bare are skipped
- GIVEN the main checkout and a prunable and a bare stanza among the enumerated worktrees
- WHEN the collector runs
- THEN the main checkout's records are candidates like any other worktree, AND the
  prunable/bare stanzas are skipped, AND `git worktree prune` is never invoked

### Requirement: deterministic dedup on divergence (D3/C2)

Candidates sharing a basename MUST group. Byte-identical copies MUST collapse to one blob.
Diverging copies MUST resolve by lexicographic worktree path, then physical line, and MUST be
reported, never refused. The plan MUST be deeply equal under any enumeration order of the same
candidate set and across repeated calls on identical input.

#### Scenario: identical bytes collapse
- GIVEN two worktrees hold byte-identical copies of the same record filename
- WHEN the planner groups candidates
- THEN one blob is written and no divergence is reported

#### Scenario: divergence resolves by path then line, reported
- GIVEN two worktrees hold diverging copies of the same filename
- WHEN the planner resolves the group
- THEN the winner is the copy from the lexicographically-first worktree path, AND the group
  appears in `duplicates` as divergent

#### Scenario: stability under shuffled enumeration
- GIVEN the same candidate set fed in a shuffled worktree-enumeration order, and fed again in
  the original order
- WHEN `planLaneCommit` runs on each
- THEN both plans are deeply equal, AND a repeated call on identical input returns an
  identical plan

### Requirement: scrub runs before hash, never writes a secret (D4)

Each candidate MUST be scanned for secrets before `hash-object -w`. A hit MUST skip only that
candidate, with `{reason:'secret', pattern, lineNumber}`; the matched line text MUST NOT
appear in output, logs, or the object database. The rest of the batch MUST still collect.

#### Scenario: one bad candidate does not block the batch
- GIVEN one candidate among many contains a secret pattern
- WHEN the collector runs
- THEN the secret-bearing candidate is skipped with `pattern` and `lineNumber` only, AND
  every other clean candidate is collected

#### Scenario: the secret never reaches the object database
- GIVEN a candidate fails the scrub
- WHEN the run completes
- THEN neither the resulting commit's tree, nor any loose object, nor the printed output
  contains the matched line text

### Requirement: the lane ref, first run and same-day append (D2)

On first run of a host-date, the collector MUST create `refs/heads/memory/<host>-<date>` with
`origin/main` as parent. On a same-day re-run, it MUST append a commit whose parent is the
ref's current tip and whose tree is the tip's tree plus the new blobs — never a `-<n>` suffix
for its own repeat run. A run with zero new candidates MUST leave the ref untouched and
return `commit: null`.

#### Scenario: first run creates the ref
- GIVEN `refs/heads/memory/<host>-<date>` does not exist
- WHEN the collector runs with at least one candidate
- THEN it creates the ref with a commit whose parent is `origin/main`

#### Scenario: same-day re-run appends
- GIVEN the ref already exists from an earlier run today, and new candidates exist since
- WHEN the collector runs again
- THEN it appends a commit whose parent is the ref's prior tip and whose tree adds only the
  new blobs, AND no `-<n>` branch is created

#### Scenario: nothing new is a no-op
- GIVEN the ref exists and no new candidates exist
- WHEN the collector runs
- THEN it returns `commit: null`, AND the ref is not updated

### Requirement: no working tree or index is modified (D6)

The collector MUST NOT modify any worktree's working tree or repository index. It MUST build
the lane tree in a temporary index (`GIT_INDEX_FILE`), removed after the run.

#### Scenario: two scratch worktrees are untouched
- GIVEN two scratch worktrees with a `git status --porcelain` snapshot taken before the run
- WHEN the collector runs against a repo containing both worktrees
- THEN both worktrees' `git status --porcelain` after the run is byte-identical to the
  snapshot before it

### Requirement: author identity is ambient, never fabricated (D6)

The collector MUST use the ambient git identity already resolved by `commit-tree`; it MUST NOT
pass a token or a fabricated `Name <email>`. If the identity is unset, the run MUST fail with
git's own error.

#### Scenario: ambient identity commits
- GIVEN a git identity configured in the environment
- WHEN the collector commits the lane tree
- THEN the commit's author/committer matches the ambient identity, with no token or invented
  name passed

#### Scenario: unset identity fails loudly
- GIVEN no git identity is configured
- WHEN the collector attempts to commit
- THEN the run fails with git's own identity error

### Requirement: the `collect` op's output shape and dispatch (D1)

`memory/cli.mjs` MUST expose `collect` in `VALID_OPS`, dispatched before backend selection,
never routed through a backend's `share`. On success it MUST print `memory.collect.done`
(en/es) and return `{ ref, commit, collected, skipped, duplicates }`, exit 0. On a genuine
failure it MUST print `memory.collect.failed` and exit 1. It MUST NOT require `MEMORY_BACKEND`.

#### Scenario: successful run reports the shape
- GIVEN a run with candidates and no failures
- WHEN `npm run memory:collect` completes
- THEN it prints `memory.collect.done` and exits 0 with `{ ref, commit, collected, skipped,
  duplicates }` populated

#### Scenario: dispatch never touches a backend
- GIVEN any `MEMORY_BACKEND` value or none set
- WHEN `collect` dispatches
- THEN no backend's `share` is invoked

#### Scenario: failure reports and exits non-zero
- GIVEN a genuine git failure during the run
- WHEN `collect` runs
- THEN it prints `memory.collect.failed` with the error message and exits 1

### Requirement: scope boundary — no push, no PR, no hook, no doctrine (D7)

This slice MUST NOT push any ref, open a pull request, be called from any hook, or write to
`brain/core/**` or `brain-drafts/`. `pre-push:70` and the other four feature-PR surfaces MUST
remain unchanged.

#### Scenario: nothing calls collect
- GIVEN this slice ships alone
- WHEN `pre-push`, `day:start`, and session-end hooks are inspected
- THEN none of them invoke `collect`, AND no push or PR call exists in `lane/collect.mjs`

## STRICT TDD test map

| Requirement | Test file | Case |
|---|---|---|
| candidate selection | `lane/plan.test.mjs` | untracked + clean + off-main is a candidate |
| candidate selection | `lane/plan.test.mjs` | modified-tracked / invalid / already-on-main each skip with own reason |
| candidate selection | `lane/plan.test.mjs` | `index.jsonl` never a candidate |
| candidate selection | `lane/collect.integration.test.mjs` | main checkout is a worktree; prunable/bare skipped, no `worktree prune` call |
| dedup | `lane/plan.test.mjs` | identical-bytes collapse to one blob |
| dedup | `lane/plan.test.mjs` | divergent tiebreak: lexicographic worktree path, then line |
| dedup | `lane/plan.test.mjs` | stability under shuffled enumeration order, deep-equal |
| scrub | `lane/collect.integration.test.mjs` | secret candidate skipped with pattern+lineNumber; rest collected |
| scrub | `lane/collect.integration.test.mjs` | matched line absent from commit tree, loose objects, and output |
| lane ref | `lane/collect.integration.test.mjs` | first run creates ref, parent `origin/main` |
| lane ref | `lane/collect.integration.test.mjs` | same-day re-run appends, never a `-<n>` branch |
| lane ref | `lane/collect.integration.test.mjs` | zero new candidates → `commit: null`, ref untouched |
| no mutation | `lane/collect.integration.test.mjs` | two scratch worktrees' `git status --porcelain` byte-identical before/after |
| author identity | `lane/collect.integration.test.mjs` | ambient identity used, no token/fabricated name |
| collect op | `cli.collect.test.mjs` | success prints `memory.collect.done`, returns full shape, exit 0 |
| collect op | `cli.collect.test.mjs` | dispatch never invokes a backend's `share` |
| collect op | `cli.collect.test.mjs` | failure prints `memory.collect.failed`, exit 1 |
| scope boundary | `lane/collect.integration.test.mjs` | no push/PR call present; hooks unchanged |

## Non-goals (D7)

The push and the PR (#888), `brain:memory:ship` and hook wiring (#888), `lane-paths`/
`lane-scrub` CI contexts (#889), retiring `pre-push:70` (#890), any change to `share`,
`reindex`, the record format, or `memory-gate`.
