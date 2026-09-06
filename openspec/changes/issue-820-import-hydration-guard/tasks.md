---
status: applying
issue: 820
---

# Tasks: #820 — hydration guard

- [x] 1.1 RED: `hydration-guard.test.mjs` — acquire/release; contended-by-live-pid → `{held:false, owner}`; stale by dead pid → reclaimed; stale by age → reclaimed; fn throws → released.
- [x] 1.2 RED: `engram.import.test.mjs` — the #820 shape: importer B fired from inside A's `_engramExistingTopicKeys` seam returns `contended`, `_engramImport` called once; contended path warns on stderr and writes nothing.
- [x] 1.3 GREEN: `brain/scripts/memory/lib/hydration-guard.mjs`.
- [x] 1.4 GREEN: wire `_guard` into `importMemory`; acquire before the first `await`; release in `finally`.
- [x] 1.5 i18n `memory.import.contended` in `en.mjs` and `es.mjs`.
- [x] 1.6 Amend the header at `engram.mjs:917-940`: twin hazard; mitigation vs fix (#863); the D2b note that plainfiles needs no guard.
- [x] 1.7 `npm test`, `brain:repo:check`; session record via `memory:save --issue 820`; tick 0.1 in `issue-864-memory-2-0/tasks.md`.

## Measured while applying
- The #820 shape, live: two `cli.mjs import` started concurrently against the real store — A `import complete — 0/2349`, B `another hydration is running (pid …) — import SKIPPED` on stderr, no lock left behind, `memory:audit` backend row unchanged (2368/2365, the same three duplicates).
- Tests that fake the backend must fake the guard too (`_guard: noGuard`): a faked backend has no store to protect, and a test taking the real machine guard could make a real `session:start` report contended. 19 call sites across four test files; `pullMemory` tests already fake `_import` whole.
- The critical section is synchronous end to end (acquire → read → build → write → release); the i18n `await`s happen after release. That is what lets the #820-shape test fire importer B from inside A's read seam.

## Review Workload Forecast
- Estimated changed lines: ~130 non-test + ~150 test (ignore-listed).
- 400-line budget risk: Low.
- Chained PRs recommended: No.
- Decision needed before apply: No.

## Micro-decisiones en caliente
- Lock path in `os.tmpdir()`, not `.memory/` and not `~/.engram/` (design.md D1).
- The detector for duplicated backend keys is `memory:audit` (#870), already shipped — this slice stays a guard.
