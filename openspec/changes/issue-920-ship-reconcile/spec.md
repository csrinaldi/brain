# Spec — Lane Ship Reconciliation (issue #920)

## Purpose

`shipLane()` (`brain/scripts/memory/lane/ship.mjs`) MUST guarantee that once a
lane's records are pushed, they eventually reach `main`, even when a retry
brings no new commits. "Nothing to push" and "nothing to deliver" are
different facts; this spec normalizes the second one. Normative surface for
this change (no `openspec/specs/**` capability entry exists for the memory
lane, per prior ruling); see also ADR-0034 L5.

## Requirements

### Requirement: Reconciliation is decided independently of whether a push is needed

The system MUST evaluate "is there anything to push?" and "is there anything
to reconcile (PR found/created, auto-merge armed)?" as two independent
questions. A retry that collects zero new records MUST still run the PR
find/create and auto-merge steps when the lane is not yet delivered.

#### Scenario: A failed PR lookup is recovered on the next run

- GIVEN a push already succeeded but the prior run's `mrList` call threw
- WHEN the lane is shipped again with zero new captures
- THEN `findOrCreatePr` runs, the PR is found or created, and the records
  reach `main`

#### Scenario: A failed auto-merge arming is retried

- GIVEN a PR already exists for the branch but its auto-merge arming failed
  on a prior run
- WHEN the lane is shipped again with zero new captures
- THEN auto-merge is armed on this run

### Requirement: Delivery is read via content containment against `origin/main`, never commit ancestry

The system MUST determine "delivered" by diffing the lane's own record paths
against `origin/main`'s content, not by asking whether the lane's commit is
an ancestor of `origin/main`. Auto-merge is squash on both VCS providers, so
a squash-merged lane commit is never an ancestor of `main`; an ancestry check
would report every merged lane as pending forever.

#### Scenario: Delivered is a no-op

- GIVEN the lane's record files are already present in `origin/main`'s
  content (squash-merged), whether the remote branch was kept or deleted
- WHEN the lane is shipped again
- THEN no push, no `mrList`/`mrCreate`, and no auto-merge arming occur
- AND this holds regardless of commit ancestry between the lane ref and
  `origin/main`

#### Scenario: New records after a same-day squash-merge ship

- GIVEN a lane whose prior PR was already squash-merged today
- WHEN new records are collected on top of the old (merged) tip
- THEN the lane pushes and a new PR is opened for the undelivered records

### Requirement: A branch that never existed is a true no-op

The system MUST NOT diff a ref that has no local existence, and MUST report
`title`/`body` as `null` (present, not absent) rather than fabricate a diff
failure as "origin/main could not be fetched".

#### Scenario: A branch that never existed stays a no-op

- GIVEN the lane ref has never been created locally
- WHEN the lane is shipped
- THEN no diff is taken, `title` and `body` are `null`, and no push, PR
  lookup, or auto-merge call is made

### Requirement: An unreadable delivery state never resolves to delivered

The system MUST treat a delivery read it cannot complete (unfetchable
`origin/main`, or an unknown ref state) as `delivered: null`, acting as if
undelivered — pushing when needed and always attempting reconciliation —
rather than silently assuming delivery.

#### Scenario: An unreadable delivery acts rather than assumes

- GIVEN `origin/main` cannot be fetched or the delivery diff cannot be
  resolved
- WHEN the lane is shipped
- THEN `delivered` is `null`, the run still pushes if needed and always
  attempts reconciliation, and the outcome names the reason

#### Scenario: A closed unmerged PR is not a delivery

- GIVEN a PR for the branch was closed without being merged and lane records
  are still absent from `origin/main`
- WHEN the lane is shipped
- THEN the records are treated as pending and a fresh PR is opened

### Requirement: The outcome shape reports reconciliation as work; existing failure and refusal behavior is preserved

The system MUST add `delivered` (`true|false|null`) and `reconciled`
(`boolean`) to the outcome, and every caller that renders "something
happened" from the outcome MUST treat a reconciliation-without-push as work,
not as "nothing". Divergence refusal and fatal PR-lookup-failure behavior
MUST NOT change.

#### Scenario: A reconciliation without a push is reported as work

- GIVEN a run finds/creates a PR or arms auto-merge without pushing
- WHEN `day-start-sweep`'s lane sweep line or `memory:ship`'s own outcome
  message is rendered
- THEN the message reports a reconciliation, never "nothing to ship"

#### Scenario: Divergence still refuses before the network

- GIVEN the local lane ref is behind `origin`'s matching ref
  (`behind > 0`)
- WHEN the lane is shipped
- THEN the run refuses before any push or VCS port call

#### Scenario: A failed PR lookup is still fatal

- GIVEN `mrList` throws during `findOrCreatePr`
- WHEN the lane is shipped
- THEN the run fails closed as `prLookupFailed`; this failure is not
  swallowed by the reconciliation path

## Out of Scope

- Widening the VCS port's `mrList`/`mrCreate` shape to expose merge state —
  filed separately as #930.
- The date-change case where nothing revisits yesterday's unreconciled
  branch (ruling R10) — its own follow-up issue is a task of this change,
  not solved here.
- `--dry-run` previewing a reconciliation outcome (ruling R12) — dry-run
  stays network-free; it only gains `delivered: null, reconciled: false`
  for shape uniformity.
- The first real `memory:ship` run against a live VCS provider.
