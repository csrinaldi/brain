# Issue #361 — index self-healing is backend-asymmetric

## What

Add cross-backend test coverage pinning that `share()` and the `pull` path
reindex `.memory/index.jsonl` **unconditionally** on both `plainfiles` and
`engram` — the property #361 asked for — plus two missing unit tests on
`pullMemory()`'s own reindex step (issue #574), which had zero test coverage
before this change despite existing in production code.

**No production code changes.** Every behavior the ticket's Acceptance
section asks for was already true on `main` before this change started; see
"Ticket framing vs. current code" below.

## Why

Filed 2026-07-29 against a real asymmetry: `engram.share()` reindexed only
when `dualWriteRecords()` had appended ≥1 record, and `engram.pull()` never
reindexed at all (it was a thin `engram sync --import` chunk wrapper). Two
*independent* efforts have since closed both gaps:

- `pull`'s reindex step landed with issue #574 (commit `a029ed0a`,
  2026-08-13) — `pullMemory()` gained "Step 3: rebuild the derived index from
  the just-merged records/", unconditionally, between `git pull` and
  `importMemory()`.
- `share`'s unconditional reindex landed with issue #874 split B (commit
  `56de7408`, 2026-09-11 — literally the day before this ticket was worked)
  — `engram.share()` was reshaped into the `plainfiles.share()` mirror:
  `_ensureSymlink(root)` → `rebuildIndex()` → `{indexCount, duplicates}`, no
  conditional, no `dualWriteRecords()` call at all.

Neither landing cites #361; both were driven by their own tickets (#574,
#874). The asymmetry is gone, but nothing proved it stays gone — that's the
actual gap this change closes.

## Ticket framing vs. current code (say explicitly if stale)

**The ticket's framing is stale.** Its comparison table:

| Verb | `plainfiles` | `engram` (per ticket) | `engram` (current, verified) |
|---|---|---|---|
| `share()` | reindexes unconditionally | reindexes only if ≥1 record appended | **reindexes unconditionally** (`engram.mjs` `share()`, #874 split B) |
| `pull()` | reindexes unconditionally | never reindexes | **reindexes unconditionally**, between `git pull` and `import` (`pullMemory()` Step 3, #574) |

Both of the ticket's three "Decision needed" options are moot as literally
posed — the code already behaves like Option 2 (match `plainfiles`,
unconditional) for both verbs. `memory-backend-contract.md`'s `share` row
already documents this ("commits what is already true... exports nothing
from the backend") and Amendment 2 records the `share()` landing explicitly.
The contract's `pull`/`hydrate` row is written in terms of the bulk-vs-single
record split (#862/#874 3.2) and doesn't call out the reindex step by name,
but the code comment at `pullMemory()` Step 3 does: "`plainfiles.pull()` has
always been `git pull` + reindex; both backends now say the same thing about
the same store."

## Ruling (Acceptance item 1)

Given the above, the ruling is: **ratify Option 2 retroactively** — both
backends reindex unconditionally on `share` and on the `pull` path, matching
`plainfiles`. No new documentation is needed in `memory-format.md` (Option 3
does not apply — there is no remaining intentional asymmetry to document).

## Non-goals

- No change to `engram.pull()`'s own `{root}` bound (documented, pre-existing,
  unreachable today — see `cli.mjs` comment at `ROOTED_OPS`). Out of scope
  for #361; flagged here only because it surfaced while reading the pull path.
- No retirement of `dualWriteRecords()` (epic task 2.4) or rule 3 (manifest/
  symlink/chunks) work (epic tasks 2.3/2.4). Untouched by this change.
- No change to `engram.pull.test.mjs`'s existing tests (a)-(c)/(e), which
  predate this change and rely on the production `_rebuildIndex` default
  against the real repo root (harmless because `rebuildIndex` is
  deterministic and idempotent — no diff results) — noted, not fixed, to
  avoid unrelated scope creep.

## Acceptance (mapped to the ticket)

- [x] A ruling recorded (above).
- [x] Both backends behave the same on index rebuild (already true, verified
      against source — see mutation table in `apply-progress.md`).
- [x] Contract-parity coverage added: `backends/reindex-parity.test.mjs`
      (cross-backend) plus two new tests in `backends/engram.pull.test.mjs`
      pinning `pullMemory()`'s own reindex step, which had none before.
