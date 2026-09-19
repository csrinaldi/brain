# Tasks — issue-1072-size-exception-parity

- [x] T1. `sizeExceptionRuling` + `SIZE_EXCEPTION_LABEL` in `vcs/governance-tiers.mjs`, three states kept apart (R1072-1).
- [x] T2. `governance/run-check.mjs` reads the ruling instead of deciding it (R1072-1). Behaviour unchanged; its 439 tests pass untouched.
- [x] T3. `review/evaluators/tranche.mjs` applies the ruling before emitting `budget` (R1072-2), with the waived case stated as `editorial`.
- [x] T4. `gatherTrancheInputs` takes `labels` and falls back to `prView`; `review/cli.mjs` hands it `boot.prView.labels` (R1072-3).
- [x] T5. `governance/size-exception-parity.test.mjs` drives both authorities across every tier (R1072-4).
