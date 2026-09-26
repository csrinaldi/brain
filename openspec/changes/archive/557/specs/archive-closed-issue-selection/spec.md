# Archive Closed-Issue Selection Specification

## Purpose

A shared selector that maps live `openspec/changes/` folders to `{iid, closed}` by reading issue
state through the VCS port, replacing `archive.mjs --all`'s "archive everything but iid==='260'"
behavior. Both the backfill CLI and the post-merge sweep (see `governance-postmerge-sweep`) consume
this selector so eligibility is defined once.

**Note (backfill sizing):** whether the backfill ships as one PR (`size:exception`) or split is a
delivery decision for `sdd-tasks`, not a spec constraint. This spec only requires the backfill to
ship as a normal, human-reviewed PR (Constraint C4), never through the sweep step.

## Requirements

### Requirement: Closed-Issue Detector Keyed on Issue State

The system MUST provide a selector that, for each live folder under `openspec/changes/` (excluding
`archive/`) whose name parses via `parseChangeId` or is grandfathered, resolves the associated
issue's id and current CLOSED/OPEN state through the VCS port. Eligibility MUST be keyed on the
issue being **closed**, never on whether a referencing commit has merged.

#### Scenario: Closed issue is included

- GIVEN folder `issue-518-rung3-residuals` whose issue #518 is CLOSED
- WHEN the selector runs
- THEN the folder is included in the sweep set as `{iid: '518', closed: true}`

#### Scenario: Open issue is excluded

- GIVEN the folder for issue #267, OPEN
- WHEN the selector runs
- THEN the folder is excluded and reported as "open — left in place"

### Requirement: Backfill Filters by Closed State, Drops the `260` Hardcode

`archive.mjs --all`/`--backfill` MUST route folder selection through this selector instead of
"every non-`archive` directory". The literal `iid === '260'` exclusion MUST be removed; protection
for an active change MUST follow naturally from that change's issue being OPEN.

#### Scenario: Backfill run today

- GIVEN issue #260 CLOSED and #267/#284 OPEN
- WHEN `--backfill` runs
- THEN #260's folder is archived AND #267/#284 are left untouched

#### Scenario: Legacy hardcode removed

- GIVEN the source of `archive.mjs`
- WHEN searched for `iid === '260'`
- THEN no match exists

### Requirement: Not-Planned Closures Are Excluded and Reported, Not Silently Skipped

An issue closed as "not planned" MUST NOT be treated as archivable — no spec-delta consolidation
for work that never shipped. The selector MUST distinguish CLOSED+"not planned" from
CLOSED+completed via the VCS port's closure reason, and MUST report the former as a distinct,
visible outcome ("closed, not archivable") rather than archiving it or dropping it silently.

#### Scenario: Not-planned closure is excluded

- GIVEN a folder whose issue is CLOSED with reason "not planned"
- WHEN the selector runs
- THEN the folder is excluded from the sweep set AND reported as "closed, not archivable"

### Requirement: Destination Collisions Are a Visible, Non-Silent Outcome

When `archivePath(iid)` for a selected folder already exists (multi-folder issues, e.g. #518 ×3,
#266 ×2), the caller MUST report the collision distinctly from both a success and a benign skip,
and MUST NOT report success for a folder it did not move. Re-keying `archivePath()` to disambiguate
is out of scope (see proposal Scope) — a collision is always a reported skip, never a crash that
silently aborts the remaining run.

#### Scenario: Second folder for the same issue collides

- GIVEN `issue-518-rung3-residuals` already archived to `archive/518`
- WHEN `issue-518-widen-audit-walk` is processed next
- THEN the run reports a collision for `518` and does not claim success for that folder

### Requirement: Selection Is a Snapshot; Convergence Handles the Race

The selector MUST resolve issue state once per invocation (a snapshot), not re-check at PR-merge
time. An issue closing, or a folder being deleted/renamed, between selection and the archive PR's
merge is not a bug: the next scheduled or push-triggered run converges on the new state. No locking
or retry-loop is required.

#### Scenario: Issue closes after selection, before PR merge

- GIVEN a folder was OPEN at selection time and its issue closes minutes later
- WHEN that day's sweep PR merges
- THEN the folder stays unswept until the next run selects it fresh

#### Scenario: Folder deleted between selection and merge

- GIVEN a selected folder is deleted from `main` before the sweep PR merges
- WHEN the sweep PR is merged or rebased
- THEN the resulting conflict/failure is visible, not a silent no-op, and requires human resolution

### Requirement: Selector Reads Are Fail-Closed

The selector MUST authenticate issue-state reads via `VCS_TOKEN` (mirroring the audit step, #479).
If a read fails (network, auth, rate limit), the selector MUST abort sweep-set computation rather
than proceeding as if zero folders were eligible; the caller MUST surface the failure.

#### Scenario: VCS read fails

- GIVEN the VCS port errors resolving issue state for a folder
- WHEN the selector runs
- THEN it aborts computation and the caller reports failure, not an empty-but-successful result

### Requirement: Selector and Collision Behavior Are Covered by Automated Tests

The closed-issue selector and the destination-collision behavior MUST have `node --test` unit tests
covering: a closed issue, an open issue, a not-planned closure, a VCS read failure, and a
destination collision.

#### Scenario: Test suite covers the selector

- GIVEN the test suite for the selector module
- WHEN `node --test` runs
- THEN cases for closed, open, not-planned, VCS-failure, and collision are present and pass
