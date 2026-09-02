# SDD Engine Adapter Specification

## Purpose

Make `SDD_ENGINE` the third measured port. An engine — a FRAMEWORK of skills,
doctrine and hooks (D6) — becomes legible to brain through a declaration brain
owns; the config verb Compuerta 4 ruled exists and is the only writer of
`brain.config.json`; the role-instructions debt the review pipeline has carried
since #682 is discharged (D5). Built strictly from the proposal's D1–D6.

## Requirements

### Requirement: `brain:config` is the ONE config verb, and migration belongs to it

`brain:config get <path>` prints the resolved value; `brain:config set <path>
<value>` validates against the schema, runs pending migrations FIRST
(config-migrations.mjs's additive pattern, versions per #806's ruling), then
writes. An unknown path is refused, closed — never written as an opaque key.

#### Scenario: Unknown key fails closed
- **WHEN** `brain:config set sdd.mpa.tasks x` (typo) runs
- **THEN** exit 1, nothing written, the refusal names the nearest known path family

#### Scenario: Migration runs in the verb, not the caller
- **WHEN** `set` runs against a config whose schemaVersion trails the migration list
- **THEN** pending migrations apply before the write, in one atomic result

#### Scenario: The verb is the only writer
- **WHEN** the discovery verb records what it found
- **THEN** the write goes through the same module `brain:config set` uses — one
  validator, never a second

### Requirement: `gentle-ai` declares roles as recorded, brain-owned data

`gentle-ai.declareRoles(stages)` answers EVERY resolved stage — lifecycle and
custom — in brain's vocabulary. The declaration carries `_provenance
{ recorded: true, endpoint, date }` (D2) and is never read from installed
files. `chooses_model: false` on every stage (D4); tiers map
sonnet → `balanced`, opus → `deep`, haiku → `cheap`.

#### Scenario: A custom stage is answered, not skipped
- **WHEN** the resolved set includes `cold-review`
- **THEN** gentle-ai's declaration answers it under the same assertions as `tasks`

#### Scenario: CI without the tool installed
- **WHEN** the contract suite runs on a machine with no `~/.claude/skills/`
- **THEN** every gentle-ai assertion passes — the declaration is in-repo data

### Requirement: `instructions` is a checked field, never an unread one

The contract gains `instructions`: a non-empty string, or `null` as a CHECKED
value mirroring `model_tier: null` ("a human executes; there is no prompt").
`plain` declares null on every stage; `gentle-ai` declares recorded content.
A missing field is refused exactly as a missing `chooses_model` is.

#### Scenario: Absence is refused, null is accepted
- **WHEN** an inhabitant declares a role with no `instructions` key
- **THEN** `resolveRoles` throws naming the stage and the field
- **WHEN** it declares `instructions: null`
- **THEN** the role resolves, and the null is reported as the no-prompt state

### Requirement: The cold reviewer's role is served from the port (D5)

`brain/scripts/roles/` owns the Adversary instance for `cold-review` — brain's
first first-party role, #576's archetype set grows around it later.
`cold-review-prompt.mjs` is DELETED. The review pipeline keeps a thin
assembler: the port serves the role text (identity, what it may use, what it
must not do); the assembler interpolates the machine-checkable protocol block
from the reader's own constants (`ARTIFACT_TAG`, `CARRIED_FIELDS`,
`ALLOWED_SEVERITIES`, `FORCED_EVIDENCE_CLASS`, refused fields, artifact path)
and the per-run parameters. No protocol literal moves into the role text.

#### Scenario: The worked contract still parses
- **WHEN** the assembled prompt's worked example is fed to `readFindingsArtifact`
- **THEN** it parses — the derived-from-the-reader property survives the split

#### Scenario: Neutrality is intact (ADR-0019 Am.1 c.2)
- **WHEN** the port serves the Adversary role
- **THEN** nothing in the served surface selects WHO verifies — content, never routing

### Requirement: Discovery reports, and records only through the verb

`brain:engines` (final name) interrogates each `SDD_ENGINES` member through
`loadInhabitant` + `resolveRoles`, reports per stage: role, tier,
`chooses_model`, instructions presence. Recording writes `sdd.engines.<name>`
through the `brain:config` module (D1). Re-running shows drift against the
recorded entry.

#### Scenario: An engine with no declareRoles is reported, not crashed
- **WHEN** a listed engine exports no `declareRoles`
- **THEN** the report states the refusal for that engine and continues with the rest

### Requirement: Parity n=2 is measured, and the tripwire dies by failing

`INHABITANTS` gains `gentle-ai`. The TRIPWIRE test fails, and is deleted per
its own instruction together with the parity-debt statements it names.

#### Scenario: The suite measures both, identically
- **WHEN** the contract suite runs
- **THEN** every assertion runs over both inhabitants from one test body

#### Scenario: Close semantics
- **WHEN** the tripwire is deleted
- **THEN** it is because it FAILED on a real second entry — n=2 measured, never declared
