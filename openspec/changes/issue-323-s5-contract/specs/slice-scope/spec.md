# Slice Scope Specification (S5)

## Requirements

### Requirement: the block is JSON, per slice, scope + termination (D1)
`brain-slice-scope/1`: `{slice: number, claims: string[], terminal_pr: string}`.

#### Scenario: parsed
- **WHEN** a tasks.md carries two well-formed blocks
- **THEN** `parseSliceScopes` yields both, in order

#### Scenario: malformed refuses
- **WHEN** a block is JS, or claims is not a string array, or terminal_pr is absent
- **THEN** refusal names the rule; nothing is guessed

### Requirement: absence is legal; declared must be valid (D2/D3)
#### Scenario: legacy
- **WHEN** a tasks.md has no block
- **THEN** the parser returns [] and the structure check passes

#### Scenario: declared-but-broken
- **WHEN** any repo tasks.md carries a malformed block
- **THEN** the structure check goes red naming the file

### Requirement: stranded trackers are a signal, not silence (D4)
#### Scenario: stranded
- **WHEN** `feature/x` is ahead of the default and no open PR has head `feature/x`
- **THEN** `brain:status` reports it as stranded

#### Scenario: in flight
- **WHEN** an open PR carries the branch
- **THEN** no report — a chain in flight is not a chain that stopped
