# Delta for governance-v3 (issue #942)

Ratified rulings R1–R12 (maintainer, 2026-09-12, issue #942 comment; engram
`sdd/issue-942-deny-fail-closed/ruling`) are the source of truth below and are not
reopened here.

## Note — accepted operational cost

An unparseable `brain.config.json` now turns every PR in a consumer repo red at once
(`actor-check` and `brain-writes-reviewed` both fail at `required` tiers). The maintainer
ratified this cost explicitly (R1, R12): it is the intended direction, not a defect.

## Out of scope (non-goals, carried from the proposal)

- The secret-scan loaders (`plainfiles.mjs`, `engram.mjs`, `lane/collect.mjs`, `lane-scrub.mjs`) — #712.
- A `config-parses` governance job / new `GATE_MATRIX` row / `governance.yml` job — R9, follow-up ticket.
- A localized (Spanish) refusal string — R10, blocked on #715 (`activeLang()` reads the same config the refusal describes).
- `loadBrainConfig()`'s own error shape — R8; it keeps throwing on absence AND malformation, unchanged.
- The tier resolver's ratified degrade to `standard` (`readConfigSafe`, REQ-TIER-10) — unchanged, not this issue.

## MODIFIED Requirements

### Requirement REQ-L5-1: `status:approved` Actor Must Differ From the Author

A new job MUST call `gh api repos/{repo}/issues/{n}/events` (the same permission
already granted — `permissions: issues: read`, `governance.yml:19`) for the issue
referenced by the PR (resolved the same way `issue-link` resolves it), find the actor
who applied the `status:approved` label, and compare that actor's login against the
PR author and the issue author. The job MUST fail when the `status:approved` actor
equals the PR author or the issue author. The deny-direction readers this job consumes
(`denyActors` via `approvalDenySet`) MUST propagate a `brain.config.json` read or parse
failure rather than returning an empty set; the failure routes through the existing
tiered fail-closed catch (`resolveTierForFailure` + `resolveGatePolicy`).
(Previously: the deny readers silently returned `[]` on any read/parse error, which
denied nobody.)

#### Scenario: Self-applied approval fails the gate

- GIVEN the issue referenced by the PR was labeled `status:approved` by the same actor who authored the PR
- WHEN the L5 job runs
- THEN it exits non-zero citing self-approval

#### Scenario: Human-applied approval passes the gate

- GIVEN the issue referenced by the PR was labeled `status:approved` by an actor different from the PR author and the issue author
- WHEN the L5 job runs
- THEN it exits zero

#### Scenario: A deny reader refuses rather than denying nobody

- GIVEN `brain.config.json` is present but unparseable (malformed JSON, a permission error, a directory in its place)
- WHEN `actor-check` reads `denyActors`
- THEN it fails closed at `required` tiers, naming the unreadable file and the parse error
- AND the verdict is NOT computed from an empty deny set

---

### Requirement REQ-L6-2: Evidence-Based Human Review on Brain-Writes (Primary L6 Mechanism)

A PR whose changed files include at least one path under `brain/core/**` or
`brain/project/**` MUST have at least one `APPROVED` review from a human reviewer who
is neither the PR author nor a bot-allow-listed identity, before that PR's brain-writes
are considered reviewed. Missing REVIEW EVIDENCE (no reviews, API unavailable) MUST
degrade to a warning, never a false failure. A `brain.config.json` read or parse
failure feeding the exclusion readers (`reviewActors`, `approvalActors`) is a distinct,
uncomputable case — NOT missing evidence — and MUST fail closed per tier via the same
`resolveTierForFailure` + `resolveGatePolicy` shape `actor-check.mjs` already uses. The
docstring claiming this job is "detection-only (DETECTION_JOBS)" is corrected: the gate
is `required` at every tier.
(Previously: the catch was an unconditional `warn` for both missing review evidence
and config-read failure, and the docstring falsely stated the gate was detection-only.)

#### Scenario: Non-brain PR is exempt

- GIVEN a PR's changed files contain no path under `brain/core/**` or `brain/project/**`
- WHEN the `brain-writes-reviewed` check runs
- THEN it reports `pass`

#### Scenario: Self-approval only fails the check

- GIVEN a PR touches `brain/core/**` and the only `APPROVED` reviewer is the PR author
- WHEN the check runs
- THEN it reports `fail`

#### Scenario: Bot-only approval fails the check

- GIVEN the only `APPROVED` reviewer is a bot-allow-listed identity
- WHEN the check runs
- THEN it reports `fail`

#### Scenario: Human review present passes the check

- GIVEN at least one `APPROVED` reviewer is neither the PR author nor bot-allow-listed
- WHEN the check runs
- THEN it reports `pass`

#### Scenario: Admin override passes, logged

- GIVEN an allow-listed `override:*` label is present
- WHEN the check runs
- THEN it reports `pass`, logged

#### Scenario: A warning is not a refusal

- GIVEN a PR touches `brain/core/**` and `brain.config.json` is present but unparseable
- WHEN `brain-writes-reviewed` runs
- THEN it returns `fail` at `required` tiers, not `warn`, naming the file and the parse error
- AND this is distinct from the "missing review evidence" case, which still returns `warn`

## ADDED Requirements

### Requirement REQ-DENY-1: Shared Primitive Distinguishes Absence From Unreadability

`brain/scripts/lib/brain-config.mjs` MUST export `loadBrainConfigOrThrow(root)`: it
MUST return `{}` when `brain.config.json` is absent (`ENOENT`), and MUST throw a named
error identifying the file and the underlying read or parse failure for any other
failure. This is the one shared primitive; it is NOT a shared deny/allow list and NOT a
shared policy function — each caller still handles the throw per its own direction.

#### Scenario: The primitive distinguishes the two failures

- GIVEN `brain.config.json` does not exist at `root`
- WHEN `loadBrainConfigOrThrow(root)` is called
- THEN it returns `{}` and does not throw
- GIVEN `brain.config.json` exists but is not valid JSON
- WHEN `loadBrainConfigOrThrow(root)` is called
- THEN it throws a named error identifying the file

#### Scenario: An absent config is not an unreadable one

- GIVEN a fresh consumer install with no `brain.config.json` at all
- WHEN any hardened deny reader (`actor-check`, `brain-writes-reviewed`, `brain:approve`) runs
- THEN it behaves exactly as it does today — returns `[]`, no gate refuses

### Requirement REQ-DENY-2: Write-Side Deny Readers Refuse, Not Crash

`brain:approve`'s deny readers (`defaultReadDenyActors`, `defaultReadAgentActors`) MUST
propagate a `brain.config.json` read/parse failure into `runApprove`'s existing
`say('✗ …'); return done(1)` refusal shape. A refusal MUST NEVER surface as a raw
stack trace in an interactive session.

#### Scenario: The write side refuses too

- GIVEN `brain.config.json` is present but unparseable
- WHEN a user runs `brain:approve`
- THEN the command exits 1 with a `✗ …` message naming the unreadable config
- AND no stack trace reaches the terminal

### Requirement REQ-DENY-3: Read Side and Write Side Agree Under Every Config State

For one actor identity, `actor-check`'s deny verdict and `brain:approve`'s deny verdict
MUST agree under every `brain.config.json` state: readable-and-listed, readable-and-not-
listed, absent, and unreadable.

#### Scenario: The read side and the write side agree

- GIVEN one actor identity and one `brain.config.json` state (readable, absent, or unreadable)
- WHEN both `actor-check` and `brain:approve` evaluate that identity
- THEN both reach the same deny/allow answer for that state

### Requirement REQ-DENY-4: Direction Asymmetry Holds, and the Judge Cannot Be Disarmed

Allow/exemption-direction readers (`actor-check.mjs`'s `approvalActors` reader,
`governance.ignoreList` consumers, `approved-label.mjs`) are UNCHANGED by this issue and
MAY keep degrading to empty on a config-read failure, because empty is the restrictive
answer in that direction. Because every hardened reader resolves `cwd` to the PR's own
checked-out tree, a change that leaves its own `brain.config.json` unparseable MUST make
the gates it feeds refuse, not silently pass.

#### Scenario: An allow list may still degrade

- GIVEN `brain.config.json` is unparseable
- WHEN `actor-check`'s `approvalActors` reader, an `ignoreList` consumer, or `approved-label.mjs` runs
- THEN each returns its empty/default fallback, unchanged from today

#### Scenario: The gate that judges a change cannot be disarmed by it

- GIVEN a PR's own diff leaves `brain.config.json` unparseable
- WHEN `actor-check` or `brain-writes-reviewed` runs against that PR's checked-out tree
- THEN the gate refuses (fails closed), it does not pass
