# Tasks — issue-1029-parent-value-region

- [x] T1 — RED: `epic-map.test.mjs` gains #998's real body shape (one `Parent:` line naming four other issues in prose → parent 878, no divergence) and the bare-whitespace list case (`Parent: #878 #879` → still ambiguous).
- [x] T2 — GREEN: `PARENT_PROSE_LINE` becomes `PARENT_PROSE_VALUE`, capturing the key's value region; `parentFromProse` counts references inside the capture, never across the line. The doc comments say why the old end-of-line rule existed and what replaces it.
- [x] T3 — Mutation: the value region restored to `.*` (the old rule) turns exactly the #998-shaped test red; reverted.
- [x] T4 — Measured after the fix against the real forge body of #998: `{parent: 878, parentSource: 'prose', divergence: null}`.
- [x] T5 — Full suite and `brain:repo:check` green; proposal, spec, tasks and apply-progress written.
