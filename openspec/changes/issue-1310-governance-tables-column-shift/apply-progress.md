---
issue: 1310
---

# Apply progress — governance-tables-column-shift (issue 1310)

Mode: Strict TDD. Batch 1 of 1: 5 of 5 tasks.

- RED: `table-cells.test.mjs` failed 2 of 5 (scan listed memory-actor, decision-title, decision-status, anti-pattern-scope, anti-pattern-title; chip-in-cell failed).
- GREEN: chips moved to inner elements (D116); 5 of 5 pass; `npm test` 7612 tests, 7609 pass, 0 fail, 3 skipped.
- Mutation: `.decision-title { display: inline-block; }` appended: scan fails; reverted.
- Sweep: every class on td/th/tr in `app.js` against `app.css`. Offenders: decision-title, decision-status, anti-pattern-scope, anti-pattern-title (the issue) and memory-actor (same class of bug, Memory view). No others.
