# Harness Doctrine — Archive Policy Specification

## Purpose

Correct two dead references in doctrine files and state the archive policy explicitly: `/sdd-archive`
is optional for a human to invoke directly, but archiving is guaranteed by the post-merge sweep — so
"optional" in `harness-contract.md` stops reading as "nobody's job".

## Requirements

### Requirement: Dead Reference Fixed — `openspec/README.md`

`openspec/README.md:5` MUST reference an existing ADR path
(`brain/project/decisions/adr-0001-arquitectura-3-capas-harness-reemplazable.md` or its current
location) instead of a non-existent target.

#### Scenario: Reference resolves

- GIVEN `openspec/README.md`
- WHEN the referenced ADR path is checked
- THEN the file exists at that path

### Requirement: Dead Reference Fixed — `harness-contract.md`

`harness-contract.md:6` MUST reference the correct, existing ADR instead of a non-existent target.

#### Scenario: Reference resolves

- GIVEN `harness-contract.md`
- WHEN the referenced ADR path is checked
- THEN the file exists at that path

### Requirement: Archive Policy Stated as Human-Optional, Machine-Guaranteed

`harness-contract.md`, near the `/sdd-archive` entry (§43-50), MUST state that the verb is optional
for direct human invocation but that archiving itself is guaranteed by the post-merge sweep
(`governance-postmerge-sweep`).

(Design decision, parameterized here: exact wording, and whether the `/sdd-archive` row moves out of
"Optional verbs" into a new category, are left to `sdd-design`. This requirement fixes only the
required meaning, not the literal text.)

#### Scenario: Doc communicates the guarantee

- GIVEN `harness-contract.md`'s `/sdd-archive` entry
- WHEN a reader reviews the surrounding text
- THEN it states that archiving happens automatically via the post-merge sweep even though manual
  invocation remains optional
