# Governance Post-Merge Sweep Specification

## Purpose

A step appended to `.github/workflows/governance-postmerge.yml`, after `advance`, that opens one
`auto-archive/<date>` PR per run when closed-and-unswept `openspec/changes/` folders exist. It
consumes the selector from `archive-closed-issue-selection` and never gates the audit/revert path.

## Requirements

### Requirement: Sweep Gated on Clean Audit After Cursor Advance

The sweep step MUST run only when `steps.audit.outputs.code == '0'` and after `advance` completes.
It MUST NOT run on audit code `1` (revert) or `2` (uncomputable), and MUST NOT run before the
cursor has advanced (Constraint C1).

#### Scenario: Audit clean

- GIVEN `steps.audit.outputs.code == '0'` and `advance` succeeded
- WHEN the job proceeds
- THEN the sweep step runs

#### Scenario: Audit dirty

- GIVEN `steps.audit.outputs.code` is `'1'` or `'2'`
- WHEN the job proceeds
- THEN the sweep step does not run

### Requirement: Staleness Is Never an Audit Failure Class

The sweep MUST NOT be implemented as, or feed, a `brain-audit` `[FAIL]` class (Constraint C2). A
stale folder MUST NOT make `steps.audit.outputs.code` non-zero and MUST NOT enter the auto-revert
path.

#### Scenario: Stale folders exist alongside a clean audit

- GIVEN 50 closed-and-unswept folders at HEAD
- WHEN `brain-audit` runs over the cursor window
- THEN the exit code reflects only existing FAIL classes, unaffected by staleness

### Requirement: One `auto-archive/<date>` PR, Never a Direct Push

When the sweep set is non-empty, the step MUST archive each eligible folder, commit to branch
`auto-archive/<date>` (UTC date of the run), push it, and open exactly one PR targeting `main`
(Constraint C4). It MUST NOT push directly to `main`.

#### Scenario: One closed-and-unswept folder

- GIVEN one folder eligible per the selector
- WHEN the sweep step runs
- THEN exactly one `auto-archive/<date>` PR is opened with that folder's archive + spec diff

### Requirement: PR-Head Idempotency

Before creating a PR, the step MUST check for an existing `auto-archive/<date>` PR in any state
(open, merged, or closed-without-merge — `--state all`), mirroring `auto-revert/<sha>`
(REQ-D2-13). If one exists, the step MUST skip PR creation for that date without failing the job.

#### Scenario: Re-run same day after PR exists

- GIVEN an `auto-archive/2026-08-11` PR already exists in any state
- WHEN the sweep step runs again the same UTC day
- THEN no new PR is created and the step does not fail

#### Scenario: Nothing to sweep

- GIVEN no closed-and-unswept folders
- WHEN the sweep step runs
- THEN no PR is created

### Requirement: Sweep Failure Never Turns a Green Run Red-and-Silent

A sweep failure (selector read failure, collision, git/PR error) MUST NOT undo the cursor advance
and MUST NOT mask the audit result. It MUST either (a) not fail the overall job while recording an
explicit alarm/log line distinct from the audit's own alarms, or (b) fail the job AND file an
alarm — but MUST NOT fail silently. Either way it MUST satisfy REQ-TS-5's invariant that no
terminal state is both red and silent.

#### Scenario: Selector read fails mid-sweep

- GIVEN the closed-issue selector cannot resolve issue state
- WHEN the sweep step runs
- THEN it records an alarm/log line identifying the failure, the prior cursor advance is untouched,
  and the job's terminal step does not report an unreported-red state

#### Scenario: Collision detected during sweep

- GIVEN two folders resolve to the same `archivePath`
- WHEN the sweep step runs
- THEN the collision is reported in the step's output and does not silently drop the second folder

### Requirement: Sweep Runs Strictly After Advance, Never Gates It

The sweep step MUST be ordered after `advance` and MUST NOT be a prerequisite for `advance`,
`revert`, or the `terminal` (REQ-TS-5 backstop) steps. A sweep failure MUST NOT block or delay the
revert path on a subsequent run.

#### Scenario: Sweep step fails

- GIVEN the sweep step errors after cursor advance
- WHEN the next post-merge run occurs
- THEN `advance`/`revert` evaluate the new window normally, unaffected by the prior sweep failure
