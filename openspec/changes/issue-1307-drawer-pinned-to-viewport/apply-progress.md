# Apply progress — issue 1307

Mode: Strict TDD. Baseline: 7615 tests, 7612 pass, 3 skipped.

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1/2.1 CSS scan (`static/drawer-pinned.test.mjs`) | 4 failed (sticky, body scroller, sticky tabs, phone) | 4 pass after `app.css` | none |
| 1.2/2.2 fake-DOM structure (`app-smoke.test.mjs`) | failed: drawer children were not `[drawer-head, drawer-body]` | pass after `app.js` nesting | `local-render.test.mjs` `positionOf` reads the body's children |
| 3.1 verification | | 7620 tests, 7617 pass, 0 fail, 3 skipped; repo:check and nav green | tabs moved from sticky-in-body to the head after the browser showed sticky never engages (design D120) |

Mutation: removed `position: sticky` and `max-height: 100vh` from `.drawer`: R1307-1 scan failed; restored.
Gated diff vs origin/main: 29 insertions + 18 deletions (app.css, app.js), budget 1000.
Task 4.1 (browser proof) is recorded in the final report.
