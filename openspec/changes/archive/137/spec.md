# Spec: brain: Verb Namespace (issue-137-brain-namespace)

## Purpose

Delta requirements for the `brain:` namespace change: 8 new `brain:*` verbs, deprecated
aliases, no-subprocess contract, i18n lockstep, and the new `package-json-merge` capability.

---

## package-json-merge Specification (New Capability)

### Requirement: Additive Verb Injection

On `brain:upgrade`, the installer MUST additively inject all managed `brain:*` script keys
into the consumer's `package.json` `scripts` section.

- The managed verb set MUST be defined in one authoritative source; MUST NOT be hardcoded
  in two separate places.
- The installer MUST NEVER overwrite an existing key the consumer already has. Consumer-owned
  values win unconditionally.
- The operation MUST be idempotent: running it twice leaves `package.json` unchanged after
  the first successful run.
- The installer MUST NOT modify any field outside `scripts`.
- Key order and JSON formatting SHOULD be preserved as much as reasonable.

#### Scenario: Fresh consumer — all verbs injected

- GIVEN a consumer `package.json` with no `brain:*` entries in `scripts`
- WHEN `brain:upgrade` runs
- THEN all managed `brain:*` verbs are present in `scripts`
- AND no pre-existing key is removed or overwritten

#### Scenario: Consumer owns brain:env:init — not overwritten

- GIVEN a consumer `package.json` with `"brain:env:init": "my-custom-init"` in `scripts`
- WHEN `brain:upgrade` runs
- THEN `brain:env:init` retains `"my-custom-init"` unchanged
- AND all other absent managed `brain:*` verbs are injected

#### Scenario: Idempotent second run

- GIVEN `brain:upgrade` has already run and all managed verbs are present
- WHEN `brain:upgrade` runs again
- THEN `package.json` content is identical to before the second run

#### Scenario: Non-scripts fields untouched

- GIVEN a consumer `package.json` with fields such as `version`, `dependencies`, `devDependencies`
- WHEN `brain:upgrade` runs
- THEN only `scripts` is modified; all other top-level fields remain unchanged

---

## ADDED Requirements

### Requirement: Verb Namespace Uniformity

All 8 `brain:*` verbs (`brain:env:init`, `brain:day:start`, `brain:ticket:start`,
`brain:project:feature`, `brain:project:status`, `brain:tracker:board`, `brain:repo:check`,
`brain:change:verify`) MUST exist in `package.json` and invoke the same script targets as
their predecessors. The 8 original verbs MUST remain as working deprecated aliases in 0.8.0.

#### Scenario: New verb resolves

- GIVEN brain version 0.8.0 is installed
- WHEN any of the 8 new `brain:*` verbs is invoked via `npm run`
- THEN it executes the same script as the corresponding original verb

#### Scenario: Old verb still works as alias

- GIVEN brain version 0.8.0 is installed
- WHEN any of the 8 original verbs is invoked via `npm run`
- THEN it executes successfully (deprecated but functional; no error exit code)

---

### Requirement: No Managed-Script Verb Dependence

No file under `brain/scripts/**` MUST invoke a `package.json` verb via `npm run <verb>` or
any subprocess. The two known call sites (`brain-check.mjs` and `verify-change.mjs`) MUST
invoke `check-refs.mjs` directly via `node brain/scripts/check-refs.mjs`.

#### Scenario: brain:check runs without repo:check script present

- GIVEN a consumer `package.json` with NO `repo:check` entry
- WHEN `brain:check` is invoked
- THEN `check-refs.mjs` executes successfully and exit code reflects only the check result

#### Scenario: change:verify runs without repo:check script present

- GIVEN a consumer `package.json` with NO `repo:check` entry
- WHEN `change:verify` (or `brain:change:verify`) is invoked
- THEN `check-refs.mjs` executes successfully via direct `node` invocation

---

### Requirement: i18n Lockstep

All user-facing strings in `i18n/en.mjs` and `i18n/es.mjs` referencing old verb names MUST
be updated to new `brain:*` verb names in the same change slice as the verb rename.
Assertions in `i18n/coverage.test.mjs` that assert on those strings MUST be updated in the
same commit/PR, keeping `npm test` green throughout.

#### Scenario: Coverage suite passes after i18n update

- GIVEN i18n catalogs updated to new `brain:*` verb names
- WHEN `npm test` runs (including `coverage.test.mjs`)
- THEN all assertions pass with zero failures

---

### Requirement: Deprecation Contract

Old verbs MUST remain functional in 0.8.0. A deprecation warning on invocation of an old
verb is OPTIONAL in 0.8.0; the mechanism is left to design. Old verbs MUST NOT be removed
before the next MAJOR version increment. The `harness-contract.md` verb table MUST be
updated to list new `brain:*` names as authoritative in the same change.

#### Scenario: Old verb invoked — runs without error

- GIVEN brain 0.8.0
- WHEN any of the 8 original verbs is invoked via `npm run <old-verb>`
- THEN the script runs to completion without a non-zero exit code
- AND a deprecation warning MAY be emitted to stderr
