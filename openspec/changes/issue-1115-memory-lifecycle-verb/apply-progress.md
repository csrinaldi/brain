# Apply progress — #1115 (folds #1189)

Strict TDD. Single test files run with `node --import ./brain/scripts/lib/test-brain-home.mjs --test <file>`.
Rulings Q1-Q4 (2026-10-05) are folded into spec/design/tasks first (commit `docs(openspec): record the Q1-Q4 rulings…`).

## T0, T1b, T1 — read-only verify, store, adapters, i18n keys
| step | RED (before code) | GREEN |
|---|---|---|
| 1b.1-2 `store.verify-index.test.mjs` | `SyntaxError: The requested module './store.mjs' does not provide an export named 'verifyIndex'` (1 file failed) | 6/6 pass, plus `store.test.mjs` 26/26 (rebuildIndex refactor onto `buildIndex` is behaviour-neutral) |
| 1.1-1.3 `engram.hydrate.test.mjs` bulk | 6 of 16 failed (`not ok 10..15`, every bulk case) | 16/16; engram suite 114 tests, 0 fail |
| 1b.3-4, 1.4-1.5 `plainfiles.hydrate.test.mjs` | the file failed to load (no `hydrate` export) | 6/6; plainfiles suite 68/68 |
| 1.6 i18n (`coverage.test.mjs` new #1115 tests + re-pinned keys) | 5 of 52 failed | 52/52; `i18n/*.test.mjs` 75/75 |

## T2 — dispatcher
| step | RED | GREEN |
|---|---|---|
| 2.1 `cli.hydrate.test.mjs` | import error, then (with `EXIT_DEFERRED` added) 9 of 11 failed: hydrate/import/verify/exit 6/refusals | 11/11 |
| 2.5 pins (`backend-fallback` import → exit 6, `backend-declaration` lists + `hydrate`, `backend-selection` no `importMemory` map and `!FALLBACK_OPS.includes('hydrate')`) | n/a (pins updated with the behaviour) | `memory/*.test.mjs` + `backend-selection` 293/293 |
| `chunk-boundary.test.mjs` line-keyed allowlist | 1 failed (cli.mjs line 792 became 797) | re-keyed, 15/15 |
