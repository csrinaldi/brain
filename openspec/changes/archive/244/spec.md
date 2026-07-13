# Spec Delta — GitLab Substrate Ladder Awareness (slice A4)

> Ships GitLab rung-1 as three distinct, honestly-reported sub-gates (`pipelineMustSucceed` load-bearing,
> `protectedBranches` complementary, `preReceive` non-remotely-verifiable), wires the provider-branched
> detection probe, and fixture-tests the bare-repo pre-receive rejection path. Supersedes the "presence-alone"
> default per the owner's Q1-Q3 ruling. See [design.md](design.md).

## REQ-A4-1: GitLab rung-1 is computed as an OR of three per-provider sub-gates in `substrate.mjs` (D1)

`evalRung1` (`substrate.mjs:97-141`) MUST replace the `config?.vcs?.selfHostedPreReceive` short-circuit with
a `rungs[1].gates` table exposing three GitLab sub-gates — `pipelineMustSucceed`, `protectedBranches`,
`preReceive` — each carrying `{available, active, verifiable, mechanism}`. `rungs[1].active` MUST be the OR
of whichever sub-gates are armed. `detectSubstrate` MUST remain a pure orchestrator: sub-gate values arrive
via injected `probes` only (no fs/git/network inside `substrate.mjs`). `selectRung()` (`:207-212`) MUST be
unchanged.

#### Scenario: CP-A2b mirror state — pipelineMustSucceed alone arms rung-1

- GIVEN a GitLab probe reporting `only_allow_merge_if_pipeline_succeeds: true` and NO protected branches
  configured (the `feature/v2.0.0` mirror state proven in CP-A2b)
- WHEN `detectSubstrate` evaluates rung 1
- THEN `gates.pipelineMustSucceed.active` is `true`, `gates.protectedBranches.active` is `false`, and
  `rungs[1].active` is `true` via `pipelineMustSucceed` alone — presence-alone would have wrongly reported
  rung-1 absent in this exact repo

#### Scenario: neither GitLab sub-gate armed → rung-1 inactive

- GIVEN a GitLab probe reporting `only_allow_merge_if_pipeline_succeeds: false` and no protected branches
- WHEN `detectSubstrate` evaluates rung 1
- THEN `rungs[1].active` is `false` with a remedy pointing at arming either mechanism

#### Scenario: the `selfHostedPreReceive` short-circuit is gone

- GIVEN `config.vcs.selfHostedPreReceive: true` and no API-verifiable gate armed
- WHEN `evalRung1` runs
- THEN it does NOT unconditionally return `active:true`; the `preReceive` sub-gate reports `active:true` with
  `verifiable:false`, and `rungs[1].active` is `true` via that sub-gate specifically — not a bypassed
  short-circuit

## REQ-A4-2: Pre-receive is never rendered as verified — data and presentation change together (D1+D2, constraint 3)

The `preReceive` sub-gate MUST always carry `verifiable:false` and `mechanism:'pre-receive-config-declared'`
when armed by `config.vcs.selfHostedPreReceive`. `brain-governance-status.mjs`'s print layer MUST render
"not remotely detectable; verify via install runbook" for this sub-gate whenever armed, and MUST NEVER print
pre-receive as "verified" or bare "available". The SIGNAL (`substrate.mjs`) and the CAVEAT TEXT
(`brain-governance-status.mjs`) MUST change together — a fix that touches only one file is incomplete.

#### Scenario: declared-not-verified renders the caveat, never "verified"

- GIVEN `config.vcs.selfHostedPreReceive: true` and no API-verifiable rung-1 gate armed
- WHEN `brain:governance-status` renders the report
- THEN the pre-receive line reads "not remotely detectable; verify via install runbook", and no output line
  contains "pre-receive" alongside "verified"

#### Scenario: an API-verified gate does not borrow the pre-receive caveat

- GIVEN `protectedBranches.active: true` and `preReceive` inactive
- WHEN the report renders rung 1
- THEN the `protectedBranches` line is reported as API-verified, with no non-detectability caveat attached

## REQ-A4-3: `governance-status` gains a provider-dispatched GitLab branch-protection + pipeline-required probe (D2)

`realBranchProtectionProbe` (`brain-governance-status.mjs:45-63`) MUST dispatch on `config?.vcs?.provider`,
mirroring `realBrainWritesReviewedProbe` (`:78-111`). The GitLab branch MUST feed
`gates.protectedBranches` from the existing `glab api projects/:id/protected_branches` read, and
`gates.pipelineMustSucceed` from a NEW `GET /projects/:id` read added to `gitlab.mjs` reading
`only_allow_merge_if_pipeline_succeeds` off the project object. `gitlab.mjs` MUST NOT read `CI_API_V4_URL` or
any pipeline env directly (GATE_FILE discipline, enforced by `ci-context-drift-guard.test.mjs`). The new read
uses the `glab` CLI session (`run('glab', ['api', ...])`), consistent with the sibling LOCAL-DEV probes
`capabilities()`/`branchProtect()` — NOT `{apiBase, token, proxyUrl}` parameters like `issueView`/`prView`/
`labelEvents`/`prReviews`. Those four are CI-portable because CI gates (e.g. the REQUIRED issue-link check)
actually invoke them in a `glab`-less environment; `brain:governance-status` is a local-dev-only tool that
always runs where the `glab` session is available, so it correctly follows the CLI-session pattern instead.

#### Scenario: GitLab dispatch reuses the sanctioned config path

- GIVEN `config.vcs.provider: 'gitlab'` and an authenticated local `glab` CLI session
- WHEN `realBranchProtectionProbe` runs
- THEN it calls the new project-settings read and the protected-branches read via the `glab` CLI session
  (`run('glab', ['api', ...])`) — no direct `process.env` access inside `gitlab.mjs`

#### Scenario: an unreachable endpoint degrades honestly, never crashes

- GIVEN `GET /projects/:id` fails or is unreachable
- WHEN the probe runs
- THEN `pipelineMustSucceed` reports `available:false` with a remedy, and the report completes without
  throwing

## REQ-A4-4: CP-A4a bare-repo push rejection is fixture-tested (D3)

`hooks/pre-receive.test.mjs` MUST gain a rejection scenario reusing `setupFixture`/`commitAndPush` unchanged:
a non-compliant push (bad commit message or missing ticket ref) to a bare repo with `hooks/pre-receive`
installed MUST be rejected (non-zero exit, ref not updated); a compliant push MUST pass. The test MUST
require no GitLab and no network, and remain `GIT_AVAILABLE`-gated like the existing cases.

#### Scenario: non-compliant push rejected

- GIVEN a bare-repo fixture with `pre-receive` installed
- WHEN `commitAndPush` pushes a commit whose message fails the format/ticket-ref check
- THEN the push is rejected (non-zero exit) and the bare repo's ref is NOT updated

#### Scenario: compliant push accepted

- GIVEN the same fixture
- WHEN `commitAndPush` pushes a commit with a valid Conventional Commit + ticket ref
- THEN the push succeeds and the bare repo's ref reflects the new commit

## REQ-A4-5: New fixtures are offline, derived, and provenance-stamped (D3)

Fixtures for the new `GET /projects/:id` read and its protected-branch companion in
`brain-governance-status.test.mjs` MUST be marked `derived` with `_provenance` (endpoint + note that the
shape is live-verifiable by curl against the mirror per the CP-A3a precedent) — MUST NOT be stamped
`recorded`, since no live-recording pass exists yet for this endpoint. `npm test` MUST perform no live
network or `glab` process call for these cases.

#### Scenario: derived fixtures carry provenance, not a false recorded stamp

- GIVEN the new `GET /projects/:id` fixture used by the governance-status suite
- WHEN it is inspected
- THEN it is marked `derived` with `_provenance` identifying the endpoint, and is NOT marked `recorded`

#### Scenario: `npm test` touches no live GitLab endpoint

- GIVEN `npm test`
- WHEN the new GitLab rung-1 fixture cases run
- THEN no real HTTP call or `glab` CLI process is spawned — all reads go through injected fixture probes

## Non-goals

- `diff-size` inside the pre-receive hook — whole-MR delta-vs-base concept, no "MR base" at push-batch level
  (constraint 2).
- A GitLab-CI job registry (`REQUIRED_JOBS` equivalent) — A4 is detection honesty, not job orchestration.
- Real server-side hook install on self-hosted GitLab (`custom_hooks/`, Gitaly host-fs admin) — SCIT bundle.
- CP-A3b / CP-A2b live smoke — unchanged by A4, endpoint-dependent, deferred to SCIT.

## Acceptance split

- **CP-A4a (this slice, fixture-phase):** REQ-A4-1 through REQ-A4-5 fully offline. Bare-repo rejection
  fixture-tested (`sh`+`git`, no GitLab); GitLab protected-branch + pipeline-required detection and the
  honest pre-receive caveat unit-tested via injected probes; `npm test`, `brain:audit`, `brain:repo:check`,
  `brain:nav` green. Hard stop, PR-as-review.
- **Track A closing (deferred to SCIT):** real-MR block on a self-hosted GitLab server with the pre-receive
  hook installed via `custom_hooks/` — out of scope for this spec.
