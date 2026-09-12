# Archive Report — #920 lane ship reconciliation

**Archived**: 2026-09-12
**Method**: `npm run brain:change:archive -- issue-920-ship-reconcile` (native verb, no manual `git mv` needed — the verb ran cleanly on the first attempt).
**Result**: moved `openspec/changes/issue-920-ship-reconcile/` → `openspec/changes/archive/920/`, including `verify-report.md`. No `openspec/specs/**` capability entry was created or modified (per proposal's own ruling — the memory lane carries no `openspec/specs/**` capability by prior repo convention).

## Verify outcome carried into archive

PASS. 30/30 tasks complete. All ten named spec scenarios measured green on
branch `docs/issue-920-archive` @ `8ec69885`:
- `ship.test.mjs` 38/38, `ship.integration.test.mjs` 7/7,
  `day-start-sweep.test.mjs` 17/17, `cli.ship.test.mjs` 23/23,
  `chunk-boundary.test.mjs` 15/15 (collateral line re-pin).

No CRITICAL or WARNING findings. Full report: `verify-report.md` in this
directory; also persisted at engram topic_key
`sdd/issue-920-ship-reconcile/verify-report`.

## Epic tracker

`openspec/changes/issue-864-memory-2-0/tasks.md` item 4.6 (`#920`) was
already ticked `[x]` by the apply batch — confirmed, not re-ticked. No other
epic line touched.

## Scope discipline

Nothing in this archive pass touched `brain/core/**`, `brain/project/**`, or
`openspec/specs/**`. No push, no PR, no `gh` write call was made.
