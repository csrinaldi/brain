# Delta for governance-v3

New family `REQ-SHIP-*`: governs which process may reach `cli.mjs ship`'s VCS calls —
distinct from `REQ-SCAN-*` (secret-scan config read failures). No existing requirement's
text conflicts, so all entries below are ADDED.

## ADDED Requirements

### Requirement: REQ-SHIP-1: Ship-Op Invoker Refusal

`cli.mjs ship` MUST refuse, before any credential read or VCS call, unless `--invoker`
is one of `hook`, `sweep`, or `manual`. The refusal MUST exit non-zero and name the
accepted values and `npm run brain:memory:ship`. This refusal MUST be bypassed only by
`BRAIN_VCS_TEST_MODULE` or `--dry-run`.

#### Scenario: Missing or unknown invoker refuses before any VCS work

- GIVEN `cli.mjs ship` runs with no `--invoker` (or an unrecognized value), no `BRAIN_VCS_TEST_MODULE`, and no `--dry-run`
- WHEN the op executes
- THEN it exits non-zero, naming `hook`/`sweep`/`manual` and `npm run brain:memory:ship`
- AND no credential is read and no VCS call is attempted

#### Scenario: Each declared invoker value proceeds

- GIVEN `cli.mjs ship` runs with `--invoker hook`, `--invoker sweep`, or `--invoker manual` and a fake VCS port
- WHEN the op executes
- THEN none of the three is refused for its invoker value

#### Scenario: Either bypass excuses a missing invoker

- GIVEN `cli.mjs ship` runs with no `--invoker`, and either `--dry-run` or `BRAIN_VCS_TEST_MODULE` is set
- WHEN the op executes
- THEN it is not refused for a missing invoker

### Requirement: REQ-SHIP-2: Test-Context Refusal

`cli.mjs ship` MUST refuse when `NODE_TEST_CONTEXT` is set, independent of REQ-SHIP-1,
even with a valid `--invoker`. This refusal MUST be bypassed only by the same two
bypasses as REQ-SHIP-1.

#### Scenario: A valid invoker under a test context is refused, unless bypassed

- GIVEN `NODE_TEST_CONTEXT` is set and `cli.mjs ship` runs with `--invoker manual`
- WHEN neither bypass is present, it exits non-zero before any VCS call
- AND WHEN `BRAIN_VCS_TEST_MODULE` is set instead, it is not refused for the test context

### Requirement: REQ-SHIP-3: Callers Declare Their Invoker

`session-end-ship.mjs` MUST spawn `cli.mjs ship` with `--invoker hook`;
`day-start-sweep.mjs` MUST spawn it with `--invoker sweep`; the `brain:memory:ship` npm
script MUST pass `--invoker manual`. The SessionEnd hook command and the child's
inherited `process.env` are unchanged.

#### Scenario: SessionEnd hook path reaches the fake VCS port

- GIVEN `memory.lane.enabled` is `true` and a fake VCS port is configured
- WHEN `npm run brain:memory:session-end` runs end to end
- THEN `session-end-ship.mjs` spawns `cli.mjs ship --invoker hook` and the fake port receives the call

#### Scenario: Day-start sweep path reaches the fake VCS port

- GIVEN `memory.lane.enabled` is `true` and a fake VCS port is configured
- WHEN the day-start sweep runs end to end
- THEN it spawns `cli.mjs ship --invoker sweep` and the fake port receives the call

#### Scenario: Manual ship keeps today's behavior

- GIVEN a fake VCS port is configured
- WHEN `npm run brain:memory:ship -- --dry-run` runs
- THEN `cli.mjs ship` receives `--invoker manual` and `--dry-run`, unchanged from today

### Requirement: REQ-SHIP-4: Spawn-Hygiene Meta-Test Enforces a Closed Allowlist

A meta-test sibling to `test-hygiene.test.mjs` MUST scan tests that spawn
`brain/scripts/**` entrypoints through `process.execPath`. A spawn MUST fail the scan
unless it is allowlisted with a reason from the closed set `no-vcs-capability`,
`fixture-root-local-git`, `vcs-port-substituted`, `refusal-asserted`, or carries a
recognized test seam. An allowlist reason outside that set MUST fail. The meta-test MUST prove its own
detection through self-proving fixtures.

#### Scenario: An unallowlisted, seamless spawn fails the scan

- GIVEN a fixture test spawns a `brain/scripts/**` entrypoint via `process.execPath`, unlisted, with no recognized seam
- WHEN the meta-test runs
- THEN it fails, forcing a reviewer decision

#### Scenario: A closed-set reason passes; an out-of-set reason fails

- GIVEN two fixture spawns, one allowlisted with a closed-set reason and one with a reason outside the set
- WHEN the meta-test runs
- THEN the first passes and the second fails

### Requirement: REQ-SHIP-5: Anti-Pattern Draft Exists for Maintainer Promotion

This change MUST add a draft anti-pattern file under its own `brain-drafts/` directory,
shaped like `brain/core/anti-patterns/*.md` (Problem / Why / Rule / Detection), and a
separate promotion note carrying the one-line entry for the `## Registered` list in
`brain/core/anti-patterns/README.md`. The draft itself MUST carry no draft-only
scaffolding, so it can be copied verbatim. The agent MUST NOT place the draft under
`brain/core/**` directly.

#### Scenario: Draft exists in the change's drafts folder, not under the governed path

- GIVEN this change's `brain-drafts/` directory and its diff
- WHEN both are inspected
- THEN `brain-drafts/` contains a draft with Problem/Why/Rule/Detection sections and no `Status` or `Registered` section, a promotion note naming the README `## Registered` entry, and no new file was added under `brain/core/anti-patterns/`
