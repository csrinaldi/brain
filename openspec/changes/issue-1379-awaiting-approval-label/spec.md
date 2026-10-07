---
status: approved
issue: 1379
---

# Spec — awaiting-approval-label (issue 1379)

## Requirements delta

**R1379-1.** The label of state `awaiting-review` is `Awaiting approval`, from the single table in `state-vocab.mjs`. Every surface that draws a state word (card chip, drawer head, legend, Roadmap row and their title attributes) therefore reads it.

**R1379-2.** The code `awaiting-review`, its CSS classes, tokens, glyph `◇` and its precedence are unchanged.

## Scenarios

- GIVEN an open issue without `status:approved`, WHEN the board renders, THEN its card chip reads `◇Awaiting approval`, the drawer head and the Roadmap row (`◇ Awaiting approval`) agree, the legend lists it, and no text or title contains "Awaiting review".
- GIVEN the state table, THEN the code is `awaiting-review` and the class `status-awaiting-review`.
