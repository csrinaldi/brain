---
status: approved
issue: 1310
---

# Spec — governance-tables-column-shift (issue 1310)

Capability: `governance-views` (modified; #882, #1059). Delta requirements: what MUST be true after this change. Requirement keywords follow RFC 2119.

Scenario grammar: each scenario carries exactly one `WHEN` line and one `THEN` line, with an optional `GIVEN`.

## Table cells keep their table layout

### R1310-1: No table cell has a non-table display

A CSS rule whose last selector compound names a class applied to a `<td>`, `<th>` or `<tr>` in `app.js` MUST NOT set `display`.

#### Scenario: A chip class on a cell is refused
- **GIVEN** `app.css` carries `.decision-title { display: inline-block; }` and `app.js` applies `decision-title` to a `<td>`
- **WHEN** the table-cell scan runs
- **THEN** it fails and names `.decision-title`

### R1310-2: Chips are inner elements

The Decisions status chip and the Anti-patterns scope chip MUST be `<span>` elements inside their `<td>`; the Memory actor stack MUST be a `<div>` inside its `<td>`. The `<td>` itself carries only a `-cell` class.

#### Scenario: The status chip is a child of its cell
- **WHEN** `renderDecisionRow` builds a readable row
- **THEN** the status `<td>` has class `decision-status-cell` and contains a `<span class="decision-status status-...">`

### R1310-3: Row cells match the header

A readable Decisions row MUST have five cells and a readable Anti-patterns row four, matching their headers; an unreadable row keeps its single `colspan` cell.

#### Scenario: Cell counts
- **WHEN** the row builders are scanned
- **THEN** `renderDecisionRow` creates one spanning plus five readable `<td>`s and `renderAntiPatternRow` one spanning plus four
