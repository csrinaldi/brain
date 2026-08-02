# ADR-0027 — `brain:upgrade` Rollback Is Restorable, Not Atomic

**Status**: Accepted  
**Date**: 02/08/2026 - Cristian Rinaldi

> ⚠️ **AMENDED AFTER SIGNATURE — Decision #3 needs re-confirmation.** A second review
> measured the original Decision #3's premise to be false: a symlink resolving *inside* the
> repository round-trips cleanly, so refusing every symlink was wrong, while a symlinked
> *ancestor* directory — which does escape — was passing unnoticed. Decision #3 and its cost
> paragraph now state the real boundary. Two factual corrections came with it ("four disjoint
> locations" was five; the consumer's-own-VCS alternative was unnamed). The signature above
> covers the decision's substance, which is unchanged; **the amended Decision #3 has not been
> separately confirmed.**

## Context

Issue #396 (milestone M4, the hard gate blocking external adopters) states its exit
criterion as:

> Killing `brain:upgrade` at any point between the first and last managed-file write
> leaves the consumer tree byte-identical to the pre-upgrade state.

**That criterion cannot be met as written, and no implementation effort would change
that.** `rename(2)` is atomic for exactly one path. The managed payload spans five
disjoint locations — `brain/**`, `.github/**`, `.gemini/**`, `.claude/settings.json`, and
loose files at the repo root — so there is no single directory whose swap could commit the
upgrade in one operation. A genuinely atomic multi-file commit requires an on-disk journal; no portable
Node `fs` API provides one.

Two further observations were made while measuring the real surface:

1. **Three of the four failure modes #396 names are catchable in-process.** Ctrl-C
   (`SIGINT`), disk-full (`ENOSPC` throw) and a corrupt archive (throw) all run in a
   process that survives long enough to act. Only SIGKILL and power loss do not.
2. **The issue's own Scope and Exit criteria disagree.** Scope says "restore the
   pre-upgrade state of every managed path"; Exit says "the consumer tree byte-identical".
   These are not the same claim, and the second cannot hold: step 1 of the upgrade runs
   the package install, rewriting `package.json`, the lockfile and `node_modules/` before
   any snapshot could exist.

A measurement also overturned the intuition behind the ticket's Ctrl-C framing. Node
delivers signals through the event loop, so **a signal handler cannot interrupt a
synchronous fs loop**: a `SIGINT` sent 40 ms into a 935 ms synchronous copy loop was
queued and ran only after the loop returned, while the same loop with a `setImmediate`
yield aborted mid-flight. The real managed write is 366 files in ~23 ms. Registering a
handler therefore does not enable a mid-write abort — it prevents the default action
from killing the process instantly, which is the one thing that genuinely leaves a
half-applied tree.

## Decision

**Restate #396's exit criterion as _restorability_, not atomicity**, and name the
residual gaps rather than implying they are closed.

1. The managed-path copy is protected by a **restore point**: every path the write loop
   may touch is snapshotted before the first write, and any throw restores those bytes
   and re-raises the original failure.
2. **A rollback that cannot complete must say so, and must preserve its snapshot.** A
   half-restored tree reported as clean is worse than an unprotected one, because it
   removes the operator's reason to look.
3. **Conditions that cannot be rolled back are refused up front, not handled optimistically.**
   The boundary is a write that lands **outside `destRoot`**, since the snapshot lives inside
   it — not "the path is a symlink". Two classes are refused: a path that resolves outside the
   repository once every symlink on its *whole* path is followed (so a symlinked **ancestor
   directory** counts, which a leaf-only test misses), and a **dangling** symlink, which
   cannot be snapshotted at all. A symlink resolving *inside* the repository is protected like
   any other path.
4. **The residual gaps are enumerated in `docs/KNOWN-LIMITATIONS.md`**, individually:
   SIGKILL/power loss, the dependency install, the config migration, and symlinked paths.
5. Surviving SIGKILL and power loss requires an on-disk journal replayed by the *next*
   invocation. That is deliberately a **separate slice**, not a silent omission.

### The line this draws

> The upgrade does not promise it will never be interrupted. It promises that an
> interruption is **detectable and reversible** — and, where it is not reversible, that
> it will be **named**.

## Consequences

**Positive**

- The claim brain makes is one it can actually keep, and each gap has a ticket rather
  than an asterisk.
- The snapshot directory is the substrate the journal slice needs; slice 2 builds on it
  instead of replacing it.
- Refusing symlinked managed paths converts a silent corruption (the link deleted, the
  write escaped the repo) into an actionable message.

**Negative / accepted costs**

- A hard kill still leaves a half-applied tree until the journal slice lands. This is the
  honest state, and M4's hard gate stays closed until it is fixed.
- The snapshot doubles write I/O for the copy phase (~23 ms → ~46 ms, 2.75 MiB for 366
  files). Measured and accepted.
- A consumer whose managed path resolves **outside** the repository, or is a dangling link,
  must fix it before upgrading. Deliberate fail-closed; the message names the path and the
  remedy, so it is not the silent lockout class recorded in `brain/core/anti-patterns/`.
  A symlink pointing *inside* the repository costs nothing — an earlier revision of this ADR
  refused those too, on the premise that the write escapes the repo. **That premise was
  measured false**: the snapshot, the write and the restore all follow the link, so the target
  returns to its original bytes with the link untouched. Since `AGENTS.md` is a managed path
  and `AGENTS.md -> CLAUDE.md` is the canonical agent-interop symlink, the broader rule would
  have soft-locked a common, legitimate setup — and only *after* step 1 had already rewritten
  the consumer's `package.json`, lockfile and `node_modules/`.

**Follow-ups this decision creates**

- `.brain-upgrade-backup` cannot be gitignored by brain: `.gitignore` is not a managed
  path, and adding it to `brain/core/managed-paths.mjs` is itself a Tier-2 change. Until
  then a leaked snapshot appears as untracked files in a consumer repo.
- The config migration (step 3) is outside the restore point because `brain.config.json`
  is a `local` path. Extending protection across the whole verb, not just the copy, is a
  separate decision.

## Alternatives considered

**Stage-and-swap (true atomicity).** Rejected: not achievable portably. The managed paths
have no common parent directory to rename, so a swap decomposes into N non-atomic
renames — the same exposure, in a shorter window.

**Journal-only, recovery on the next run.** Rejected as the *first* slice, not on merit.
It covers all four modes with one mechanism, but leaves the tree visibly dirty after a
Ctrl-C until someone re-runs the command. It remains the right shape for slice 2, layered
on the snapshot rather than replacing it.

**Delegate the restore point to the consumer's own VCS.** This is the pre-existing
mechanism — `docs/KNOWN-LIMITATIONS.md` said recovery was "through the consumer's own git
hygiene" — and it is the first alternative any reviewer raises, so it is named here rather
than passed over. Rejected: ADR-0007/0008 make brain VCS-agnostic, so it cannot be assumed;
a consumer with a dirty working tree makes `git stash` unreliable; and it requires the
consumer to notice the failure and know the remedy, which is exactly the burden this ADR
exists to remove.

**Leave the criterion as written and claim it is met.** Rejected explicitly. It is the
failure mode M10 (#335) exists to close — green in test, inert in production — and #396
is a gate whose entire purpose is that an external team does not lose its work.

## References

- Issue #396 · epic #313 (M4 hard gate) · slice 2 tracks the journal
- ADR-0003 / ADR-0006 — managed/local boundary and the upgrade contract
- ADR-0013 — Tier-2 promotion pattern (agent drafts, human signs)
- `docs/KNOWN-LIMITATIONS.md` § Self-update
- `brain/core/anti-patterns/pre-v0-8-0-upgrade-clobber-lockout.md` — the lockout class the
  symlink refusal is deliberately shaped to avoid
