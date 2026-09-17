# Delta for feature-working-memory

This delta retires durable-record transport from feature pushes while preserving
feature checkpoint/resume behavior. `memory-gate` is unchanged.

## MODIFIED Requirements

### Requirement: REQ-S0-2: Pre-push Memory Guard

The pre-push hook MUST NOT invoke `brain:memory:share`, inspect `.memory/` for
feature-push transport, or require `.memory/` changes. It MUST preserve the
existing repository checks and MUST NOT block a feature push solely because
`.memory/` is absent or clean.

(Previously: the hook invoked `brain:memory:share`, then inspected `.memory/` and
blocked when uncommitted memory changes remained.)

#### Scenario: Feature push does not materialize durable records

- GIVEN a feature push with no `.memory/` changes
- WHEN the pre-push hook runs
- THEN it does not invoke `brain:memory:share`
- AND it does not fail solely because `.memory/` is clean

#### Scenario: Repository checks remain enforced

- GIVEN a feature push whose ordinary repository checks fail
- WHEN the pre-push hook runs
- THEN it reports the repository-check failure and exits non-zero
- AND the retired memory transport is not used as a substitute

### Requirement: REQ-S4-1: Pre-push Checkpoint Automation

The pre-push hook MUST call `feature-checkpoint <feature>` when a matching
`openspec/changes/<feature>/` directory exists for the active branch. It MUST
run this checkpoint without first invoking `brain:memory:share` and MUST retain
checkpoint failure isolation and the existing repository checks.

(Previously: checkpoint automation ran after `brain:memory:share` and before the
uncommitted-memory guard.)

#### Scenario: Checkpoint runs without durable-record transport

- GIVEN the active branch has a matching feature change directory
- WHEN the pre-push hook runs
- THEN `feature-checkpoint <feature>` runs
- AND no `brain:memory:share` call or dirty-`.memory/` guard is required

#### Scenario: Missing feature directory does not add a memory dependency

- GIVEN no matching feature change directory exists
- WHEN the pre-push hook runs
- THEN no checkpoint is attempted
- AND repository checks continue without requiring `.memory/` changes
