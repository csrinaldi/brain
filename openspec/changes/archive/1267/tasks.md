---
status: approved
issue: 1267
---

# Tasks — epic-drawer-closed-count-claim (issue 1267)

- [x] 1. RED: `rollupNote` tests in `rollup-model.test.mjs` (counted, stale, each uncounted state, not-ok rollup).
- [x] 2. GREEN: add `rollupNote` to `rollup-model.mjs`.
- [x] 3. RED: render tests in `rollup-render.test.mjs` for pending, disabled, failed-no-data and unread closed list; the counted case keeps the note.
- [x] 4. GREEN: `renderChildren` appends the note only when `rollupNote` is non-null.
- [x] 5. Annotate D59, D60 and Risks in #1199's design.
- [x] 6. Sweep the UI for the same class; `npm test`, `brain:repo:check`, `brain:nav`, mutation checks.

## Micro-decisions

- D108 to D111 in design.md.
