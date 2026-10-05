# Apply progress — issue 1267

All six tasks done (6/6). Strict TDD.

- RED: `rollupNote` tests failed on the missing export; 5 render tests (pending, pending with reason, disabled, failed with no data, unread closed list) failed with the note present. The counted and stale-count render tests passed as controls.
- GREEN: `rollupNote` in `lib/rollup-model.mjs`; `renderChildren` renders it only when non-null.
- Mutations caught: dropping the null guard in app.js (4 render failures, after adding an assertion for an empty note element), forcing `rollupNote` to always return the sentence (6 failures), removing the `!rollup.ok` guard (1 failure).
- #1199 design D59, D60, the residual paragraph and Risks annotated "Amended by #1267".
- Class sweep: `app.js` fixed sentences next to nullable values were reviewed. `no ticket cites it` (app.js:1558) is driven by an empty list, a fact about declarations. `no open ticket declares this one as its parent` states open tickets only. `rollupLabel` words every state. No other instance.
- `npm test`: 7598 tests, 7595 pass, 0 fail (3 skipped). `brain:repo:check` and `brain:nav` clean.
