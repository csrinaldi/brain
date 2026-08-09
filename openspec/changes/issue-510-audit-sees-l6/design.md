---
status: draft
issue: 510
---

# Design

## The seam that already exists

`fetchPrMeta` (`lib/merge-walk.mjs:247`) resolves the PR per merge and fetches labels + body
in a single call, precisely so `diffSize` and `issueLink` can key on PR evidence rather than
on the merge commit. It is **best-effort by contract**: it returns `prMetaError` rather than
throwing, and it never collapses a fetched-but-null value into a fabricated default.

The L6-shaped check rides that seam. `prReviews` is already in the port's `VERBS` and
implemented on both providers — it is what the reviewer's own anti-loop and rev-bound read.

## Three states, not two

The whole design turns on refusing to collapse these:

| state | evidence | verdict |
|---|---|---|
| governed | a PR resolved, an approving non-author human review present | pass |
| ungoverned | a PR resolved, no such review | fail |
| **undeterminable** | no PR resolved | **uncomputable** |

Collapsing the third into the second turns the audit red over history it cannot judge — every
direct push, every squash outside the PR flow. Collapsing it into the first is a silent
fail-open, which is the class this whole ladder exists to prevent. #474 established the
vocabulary; this check borrows it rather than inventing a second one.

## Why not tree-keyed

`TREE_KEYED_CHECKS` exists because only a check that is a pure function of the tree can be
causally mirrored by a commit whose contribution is the net-inverse of an offender's. That is
what licenses the reverter-skip and the `[FAIL-SHA]` auto-revert signal.

Review evidence is not a function of the tree. It is PR metadata, like `issueLink`, which is
deliberately excluded for the same reason. So the check is **not** a member, and therefore
never auto-reverts.

This is not a loss. A10's assertion is that the offender is *reported* and never `[SKIP]`ped —
not that it is auto-reverted. Auto-reverting on review evidence would also be wrong on its
face: the remedy for "nobody reviewed this" is a human reviewing it, not a machine undoing it.

## What `adrPresence` becomes

A pure indexing check, and small enough to state in one sentence: *a new ADR must arrive with
its `brain/HOME.md` entry.* The added-only list is threaded from all three surfaces through
the same failure path as the full list, so an unreadable added-list cannot degrade into a
verdict.

The optional-parameter shape (`addedFiles = null` → pre-#510 behaviour) is deliberate: it
keeps `brain-promote` and `postmerge/resolution` working untouched, and it makes the
enforcement surfaces the only places that had to think about the distinction.

## Reinforcing A10 rather than retiring it

A10's fixture is a synthetic git repo with no PR at all. Under this design its merge lands in
the *undeterminable* branch, so its two assertions (non-zero exit, never `[SKIP]`) would still
hold — for a reason its own comment no longer describes. That is the failure mode this repo
calls an apparent protection.

So the fixture gains a resolvable PR with review evidence, and pins all three outcomes on the
MODIFY channel it exists to guard. Its frozen invariants (`^M`, never `^A`) are untouched: the
attack shape is not what changed, only which invariant answers it.

## Rejected

- **A new gate for I2.** Nine coupling points including a `GATE_MATRIX` row, a
  `governance.yml` job, the job-order drift guard, a branch-protection re-arm and a tier
  decision — to express an invariant L6 already expresses. It would also create two places to
  read the same rule, which is the drift #340 records for `issue-link`.
- **Fixing CI only.** The audit then fails merges CI passed, and `adrPresence` is tree-keyed:
  rung 3 would open an auto-revert against every merge touching an ADR.
- **Keying on the ADR title** (`brain/HOME.md` indexes by title). Deterministic and cheap, and
  it does not cover A10 — the offending text returns while the title never moves.
- **Accepting the loss of A10.** Disarming a frozen attack fixture to unblock a documentation
  PR is the worst trade on the table.
