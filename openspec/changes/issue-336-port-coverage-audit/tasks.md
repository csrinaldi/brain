---
issue: 336
phase: tasks
---

# Tasks — #336

```brain-slice-scope/1
{"slice": 1, "claims": ["R336-1", "R336-2", "R336-3", "R336-4"], "terminal_pr": "this PR -> main"}
```

- [x] T1. Pure `buildReport` + verb/provenance/consumer folds; tests for the
      four requirements including `mixed` and `unreadable`.
- [x] T2. `gather()` + CLI (`--json`), wired as `brain:port:coverage`.
- [x] T3. Run it on the real tree; confirm every github.mjs verb appears and
      `prReviews` reads as the ticket predicts (or report what is true instead).
- [x] T4. Staged, full suite, PR, cold review to APPROVE.
