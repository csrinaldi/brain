---
status: draft
issue: 267
---

# Tasks — Intelligent Context Synthesizer (Issue #267)

> **STRICT TDD MODE IS ACTIVE** for all tasks: RED → GREEN pairs using `node:test` + `assert/strict`.

## Review Workload Forecast
- **Estimated changed lines**: ~117 implementation lines (ex-tests).
- **400-line budget risk**: Low.
- **Chained PRs recommended**: No.

## Phase 1 — SDD Planning Artifacts
- [x] **1.1** `proposal.md` — PRD with core baseline floor, empty-match failsafe, and scope.
- [x] **1.2** `spec.md` — Delta requirements REQ-CTX-1..4.
- [x] **1.3** `design.md` — Architecture, data flow, and failsafe policy.
- [x] **1.4** `tasks.md` — Implementation checklist with RED->GREEN TDD pairs.

## Phase 2 — Core Synthesizer Engine (REQ-CTX-1, REQ-CTX-2)
- [x] **2.1 RED** — `brain/scripts/context/synthesizer.test.mjs`: Test core baseline floor (`brain/core/`) inclusion and file-matching over ADRs.
- [x] **2.2 GREEN** — Implement core file matcher and baseline floor loader in `brain/scripts/context/synthesizer.mjs`.

## Phase 3 — Empty-Match Failsafe Policy (REQ-CTX-3)
- [x] **3.1 RED** — `brain/scripts/context/synthesizer.test.mjs`: Test that zero file matches trigger the `CORE_FLOOR` failsafe mode instead of empty return.
- [x] **3.2 GREEN** — Implement fail-closed baseline floor fallback logic in `synthesizer.mjs`.

## Phase 4 — CLI & Session Integration (REQ-CTX-4)
- [x] **4.1 RED** — `brain/scripts/context/cli.test.mjs`: Test CLI entrypoint (`npm run brain:context:compile`).
- [x] **4.2 GREEN** — Implement `brain/scripts/context/cli.mjs` and wire package.json script.
- [x] **4.3 RED** — `brain/scripts/session-start.test.mjs`: Test `session:start` context hydration integration.
- [x] **4.4 GREEN** — Wire synthesizer hydration into `brain/scripts/session-start.mjs`.

## Phase 5 — Verification & Governance Check
- [x] **5.1 GATE** — `npm test` clean (1454 tests passing); `npm run brain:repo:check` clean.
- [x] **5.2 BUDGET** — Confirm diff <= 400 counted lines (~117 counted implementation lines).
