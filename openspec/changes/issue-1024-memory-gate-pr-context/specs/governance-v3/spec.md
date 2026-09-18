REQ-L3-4 is restated in full (its scoped-evidence set, fail-closed rule, and path
naming all change; its no-issue-detectable fallback does not). Two new members join
the existing L3 family (`REQ-L3-1`..`REQ-L3-4` already cover job registration and
issue-scoping): `REQ-L3-5` is the `memory-gate`-specific skip override (distinct from
any other gate's override), and `REQ-L3-6` is the CI-wiring precondition without which
`REQ-L3-4`'s scoped path never runs on GitHub. Both extend the L3 numbering rather than
opening a new family, since both are `memory-gate` job behavior, the same requirement
this family already governs.

## MODIFIED Requirements

### Requirement: REQ-L3-4: `memory-gate` Is Issue-Scoped (T2.1)

REQ-L3-1's `memory-gate` job MUST NOT stop at a global existence check once the
current change's issue number is detectable. `run-check.mjs` MUST resolve the issue
number the current PR/MR targets from `ctx.body` (reusing this file's own existing
`extractIssueNumber`/`requiresClosingKeyword` — no new extraction implementation),
then filter the SCOPED EVIDENCE to `record.issue === issueNumber` before verifying
coverage.

The scoped evidence set MUST be the union of the records readable from the PR's
checked-out tree and the records readable from `origin/<default>`, de-duplicated by
`record.id` (on a same-id collision, the PR-tree copy wins). A record that reaches the
default branch on its own lane PR (ADR-0034) satisfies a feature PR that closes the
same issue, with no rebase required — the feature branch never needs to carry the
record.

The gate MUST:

- FAIL when no record in either source is scoped to the issue (MISSING).
- PASS with a WARN-flavored reason (non-blocking) when scoped records exist but none
  is a `session_summary` (PARTIAL).
- PASS cleanly when a scoped `session_summary` exists in either source (HIT).
- FALL BACK to the pre-existing global `memoryPresence()` check when no issue number
  can be resolved from `ctx` — unchanged by this change.

If the default-branch read fails (fetch/ref error) and the PR tree alone already
contains a scoped HIT, the gate MUST still pass on that hit. If the default-branch
read fails AND the PR tree has no scoped hit, the gate MUST fail closed with an
explicit "default branch unreadable" reason — a read failure MUST NEVER produce a
silent pass.

Every run MUST name the path it took — `presence` (global fallback), `retrieval`
(issue-scoped, either source), or `skipped` (REQ-L3-5) — including a clean pass, which
named nothing before this change.

Tier behavior is unchanged: at `lite`, a scoped MISS is a non-blocking `::warning::`
(`mapDetectionToWarning`); at `standard`/`regulated`, a scoped MISS blocks
(`GATE_MATRIX['memory-gate']`).

(Previously: scoped evidence was the PR tree ONLY, so a record that had reached the
default branch but not the feature branch counted as MISSING, forcing a rebase; the
gate never named the path it took, not even on a clean pass.)

#### Scenario: PR-tree record satisfies the scoped check

- GIVEN `ctx.body` resolves to issue N
- AND the PR tree contains a `session_summary` record with `issue === N`
- WHEN `memory-gate` runs
- THEN it passes cleanly with `path=retrieval`

#### Scenario: Default-branch-only record satisfies the scoped check, no rebase

- GIVEN `ctx.body` resolves to issue N
- AND no record scoped to N exists in the PR tree, but one exists on `origin/<default>`
- WHEN `memory-gate` runs
- THEN it passes with `path=retrieval`, with no rebase of the feature branch

#### Scenario: The same record on both trees counts once

- GIVEN a `session_summary` scoped to issue N exists in both the PR tree and
  `origin/<default>` with the same `id`
- WHEN `memory-gate` runs
- THEN it passes citing one scoped hit, not a duplicate

#### Scenario: No scoped record in either source fails, citing the issue

- GIVEN `ctx.body` resolves to issue N
- AND neither the PR tree nor `origin/<default>` has a record with `issue === N`
- WHEN `memory-gate` runs
- THEN it fails, citing issue N by number, with `path=retrieval`

#### Scenario: Scoped records exist but none is a session_summary

- GIVEN `ctx.body` resolves to issue N
- AND at least one record scoped to N exists in the union set, but none is a
  `session_summary`
- WHEN `memory-gate` runs
- THEN it passes (`pass: true`) with a partial/warn reason and `path=retrieval`

#### Scenario: Default-branch read fails but the PR tree already has the hit

- GIVEN the default-branch read errors (fetch/ref failure)
- AND the PR tree alone contains a scoped `session_summary` for issue N
- WHEN `memory-gate` runs
- THEN it still passes, citing the PR-tree hit

#### Scenario: Default-branch read fails and the PR tree has no hit — fail closed

- GIVEN the default-branch read errors
- AND the PR tree has no record scoped to issue N
- WHEN `memory-gate` runs
- THEN it fails, with an explicit "default branch unreadable" reason
- AND it never passes silently

#### Scenario: No issue number detectable — fallback unchanged, path named

- GIVEN `ctx.body` is absent, or present but contains no closing keyword or "Part of
  #N" reference
- WHEN `memory-gate` runs
- THEN it degrades to the pre-T2.1 global `memoryPresence()` check
- AND a clean pass names `path=presence`

#### Scenario: `lite` tier turns a scoped miss into a warning

- GIVEN this repository's `governance.tier` is `lite`
- AND `memory-gate` would otherwise fail on a scoped MISS
- WHEN the result is mapped through `mapDetectionToWarning`
- THEN it exits 0 with an `::warning::` annotation, not a red check

## ADDED Requirements

#### Scenario: An uncomputable PR description is handled per tier

- GIVEN `PR_NUMBER` is set but the PR description could not be fetched
- WHEN `memory-gate` runs
- THEN at `standard`/`regulated` the result is uncomputable and fails closed, as
  `issue-link` does for an uncomputable body
- AND at `lite` it falls back to the repository-wide check and prints
  `path=presence (PR description uncomputable)`

#### Scenario: A partial pass at regulated shows the evidence gap

- GIVEN a PR at `regulated` whose issue has scoped records but no `session_summary`
- WHEN `memory-gate` runs
- THEN it passes as today, and the output carries a visible evidence-gap note that
  `regulated` expects an issue-linked session summary

### Requirement: REQ-L3-5: `memory-gate` Skip Override Is Real

Whether the label is honored is a tier parameter, `TIER_PARAMS.honorSkipMemoryGate`
(`brain/scripts/vcs/governance-tiers.mjs`): `false` at `lite`, `true` at `standard`,
`false` at `regulated`. When the tier honors it and the PR carries `skip:memory-gate`
from an authorized applier, `memory-gate` MUST short-circuit BEFORE evaluating
REQ-L3-4's scoped check and PASS with `path=skipped`, naming who applied the label. At
`regulated` the label MUST be refused with a reason that names the tier, consistent with
`regulated` refusing `size:exception`; evaluation continues per REQ-L3-4. At `lite` the
label is noted in the output and not consulted, because the gate is detection-only
there. Without an honored label, a scoped MISS at `standard`/`regulated` fails per
REQ-L3-4.

The PR's labels MUST reach the gate through the same normalized context as the body
(`ci-context` `loadContext()`). An uncomputable label set (the fetch failed —
`labels: null`, distinct from `[]`) MUST NEVER be read as the label being applied: the
gate MUST proceed as if no override were present, never silently PASS with
`path=skipped`.

An authorized applier is the actor of the latest label-add event for
`skip:memory-gate`, who MUST differ from the PR author and MUST NOT be listed in
`governance.reviewActors` or `governance.agentActors`. When the label events cannot be
read, the applier is unknown and the label MUST NOT be honored; the reason says so.

#### Scenario: Labeled PR passes at standard, applier named

- GIVEN a PR at `standard` carries `skip:memory-gate`, applied by an actor other than
  the PR author and outside `reviewActors`/`agentActors`
- WHEN `memory-gate` runs
- THEN it passes with `path=skipped`, naming the actor who applied the label

#### Scenario: Labeled PR at regulated is refused, tier named

- GIVEN a PR at `regulated` carries `skip:memory-gate` from an otherwise authorized
  applier, and has no scoped record for its issue
- WHEN `memory-gate` runs
- THEN the override is refused with a reason naming the `regulated` tier
- AND the gate fails per REQ-L3-4

#### Scenario: Labeled PR at lite notes the label and stays detection-only

- GIVEN a PR at `lite` carries `skip:memory-gate` and has no scoped record for its issue
- WHEN `memory-gate` runs
- THEN the output notes the label as not consulted at `lite`
- AND the scoped miss is a non-blocking warning per REQ-L3-4

#### Scenario: The PR author cannot wave their own PR through

- GIVEN a PR at `standard` carries `skip:memory-gate` applied by the PR author
- WHEN `memory-gate` runs
- THEN the override is refused with a reason naming the author as the applier
- AND evaluation continues per REQ-L3-4

#### Scenario: Unreadable label events are never an honored skip

- GIVEN a PR at `standard` carries `skip:memory-gate` but its label events cannot be read
- WHEN `memory-gate` runs
- THEN the override is not honored and the reason says the applier is unknown

#### Scenario: Unlabeled PR still fails a scoped miss at standard

- GIVEN a PR does not carry `skip:memory-gate` and has no scoped record for its issue,
  at `standard` tier
- WHEN `memory-gate` runs
- THEN it fails per REQ-L3-4, and the reason names `skip:memory-gate` as available

#### Scenario: Uncomputable labels are never read as a skip

- GIVEN the label fetch fails (`labels: null`, not `[]`)
- WHEN `memory-gate` runs
- THEN it does not pass with `path=skipped`
- AND it falls through to REQ-L3-4's scoped evaluation, never treating the
  uncomputable state as "label applied"

#### Scenario: An agent or review actor cannot apply the override

- GIVEN a PR at `standard` carries `skip:memory-gate` applied by an actor listed in
  `governance.agentActors` or `governance.reviewActors`
- WHEN `memory-gate` evaluates the override
- THEN it refuses the override with a reason naming the rejected applier, and falls
  back to REQ-L3-4's scoped evaluation

### Requirement: REQ-L3-6: `memory-gate` Job Declares PR Context Env

The GitHub `memory-gate` job in `governance.yml` MUST declare `VCS_TOKEN`,
`PR_NUMBER`, and `PR_BODY` in its step `env:`, mirroring the `issue-link` job
(`:61-71`), so `ci-context.mjs`'s `loadContext()` can populate `ctx.body` and
`ctx.labels` for this job instead of leaving both structurally `null`. A drift-guard
test, modelled on `ci-context-drift-guard.test.mjs`'s `#130` case, MUST assert all
three keys are present in the job block and MUST fail against the job definition as it
stood at `02896d69`.

#### Scenario: `memory-gate` job declares the three keys

- GIVEN `governance.yml`'s `memory-gate` job block
- WHEN the drift-guard test inspects it
- THEN `VCS_TOKEN`, `PR_NUMBER`, and `PR_BODY` are each declared

#### Scenario: The drift-guard test fails on the pre-change base

- GIVEN the `memory-gate` job block as it stood at commit `02896d69` (`DEFAULT_BRANCH`
  only)
- WHEN the drift-guard test runs against that block
- THEN it fails, naming the missing key(s)

## Open Questions

- Uncomputable PR body: resolved by design (fail closed at `standard`/`regulated`,
  named `presence` fallback at `lite`); now a REQ-L3-4 scenario.
- `regulated` treating PARTIAL coverage as a MISS: deferred; this change only makes
  the gap visible (REQ-L3-4 scenario). A follow-up decides enforcement.
- Override tier scope: resolved by the maintainer on 2026-09-18 — follow
  `TIER_PARAMS.honorSkipMemoryGate` (REQ-L3-5).
- The automatic re-trigger on a default-branch push and GitLab verification are
  explicitly out of scope for this change (see proposal); tracked as follow-ups, not
  requirements here.
