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

### R1072-3: the labels are an INPUT, and the gather never fetches them
`gatherTrancheInputs` MUST take `labels` from its caller and MUST NOT reach
the forge for them. Any value that is not an array is "not read", which waives
nothing.

A first draft of this requirement said the gather MUST fall back to a `prView`
fetch when a caller supplied none. That was implemented and REVERTED, and the
requirement is rewritten rather than left standing beside code that contradicts
it: the fallback made this function reach the network, so every existing test
that omits labels called out to a forge. With an authenticated `gh` on the
developer's machine the call returned an array and the suite was green; in CI
there is no such credential, the call threw, and a budget finding's evidence
gained a sentence the tier-text assertions did not expect. The green run was
the lie.

The fallback was also unnecessary. Both production callers already hold the
labels: `review/cli.mjs` reads `boot.prView.labels` before the gather, and
`evaluators/checkpoint.mjs` already took `labels` as a parameter of its own and
merely was not forwarding them.

#### Scenario: the caller supplies the labels
- **WHEN** `review/cli.mjs` or `evaluators/checkpoint.mjs` passes the labels it already read
- **THEN** they are used as given, and no forge call is made for them, so they cannot disagree with the `prBody` gathered beside them.

#### Scenario: the caller supplies none
- **WHEN** no `labels` are passed
- **THEN** the gather yields `null` without contacting the forge, because a unit suite whose result depends on reaching a network is not a unit suite.

#### Scenario: the read was refused upstream
- **WHEN** the caller's own PR read returned no labels, and it passes `null`
- **THEN** nothing is waived, and the budget finding says the labels could not be read — a different fact from a PR that carries no exception.

### R1072-5: every consumer of a label set survives one that was never read
A value threaded as "not read" MUST fail closed at each consumer, never throw.
A `labels = []` parameter default does NOT satisfy this: a default applies only
to `undefined`, and the honest value for an unread set is `null`.

#### Scenario: the checkpoint evaluator is handed an unread set
- **WHEN** `review/cli.mjs` passes `null` and `hasDecisionLabel` is computed
- **THEN** it is `false` — nobody read the labels, so nobody can claim a decision label is there — and the review continues instead of crashing.

#### Scenario: the mode is derived from an unread set
- **WHEN** `deriveMode` receives a non-array `labels`
- **THEN** it derives the default mode, because a set nobody read cannot claim a ruling was asked for.

#### Scenario: a caller passes no labels at all
- **WHEN** `gatherCheckpointInputs` is called without `labels`
- **THEN** the value is `null`, never `[]` — a default of `[]` MINTS the claim "read, and carries no exception" for a caller who simply did not pass any, and that manufactured reading is then forwarded into the budget decision.

### R1072-6: one export owns the label's spelling
No authority may write the label string into executable text. Prose and
comments may name it; code MUST interpolate `SIZE_EXCEPTION_LABEL`.

#### Scenario: a verdict or a gate reason names the label
- **WHEN** `run-check.mjs` or `evaluators/tranche.mjs` builds a reason or an evidence sentence mentioning the label
- **THEN** the spelling comes from the shared export, so a typo cannot name a label the code does not read.

### R1072-4: the agreement is pinned, not assumed
A test MUST drive both authorities with the same inputs and fail when their
answers diverge.

#### Scenario: either authority stops reading the ruling
- **WHEN** the gate or the reviewer is changed to ignore the label
- **THEN** the parity test fails, which is the test that would have caught the defect on PR #1067.
