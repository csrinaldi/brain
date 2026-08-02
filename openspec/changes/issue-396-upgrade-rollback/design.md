---
status: design
issue: 396
epic: 313
artifact_store: openspec
topic_key: sdd/issue-396-upgrade-rollback/design
---

# Design — Rollback / atomic apply for `brain:upgrade` (issue 396)

## §1 — The shape of the problem, measured

| Fact | Value | Source |
|---|---|---|
| Write loop | two sequential loops, no staging | `installer.mjs:184-196` (pre-change) |
| Managed payload | 366 files, 13 globs | `brain/core/managed-paths.mjs:39-61` |
| Write duration | ~23 ms | measured on this repo |
| Existing guards | `--dry-run`, `--abort-on-collision`, `.brain-source` | all gate whether the loop STARTS |

None of the three guards protects a failure *during* the loop. That is the whole gap.

## §2 — Why atomicity was rejected

`rename(2)` is atomic for one path. The managed payload spans `brain/**`, `.github/**`,
`.gemini/**` and loose root files — four disjoint locations, no common parent to swap.
Stage-and-swap therefore decomposes into N non-atomic renames: the same exposure in a
shorter window, at the cost of a full second copy of the payload.

**Decision: restore point, not staging.** Snapshot before, restore on failure. See
`brain-drafts/adr-0027-*` for the exit-criterion restatement this implies.

## §3 — Why the signal handlers are not what they look like

Node delivers signals through the event loop, so a JS handler cannot pre-empt synchronous
code. Measured directly:

| Loop | SIGINT at ~40 ms of a 935 ms loop | Result |
|---|---|---|
| synchronous | `LOOP_END i=60000 aborted=false`, handler ran after | ran to completion |
| `setImmediate` yield every 50 | `ABORTED_AT 2251` | interrupted |

Consequences that shaped the design:

1. A handler cannot abort the write. What it does is **suppress the default terminate
   action**, which is the only thing that can actually half-apply the tree. The 23 ms
   batch then completes and the tree is whole.
2. **The window that matters is the package install, not the copy** — seconds versus
   milliseconds.
3. But a signal during that install kills the *child*, and `spawnSync` returns
   `{ status: null, signal }` **synchronously**. A deferred-flag check placed after it is
   therefore dead code on that path: `if (r.status !== 0)` fires first. This was got wrong
   in the first revision and is corrected — the install step tests `r.signal` **before**
   `r.status` and exits `128+signal`.

## §4 — Restore-point semantics

Three categories, decided at snapshot time:

| Dest state | Recorded as | Rollback action |
|---|---|---|
| present — regular file, **or a symlink resolving inside `destRoot`** | `saved` — bytes copied to the snapshot dir | copy back |
| absent | `created` | delete; prune directories the write had to create |
| resolves **outside** `destRoot` (leaf or any ancestor) | `escaping` | **refuse the whole run** |
| **dangling** symlink | `dangling` | **refuse the whole run** |

**Presence is judged with `lstat`, never `existsSync`.** `existsSync` follows links, so a
dangling symlink reads as absent → recorded as `created` → **deleted** on rollback. That is
the feature corrupting the very thing it exists to protect, so the distinction is
load-bearing.

**The boundary is escaping the repo, not being a symlink.** An earlier revision refused every
symlink, on the premise that "the write lands outside `destRoot` where no rollback can reach".
That premise is false for a link pointing inside the repo, and it was measured: `copyFileSync`
follows the link on the snapshot, on the write and on the restore, so the target returns to
its original bytes with the link itself untouched. Refusing those would soft-lock any consumer
using `AGENTS.md -> CLAUDE.md` — a managed path, and the canonical agent-interop symlink.

What genuinely cannot be covered is a write landing outside `destRoot`, since the snapshot
lives inside it. `escapesRoot()` resolves the **whole path**, so a symlinked ancestor
directory is caught too; a leaf-only test never sees that case.

## §5 — Failure judged by outcome, not by whether a call threw

`restore()` is best-effort per path — one unrecoverable entry must not strand the others.
`rmSync(..., { force: true })` suppresses `ENOENT` but **not** `ENOTDIR`, so a managed path
whose parent exists as a file would otherwise abort the whole restore, and its own throw
would replace the failure being reported.

Success is then judged by **outcome**: is the path still on disk? Judging by "did the call
throw" produced a false positive — a path the write never reached was reported as
unrestored.

## §6 — The snapshot is preserved exactly when the rollback failed

The first revision put `discard()` in a `finally`. `finally` runs after `catch`, so the
snapshot was deleted on the **incomplete-rollback** path — the one branch where it is the
only surviving copy of the consumer's bytes, and the same branch whose CLI message tells
the operator to go and inspect them.

**Only a complete rollback earns the cleanup.** This is why the discard is not a `finally`.
The surviving snapshot's location is reported on the error and printed by the CLI.

## §7 — Annotating the failure cannot be allowed to throw

Modules are strict mode. `err.rollbackIncomplete = failed` throws a `TypeError` when the
thrown value is a string, a frozen `Error`, or `null` — and that TypeError replaces the
real failure *and* drops the dirty-tree signal, so the CLI's `else` branch reports a clean
rollback over a dirty tree. `specialMerge` is caller-supplied on an exported API, so a
non-`Error` throw needs no brain-side bug to reach.

`annotateRollback()` therefore mutates the error only when it can, and otherwise returns a
wrapper carrying the original as `cause`. Identity is preserved whenever possible, so the
"re-thrown unchanged" contract still holds for the ordinary case.

## §8 — Deterministic write order

`toMerge` and `toCopy` are sorted before use. Two reasons: a partial failure lands at a
reproducible point (so a bug report reproduces), and the journal slice needs a defined
replay order. It also makes the write order match the sorted arrays the function already
returned.

## §9 — What is deliberately NOT covered

| Gap | Why | Where recorded |
|---|---|---|
| SIGKILL / power loss | no in-process handler runs; needs a journal | slice 2, REQ-396-9 |
| The dependency install (step 1) | rewrites `package.json`, lockfile, `node_modules/` **before** any snapshot exists | `KNOWN-LIMITATIONS.md` |
| The config migration (step 3) | `brain.config.json` is a `local` path, outside `relPaths` | `KNOWN-LIMITATIONS.md` |
| Symlinked managed paths | refused, not supported | `KNOWN-LIMITATIONS.md` |
| `.brain-upgrade-backup` not gitignored | `.gitignore` is not managed; adding it is **Tier 2** | needs a ticket |

The CLI's success-path message is scoped to match: *"Every managed path was rolled back to
the bytes it had before the copy. The dependency install was NOT reverted."* Saying "the
tree is unchanged" there would be false.

## §10 — Slice boundary

Slice 1 ends at in-process rollback. Slice 2 adds the journal, and **must invert**
`createRestorePoint`'s entry-time `rmSync` of a pre-existing snapshot: correct now (nothing
reads it, so carrying it forward could only restore stale bytes), fatal then (a leftover
snapshot becomes the evidence recovery replays). Flagged in an inline comment at that line.
