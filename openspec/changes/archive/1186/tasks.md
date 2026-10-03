# Tasks (#1186, #1187)

- [x] Red/green: slug, default-branch (real git, `origin/HEAD` unset), npm-test applicability (`lib/local-gate-context.test.mjs`)
- [x] Red/green: brain-check (a) slug reaches the port, (c) `[N/A]` npmTest, (d) `lite` memoryPresence (`brain-check.test.mjs`)
- [x] Red/green: tier x fixture parity against CI `main()` and `CI_COUNTERPART` guard (`local-ci-parity.test.mjs`)
- [x] `runCheckWithPolicy` in `run-check.mjs`, shared by `main()` and `brain:check`
- [x] Red/green: hermetic fresh-consumer e2e, `mrCreate` reaches the fake port (`brain-ship.fresh-consumer.e2e.test.mjs`)
- [x] Extract `lib/hermetic-box.mjs` from `bootstrap.e2e.test.mjs`
- [x] `release-notes.md` guide text (adoption.md is not edited here)
- [x] `brain:check` runs `brain:nav` and `index-lag`; step list derived from governance.yml (PR #1192 review)
