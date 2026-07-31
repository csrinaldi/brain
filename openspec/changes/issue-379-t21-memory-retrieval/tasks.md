---
status: draft
issue: 379
epic: 313
artifact_store: openspec
topic_key: sdd/issue-379-t21-memory-retrieval/tasks
---

# Tasks — Issue-Scoped memory-gate (T2.1, Issue #379)

> **STRICT TDD MODE IS ACTIVE**: RED → GREEN pairs using `node:test` + `assert/strict`.
> Branch: `feat/issue-379-t21-memory-retrieval` off `origin/main`.

## Phase 1 — Pure Evaluator (`memory-retrieval.mjs`) — RED then GREEN
- [x] **1.1 RED** — Write `memory-retrieval.test.mjs`: HIT (scoped session_summary →
  pass, reason without warn/partial wording), MISS (zero scoped records → fail, reason
  cites the issue number), PARTIAL (scoped records, none a session_summary → pass:true
  with warn/partial reason), non-array/null/undefined observations → graceful empty,
  cross-issue exclusion regression (#12 record must not satisfy #999), `record.issue`
  string-vs-number `Number()` coercion. Confirm RED (module not found).
- [x] **1.2 GREEN** — Implement `brain/scripts/governance/checks/memory-retrieval.mjs`
  (`memoryRetrieval(observations, issueNumber)`), pure, no fs/gh. Confirm all 1.1 tests
  green.

## Phase 2 — Wrapper Wiring (`run-check.mjs`) — RED then GREEN
- [x] **2.1 RED** — Add `run-check.test.mjs` cases: ctx-less call → global fallback
  (regression, must still pass with all existing memory-gate fixtures); ctx.body with a
  closing/Part-of reference + scoped session_summary → pass clean; ctx.body with a
  reference but no scoped records → fail; ctx.body with scoped records but no
  session_summary → pass:true with warn/partial reason; ctx.body present but no
  extractable issue number → fallback to global check (both a would-pass and a
  would-fail fallback fixture); readRecords throwing with a ctx.body present →
  uncomputable:true (regression). Confirm RED for the right reason (scoped cases
  currently behave like the unscoped global fallback).
- [x] **2.2 GREEN** — Import `memoryRetrieval` into `run-check.mjs`; add
  `runMemoryGateCheck(ctx, records)` (fallback to `memoryPresence(records)` on
  non-string `ctx.body` or `issueNumber == null`, else `memoryRetrieval(records,
  issueNumber)`) reusing this file's own `extractIssueNumber`/`requiresClosingKeyword`
  (`requiresClosingKeyword(ctx) === true` coercion). Replace the `memory-gate` branch's
  `return memoryPresence(records)` with `return runMemoryGateCheck(ctx, records)`. Keep
  the try/catch around `readRecords(cwd)` unchanged. Confirm all 2.1 tests green.

## Phase 3 — Docs / Traceability
- [x] **3.1** Update `brain/project/decisions/adr-0015-governance-v3-substrate-ladder.md`
  L3 row: describe issue-scoping, reference issue #379, add REQ-L3-4 to the Req IDs
  column.
- [x] **3.2** Add `REQ-L3-4` to `openspec/specs/governance-v3/spec.md`'s Requirement
  Index table and Level 3 section (Given/When/Then scenarios matching the design).
- [x] **3.3** Write `proposal.md`, `design.md`, `specs/governance-v3/spec.md` (delta),
  and this `tasks.md` under `openspec/changes/issue-379-t21-memory-retrieval/`.

## Phase 4 — Verification
- [x] **4.1 GATE** — `npm test` on the full suite: confirm 0 regressions, 0 failures,
  before/after test counts recorded (2073 → 2090, +17).
- [x] **4.2** Confirm diff line count against the 400-line review budget; flag clearly
  if over budget (do not silently request `size:exception`).
