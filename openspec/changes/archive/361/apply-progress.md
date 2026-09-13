# Apply Progress — issue #361 reindex parity

## Status

9/9 tasks complete. All new tests GREEN. Full suite GREEN at
5316/5316 (baseline 5311 + 5 new tests). Ready for verify.

## Ticket framing verdict

**Stale.** Both asymmetries #361 named were independently closed before this
change started:

| Fix | Commit | Date | Landed via |
|---|---|---|---|
| `pull` reindex (Step 3 of `pullMemory()`) | `a029ed0a` | 2026-08-13 | issue #574 |
| `share` unconditional reindex | `56de7408` | 2026-09-11 | issue #874 split B |

Issue #361 was filed 2026-07-29 — before either fix. See `proposal.md` for
the full comparison table and ruling.

## Files changed

| File | Action | What |
|---|---|---|
| `brain/scripts/memory/backends/engram.pull.test.mjs` | Modified | Added tests (f) and (g): `pullMemory()` reindexes between `git pull` and `import`, unconditionally, with the same `recordsDir`/`indexPath` shape as `plainfiles.pull()`. Updated header comment. |
| `brain/scripts/memory/backends/reindex-parity.test.mjs` | Created | 3 cross-backend tests: `share()` unconditional parity, pull-path unconditional parity, shared `recordsDir`/`indexPath` derivation shape. |
| `openspec/changes/issue-361-reindex-parity/{proposal,tasks,apply-progress}.md` | Created | This change's artifacts. |
| `openspec/changes/issue-864-memory-2-0/tasks.md` | Modified | Ticked epic task 4.1. |

No files under `brain/scripts/memory/backends/engram.mjs` or
`plainfiles.mjs` were changed — production behavior was already correct.

## TDD Cycle Evidence / Mutation Table

Strict TDD mode active. Since production code already implemented the
correct behavior (found during Step 2 investigation, before writing any
test), RED was proven via **mutation**: temporarily reintroduce each bug
the ticket named, confirm the new test(s) — and ONLY those — go red, then
restore byte-identical (`diff` confirmed) and confirm GREEN.

| # | Mutation (simulates) | Test(s) that must die | Result |
|---|---|---|---|
| A | `engram.share()`: gate `_rebuildIndex` behind `appendedAtLeastOne = false` (pre-#874 conditional-reindex bug) | `reindex-parity.test.mjs` share test + all 3 pre-existing `engram.share.test.mjs` tests that assert unconditional call/shape | **RED**: 4 failed, exactly those 4 (`pass 4 / fail 4` out of 8 in the targeted run). Pull-path and shape tests stayed GREEN. |
| B | `pullMemory()`: delete Step 3 (`_rebuildIndex` call), hardcode `count = 0` (pre-#574 never-reindexes bug) | `engram.pull.test.mjs` (f), (g) + `reindex-parity.test.mjs` pull-path test | **RED**: exactly 3 failed (`pass 12 / fail 3` out of 15 in the targeted run) — tests (a),(b),(c),(e) and the share-related tests stayed GREEN, proving the mutation's blast radius matched its actual scope. |
| — | Restore (both mutations reverted) | — | `diff /tmp/engram.mjs.bak engram.mjs` → **IDENTICAL**. All 15 targeted tests GREEN. Full `npm test` → 5316/5316 GREEN. |

Each mutation was applied and reverted independently (never both at once),
per the "revert ONE at a time" instruction.

## Test counts (GIT_CONFIG_GLOBAL=/dev/null isolation)

- Targeted (`engram.pull.test.mjs` + `engram.share.test.mjs` +
  `reindex-parity.test.mjs`): 15/15 pass.
- Full `npm test`: 5316/5316 pass, 0 fail (origin/main baseline under
  identical isolation: 5311/5311 — delta is exactly the 5 tests added:
  2 in `engram.pull.test.mjs`, 3 in `reindex-parity.test.mjs`).
- `.memory/index.jsonl` / `.memory/manifest.json`: confirmed untouched
  (`git status --porcelain .memory/` empty) before and after every test run
  in this change — all new tests inject `root` + `_rebuildIndex` seams.

## Deviations from design

None — there was no separate `design.md` for this change; the ruling lives
in `proposal.md` per the ticket's own request ("recorded in the change's
design"). Scope was proportionate: test-only change, no production code
touched, because none was needed.

## Issues found (out of scope, noted per instructions)

- `engram.pull()` (the zero-arg wrapper calling `pullMemory()`) and
  `engram.setup()` ignore any `{root}` argument `cli.mjs` passes them — a
  pre-existing, already-documented bound (`cli.mjs` comment at
  `ROOTED_OPS`, "Not reachable today"). Unrelated to #361's reindex-parity
  question; not touched here.
- `engram.pull.test.mjs`'s pre-existing tests (a)-(c)/(e) call `pullMemory()`
  without injecting `root`/`_rebuildIndex`, so they exercise the REAL
  `rebuildIndex` against this checkout's real `.memory/records/` (harmless
  today because `rebuildIndex` is deterministic/idempotent — confirmed no
  diff results — but not properly isolated). Left as-is; new tests in this
  change always inject the seam.
