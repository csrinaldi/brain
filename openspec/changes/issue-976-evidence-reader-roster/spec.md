---
status: applying
issue: 976
---

# The evidence-reader roster paragraph promotes the sixth reader and the approved-label exemption (#976)

## Requirements

### Requirement: the draft carries an open, approved issue link

#### Scenario: the copied draft's contract
- **WHEN** the `brain-amendment/1` contract in `deny-readers-roster-sixth.draft.md` is parsed
- **THEN** its `target` is `brain/core/anti-patterns/evidence-reader-empty-on-failure.md` and its `issue` is `976` (an OPEN, `status:approved` issue), not `962` (CLOSED)

### Requirement: the amend-find anchor matches the current doctrine text exactly

#### Scenario: byte-identical anchor
- **WHEN** the draft's `amend-find` block is compared against the current "Applied at" paragraph in `brain/core/anti-patterns/evidence-reader-empty-on-failure.md` on this branch
- **THEN** the two are byte-identical, and `assessEdit` against the real target reports `state: pending`, `free: 1`

### Requirement: the promoted paragraph names brain-audit as fixed, not tracked

#### Scenario: simulated promotion
- **WHEN** `applyEdits` (from the real `brain/scripts/lib/amendment-draft.mjs`) is run against the draft's edit and the real target file
- **THEN** the resulting text names `brain-audit.mjs`'s `loadConfig` among six readers that stopped swallowing a config-read failure, and contains neither "tracked in issue #962" nor "still swallows the failure"

### Requirement: the promoted paragraph reclassifies approved-label.mjs as an exemption

#### Scenario: approved-label moves out of the ALLOW-reader list
- **WHEN** the simulated promotion result is inspected
- **THEN** `approved-label.mjs` no longer appears in the ALLOW-reader bullet list, and instead is described as a fixed-fallback exemption citing `approved-label.mjs:19,56-60` and comparing it to `governance-tiers.mjs`'s `resolveTier`

### Requirement: no other line in the target file changes

#### Scenario: single-paragraph diff
- **WHEN** the simulated promotion result is diffed against the current target file
- **THEN** only the "Applied at" paragraph's lines differ; every other line, including the "Exemption" paragraph above it, is unchanged

### Requirement: every reader the paragraph names is verified against source, not assumed

#### Scenario: reader classification table
- **WHEN** each reader named in the rewritten paragraph is checked against its source file
- **THEN** its direction (DENY, ALLOW, or Exemption) and failure behavior match what the paragraph claims, recorded with file:line in `proposal.md` and `apply-progress.md`

### Requirement: the known non-object-config-shape gap is not claimed as fixed

#### Scenario: issue #975 stays open
- **WHEN** the draft's preamble and this change's proposal describe `loadBrainConfigOrThrow`'s remaining gap (JSON that parses but is not an object)
- **THEN** they cite issue #975 as OPEN and unfixed, and do not claim PR #969 or this draft closes it

### Requirement: brain:promote is never invoked by this change

#### Scenario: promotion left to the maintainer
- **WHEN** this change's apply batch runs
- **THEN** no `npm run brain:promote` invocation occurs; the promotion command is recorded in `proposal.md`/`apply-progress.md` for the maintainer to run
