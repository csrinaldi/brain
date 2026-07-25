---
status: draft
issue: 267
---

# Proposal — Intelligent Context Synthesizer (Issue #267)

## What

Implement an **Intelligent Context Synthesizer** CLI module (`brain/scripts/context/synthesizer.mjs` and `npm run brain:context:compile`) integrated directly into `brain:session:start` and `brain:ticket:start` that dynamically compiles a targeted context payload (`.brain-context.md` or `resume.md` section) based on the files and terms affected on the active working branch.

Key capabilities:
1. **Targeted Scanning**: Scans `brain/project/decisions/` (ADRs) and `.memory/records/` (durable observations) for guidelines matching touched files or domain keywords.
2. **Core Baseline Floor (Mandatory)**: Always includes the core governance methodology from `brain/core/` (`agent-authorities.md`, `sdd-layout.md`, `workflow-governance.md`, `reviewer-protocol.md`).
3. **Empty-Match Failsafe Policy**: If project decisions or memory yield zero matches, the synthesizer fails closed to the **Core Doctrinal Baseline Floor** (`brain/core/` + active change specification), guaranteeing no developer agent runs unguided without core governance.

## Why

Developer agents working in this codebase currently receive a large, monolithic amount of context (e.g. entire system prompts, full ADR lists, and all memory records). This causes two major friction points:
- **Context Bloat**: Unnecessary token consumption leading to higher latency and risk of prompt truncation.
- **Model Distraction**: Exposure to irrelevant subsystem rules (e.g. Maven rules when working on Node scripts or specific subsystem ADRs), diluting focus on critical task constraints.

## Scope

### Included
- **Core Synthesizer Module (`brain/scripts/context/synthesizer.mjs`)**: File-matching & keyword-relevance engine over `brain/core/`, `brain/project/decisions/`, and `.memory/records/`.
- **CLI Command (`npm run brain:context:compile`)**: Standalone CLI entrypoint printing or saving synthesized context.
- **Integration into `session:start` & `ticket:start`**: Automatically populating active working memory during task initialization.
- **Unit & Integration Suite (`brain/scripts/context/synthesizer.test.mjs`)**: Node test suite validating empty-match fallback, core floor inclusion, and keyword matching.

### Excluded
- **Vector Database / Embedding Indexes**: Kept local, lightweight, zero-dependency, and deterministic using fast file glob & term indexing.
