# Stage Wiring Specification (S4)

## Purpose
The seam stops refusing the two frameworks; C3 holds at the boundary.

## Requirements

### Requirement: plain's run is the handoff (D1)
`{ok: true, manual: true, target, steps}` — the human is the runtime, said
not simulated; the target is the single accessor's answer.

#### Scenario: routed lifecycle stage
- **WHEN** plain.runStage receives bound evidence for `tasks`
- **THEN** it answers the handoff with `artifactPaths(changeId).tasks`

### Requirement: gentle-ai runs ON the platform (D2)
The prompt composes FROM `routed.role.instructions` (the port's recorded
words, never installed files); the spawn delegates to the claude backend as
transport; the transport's `{ok, reason}` rides through verbatim.

#### Scenario: transport failure
- **WHEN** the transport answers `{ok: false, reason}`
- **THEN** gentle-ai's answer IS that object — no wrapping, no retry

### Requirement: the evidence guard holds at the engine layer (D3)
Both engines refuse a lifecycle payload without BOUND routed evidence for
that exact stage.

#### Scenario: bearer evidence
- **WHEN** evidence computed for `tasks` arrives with stage `design`
- **THEN** refusal names both stages

### Requirement: C3 at the boundary (D4)
One accessor, two engines, one target; the presence readers accept a change
dir engine-blind.

#### Scenario: same target
- **WHEN** both engines run one stage for one change
- **THEN** the target paths are identical
