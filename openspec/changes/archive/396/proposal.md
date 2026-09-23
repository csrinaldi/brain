---
status: draft
issue: 396
epic: 313
artifact_store: openspec
topic_key: sdd/issue-396-upgrade-rollback/proposal
---

# Proposal: Rollback / Atomic Apply for `brain:upgrade` (M4 hard gate)

Issue #396. Epic #313 (M4 — Distribution & self-update, hard-gate decomposition).
Change folder: `openspec/changes/issue-396-upgrade-rollback/`.

## Intent

`brain:upgrade` copies the managed payload into a consumer repo with a sequential loop
of `copyFileSync` / merge calls (`installer.mjs`, `copyManaged`). There is no staging,
no restore point and no transaction: a failure partway through leaves the consumer tree
**half old and half new**, recoverable only through the consumer's own git hygiene.
`docs/KNOWN-LIMITATIONS.md` states this verbatim, and epic #313 marks the self-update
safety subset as a **HARD GATE before any external adopter runs `brain:upgrade`**.

Measured surface, on `main` @ `217b8ab`:

- The write loop is `installer.mjs:184-196` — two sequential loops, zero staging.
- The three existing guards (`--dry-run`, `--abort-on-collision`, the `.brain-source`
  self-host marker) all gate **whether the loop starts**. None protects a failure
  *during* it.
- The real payload is **366 files across 13 managed globs**, written in ~23 ms.

## Problem with the issue's own exit criterion

#396 states:

> Killing `brain:upgrade` at **any point** between the first and last managed-file write
> leaves the consumer tree byte-identical to the pre-upgrade state.

**This cannot be met as written.** `rename(2)` is atomic for exactly one path; the
managed payload spans four disjoint locations (`brain/**`, `.github/**`, `.gemini/**`,
loose root files), so no single directory swap can commit the upgrade. Atomic multi-file
commit requires an on-disk journal — no portable Node `fs` API provides one.

Two further findings from measurement:

1. **Three of the four failure modes the issue names are catchable in-process** — Ctrl-C
   (`SIGINT`), disk-full (`ENOSPC`), corrupt archive (throw). Only SIGKILL and power loss
   are not.
2. **The issue's Scope and Exit criteria disagree.** Scope says "every managed path";
   Exit says "the consumer tree". The second cannot hold: step 1 already ran the package
   install, rewriting `package.json`, the lockfile and `node_modules/` before any
   snapshot could exist.

A measurement also overturns the ticket's Ctrl-C framing: Node delivers signals through
the event loop, so **a signal handler cannot interrupt a synchronous fs loop**. A SIGINT
sent 40 ms into a 935 ms synchronous copy loop was queued and ran only after the loop
returned; the same loop with a `setImmediate` yield aborted mid-flight. Registering a
handler therefore does not enable a mid-write abort — it stops the default action from
killing the process instantly, which is the one thing that genuinely half-applies a tree.

## Proposed change

Restate the exit criterion as **restorability**, not atomicity, and deliver it in two
slices.

**Slice 1 — in-process rollback (PR #412).** Snapshot every path the write loop may
touch before the first write; restore those bytes on any throw and re-raise the original
failure. When the rollback itself cannot finish, **keep the snapshot and say so**.
Refuse conditions that cannot be rolled back at all (symlinked managed paths, where the
write follows the link out of the repository). Report honestly at the CLI.

**Slice 2 — on-disk journal.** Survive SIGKILL and power loss by writing a journal
before the loop and replaying the restore on the next invocation. The slice-1 snapshot
directory is the substrate this builds on.

## Non-goals

- Reverting the dependency install (step 1) or the config migration (step 3). Both sit
  outside the restore point; they are named in `KNOWN-LIMITATIONS.md`, not silently
  covered.
- Full support for symlinked managed paths. Slice 1 refuses them with an actionable
  message; supporting them is a separate decision.
- Changing the merge/copy classification — that is #397.

## Impact

- `brain/scripts/lib/installer.mjs` — new `createRestorePoint()` + `RESTORE_POINT_DIR`;
  `copyManaged`'s write loop wrapped.
- `brain/scripts/brain-upgrade.mjs` — failure and rollback-completeness reporting;
  interrupt handling.
- `docs/KNOWN-LIMITATIONS.md` — the claim becomes partial-and-enumerated.
- **Tier 2 (blocked, human-promoted):** `.brain-upgrade-backup` cannot be gitignored by
  brain, because `.gitignore` is not a managed path (`brain/core/managed-paths.mjs`).

## Decision requiring ratification

The exit-criterion restatement is architectural. Recorded as ADR-0027, promoted and signed in `32bc8e7` (PR #416).
