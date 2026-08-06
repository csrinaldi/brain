# Delta for Governance v3

Refines REQ-L2-2/REQ-HONESTY-1: rung 3 MUST earn "armed" from run-ledger evidence, not
file presence — closing the gap that let a 12-day post-merge CI outage report armed.

## ADDED Requirements

### Requirement: REQ-R3-1 — Recent Success Arms Rung 3

Rung 3 MUST report `active: true, verifiable: true` only when the last terminal run of
the post-merge workflow succeeded within the 48h staleness window. `mechanism` MUST
name the run ledger as the evidence source — never a generic/file-presence label.

#### Scenario: Recent successful run arms rung 3

- GIVEN the last terminal run of `governance-postmerge.yml` completed within 48h, conclusion success
- WHEN rung 3 is evaluated
- THEN it reports `active: true, verifiable: true`, `mechanism` naming the run ledger

### Requirement: REQ-R3-2 — Terminal Failure Reports Inert With the Run URL

Rung 3 MUST report `active: false, mechanism: 'postmerge-inert'` when the last terminal
run failed, and `reason` MUST carry that run's URL.

#### Scenario: Failed last run reports inert with the run URL

- GIVEN the last terminal run of `governance-postmerge.yml` completed, conclusion failure
- WHEN rung 3 is evaluated
- THEN it reports `active: false, mechanism: 'postmerge-inert'`, `reason` includes the run URL

### Requirement: REQ-R3-3 — Staleness Reports Inert; Drift-Guard Required

Rung 3 MUST report inactive when no terminal run occurred within 48h (2 daily cron
periods), regardless of an older run's outcome. A test MUST fail if
`governance-postmerge.yml`'s `schedule:` cron changes without updating the constant.

#### Scenario: Stale last-known-success reports inert

- GIVEN the last terminal run succeeded but was >48h ago, no run since
- WHEN rung 3 is evaluated
- THEN it reports `active: false`

#### Scenario: Drift guard fails on unmatched cron change

- GIVEN `governance-postmerge.yml`'s `schedule:` cron changes without the constant being updated
- WHEN the drift-guard test runs
- THEN it fails

### Requirement: REQ-R3-4 — Read Failure Is Uncomputable, Never Armed

Rung 3 MUST report `available: false`, never `active: true`, on any read failure (auth,
token, network, rate-limit, malformed response) — per the
`evidence-reader-empty-on-failure` contract: a reader MUST NOT turn a failed read into
a confident verdict.

#### Scenario: No API access is uncomputable

- GIVEN the run-ledger read fails (no token/API access)
- WHEN rung 3 is evaluated
- THEN it reports `available: false, active: false` — never `active: true`

#### Scenario: Malformed response is uncomputable

- GIVEN the run-ledger read returns an unparseable response
- WHEN rung 3 is evaluated
- THEN it reports `available: false, active: false`

### Requirement: REQ-R3-5 — Zero Runs Ever Reports Unproven

Rung 3 MUST report `active: false, mechanism: 'postmerge-unproven'` when the workflow
file is present but has never had a terminal run.

#### Scenario: Freshly wired workflow with no runs reports unproven

- GIVEN `governance-postmerge.yml` exists with zero terminal runs recorded
- WHEN rung 3 is evaluated
- THEN it reports `active: false, mechanism: 'postmerge-unproven'`

### Requirement: REQ-R3-6 — Shape Parity With Rung 2

Every rung-3 outcome MUST return the same fields rung 2 (#337) returns: `available,
active, verifiable, mechanism, reason, remedy`.

#### Scenario: Every rung-3 branch carries the full field set

- GIVEN any rung-3 outcome (armed, inert, stale, unproven, uncomputable)
- WHEN the result is inspected
- THEN it contains `available, active, verifiable, mechanism, reason, remedy`

### Requirement: REQ-R3-7 — Legacy Bare-Boolean Probes Keep Working

A probe returning a bare boolean (the existing ~36-fixture contract) MUST keep working,
normalized to a declared-but-legacy signal (`verifiable: false`) — mirroring rung 2's
`normalizeReleaseGateEvidence` pattern — with no existing fixture requiring changes.

#### Scenario: Bare `true`/`false` normalize to declared-legacy

- GIVEN a probe returns bare boolean `true` or `false`
- WHEN rung 3 is evaluated
- THEN `verifiable: false`, `active` matches the boolean, and `mechanism` differs from REQ-R3-1's run-ledger mechanism

### Requirement: REQ-R3-8 — Governance-Status Renders a Rung-3 Breakdown

`brain:governance-status` output MUST include a rung-3 breakdown block reporting
`verifiable` and `mechanism` whenever rung-3 evidence exists, mirroring the existing
rung-1/rung-2 blocks — no computed rung-3 signal may go unrendered.

#### Scenario: Rung-3 evidence is visible in the status report

- GIVEN rung 3 has been evaluated (any outcome)
- WHEN `brain:governance-status` runs
- THEN its output includes a rung-3 line naming `verifiable` and `mechanism`

### Requirement: REQ-R3-9 — Historical Outage Window Replays as Inactive

A fixture built from the real run-ledger data for `governance-postmerge.yml` covering
2026-07-24 to 2026-08-05, replayed through the real probe and rung-3 evaluation, MUST
report rung 3 inactive.

#### Scenario: The 12-day outage window reports inactive

- GIVEN the 2026-07-24→2026-08-05 fixture, in which the workflow failed continuously
- WHEN it is replayed through the real probe and rung-3 evaluation
- THEN rung 3 reports `active: false`
