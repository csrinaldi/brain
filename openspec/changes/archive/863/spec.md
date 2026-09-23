---
status: applying
issue: 863
---

# Backend Contract Specification (#863)

The ruling ticket's own scenarios: what must be true once its drafts are promoted. The
implementation scenarios (idempotent hydration, record-first, no artifact) live in the memory
2.0 spec and are owned by the slices this ticket files.

## Requirements

### Requirement: the contract exists and is what adapters cite

#### Scenario: the document
- **WHEN** `brain/core/methodology/memory-backend-contract.md` is read
- **THEN** it states the agnosticism test verbatim, the three rules, four required verbs (`setup`, `share`, `hydrate`, `save`) and the optional ones, the failure discipline, a Producers section with the memory CLI and the review poster as rows, a Deletion section, and a Conformance row per backend

#### Scenario: HOME and AGENTS know it
- **WHEN** the draft is promoted
- **THEN** `brain/HOME.md` lists it beside `vcs-contract.md` and `AGENTS.md` regenerates clean

### Requirement: the two ADRs no longer contradict the contract

#### Scenario: ADR-0002 Amendment 1
- **WHEN** ADR-0002 is read after promotion
- **THEN** its durable-layer bullet names records, its manifest note is marked superseded with the spike preserved, and its two artifact Consequences are withdrawn or narrowed

#### Scenario: ADR-0004 Amendment 1
- **WHEN** ADR-0004 is read after promotion
- **THEN** "no formal interface today" and "manifest required for all backends" are both closed, citing the contract and `plainfiles`

### Requirement: doctrine speaks in records

#### Scenario: the three surfaces
- **WHEN** `harness-contract.md` (rows `session:start`, `memory:share`, `memory:pull`, `memory:index`; the implementation note), `agent-authorities.md` Tier 1, and `consolidation-protocol.md` §3 are read after promotion
- **THEN** no memory verb is described as "engram → .memory" or "local engram", Tier 1 grants the producer path (`memory:save`) and not `.engram/**`, and the zone map names `.memory/records/**`

### Requirement: each draft promotes through the verb, or says why not

#### Scenario: amendment drafts
- **WHEN** each `*.draft.md` in `brain-drafts/` is planned by `lib/amendment-draft.mjs#planAmendment`
- **THEN** the plan is `ok` with every `amend-find` anchor occurring exactly once

#### Scenario: the new document
- **WHEN** `memory-backend-contract.md` is promoted
- **THEN** its promotion note states the manual path (a new methodology document is neither of `brain:promote`'s two shapes) and names the HOME and AGENTS acts

### Requirement: the ruling reaches the epic

#### Scenario: re-sequence and tickets
- **WHEN** `issue-864-memory-2-0/tasks.md` is read
- **THEN** 2.4 depends on 3.2 (D3), 1.2 is ticked, 0.0 is ticked, the record-first ticket (3.2) has a number, and the one-time heal of the three pre-guard rows has a task under D1/D5
