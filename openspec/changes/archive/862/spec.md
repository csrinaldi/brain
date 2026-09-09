---
status: tasked
issue: 862
---

# Memory Lane Specification (#862)

The ruling ticket's own contract: what MUST be true once the lane exists. #862 implements
nothing itself — this spec is what Wave 3 (2.5, 3.1a–d) are verified against. Ratified
2026-09-09 (L1–L9 as recommended, plus C1 secret scrub and C2 deterministic dedup).

## Requirements

### Requirement: lane recognition is narrow and structural

`issue-link`/`actor-check` MUST classify a PR as a **lane** only when its head branch matches
`^memory/` AND every diff path is an addition under `.memory/records/`. Any other path means
the PR is NOT a lane.

#### Scenario: a clean lane vs. a foreign path
- **WHEN** a PR's head is `memory/host1-2026-09-09` with a diff adding only files under
  `.memory/records/`
- **THEN** it is classified as a lane and requires no closing keyword or issue
- **AND WHEN** any diff path lies outside `.memory/records/` additions
- **THEN** the PR is refused as not-a-lane, naming the path, and standard `issue-link` rules
  apply

### Requirement: merge auto-merges only where the tier allows

`mrAutoMerge` MUST auto-merge a green lane PR when `requiredReviews: 0` (`lite`). It MUST
refuse, without throwing, when `requiredReviews > 0` (`standard`/`regulated`); the PR then
waits for human approval.

#### Scenario: tier-gated merge
- **WHEN** a lane PR is green at `lite`
- **THEN** `mrAutoMerge` merges it without review
- **AND WHEN** it is green at `standard`/`regulated`
- **THEN** `mrAutoMerge` refuses and the PR stays open for approval

### Requirement: the secret scrub is a required lane check (C1)

The secret scrub (#469 lineage) MUST run as a required status context on every lane PR. A
lane MUST NOT auto-merge while that check is missing, pending, or failing.

#### Scenario: scrub blocks auto-merge
- **WHEN** a lane PR is otherwise green but the secret-scrub check has not succeeded
- **THEN** `mrAutoMerge` does not merge it

### Requirement: the index stays off the lane

A lane PR MUST NOT commit `index.jsonl`. `local-checks` MUST warn, without blocking, when the
committed index lags `rebuild(records)`.

#### Scenario: lag is visible, two lanes never conflict
- **WHEN** a lane merges and the committed `index.jsonl` no longer equals a rebuild from
  `.memory/records/`
- **THEN** `local-checks` prints a lag warning and does not fail
- **AND WHEN** two hosts' lane PRs both add records and neither commits the index
- **THEN** both merge without a hand-resolved conflict

### Requirement: the collector uses plumbing with deterministic dedup (C2)

The collector MUST enumerate `git worktree list`, gather untracked `.memory/records/*.jsonl`
absent from `origin/main`, and build/push the lane branch via `hash-object`/`commit-tree`
without checking out any worktree. When a filename exists in more than one worktree with
diverging unhashed fields, it MUST resolve it with the reader's first-wins rule: earliest
line, earliest month file.

#### Scenario: no checkout, deterministic on divergence
- **WHEN** the collector runs
- **THEN** no worktree's working tree or index is modified
- **AND WHEN** two worktrees hold a same-named record file with diverging unhashed fields
- **THEN** the collector's output matches the reader's first-wins rule, deterministically, on
  repeated runs

### Requirement: the ship trigger and credential are separated

`brain:memory:ship` MUST run only from the session-end hook, `day:start`, or by hand — never
from a feature branch's `pre-push`. The capturing session MUST NOT hold the poster credential
(ADR-0033): ambient VCS identity at `lite`; `BRAIN_MEMORY_TOKEN`, handed explicitly, on
unattended hosts.

#### Scenario: trigger and credential boundaries
- **WHEN** a feature branch is pushed
- **THEN** `pre-push` does not invoke `brain:memory:ship`
- **AND WHEN** `brain:memory:ship` runs on an unattended host
- **THEN** it authenticates with `BRAIN_MEMORY_TOKEN`, never the capturing session's own
  credentials

### Requirement: `memory-gate` is unchanged; the template wording updates

`memory-gate` MUST keep reading the PR tree's `.memory/records/`, not the diff, with no code
change. The PR template's memory line MUST become "captured as a record
(`memory:save --issue N`); it reaches `main` on the lane".

#### Scenario: a rebased feature PR passes unchanged
- **WHEN** a feature PR is rebased on a `main` that already holds the lane's record for its
  issue
- **THEN** `memory-gate`'s scoped mode passes with no change to the gate's logic

### Requirement: feature-PR surfaces retire only after the lane is proven

`pre-push:70`'s `share`, `ticket.nextSteps.step3` (en/es), `brain-save.mjs`,
`contributor-scaffold.mjs:274`, and `day.done.checkCmd` MUST NOT be retired until 3.1b's first
scenario ("a record does not wait for its feature") has passed AND #874 (record-first) has
landed.

#### Scenario: retirement is sequenced
- **WHEN** 3.1d is attempted before 3.1b's first scenario passes or before #874 lands
- **THEN** retirement does not proceed
- **AND WHEN** both conditions are met
- **THEN** all five surfaces are rewritten or removed and none tells a feature-branch author
  to add records

### Requirement: latency targets are ratified (L9)

`memory:audit` MUST report learn→main latency at `lite` of p50 ≤ 1 h and p90 ≤ 24 h, against
the baseline p50 21.6 h / p90 399.7 h.

#### Scenario: exit measurement
- **WHEN** `memory:audit` runs after the lane ships records
- **THEN** it prints p50/p90 learn→main beside the baseline, for comparison against the
  ratified targets

## Requirement ownership

| Requirement | Owning slice |
|---|---|
| lane recognition | 3.1c |
| merge by tier | 2.5 |
| secret scrub required check | 3.1c |
| index off the lane | 3.1c |
| collector, deterministic dedup | 3.1a |
| trigger + credential | 3.1b |
| `memory-gate` unchanged / template wording | 3.1d |
| feature-PR surface retirement | 3.1d |
| latency targets | epic exit 6.1, measured by `memory:audit` (#870) |
