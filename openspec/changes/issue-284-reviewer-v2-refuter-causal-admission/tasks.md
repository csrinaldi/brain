---
status: draft
issue: 284
---

# Tasks — Reviewer v2: Refuter Role & Causal Admission (Issue #284)

> **STRICT TDD MODE IS ACTIVE** for all tasks: RED → GREEN pairs using `node:test` + `assert/strict`.

## Phase 1 — SDD Planning Artifacts
- [x] **1.1** `proposal.md` — PRD with intent, scope, local subagent execution, and 4 token-saving filters.
- [x] **1.2** `spec.md` — Delta requirements REQ-H2-1..7.
- [x] **1.3** `design.md` — Architecture, module layout, and FORK rulings (FORK 1–4).
- [x] **1.4** `tasks.md` — Implementation checklist.

## Phase 2 — `brain-review/2` Schema & Parser Support (REQ-H2-2, REQ-H2-4)
- [x] **2.1 RED** — `review/lib/parse-verdict.test.mjs`: Test parsing of `brain-review/2` blocks with `evidence_class` and `causal_disposition`.
- [x] **2.2 GREEN** — Update `parse-verdict.mjs` to extract v2 fields while preserving `/1` backwards compatibility.
- [x] **2.3 RED** — `review/lib/schema-v2.test.mjs`: Validate `evidence_class` and `causal_disposition` enum bounds.
- [x] **2.4 GREEN** — Implement `review/lib/schema-v2.mjs` validator.

## Phase 3 — Emitter Causal Admission Rules (REQ-H2-3)
- [x] **3.1 RED** — `review/verdict.test.mjs`: Test that `pre-existing` or `base-only` findings do NOT produce a `REVISE` verdict and are routed to `follow_ups[]`.
- [x] **3.2 RED** — `review/verdict.test.mjs`: Test that `causal_disposition: unknown` forces `escalate: human`.
- [x] **3.3 GREEN** — Implement causal admission filter in `review/verdict.mjs`.

## Phase 4 — Refuter Role Evaluator (REQ-H2-1)
- [x] **4.1 RED** — `review/evaluators/refuter.test.mjs`: Test that a `refuted` inferential finding prevents a blocking `REVISE`.
- [x] **4.2 RED** — `review/evaluators/refuter.test.mjs`: Test that an `inconclusive` refuter outcome forces `escalate: human`.
- [x] **4.3 GREEN** — Implement `review/evaluators/refuter.mjs` evaluator.

## Phase 5 — Verification & Governance Check
- [x] **5.1 GATE** — `npm test` clean (1840 tests passing); `npm run brain:repo:check` clean.
- [x] **5.2 BUDGET** — Confirm diff <= 400 counted lines (~115 counted implementation lines).
