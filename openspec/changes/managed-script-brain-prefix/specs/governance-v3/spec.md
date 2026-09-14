# Delta for governance-v3 (issue #961)

Ratified rulings R1-R10 (maintainer, 2026-09-14, issue #961 comment) are the source of
truth and are not reopened here. Delivery: Tier-1 PR — these command literal renames
land in the same PR as the `package.json` rename.

## MODIFIED Requirements

### Requirement: REQ-SCAN-1 — An Unreadable Policy Refuses, Never Defaults

When `brain.config.json` exists at the scanned root but cannot be read or parsed, every
call site consuming `governance.memorySecretPatterns` or `memorySecretAllowPatterns`
MUST refuse instead of scanning under `DEFAULT_SECRET_PATTERNS`. Call sites:
`memory/lane/collect.mjs`, `memory/backends/engram.mjs`,
`memory/backends/plainfiles.mjs`, `governance/lane-scrub.mjs`.

(Previously: scenario cited the bare `memory:save` and `memory:collect` names.)

#### Scenario: A policy that cannot be read is not an empty policy

- GIVEN `brain.config.json` is present at the scanned root but is not valid JSON
- WHEN `brain:memory:save` (either backend), `brain:memory:collect`, or `lane-scrub`
  reads the secret-scan config
- THEN that call site refuses instead of scanning under `DEFAULT_SECRET_PATTERNS`

### Requirement: REQ-SCAN-3 — An Absent Config Stays Green

When `brain.config.json` does not exist (`ENOENT`), all four call sites MUST behave as
today: `DEFAULT_SECRET_PATTERNS` apply, the allowlist is empty, nothing refuses.

(Previously: scenario cited the bare `memory:save`, `memory:collect`, `memory:ship` names.)

#### Scenario: An absent config is not an unreadable one

- GIVEN no `brain.config.json` exists at the scanned root
- WHEN `brain:memory:save`, `brain:memory:collect`, `brain:memory:ship`, or `lane-scrub`
  runs
- THEN all four proceed on the default pattern set and none refuses
- AND this is `lane-scrub`'s first assertion of this case — it has zero coverage today

### Requirement: REQ-SCAN-4 — The Write Operations Refuse and Say So

`brain:memory:save` (both backends), `brain:memory:collect`, and `brain:memory:ship`
MUST exit non-zero when their secret-scan config read fails per REQ-SCAN-1, through
their existing error handling, naming the unreadable file.

(Previously: requirement text and scenario cited the bare `memory:save`, `memory:collect`,
`memory:ship` names.)

#### Scenario: The write ops refuse and say so

- GIVEN `brain.config.json` is present but unparseable
- WHEN `brain:memory:save`, `brain:memory:collect`, or `brain:memory:ship` runs
- THEN each exits 1 through its existing catch, naming the file, and no record or lane
  commit is written
