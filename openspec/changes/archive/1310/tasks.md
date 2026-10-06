---
status: approved
issue: 1310
---

# Tasks — governance-tables-column-shift (issue 1310)

Strict TDD. Test runner: `npm test`; one file with `node --test <path>`.

## Phase 1 — RED

- [x] 1.1 RED — create `brain/scripts/ui/static/table-cells.test.mjs` (R1310-1, R1310-2, R1310-3). **Fails today:** the scan names `.memory-actor`, `.decision-title`, `.decision-status`, `.anti-pattern-scope`, `.anti-pattern-title`, and the chip-in-cell test fails.

## Phase 2 — GREEN

- [x] 2.1 GREEN — `static/app.js`: status and scope chips as `<span>`s in `-cell` tds; memory actor stack as an inner `<div>` (D116).
- [x] 2.2 GREEN — `static/app.css`: remove the `display` from `.decision-title` and `.anti-pattern-title`.

## Phase 3 — Verify

- [x] 3.1 Mutation check: `display` back on `.decision-title` fails the scan; reverted.
- [x] 3.2 `npm test`, `brain:repo:check`, `brain:nav` green.
- [x] 3.3 Visual check of Decisions and Anti-patterns.
