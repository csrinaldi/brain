# Stage Routing Specification (S2)

## Purpose

ADR-0019 Amendment 1's condition 4, executed: the flat lifecycle refusal is
replaced by a check that enforces the conditions. Built from proposal D1–D4.

## Requirements

### Requirement: An undeclared stage refuses everywhere (D3)

`resolveStageEngine` refuses an `sdd.map` entry whose stage is neither
lifecycle nor a member of the resolved `sdd.stages` — naming both sets.

#### Scenario: Typo'd stage
- **WHEN** `sdd.map['cold-reviw']` exists and `sdd.stages` does not declare it
- **THEN** resolution throws naming the stage and where declarations live

### Requirement: A lifecycle stage routes only to a declaring engine (D1/D2)

`assertRoutedStage({config, stage})` — async, the port interrogated through
`loadInhabitant` + `resolveRoles`: for a LIFECYCLE stage the routed value
must be an `SDD_ENGINES` member whose declaration answers the stage, enabled.
A custom stage may name a transport (option A — the split stated in the
refusal text; #833 holds the debt).

#### Scenario: Lifecycle to a declaring engine
- **WHEN** `sdd.map.tasks = {engine: 'gentle-ai'}`
- **THEN** the check passes and returns the routing with the resolved role

#### Scenario: Lifecycle to a platform
- **WHEN** `sdd.map.tasks = {engine: 'claude'}`
- **THEN** refusal names D6 (platforms execute; engines declare) and #833

#### Scenario: Lifecycle to an engine that does not declare or is disabled
- **THEN** refusal carries the port's own words

#### Scenario: The field config keeps breathing
- **WHEN** `sdd.map['cold-review'] = {engine: 'claude', model: 'sonnet'}` (#812)
- **THEN** the check passes — custom stage, transport naming, byte-for-byte

### Requirement: The transport demands evidence (condition 4 — replaced, not removed)

`runStage` refuses a LIFECYCLE stage unless handed the routing the async
check produced. The flat refusal becomes a demand for proof: a lifecycle
spawn that skipped the check still throws.

#### Scenario: A caller that skipped the check
- **WHEN** `runStage({stage: 'tasks', ...})` with no routed evidence
- **THEN** it throws naming `assertRoutedStage` as the missing step

### Requirement: The condition pins (D4)

C1: an `sdd.map` value carrying anything path-shaped refuses. C2: pinned by
test — no shared reader reads an engine field. C3: this change lands the
hook (the check returns what was routed); the parity proof is S4's, stated.

#### Scenario: Path-shaped value
- **WHEN** an entry carries `layout`, `root`, `path` or a value with `/`
- **THEN** refusal cites condition 1
