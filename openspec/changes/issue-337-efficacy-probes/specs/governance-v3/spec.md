# Delta for governance-v3

Issue #337 — M10 Phase 3. Rung 2 must report structural efficacy, not file presence.

## MODIFIED Requirements

### Requirement REQ-L2-1: `brain:audit` Fails Closed at the Release/Tag Path (Rung 2)

The project's release/publish/tag script MUST invoke `brain-audit.mjs` (or an
equivalent invocation over the range being released) and MUST fail closed — abort the
release — when `brain-audit.mjs` exits non-zero. This MUST hold regardless of whether
branch protection (rung 1) is available, since rung 2 requires only that the project
controls its own release path.

The rung 2 **verdict** reported by `evalRung2` (`brain/scripts/vcs/substrate.mjs`) and
`realReleaseGateProbe` (`brain/scripts/brain-governance-status.mjs`) MUST derive from a
structural efficacy check of the wired release path — whether the workflow can
plausibly block a release/tag before it exists — never from mere presence of a
release/publish workflow file. A workflow that triggers post-tag (e.g. `on: push:
tags`) or lacks write-level permissions to prevent the tag (e.g. `permissions:
contents: read`) MUST yield `active: false` with a remedy. The verdict MUST also carry
a `verifiable` flag (mirroring rung 1's `evalPreReceiveGate` precedent, `substrate.mjs:210-227`)
so wiring that is declared but structurally unproven is never rendered as enforced.

(Previously: described only the release script's own fail-closed obligation; the
verdict-reporting probe had no efficacy check and treated file presence as sufficient.)

#### Scenario: Release aborts on audit failure

- GIVEN the range being released contains a merge commit that fails a `brain-audit.mjs` check
- WHEN the release/tag script runs
- THEN `brain-audit.mjs` exits non-zero and the release script aborts before publishing or tagging

#### Scenario: Rung 2 holds on a substrate with no branch protection

- GIVEN branch protection on `main` is unavailable
- WHEN a release is attempted with a violation in the audited range
- THEN the release still fails closed via the release-path `brain:audit` gate

#### Scenario: Enforcing workflow reports active and verifiable

- GIVEN `release.yml` triggers pre-tag and holds write permissions sufficient to block the tag
- WHEN `evalRung2` runs
- THEN it reports `active: true`, `verifiable: true`

#### Scenario: Post-tag anti-pattern reports inert

- GIVEN `release.yml` exists, triggers on `push: tags`, and holds only `contents: read`
- WHEN `evalRung2` runs
- THEN it reports `active: false` with remedy "workflow cannot block tags (fires post-tag)"

#### Scenario: No wired workflow reports inert

- GIVEN no release/publish workflow file exists
- WHEN `evalRung2` runs
- THEN it reports `active: false` with remedy "no workflow wired"

#### Scenario: Gated-but-unproven workflow reports unverifiable (deferred to Phase 4 #210)

- GIVEN a workflow exists and the audit-gating job is present but conditionally skipped (or lacks a `needs:` DAG link to the tag-creation step) so enforcement cannot be confirmed structurally
- WHEN `evalRung2` runs
- THEN it reports `verifiable: false` with remedy "workflow rebuild needed (Phase 4 #210)"
- **NOTE (Phase 3 #337)**: This scenario is documented but deferred to Phase 4. Phase 3 detects presence of the audit job and write permissions; full DAG validation (`needs:` link confirmation) is out of scope and will be implemented in #210's workflow rebuild.

## MODIFIED Requirements

### Requirement REQ-HONESTY-1: `brain:governance-status` Reports Active Rung and Remedy

`brain-governance-status.mjs` MUST be extended to report, in addition to the existing
per-layer state, the active substrate rung (1-4, per the ladder table) for the
consumer repo and the remedy to reach the next rung up. The reported rung MUST be
derived from actual capability probes (as `capabilities()` already does for branch
protection), never hardcoded.

Every rung verdict, not only the top-level summary, MUST carry reasoning explaining
why the rung is or is not active, plus remedy guidance. Confident over-reporting (a
false-positive claim of enforcement) is a worse failure than honest under-reporting;
when structural evidence is ambiguous or unverifiable, the probe MUST report the
lower/unverified state, never the higher one.

(Previously: required the active rung + remedy at summary level only; behavior under
ambiguous evidence was unspecified.)

#### Scenario: Rung 2 repo reports rung 2 with a remedy to reach rung 1

- GIVEN a repo has no branch protection but has a release/tag script wired to `brain:audit` fail-closed
- WHEN `brain:governance-status` runs
- THEN it reports the active rung as 2 with reasoning and a remedy to reach rung 1

#### Scenario: Ambiguous efficacy never over-reports

- GIVEN a release workflow's ability to block a tag cannot be structurally confirmed
- WHEN `brain:governance-status` runs
- THEN it reports the lower/unverified state, never claims enforcement it cannot prove
