# Apply progress — issue 1307

Mode: Strict TDD. Baseline: 7615 tests, 7612 pass, 3 skipped.

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1/2.1 CSS scan (`static/drawer-pinned.test.mjs`) | 4 failed (sticky, body scroller, tabs in the fixed head (D120), phone) | 4 pass after `app.css` | none |
| 1.2/2.2 fake-DOM structure (`app-smoke.test.mjs`) | failed: drawer children were not `[drawer-head, drawer-body]` | pass after `app.js` nesting | `local-render.test.mjs` `positionOf` reads the body's children |
| 3.1 verification | | 7620 tests, 7617 pass, 0 fail, 3 skipped; repo:check and nav green | tabs moved from sticky-in-body to the head after the browser showed sticky never engages (design D120) |

Mutation: removed `position: sticky` and `max-height: 100vh` from `.drawer`: R1307-1 scan failed; restored.
Gated diff vs origin/main: 29 insertions + 18 deletions (app.css, app.js), budget 1000.
Task 4.1 (browser proof) is recorded in the final report.

## Batch 2 (review round 1)

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 5.1 cold-2 tab click / re-render scroll (`app-smoke.test.mjs`, 2 tests; fake DOM gained `scrollTop` + block-flow `getBoundingClientRect`) | written after the implementation; proven a detector by mutation (below) | pass | `renderDrawer` split into `renderDrawer` (scroll) + `buildDrawer` (DOM) |
| 5.1 cold-1 specificity (`drawer-pinned.test.mjs` cascade test) | failed: `padding-top ... resolves to 12px via ".drawer .tabs", not 0` | pass after `.drawer .drawer-head .tabs` | none |

Mutations: removed `tabScrollPending = true` -> tab-click test failed; `scrollTop = kept` -> 0 -> re-render test failed; reverted `.drawer .drawer-head .tabs` to `.drawer-head .tabs` -> cascade test failed. All restored.
Honest note: the two scroll tests were written after the code, so their RED is the mutation, not a pre-code failure. cold-3: tasks.md 2.1 and this file aligned to D120; R1307-5 and D122 added.
