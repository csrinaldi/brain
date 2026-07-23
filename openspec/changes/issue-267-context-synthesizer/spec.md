---
status: draft
issue: 267
---

# Delta Specification — Intelligent Context Synthesizer (Issue #267)

## Requirements

### REQ-CTX-1: Core Baseline Floor Inclusion
The synthesizer MUST always include the core governance methodology from `brain/core/` as an unskippable baseline floor.
- **Scenario 1.1**: The synthesized output payload MUST contain summary context from `brain/core/methodology/agent-authorities.md`, `sdd-layout.md`, `workflow-governance.md`, and `reviewer-protocol.md`.
- **Scenario 1.2**: Core baseline methodology CANNOT be filtered out by file-matching or term-matching logic.

### REQ-CTX-2: Targeted Decision & Memory Scanning
The synthesizer MUST scan `brain/project/decisions/` and `.memory/records/` for guidelines matching affected files or domain terms on the active branch.
- **Scenario 2.1**: When diff files touch specific subsystems (e.g. `brain/scripts/review/`), related ADRs (e.g. `ADR-0020`, `ADR-0021`) and memory records matching `topic_key` prefixes MUST be included in the context payload.
- **Scenario 2.2**: Irrelevant ADRs for untouched subsystems (e.g. Maven reactor rules) MUST be excluded from the synthesized payload.

### REQ-CTX-3: Empty-Match Failsafe Policy (Fail-Closed)
If scanning `brain/project/decisions/` and `.memory/records/` yields zero matches for touched files, the synthesizer MUST NOT return an empty payload or degrade silently.
- **Scenario 3.1**: On zero targeted matches, the synthesizer MUST fall back to the **Core Doctrinal Baseline Floor** (`brain/core/` + active change specification).
- **Scenario 3.2**: The output payload MUST include an explicit notice indicating that the core baseline floor was activated due to zero targeted matches.

### REQ-CTX-4: CLI & Lifecycle Hook Integration
The synthesizer MUST provide a CLI entrypoint and integrate with lifecycle startup commands.
- **Scenario 4.1**: `npm run brain:context:compile` MUST run the synthesizer and output the result to stdout or `.brain-context.md`.
- **Scenario 4.2**: `session:start` (`brain/scripts/session-start.mjs`) MUST invoke the synthesizer to hydrate local agent context.
