---
status: approved
issue: 1267
---

# Design — epic-drawer-closed-count-claim (issue 1267)

## Technical approach

The wording decision moves into the pure model. `app.js` renders what the model returns.

```
renderChildren(issue)
  rollup = epicRollup(hierarchy, forgeLoad, issue)
  p.epic-rollup = rollupLabel(rollup)
  note = rollupNote(rollup)          NEW, lib/rollup-model.mjs
  if (note !== null) p.note = note
```

This continues #1199's numbering after #1276's D93.

## Decisions

| # | Decision | Rejected | Why |
|---|---|---|---|
| D108 | **`rollupNote(rollup)` returns the sentence only when `rollup.ok && rollup.value.closed !== null`, else `null`.** The sentence text is unchanged. | Word a different note per state | The rollup sentence above already says why nothing is counted. A second sentence would repeat it and add a string per state to keep in step. |
| D109 | **Omit the note, do not replace it.** | "closed children are not counted" | Same reason as D108. The issue's acceptance allows either. |
| D110 | **The gate is `closed !== null`, the same value `rollupLabel` branches on.** | Re-deriving from `load.state` | `closed` already folds `hasClosedData` and `closedRead.ok` (D59/D60 of #1199), so the note and the sentence cannot disagree. |
| D111 | **#1199's design is annotated in place** ("Amended by #1267"), not rewritten. | Silent rewrite | The text records what was believed when it was written. |

## Sweep of the defect class

Fixed sentences in `app.js` and `lib/*.mjs` that claim something was counted or read were reviewed. `app.js:1847` is the only one that sat beside a nullable count. See `apply-progress.md` for the list.

## Risks

An epic drawer in an uncounted state shows no remark about closed children; the sentence above states the gap.
