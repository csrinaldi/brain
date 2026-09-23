# ADR-0035 — The archive sweep's `issue-link` exemption is content-earned, never granted by branch name

**Status**: Accepted
**Date**: 2026-09-23 — Cristian Rinaldi

## Context

Issue #557 made archiving a machine guarantee. After every clean post-merge audit,
`.github/workflows/governance-postmerge.yml` runs `brain/scripts/governance/postmerge/sweep.mjs`,
which moves each change whose issue is closed from `openspec/changes/<name>/` into
`openspec/changes/archive/<iid>/`, consolidates its spec delta into
`openspec/specs/<capability>/spec.md`, and opens at most one `auto-archive/<date>` pull request
against `main`, with a body ending `Part of #557.`.

`issue-link` (`brain/scripts/governance/run-check.mjs#runIssueLinkCheck`, invariant 1 in
`workflow-governance.md`) requires a closing keyword (`Closes`/`Fixes`/`Resolves #N`) on a pull
request to the default branch; `Part of #N` alone is accepted only on a non-default target
(`requiresClosingKeyword`). A sweep pull request targets `main` and cannot honestly carry a
closing keyword: it resolves nothing, it performs recurring housekeeping on behalf of #557.
**PR #1097 (2026-09-23) failed `issue-link` with exactly that reason.** Left alone, every sweep
pull request stays red forever, and because the workflow keeps at most one `auto-archive/*`
pull request open (design D6's backlog cap), the first red one blocks every later day's sweep.

This is the second time this repository has had to carve an exception into an invariant the
doctrine calls "not skippable". The first is ADR-0034's memory lane: `memory/<host>-<date>` pull
requests, which also close no issue. Both are machine-authored pull requests that legitimately
link nothing, and both carry the same risk. An exemption keyed on the branch name alone
(`if head starts with auto-archive/, skip issue-link`) is spoofable: anyone who can push a
branch with a matching name bypasses the gate, for an arbitrary diff.

ADR-0034 L1 already answered that for the memory lane: *"the branch name is a claim, the path
check … is the proof."* #889 implemented it as its design D1a: `runIssueLinkCheck` recomputes
`checks/lane.mjs#classifyLane` over the diff before it skips anything, and never trusts the name.
This ADR applies the same rule to a second lane instead of inventing a weaker mechanism.

## Decision

**A second content-earned `issue-link` exemption, for `auto-archive/<date>` heads. The branch
name makes the claim; a predicate recomputed over the diff is the proof.**

`brain/scripts/governance/checks/archive-sweep.mjs#classifySweepDiff` is a pure function with
the same structure as `classifyLane`, wired into `runIssueLinkCheck` right after the memory-lane
block and in the same shape.

### The claim — the branch shape

`SWEEP_BRANCH_RE = /^auto-archive\/\d{4}-\d{2}-\d{2}$/`, anchored at both ends, matching the
workflow's `br="auto-archive/${today}"` with `today="$(date -u +%F)"`. It is tested first,
before any git call: a head that does not match never reaches the diff closures, so a diff
failure can never affect an ordinary pull request.

### The proof — the diff

Recomputed on every run from `git diff -M100% --name-status` and `--numstat` over
`BASE...HEAD`. Every entry must be one of the following, or the exemption is refused:

1. **An exact-content rename** (`R100`, git's own 100%-similarity detection) from
   `openspec/changes/<name>/…` (not already under `archive/`) to
   `openspec/changes/archive/<dest>/…`, where the path below the two-segment prefix is
   identical. A file whose content drifted during the move is reported by git as a delete plus
   an add, and the delete is refused.
2. **An added file** that is either `openspec/specs/<capability>/spec.md` or any path under
   `openspec/changes/archive/<dest>/`.
3. **A modified `openspec/specs/<capability>/spec.md` with zero deleted lines**, checked on
   `--numstat` rather than inferred from the path. Consolidation both creates and appends to
   spec files (`archive-logic.mjs#mergeSpecs`): the 2026-09-23 backfill produced 18 creates and
   several appends.

In addition, **at least one rename from the first category is required.** A diff with only
spec changes is refused: a real sweep never changes a spec without moving a folder, and
accepting such a diff would let a hand-made `auto-archive/*` branch rewrite a consolidated spec
with no linked issue at all.

Anything else is refused: code, workflows, `brain/**`, `.memory/**`, a delete with no matching
rename, a copy, a type change, a spec modification that deletes a line. A refused diff falls
through to the ordinary `issue-link` rule, which requires a closing keyword on `main`.

### Fail-closed

A diff that cannot be computed (git throws; a shallow clone, for instance) makes the pull
request "not exempt". It is never reported as `uncomputable: true` and never passed silently: it
falls through to the ordinary rule, which refuses it with the message the repository already
understands. This is the memory-lane block's own property, kept identical on purpose.

## Residual risk, named rather than assumed away

1. **The destination `<iid>` is not cross-checked against the source folder.** The predicate
   proves that a rename is byte-identical and keeps its relative path. It does not prove that
   `openspec/changes/issue-518-foo/` went to `archive/518/` rather than `archive/999/`. The
   destination segment is matched as `[^/]+`, not even as digits. Choosing `<iid>` is
   `lib/archive-sweep.mjs#selectSweep`'s job, not `issue-link`'s. Accepted because a forgery
   still has to move existing content byte-for-byte and cannot carry a new payload through a
   rename. A cross-check against `sdd-layout.mjs#parseChangeId` is a possible follow-up.
2. **An added file under `openspec/changes/archive/<dest>/` is accepted with any content**,
   provided the diff also carries at least one real rename. That is wider than "an exact move",
   and neither `archive-sweep.mjs`'s header comment nor its tests state it. The blast radius is
   bounded: the path is inert history, is not compiled into `AGENTS.md` and is not loaded as
   doctrine, and code, workflows, `brain/**` and `.memory/**` stay refused. It is still a way to
   land unlinked text on `main`. Refusing `A` under `archive/` unless it pairs with a rename is
   the follow-up that closes it. This ADR records the predicate as it runs, not as it was
   described.

## The sibling gap: `auto-revert/*`

The post-merge auto-revert step has the same failure. It opens `auto-revert/<sha>` against
`main` (`gh pr create --base main`) with a body ending `Part of #259.`, so `issue-link` refuses
it for the same reason it refused PR #1097. **This ADR does not close that gap.** A revert's
diff is the inverse of an arbitrary merge, so it has no fixed shape a path predicate can check.
Its proof would have to be different: for example, recomputing that HEAD is exactly
`git revert` of a merge that `brain:audit` named as an offender. That deserves its own decision.
Widening this one to cover it would give a second lane a predicate designed for the first.

## Consequences

- Sweep pull requests pass `issue-link` on `main` without a closing keyword, and only when
  their diff has the shape a sweep produces.
- `workflow-governance.md`'s invariant 1 row, which says `issue-link` is "not skippable", stays
  true in the sense it was written for: no label bypasses it. It is now incomplete, because two
  content-proven exemptions exist. The row is amended alongside this ADR to name both.
- Any future third lane gets the same treatment: a branch regex tested first, a diff predicate
  recomputed in the IO wrapper, the pure evaluator left unaware of context (ADR-0016), and
  fail-closed to the ordinary rule.

## Rejected alternatives

**A branch-name-only exemption.** Spoofable, for any diff. ADR-0034 L1 already named and fixed
this mistake once. Repeating it for a second lane would be a regression, not a parallel decision.

**An amendment to ADR-0034.** ADR-0034 decides that memory travels on its own lane. Its L1–L9,
its tier table for `mrAutoMerge` and its secret scrub (C1) are all about memory records. The
archive sweep shares the mechanism, not the domain. Grafting it on would make a reader search
memory-lane decisions for an `openspec/` housekeeping rule. A sibling ADR that names ADR-0034 as
its precedent keeps each decision findable under its own subject.

**A skip label (`skip:issue-link`), mirroring `skip:memory-gate`.** `issue-link` has no override
path, and a label that automation applies to its own pull request is a claim the automation
makes about itself. A content proof needs no one to remember anything, and nothing can apply it
falsely.

**A closing keyword in the sweep body (`Closes #557`).** It would pass the gate by saying
something false: the sweep does not resolve #557, and GitHub would close the issue on the first
merge. That is the #867 class ADR-0034 L1 rejected for the memory lane.
