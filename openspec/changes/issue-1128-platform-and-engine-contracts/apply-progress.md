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
