# Spec — issue-1072-size-exception-parity

### R1072-1: one reading of `size:exception`, in the module that owns the tier
`vcs/governance-tiers.mjs` MUST export `SIZE_EXCEPTION_LABEL` and a pure
`sizeExceptionRuling({labels, tier})`. Every authority with an opinion about
the diff budget MUST read the label through it and MUST NOT retype the label
string.

#### Scenario: the tier honors the waiver
- **WHEN** the label is present and the tier's `honorSizeException` is true
- **THEN** the ruling is `{present: true, honored: true, refusedByTier: false}`.

#### Scenario: the tier refuses the waiver
- **WHEN** the label is present and the tier's `honorSizeException` is false
- **THEN** the ruling is `{present: true, honored: false, refusedByTier: true}`, so REQ-TIER-6's sentence can be produced.

#### Scenario: the label set could not be read
- **WHEN** `labels` is null, undefined, or not an array
- **THEN** the ruling waives nothing, because granting an exception on the strength of a failed read would fail open.

### R1072-2: the cold reviewer honors the label as the gate does
`review/evaluators/tranche.mjs` MUST take the PR's labels and apply
`sizeExceptionRuling` before emitting a `budget` finding.

#### Scenario: over budget, waiver honored
- **WHEN** the count exceeds the tier budget and the ruling is honored
- **THEN** no blocker is emitted, and an `editorial` finding states the count, the budget, the label and the tier — waiving is not forgetting.

#### Scenario: over budget, waiver refused by the tier
- **WHEN** the count exceeds the budget and the ruling is `refusedByTier`
- **THEN** the blocker stays and its evidence says the label is not honored at that tier, the same sentence the gate produces.

#### Scenario: over budget, no label
- **WHEN** the count exceeds the budget and no waiver was asked for
- **THEN** the blocker is exactly what it was, and mentions no waiver.

### R1072-3: the labels come from the caller's own read of the PR
`gatherTrancheInputs` MUST accept `labels` as an input and MUST only fetch
them through the port when the caller supplied none.

#### Scenario: the caller already read the PR
- **WHEN** `review/cli.mjs` passes `boot.prView.labels`
- **THEN** no second `prView` call is made, so the labels cannot disagree with the `prBody` gathered beside them.

#### Scenario: the forge refuses the fallback read
- **WHEN** no labels were supplied and `prView` throws
- **THEN** `labels` is `null`, never `[]`, because an empty list would claim the PR carries no exception when nothing was read.

### R1072-4: the agreement is pinned, not assumed
A test MUST drive both authorities with the same inputs and fail when their
answers diverge.

#### Scenario: either authority stops reading the ruling
- **WHEN** the gate or the reviewer is changed to ignore the label
- **THEN** the parity test fails, which is the test that would have caught the defect on PR #1067.
