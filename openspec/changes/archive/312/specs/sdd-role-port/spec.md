# SDD Role Port Specification

## Purpose

Defines the role port: a contract stating, for every stage in the resolved
SDD stage set, which inhabitant (SDD engine) executes it, with what agent
role and abstract model tier. This spec covers only the contract, the
`plain` inhabitant, `sdd.configs`, and a parity suite that measures one
inhabitant honestly. It does not cover `gentle-ai` as a second inhabitant
(#814), the engine adapter, or `sdd.map`'s ownership (#815).

## Requirements

### Requirement: The contract key is the resolved stage set

The role port MUST accept its key space from `resolveStageSet(config).stages`
— the four lifecycle stages plus any custom stage a consumer declares — and
MUST NOT hold its own fixed list of keys.

#### Scenario: A custom stage is covered like a lifecycle stage

- GIVEN a config declaring `sdd.stages` with the four lifecycle stages plus a custom `cold-review` stage
- WHEN the role port is asked for the key space
- THEN it resolves five stages, and `cold-review` is answered by the same assertions as `proposal`

#### Scenario: No fixed enumeration exists

- GIVEN the role port module
- WHEN inspected for a literal list of stage names
- THEN none exists — the key space is always resolved from config, never hardcoded

### Requirement: Three states, never collapsed

An inhabitant's answer for a resolved stage MUST be exactly one of: declared
enabled, declared disabled (a checked value), or seam absent (refused, never
read as disabled).

| State | Meaning | Coordinator action |
|---|---|---|
| declared, enabled | this engine executes this stage | calls it |
| declared, disabled | explicit, checked off | does not call it |
| seam absent | inhabitant answers nothing | refused by a registry-style test |

#### Scenario: Disabled stage is not called

- GIVEN an inhabitant declares a stage as disabled in `sdd.configs`
- WHEN the coordinator resolves whether to call that stage
- THEN it does not call it, and can state the disabled reason

#### Scenario: Seam absence is refused, not read as disabled

- GIVEN an inhabitant that omits its declaration for a resolved stage entirely
- WHEN the contract test runs
- THEN it fails with a refusal naming the missing declaration — it MUST NOT report the stage as disabled

### Requirement: `model_tier` is abstract, and `plain` declares a checked null

`model_tier` MUST be one of `cheap`, `balanced`, `deep`. A concrete model id
in this field MUST be refused. `plain` MUST declare `model_tier: null` for
every stage, a checked value meaning "a human executes", never a fourth tier.

#### Scenario: Concrete model id is refused

- GIVEN a role declaration with `model_tier: "sonnet"`
- WHEN the contract validates it
- THEN it is refused for using a concrete id instead of the abstract vocabulary

#### Scenario: `plain` declares checked null, not a missing field

- GIVEN the `plain` inhabitant's role for any resolved stage
- WHEN its `model_tier` is read
- THEN it is `null`, distinct from an absent field, and is not treated as a new vocabulary member

### Requirement: Model selection dispatches on a declared capability, three paths

An inhabitant MUST declare whether it chooses its own model. Given that
declaration, exactly one of three paths applies: the engine chooses; brain
fixes the id from `sdd.map`; or no model is chosen because no agent runs the
stage.

#### Scenario: Engine chooses its own model

- GIVEN an inhabitant declaring it can choose its own model for a stage
- WHEN model selection resolves for that stage
- THEN the engine's own choice is used, and brain does not fix an id

#### Scenario: `plain` takes the third path, not the second

- GIVEN the `plain` inhabitant and a resolved stage
- WHEN model selection resolves
- THEN no model is fixed from `sdd.map` and none is delegated — the result states no agent runs the stage

### Requirement: `sdd.configs` holds per-stage configuration

A new `sdd.configs` key MUST hold per-stage configuration general to all
stages (agent, enabled state). A stage absent from `sdd.configs` MUST take
defaults; no `sdd.configs` key MUST behave exactly as today.

#### Scenario: Zero-config identity

- GIVEN a `brain.config.json` with no `sdd.configs` key
- WHEN any stage's configuration is resolved
- THEN behavior is identical to the pre-change default for that stage

#### Scenario: Explicit disable via `sdd.configs`

- GIVEN `sdd.configs.verify.enabled = false`
- WHEN the coordinator resolves the `verify` stage
- THEN it reads declared-disabled, not seam-absent

### Requirement: The parity suite names what it cannot yet measure

`roles.contract.test.mjs` MUST loop over an inhabitant map, run identical
assertions per inhabitant, and carry an in-file, dated statement that it
measures no parity until a second inhabitant lands. It MUST assert
`model_tier` never leaks a concrete id.

#### Scenario: One inhabitant present

- GIVEN the inhabitant map holds only `plain`
- WHEN the suite runs
- THEN every assertion passes for `plain` and the file's dated statement is present and unmodified

#### Scenario: A concrete id leaking through is caught

- GIVEN a hypothetical inhabitant entry with a concrete `model_tier` value
- WHEN the suite runs
- THEN the abstraction assertion fails, naming the leaking field

### Requirement: Lifecycle-stage routing refusal is unchanged

This port MUST NOT alter `assertRoutableStage`'s refusal to route any of the
four lifecycle stages. The port declares who executes a stage; it does not
decide that a lifecycle stage may be routed.

#### Scenario: Lifecycle stage routing still refuses

- GIVEN one of the four lifecycle stages
- WHEN `assertRoutableStage` is called with it
- THEN it still refuses, exactly as before this change
