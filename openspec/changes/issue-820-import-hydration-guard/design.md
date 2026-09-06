---
status: applying
issue: 820
---

# Design: #820 — hydration guard

## D1 — where the guard lives: a machine-scoped path, not the tree

The contended resource is the backend store — one per machine — and sixty worktrees share
it. A lock under `.memory/` would be per-worktree and guard nothing. The guard is a
directory created with `mkdirSync` (atomic, `EEXIST` on contention) at
`join(os.tmpdir(), 'brain-memory-hydration.lock')`, holding `owner.json` `{pid, startedAt}`.

Rejected: a lock beside engram's DB (`~/.engram/…`) — that is the adapter's private
directory and the guard must not assume its layout (#863's no-artifact rule applies in both
directions).

## D2 — contention skips; staleness reclaims

- Held by a live pid, younger than `staleMs` (default 10 min): **skip**. `importMemory`
  returns `{written: 0, skipped: 0, deferred: true, contended: true, duplicates}` and warns
  via `memory.import.contended` — to stderr, the channel `post-merge` keeps (#633).
- Owner pid dead (`process.kill(pid, 0)` throws `ESRCH`) or age > `staleMs`: reclaim (remove,
  retry acquire once) and proceed.
- Acquire is synchronous and happens **before the first `await`** on the hydration path, so
  a second importer reaches its contended branch without yielding — which is what makes the
  #820-shape test expressible with the existing sync seams.

## D2b — the guard lives inside the adapter that needs it

The agnosticism test (#864 spec, first requirement): under `MEMORY_BACKEND=plainfiles`,
`import` is `rebuildIndex` — idempotent by construction, the vacuity row. No guard is needed
there and none is applied: the guard is wired into `engram.mjs#importMemory` only. It is
mitigation for one adapter that violates #863's idempotent-hydration rule, not a property
of memory.

## D3 — the module is pure; the wiring is one seam

`hydration-guard.mjs` exports `withHydrationGuard(fn, {lockPath, staleMs, _fs, _now,
_pidAlive})` → `{held: true, result}` | `{held: false, owner}`. `importMemory` gains a
`_guard` seam defaulting to it. No test spawns a process.

## D4 — the comment is part of the fix

`engram.mjs:917-940` argues one hazard well. The twin gets the same paragraph, and the
sentence *"this guard is mitigation; idempotent hydration by record id (#863) is the fix"*
— so the next reader does not mistake the workaround for the design.

## Delivery

Single PR to `main`. Estimated ~130 non-test lines (guard ~60, wiring ~30, comment ~20,
i18n ~4, SDD artifacts). Tests on the ignore list. Strict TDD: guard tests and the
#820-shape test are RED first.
