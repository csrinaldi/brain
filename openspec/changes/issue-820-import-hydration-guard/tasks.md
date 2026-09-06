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
- [x] 1.8 Cold review rev 1 (PR #872, REVISE) addressed as one work unit: (cold-1, blocker — reproduced by the reviewer) acquisition is now ONE atomic `rename` of a staged directory that already carries `owner.json`, so a lock never exists without its owner; reclaim of a stale lock is verified (rename aside → re-read → remove only if unchanged, else rename back); an owner-less foreign directory is reclaimed only once the directory itself is older than `staleMs`. (cold-2) the comment at the import site no longer sells in-process synchronicity as the cross-process property. New `hydration-guard.processes.integration.test.mjs`: six real processes, concurrently, 25 rounds each — no overlapping holds, contention required (held 30, refused 120).
- [x] 1.9 Found by 1.8's process test: `release()` as an in-place recursive `rmSync` leaves the lock path as an EMPTY directory between unlink and rmdir, which a POSIX rename from another process silently replaces — the releaser then fails `ENOTEMPTY`. Release is now rename-aside + verified-ours + remove, never throws.
- [x] 1.10 Cold review rev 2 (APPROVE with a correction): private staging/tombstone siblings orphaned by a kill between two steps are swept on acquire once older than `staleMs`; design.md D3 no longer names an `_fs` seam the module never had.

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
