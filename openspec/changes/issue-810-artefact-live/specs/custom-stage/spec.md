---
issue: 810
phase: spec
capability: custom-stage
---

# Spec — a declared custom stage runs end to end

## Requirement: the scaffold produces the declared set (S6-R1)

`new-change` writes one artefact file per resolved stage, custom stages
included, using the file names `resolveStageSet(config)` resolves.

### Scenario: zero-config identity
- WHEN no `sdd.stages` is declared
- THEN `new-change` writes exactly proposal.md, spec.md, design.md, tasks.md
  with today's template bytes — no fifth file, no changed content.

### Scenario: a custom stage is scaffolded
- WHEN `sdd.stages` declares the four plus `research: {artefact: "research.md"}`
- THEN `new-change` also writes `research.md`, a front-mattered stub naming its
  stage, and reports it in the summary output.

### Scenario: the resolver's refusals reach the operator
- WHEN `sdd.stages` omits a lifecycle stage
- THEN `new-change` fails with `resolveStageSet`'s own message and writes
  nothing.

## Requirement: phase-order walks the declared order (S6-R2)

Rule A's artefact set is the tier-scoped lifecycle subset UNION every declared
custom stage, in the declared interleaved order. Declaring a custom stage is
the demand — the tier scopes only the four (REQ-L4-2′).

### Scenario: implementation before the custom artefact is named
- WHEN a stage `research` is declared between `proposal` and `spec`, and a PR
  adds implementation to a change dir that has proposal.md but no research.md
- THEN phase-order fails naming `research.md` among the missing artefacts.

### Scenario: zero-config identity at the gate
- WHEN no `sdd.stages` is declared
- THEN the walk set, order, and message text (including the legacy
  "spec.md/design.md" literal at standard tier) are byte-identical to today.

### Scenario: the sentinel never lies for custom sets
- WHEN the artefact set is anything but the historical standard four
- THEN the failure message names the artefacts ACTUALLY missing, never the
  legacy literal.

## Requirement: the archive carries the custom artefact (S6-R3)

`change:archive` moves the change dir whole; a custom artefact lands in
`openspec/changes/archive/<iid>/` with its content intact.

### Scenario: custom artefact archived
- WHEN a change dir carrying research.md is archived
- THEN `archive/<iid>/research.md` exists with identical content and the
  spec-merge behaviour for the four is unchanged.

## Requirement: the authority is doctrine, not code (S6-R4)

The behaviour above ships together with ADR-0019 Amendment 5 (drafted in this
change's `brain-drafts/`, promoted by the human). The amendment names the four
conditions and how each is enforced; the code cites the amendment, not the
issue, at every surface it unlocks.

### Scenario: the draft parses
- WHEN `brain:promote` is pointed at the draft
- THEN the brain-amendment/1 block parses and the plan renders (promotion
  itself is the human's act).
