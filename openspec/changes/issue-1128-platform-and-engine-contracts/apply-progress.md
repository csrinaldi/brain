# Apply progress — #1128 + #1129

Strict TDD. Each row: the RED observed first, then the GREEN.

## S1 — descriptors and the registry
| task | red (observed) | green |
|---|---|---|
| 1.1/1.2 registry | `runtime-registry.test.mjs`: 1 test, module not found | 17 pass after `runtime-registry.mjs` + descriptors |
| 1.3/1.4 descriptors | `descriptors.test.mjs`: 13 fail (files absent) | pass (27 with the registry suite) |
| 1.5/1.6 adapter url | `harness-adapter-url.test.mjs`: `base` ignored, 1 fail | 3 pass |
| 1.7/1.8 axis-config | 3 new cases fail (literals, no `registry` option) | 41 pass |
| 1.9 rank (Q2) | covered by the registry order test and the unchanged "claude first (#1125)" pins | 22 + 41 pass, pins untouched |
| 1.10 guard filter | `axisValues()` pin fails (`claude.descriptor` etc. leaked into the values) | 15 pass |
| 1.11 re-own | allowlist owner `#1114` -> `#1367` (Q3) | guard 15 pass |
| 1.12 | `harness/cli.test.mjs` (#682 graph walker) 22 pass | |

## S2 — the review-engine contract (#1129)
| task | red (observed) | green |
|---|---|---|
| 2.1/2.2 `stage-output` | `stage-output.test.mjs`: module not found | 14 pass |
| 2.3 engine parity | `contract.test.mjs`: 5 fail — (e) claude, (e) gemini, (f) codex, (g) codex, (g) gemini. (f) codex is the latent `..x` escape: codex's `isWithin` read `/c/..x` as outside the candidate and SPAWNED | (e)/(f) green after 2.4-2.6; (g) after 2.11 |
| 2.4 claude | (e) red: first raw stderr line, no redaction | `engineTail` on every failure branch; pin `run-stage.test.mjs:60` updated |
| 2.5/2.6 codex, gemini | (f) codex red above | copies deleted, models from descriptors; gemini's `canonicalPath`/`isWithin` tests moved to `stage-output.test.mjs` |
| 2.7/2.8 runner | 4 new cases fail (declared mode ignored, `plain`/unknown reach the seam, gemini rename says Codex) | 44 pass; pin `:255-261` now `claude`/`gemini` |
| 2.9 | guard: `STALE review/lib/run-cold-review-stage.mjs axis-branch` | entry deleted |
| 2.10-2.12 readiness | `harness/readiness.test.mjs`: module not found | 12 pass; `git mv` x4, leaves export `checkReadiness`, resolvers/loadConfig/main deleted |
| 2.13 (g) parity | codex and gemini red until the move | green |
| 2.14 shell | `bash -n` both scripts | `bootstrap.sh`, `install-tools.sh` call `harness/readiness.mjs` only |
| 2.15 e2e | n/a (import of a deleted file) | `codex-route.e2e.test.mjs` 2 pass |
| 2.16 | guard red `STALE` x4 after the move | 4 entries deleted, 24 entries left |

Unplanned: the four deleted `harness/*-readiness*` paths are added to `lib/retired-paths.mjs`, so `brain:upgrade` removes them from a consumer (Q6 deletes with no shim; without this the stale files would survive every upgrade).
Deviation: the parity bodies live in `__fixtures__/engine-parity.mjs` (and `platform-parity.mjs`), not exported from `contract.test.mjs`: importing a `.test.mjs` would run its tests a second time.

## S3 — the agent-platform contract (#1128)
| task | red (observed) | green |
|---|---|---|
| 3.1 platform parity | `axes/platform/contract.test.mjs`: 4 fail — (b) claude, (b) antigravity, (b) plain (no `ok`), (e) antigravity (malformed settings reported with no `ok`) | 24 pass |
| 3.2 claude `init` | claude.test.mjs 2 new cases fail (write throw read as success; no `ok:true`), verified by stashing the change | 16 pass (Q1: write throw -> `ok:false`) |
| 3.3 antigravity `init` | parity (b)/(e) red above; pins `2.1`, `1.5`, `2.4`, `REQ-1139-5` fail on `deepEqual`/"no ok" | `ok` + `reason`, additive fields kept; pins rewritten (1.5 now asserts ok:false on a write failure and ok:true on an unreadable doc) |
| 3.4 plain | parity (b) red | `{ok:true}` |
| 3.5 CLI | `cli.test.mjs`: antigravity + malformed `.gemini/settings.json` exits 0 (red, verified with antigravity.mjs stashed) | exits 1, names the file, byte-identical; claude init exits 0 and a malformed `.claude/settings.json` exits 1. Scratch consumer = a copy of `brain/scripts` (tests excluded) under a temp root, because the CLI cannot be given a root |
| 3.7 scaffold | characterisation: green on arrival (its red state is the tree before S1, where no registry or `base` existed) | 19 pass: registry, validate, resolve, platform parity on `zed`, engine parity (a)(d)(f) on `zed-engine`, `runColdReviewStage` ok through a seam that loads from the temp base |
