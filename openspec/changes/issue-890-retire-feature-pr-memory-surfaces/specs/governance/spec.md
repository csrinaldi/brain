# Delta for governance

This delta completes the feature-PR memory retirement. Durable capture uses
`brain:memory:save --issue N` and the enabled memory lane; `memory-gate` remains
unchanged.

## ADDED Requirements

### Requirement REQ-S5-7: Automatic Memory Lane Shipping

The repository configuration MUST set `memory.lane.enabled` to `true`. Active
operator guidance MUST direct durable capture to `brain:memory:save --issue N`
and delivery through the memory lane rather than through a feature PR.

#### Scenario: Lane is enabled for this repository

- GIVEN the repository configuration is loaded
- WHEN `memory.lane.enabled` is read
- THEN its value is `true`

#### Scenario: Capture guidance uses the lane

- GIVEN an operator needs to capture durable memory for issue 42
- WHEN the documented workflow is followed
- THEN it uses `brain:memory:save --issue 42`
- AND it does not require `brain:save` or a feature-branch `.memory/` commit

## MODIFIED Requirements

### Requirement REQ-S5-5: brain:next State-Machine Guidance

`brain:next` MUST derive the current workflow state from the git branch, open PRs
via the VCS adapter, and `brain.config.json`, then emit one next recommended
command. It MUST NOT use feature-branch `.memory/` materialization or recommend
`brain:save`. It MUST cover at minimum: no branch → `brain:start`; checks failing
→ `brain:check`; durable capture still needed → `brain:memory:save --issue <issue>`;
checks passing with no open PR → `brain:ship`; and an existing open PR → a status
message. The command MUST distinguish the memory lane from feature-PR delivery.

(Previously: the state machine inspected `.memory/` materialization and
recommended `brain:save` when memory had not been materialized.)

#### Scenario: No branch exists → recommends brain:start

- GIVEN no feature branch is checked out
- WHEN `brain:next` runs
- THEN output contains `brain:start <issue>`

#### Scenario: Branch with failing checks → recommends brain:check

- GIVEN a feature branch is checked out and checks failed
- WHEN `brain:next` runs
- THEN output contains `brain:check`

#### Scenario: Durable capture is pending → recommends canonical capture

- GIVEN checks pass but the current issue still needs a durable memory record
- WHEN `brain:next` runs
- THEN output contains `brain:memory:save --issue <issue>`
- AND output does not contain `brain:save`

#### Scenario: All pass, no open PR → recommends brain:ship

- GIVEN checks pass, lane capture is handled, and no open PR exists
- WHEN `brain:next` runs
- THEN output contains `brain:ship`

#### Scenario: Open PR exists → reports status

- GIVEN an open PR exists for the feature branch
- WHEN `brain:next` runs
- THEN output reports the PR status instead of recommending `brain:save`

## REMOVED Requirements

### Requirement REQ-S5-3: brain:save Gates Session Summary + Memory

(Reason: `brain:save` is retired permanently after record-first capture and lane
shipping; retaining the command would preserve a feature-PR transport path.)
(Migration: use `brain:memory:save --issue N` for capture and let the enabled
memory lane deliver the record. No `memory-gate` behavior changes.)
