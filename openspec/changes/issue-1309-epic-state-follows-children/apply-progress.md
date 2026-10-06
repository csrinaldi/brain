# Apply progress — issue 1309

All tasks 1.1 to 5.3 done, in strict TDD order.

- Rulings applied: (a) new `Ready to close` state, (b), (c), (d) as recorded in `design.md` (D137, D138 added).
- RED recorded before each GREEN: 10 failing tests in rollup/state-vocab/tokens, 3 in lane/roadmap models, 5 in `static/epic-state-render.test.mjs`.
- GREEN: `rollupFor` and `openChildren` in `rollup-model.mjs`; `stateOf(node, work, rollup)` with `epicProgress`; `epics` option in lane and roadmap models; `currentEpics()` and the Roadmap chip tooltip in `app.js`; `ready-to-close` tokens in the three theme blocks.
- Suite: `npm test` 8195 tests, 8192 pass, 0 fail, 3 skipped. `brain:repo:check` and `brain:nav` clean. Publish allowlist canary passes (906 files, 10.23 MB unpacked).
- Gated diff vs origin/main: 150 changed lines (104 added, 46 removed) across six non-test files.
- Mutations (each failed a test, then reverted): 17/39 reads Planned; all-closed reads In flight; closed:null with an in-flight child reads Not computed; unresolved>0 with zero closed reads Planned.
