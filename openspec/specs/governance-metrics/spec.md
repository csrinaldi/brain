### [issue-324-m9-metrics] governance-metrics — 2026-07-27

# governance-metrics Specification

## Purpose

Read-only reporting verb that re-derives governance-effectiveness signals (lead
time, gate failures, bypass usage, memory-record coverage) from brain's own
merged git history. Detection-only: introduces zero new gates, invariants, or
CI failure conditions. Complements `brain-audit` (which asserts pass/fail per
merge) by aggregating the same underlying checks over time.

## Requirements

### Requirement: Merge-window aggregation

The system MUST compute, per period bucket over a requested merge window:
changes-merged count, median lead time, and per-gate raw/enforced failure
counts for required gates `issue-link`, `diff-size`, `decision-gate`. Lead
time MUST be computed as issue `status:approved` label-add timestamp → merge-
commit date, and MUST be documented as an issue-approval proxy, not
PR-review-approval time. `decision-gate` counts MUST only include PRs labeled
`decision` (label-conditional per its mixed enforcement).

> **Amended (issue #324, D3):** the original draft of this requirement also
> listed `memory-gate` among the per-period gates. `memory-gate`
> (`memoryPresence`) is repo-global — it reads `.memory/records/` state once
> and produces an IDENTICAL result for every merge in a run. A per-period
> column would be a constant masquerading as a time series. It is reported
> once, separately, as a repo-level line (see "Memory-record coverage" and
> "Repo-level signals" below) — never as a per-period gate. See "Accepted
> deviations from initial design" (D3) below.

#### Scenario: Monthly report over historical range (H1)
- GIVEN brain's merge history from 2026-06-01 to 2026-07-26 (30 merges)
- WHEN `brain:metrics` runs with default period
- THEN the report contains one row per month with changes-merged, median lead
  time, and raw/enforced counts for all three required per-period gates
  (`issue-link`, `diff-size`, `decision-gate`)

#### Scenario: Raw vs. enforced diverge when exceptions exist
- GIVEN a merge window containing PRs labeled `size:exception`
- WHEN `diff-size` failures are aggregated
- THEN the raw count includes all check failures and the enforced count
  excludes exception-labeled/exempted merges

### Requirement: Bypass usage reporting

The system MUST report `size:exception` and `skip:memory-gate` usage counts
broken down by gate, by author, and by period, over the requested window.
`skip:memory-gate` usage MUST be reported as a raw label count only — it MUST
NOT be subtracted from any enforced count, since no code path implements or
checks for it (documented, not enforced).

#### Scenario: Exception usage trend visible across weekly buckets (H3)
- GIVEN `--period=week` over a 4-week range
- WHEN the report is generated
- THEN it contains 4 weekly buckets, each with its own bypass-usage counts,
  making a rising trend observable across buckets

#### Scenario: Exception usage broken down by author
- GIVEN a merge window containing PRs where different actors added the
  `size:exception` label
- WHEN the report is generated
- THEN a separate "Exception usage by author" breakdown reports
  `size:exception` counts per (period, label-adding actor) pair, with an
  unresolvable actor bucketed as `unknown` (never dropped)

### Requirement: Memory-record coverage (repo-level, non-time-series)

The system MUST report total memory records, records with `issue` populated,
and coverage percentage as a single repo-level snapshot, MUST NOT present it
as a per-period time series, and MUST label it "adoption pending" in output.

#### Scenario: Memory store unavailable (E2)
- GIVEN memory records cannot be read (missing/unreadable `.memory/records/`)
- WHEN the report is generated
- THEN memory-record coverage is reported as 0% with the unavailability and
  adoption-pending caveats both stated, and the report otherwise completes

### Requirement: Detection-job reporting (non-blocking)

The system MUST report `phase-order`, `actor-check`, and
`brain-writes-reviewed` (DETECTION_JOBS) each as a single pass/fail count
column, without a raw/enforced split, since these jobs never block merge.

#### Scenario: Detection jobs show single column
- GIVEN a merge window with mixed detection-job outcomes
- WHEN the report is generated
- THEN each detection job appears as exactly one count column, with no
  enforced-vs-raw distinction

> **Amended (issue #324, D8):** detection-job conclusions are read from
> `vcs.prStatusRollup()`. GitHub's rollup carries a real `conclusion` field
> (`SUCCESS`/`FAILURE`/...). GitLab's rollup ALWAYS normalizes
> `conclusion: null` by its own provider contract (no distinct conclusion
> field). `detectionConclusion()` falls back to the `status` field
> (`success`/`failed`) when `conclusion` is `null`, so both providers are
> supported in code and covered by a GitLab-shaped fixture test — but only
> GitHub has been exercised against real merged history (Phase 8 integration
> run). See "Accepted deviations from initial design" (D8) below.

### Requirement: CLI invocation and output format

CLI: `npm run brain:metrics [<git-range>] [--json] [--period=month|week]
[--help]` MUST default to a markdown table on stdout, MUST default `--period`
to `month`, and MUST emit `--json` as a flat array with one object per period
bucket, a superset of the markdown table's data. `--help` MUST print usage
text and exit 0, without requiring a valid `<git-range>` or performing any
git/VCS I/O.

> **Amended (issue #324, D7):** the original draft of this requirement
> specified `--range=<range>` as a named flag. The implementation uses a
> **positional** `<git-range>` argument instead, mirroring `brain-audit`'s own
> signature (`git log` already accepts range syntax like `HEAD~30..HEAD`
> directly, so a flag adds no clarity — only inconsistency with the sibling
> verb). See "Accepted deviations from initial design" (D7) below.

#### Scenario: JSON output is parseable (H2)
- GIVEN `brain:metrics --json` runs over a valid range
- WHEN stdout is parsed as JSON
- THEN it is a flat array of period-metric objects consumable by downstream
  tooling without additional parsing

#### Scenario: --help exits 0 without touching git or the VCS
- GIVEN `brain:metrics --help` is invoked, including in a directory that is
  not a git repository or has no configured VCS
- WHEN the command runs
- THEN it prints usage text and exits 0

### Requirement: Graceful degradation

The system MUST NOT crash on empty or invalid input. An empty merge window
MUST produce a clear "no data" message and exit 0. An invalid git range MUST
produce an actionable error suggesting valid range syntax and exit non-zero.
A CLI usage error (e.g. an unrecognized flag) MUST produce a single,
non-duplicated error message and exit non-zero.

#### Scenario: No merges in range (E1)
- GIVEN a range containing zero merges
- WHEN `brain:metrics` runs
- THEN it prints a "no data for this range" message and exits 0

#### Scenario: Invalid git range (E3)
- GIVEN `--range` refers to a non-existent ref
- WHEN `brain:metrics` runs
- THEN it prints an error naming the invalid range and suggests valid
  `brain:audit`-style range syntax, and exits non-zero

#### Scenario: Unrecognized flag produces a single error message
- GIVEN an unrecognized flag (e.g. `--bogus`)
- WHEN `brain:metrics` runs
- THEN it prints exactly one `brain-metrics: ...` prefixed error message
  (never doubled) and exits non-zero

### Requirement: Historical re-execution, zero new rules

Required-gate historical results MUST be produced by re-executing the same
pure check functions `brain-audit` uses (not by querying post-merge rollup
state, which reflects current, not historical, status). The system MUST
introduce zero new governance gates, invariants, or thresholds, and MUST NOT
persist metrics between runs (each report is point-in-time only). Where the
consuming repo configures `governance.auditBaseline`, historical re-execution
MUST skip the same pre-baseline merges `brain-audit` itself skips — a merge
`brain-audit` never evaluated MUST NOT contribute a raw/enforced gate result.

#### Scenario: Re-execution matches brain-audit's own verdict

- GIVEN a historical merge that `brain-audit` marked as failing `issue-link`
- WHEN `brain:metrics` re-executes checks for that merge
- THEN it reports the same failure for that gate on that merge

#### Scenario: Pre-baseline merges are skipped identically to brain-audit

- GIVEN `governance.auditBaseline` is configured and a merge predates it
- WHEN `brain:metrics` re-executes checks for that merge
- THEN the merge contributes zero raw/enforced gate results, matching
  `brain-audit`'s own baseline skip

## Accepted deviations from initial design

The following deviations from this spec's original draft were made
deliberately during design/implementation and are accepted as final,
documented behavior rather than defects:

- **D3 — memory-gate excluded from per-period gate columns.** `memoryPresence`
  is repo-global at HEAD, identical for every merge in a run. Per-merge
  columns are reserved for gates whose result genuinely varies merge-to-merge
  (`issue-link`, `diff-size`, `decision-gate`). `memory-gate` is reported once
  as a repo-level line instead.
- **D7 — positional `<git-range>` argument, not `--range=<range>`.** Mirrors
  `brain-audit`'s own CLI signature for sibling-verb consistency; `git log`
  already accepts range syntax like `HEAD~30..HEAD` as a bare argument.
- **D8 — GitLab detection-job support via a `status` fallback, GitHub-verified
  end-to-end.** `detectionConclusion()` supports both providers in code
  (GitLab's `conclusion` is always `null` by its own contract, so the
  fallback reads `status` instead) and is covered by a GitLab-shaped fixture
  test. Only GitHub has been exercised against brain's own real merged
  history (Phase 8 integration run) — GitLab support is implemented and unit
  tested, but pending a live end-to-end confirmation against a real GitLab
  repo.

## Out of Scope

- New governance gates, invariants, or CI-blocking behavior (detection-only)
- Config file format for thresholds or exclusions
- Historical tracking database or trend storage (point-in-time reports only)
- CI integration as a blocking or required job
