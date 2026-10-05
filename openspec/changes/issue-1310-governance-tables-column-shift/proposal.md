---
status: approved
issue: 1310
---

# Proposal — governance-tables-column-shift (issue 1310)

## Intent

In Governance, Decisions and Anti-patterns, every cell after the first sits one column left of its header and the last column (FILE) is empty. The cause is CSS applied to table cells. `.decision-status` (`static/app.css:368`), `.anti-pattern-scope` (`:380`) and `.anti-pattern-title` (`:382`) set `display: inline-block`, and `.decision-title` (`:365`) sets `display: block`. `renderDecisionRow` and `renderAntiPatternRow` (`static/app.js`) apply those classes to `<td>` elements, so each such cell leaves the table layout and the remaining cells of the row shift left.

The sweep of every class applied to a `td`, `th` or `tr` found the same defect in one more place: `.memory-actor` (`app.css:1241`, `display: flex`) on the Memory view's actor `<td>` (`app.js:439`).

## Scope

### In
- Move chip styling to an inner element: the status and scope chips become `<span>`s inside their `<td>`; the memory actor stack becomes a `<div>` inside its `<td>`.
- Drop `display` from `.decision-title` and `.anti-pattern-title`.
- A scan test that fails when any rule for a class applied to a `td`, `th` or `tr` sets `display`.

### Out
- Any change to the models, the columns, the header labels or the unreadable-row `colspan`.
- Table layouts outside the Governance and Memory views.

## Approach

Rename the cell classes (`decision-status-cell`, `anti-pattern-scope-cell`, `memory-actor-cell`) and keep the existing chip classes on the inner elements, so the rules that style the chips need no change. The tests are text scans of `app.js` and `app.css`, the repo's established pattern (no DOM harness, `sdd-view.test.mjs`).

## Size

About 20 gated lines against the `lite` budget of 1000. One PR.

## Success criteria

- Decisions and Anti-patterns rows align with their headers and FILE is filled.
- No class applied to a `td`, `th` or `tr` has a rule that sets `display`.
