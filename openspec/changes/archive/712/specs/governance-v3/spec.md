# Delta for governance-v3 (issue #712)

Ratified rulings R1–R13 (maintainer, 2026-09-12) are the source of truth below and are
not reopened here. No published spec covers the secret-scan policy today, so this delta
is entirely ADDED text under `governance-v3`, not a modification of existing
requirements.

## NOT in this change

- #942's deny readers and its direction rule — reused via `loadBrainConfigOrThrow`, not reopened.
- `deriveProject`'s directory-basename fallback on ENOENT — named (R5), not fixed.
- A `config-parses` governance job / new `GATE_MATRIX` row / `governance.yml` edit.
- New i18n keys (R10) — `activeLang()` reads the same unreadable config, so a Spanish string here is dead until #715.
- The tier resolver's ratified degrade to `standard` (`readConfigSafe`, REQ-TIER-10).

## ADDED Requirements

### Requirement: REQ-SCAN-1 — An Unreadable Policy Refuses, Never Defaults

When `brain.config.json` exists at the scanned root but cannot be read or parsed, every
call site consuming `governance.memorySecretPatterns` or `memorySecretAllowPatterns`
MUST refuse instead of scanning under `DEFAULT_SECRET_PATTERNS`. Call sites:
`memory/lane/collect.mjs`, `memory/backends/engram.mjs`,
`memory/backends/plainfiles.mjs`, `governance/lane-scrub.mjs`.

#### Scenario: A policy that cannot be read is not an empty policy

- GIVEN `brain.config.json` is present at the scanned root but is not valid JSON
- WHEN `memory:save` (either backend), `memory:collect`, or `lane-scrub` reads the
  secret-scan config
- THEN that call site refuses instead of scanning under `DEFAULT_SECRET_PATTERNS`

### Requirement: REQ-SCAN-2 — Direction Is a Property of the Key, Not the File

A read carrying both a DENY-direction key (`memorySecretPatterns`) and an
ALLOW-direction key (`memorySecretAllowPatterns`) MUST propagate on failure — one read
cannot be half-propagated; the deny-direction key decides for the read that carries it.

#### Scenario: Direction follows the key, not the file

- GIVEN one read resolves both `governance.memorySecretPatterns` (deny-direction) and
  `governance.memorySecretAllowPatterns` (allow-direction) from one `brain.config.json`
- WHEN that file is present but unreadable
- THEN the read propagates, even though `memorySecretAllowPatterns` alone would be
  allow-direction

### Requirement: REQ-SCAN-3 — An Absent Config Stays Green

When `brain.config.json` does not exist (`ENOENT`), all four call sites MUST behave as
today: `DEFAULT_SECRET_PATTERNS` apply, the allowlist is empty, nothing refuses.

#### Scenario: An absent config is not an unreadable one

- GIVEN no `brain.config.json` exists at the scanned root
- WHEN `memory:save`, `memory:collect`, `memory:ship`, or `lane-scrub` runs
- THEN all four proceed on the default pattern set and none refuses
- AND this is `lane-scrub`'s first assertion of this case — it has zero coverage today

### Requirement: REQ-SCAN-4 — The Write Operations Refuse and Say So

`memory:save` (both backends), `memory:collect`, and `memory:ship` MUST exit non-zero
when their secret-scan config read fails per REQ-SCAN-1, through their existing error
handling, naming the unreadable file.

#### Scenario: The write ops refuse and say so

- GIVEN `brain.config.json` is present but unparseable
- WHEN `memory:save`, `memory:collect`, or `memory:ship` runs
- THEN each exits 1 through its existing catch, naming the file, and no record or lane
  commit is written

### Requirement: REQ-SCAN-5 — lane-scrub Refuses as Uncomputable, After the Early Return

`lane-scrub` MUST treat a secret-scan config read failure as `{pass:false,
uncomputable:true}`, exiting 2. This read MUST occur after the existing
`recordPaths.length === 0` early return.

#### Scenario: The gate refuses as uncomputable

- GIVEN `brain.config.json` is present but unparseable, and the PR adds at least one
  `.memory/records/*.jsonl` path
- WHEN `lane-scrub` runs
- THEN it exits 2, reporting `uncomputable`, distinct from an invalid-pattern verdict
- AND a PR carrying no records is unaffected, since the config is read only after the
  no-record-paths early return

### Requirement: REQ-SCAN-6 — No Report-and-Continue

A secret-scan config read failure MUST NOT produce a warning riding alongside a scan run
under the wrong policy — by the time such a warning is read, the scan already ran and
the record was already written.

#### Scenario: A warning arrives too late

- GIVEN a secret-scan config read fails
- WHEN the call site would otherwise report-and-continue (as `resolveUpstreamRef` does
  for ref selection)
- THEN the operation refuses instead — no record is written under an unverified policy

### Requirement: REQ-SCAN-7 — Read Paths Are Untouched

`memory:search` and every other read path MUST NOT be affected: none consumes
`memorySecretPatterns` or `memorySecretAllowPatterns`.

#### Scenario: Read paths are untouched

- GIVEN `brain.config.json` is present but unparseable
- WHEN `memory:search` runs
- THEN it never reaches `resolveSecretConfig` and does not refuse
