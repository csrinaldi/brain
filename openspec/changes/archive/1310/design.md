---
status: approved
issue: 1310
---

# Design — governance-tables-column-shift (issue 1310)

## Technical approach

Continues the numbering of the UI decisions at D116.

## Decisions

| # | Decision | Rejected | Why |
|---|---|---|---|
| D116 | **Chip styling lives on an inner element.** The status and scope chips are `<span>`s inside `<td class="decision-status-cell">` and `<td class="anti-pattern-scope-cell">`; the memory actor stack is `<div class="memory-actor">` inside `<td class="memory-actor-cell">`. The chip classes keep their names, so their rules (`app.css:368`, `:380`, `:862`, `:878`, `:1241`) are unchanged. `display` is removed from `.decision-title` and `.anti-pattern-title`. | Setting `display: table-cell` on the classes | It would restore the layout only by repeating the browser default on every cell, and the next chip class would repeat the defect. |
| D117 | **The guard is a scan.** `static/table-cells.test.mjs` collects every literal class of `el('td'\|'th'\|'tr', ...)` in `app.js` and fails when a rule in `app.css` whose last compound names one sets `display`. Structure tests pin the chip-in-cell shape and the cell counts. | A fake-DOM render test | This repo has no DOM harness (`sdd-view.test.mjs`); a harness would cost more than the defect class. |

## Mutation check

Appending `.decision-title { display: inline-block; }` to `app.css` fails the scan; reverted.
