# Tasks — issue-1072-size-exception-parity

- [x] T1. `sizeExceptionRuling` + `SIZE_EXCEPTION_LABEL` in `vcs/governance-tiers.mjs`, three states kept apart (R1072-1).
- [x] T2. `governance/run-check.mjs` reads the ruling instead of deciding it (R1072-1). Behaviour unchanged; its 439 tests pass untouched.
- [x] T3. `review/evaluators/tranche.mjs` applies the ruling before emitting `budget` (R1072-2), with the waived case stated as `editorial`.
- [x] T4. `gatherTrancheInputs` takes `labels` as an input and NEVER fetches them (R1072-3). `review/cli.mjs` hands it `boot.prView.labels ?? null`; `evaluators/checkpoint.mjs` forwards the `labels` it already takes.
- [x] T6. The `prView` fallback, written for T4 and reverted: it made the gather reach the network, so CI went red on a test that passed locally. Pinned by a seam that throws if the forge is called.
- [x] T5. `governance/size-exception-parity.test.mjs` drives both authorities across every tier (R1072-4).
- [x] T7. Every consumer of a label set survives an unread one (R1072-5): `evaluators/checkpoint.mjs` and `review/mode.mjs`, each pinned by a mutation.
- [x] T8. `gatherCheckpointInputs` defaults `labels` to `null`, not `[]` (R1072-5).
- [x] T9. Both authorities interpolate `SIZE_EXCEPTION_LABEL` in their reasons and evidence; a scan refuses an executable literal (R1072-6).
- [x] T10. `deriveMode` carries no `labels` default at all; the `Array.isArray` guard is the single statement (R1072-5).
- [x] T11. The budget block resolves the tier once and every sentence uses that value; pinned by scan, because no behavioural mutation can reach the divergence (R1072-2).
