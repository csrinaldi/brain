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
counts for required gates `issue-link`, `diff-size`, `memory-gate`,
`decision-gate`. Lead time MUST be computed as issue `status:approved`
label-add timestamp → merge-commit date, and MUST be documented as an
issue-approval proxy, not PR-review-approval time. `decision-gate` counts MUST
only include PRs labeled `decision` (label-conditional per its mixed
enforcement).

#### Scenario: Monthly report over historical range (H1)

- GIVEN brain's merge history from 2026-06-01 to 2026-07-26 (30 merges)
- WHEN `brain:metrics` runs with default period
- THEN the report contains one row per month with changes-merged, median lead
  time, and raw/enforced counts for all four required gates

#### Scenario: Raw vs. enforced diverge when exceptions exist

- GIVEN a merge window containing PRs labeled `size:exception`
- WHEN `diff-size` failures are aggregated
- THEN the raw count includes all check failures and the enforced count
  excludes exception-labeled/exempted merges

### Requirement: Bypass usage reporting

The system MUST report `size:exception` and `skip:memory-gate` usage counts
broken down by gate, by author, and by period, over the requested window.

#### Scenario: Exception usage trend visible across weekly buckets (H3)

- GIVEN `--period=week` over a 4-week range
- WHEN the report is generated
- THEN it contains 4 weekly buckets, each with its own bypass-usage counts,
  making a rising trend observable across buckets

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

### Requirement: CLI invocation and output format

`npm run brain:metrics [--json] [--period=month|week] [--range=<git-range>]`
MUST default to a markdown table on stdout, MUST default `--period` to
`month`, and MUST emit `--json` as a flat array with one object per period
bucket, a superset of the markdown table's data.

#### Scenario: JSON output is parseable (H2)

- GIVEN `brain:metrics --json` runs over a valid range
- WHEN stdout is parsed as JSON
- THEN it is a flat array of period-metric objects consumable by downstream
  tooling without additional parsing

### Requirement: Graceful degradation

The system MUST NOT crash on empty or invalid input. An empty merge window
MUST produce a clear "no data" message and exit 0. An invalid git range MUST
produce an actionable error suggesting valid range syntax and exit non-zero.

#### Scenario: No merges in range (E1)

- GIVEN a range containing zero merges
- WHEN `brain:metrics` runs
- THEN it prints a "no data for this range" message and exits 0

#### Scenario: Invalid git range (E3)

- GIVEN `--range` refers to a non-existent ref
- WHEN `brain:metrics` runs
- THEN it prints an error naming the invalid range and suggests valid
  `brain:audit`-style range syntax, and exits non-zero

### Requirement: Historical re-execution, zero new rules

Required-gate historical results MUST be produced by re-executing the same
pure check functions `brain-audit` uses (not by querying post-merge rollup
state, which reflects current, not historical, status). The system MUST
introduce zero new governance gates, invariants, or thresholds, and MUST NOT
persist metrics between runs (each report is point-in-time only).

#### Scenario: Re-execution matches brain-audit's own verdict

- GIVEN a historical merge that `brain-audit` marked as failing `issue-link`
- WHEN `brain:metrics` re-executes checks for that merge
- THEN it reports the same failure for that gate on that merge

## Out of Scope

- New governance gates, invariants, or CI-blocking behavior (detection-only)
- Config file format for thresholds or exclusions
- Historical tracking database or trend storage (point-in-time reports only)
- CI integration as a blocking or required job
