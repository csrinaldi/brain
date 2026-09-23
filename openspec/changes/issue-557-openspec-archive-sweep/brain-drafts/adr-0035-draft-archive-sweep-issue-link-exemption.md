# ADR-0035 (DRAFT — for maintainer review, not yet accepted) — The archive-sweep `issue-link` exemption is content-earned, not branch-name-granted

**Status**: Draft — proposed during #557 phase 9, agent-authored, requires human review
per `brain/core/methodology/agent-authorities.md` (Tier 2/3: modifying `brain/` requires
a human to move the artifact out of `openspec/changes/**/brain-drafts/`).

**Date**: 2026-09-23 — drafted by the `sdd-apply` executor on issue #557 phase 7/9.

## Context

`brain/scripts/governance/postmerge/sweep.mjs` (issue #557, design.md D6) is a scheduled
post-merge job that renames closed changes' `openspec/changes/<name>/` folders into
`openspec/changes/archive/<iid>/`, consolidates their spec deltas into
`openspec/specs/<capability>/spec.md`, and opens exactly one `auto-archive/<date>` PR
against `main` per day, with a body rendered by `renderReport()` ending `Part of #557.`.

`issue-link` (`brain/scripts/governance/run-check.mjs#runIssueLinkCheck`,
`workflow-governance.md`'s Invariant 1, "not skippable") requires a CLOSING keyword
(Closes/Fixes/Resolves #N) on any PR targeting the default branch; "Part of #N" alone is
accepted only on non-default (slice) targets. A sweep PR targets `main` and can never
carry a closing keyword — it does not resolve issue #557, it performs recurring
housekeeping *for* it. **PR #1097 (2026-09-23) failed `issue-link` with exactly this
reason**, meaning every automated sweep PR the workflow ever opens would stay red
forever, blocking every subsequent day's sweep behind an unmergeable PR (D6's own
backlog cap: "ONE open `auto-archive/*` PR at a time").

This is the SECOND time this repository has needed to carve an exception into
`issue-link`'s "not skippable" invariant. The first is ADR-0034's memory lane
(`memory/<host>-<date>` PRs, carrying `.memory/records/*.jsonl` additions only). Both
share the same shape of problem — a machine-authored PR that legitimately closes no
issue — and, critically, both share the same shape of *risk*: a naive branch-name
exemption (`if head starts with memory/`, or `if head starts with auto-archive/`, skip
`issue-link`) is spoofable. Anyone who can open a PR from a matching branch name bypasses
the gate entirely, for an arbitrary diff.

ADR-0034 L1 answers this for the memory lane: *"the branch name is a claim, the path
check... is the proof"* — the predicate is recomputed from the diff itself
(`lane.mjs#classifyLane`), never trusted by name alone. This ADR extends the identical
discipline to the archive-sweep lane, rather than inventing a second, weaker mechanism.

## Decision

**A second content-earned `issue-link` exemption, for `auto-archive/<date>` heads,
proven by recomputing a diff predicate — never granted by branch name alone.**

`brain/scripts/governance/checks/archive-sweep.mjs#classifySweepDiff` is a new pure
function, structurally mirroring `lane.mjs#classifyLane`:

- **The branch claim**: `SWEEP_BRANCH_RE = /^auto-archive\/\d{4}-\d{2}-\d{2}$/`, matching
  `governance-postmerge.yml`'s `br="auto-archive/${today}"` exactly (`today="$(date -u
  +%F)"`). Checked FIRST, before any git call — a non-matching head never touches the
  diff closures (mirrors the lane predicate's own short-circuit property).
- **The content proof**: recomputed from `git diff -M100% --name-status/--numstat
  BASE...HEAD`. Every entry in the diff must fall into one of three categories, or the
  exemption is refused:
  1. An EXACT-content rename (`R100` — git's own 100%-similarity detection, so any
     content drift during the "move" is reported as a separate delete+add and rejected)
     from `openspec/changes/<name>/**` into `openspec/changes/archive/<iid>/**`, with the
     relative path below the two-segment prefix required to match (same basename).
  2. A brand-new `openspec/specs/<capability>/spec.md`.
  3. A MODIFICATION to an existing `openspec/specs/<capability>/spec.md` that is a PURE
     addition — asserted by a zero-deletions `--numstat` check, never by path shape
     alone. (`archiveChange`'s `mergeSpecs` both creates AND appends to spec files,
     confirmed against the 2026-09-23 backfill: 18 creates, several appends.)
  - **At least one valid rename must be present.** A diff carrying ONLY spec changes
    (case 2 or 3, with zero case-1 entries) is refused. A real sweep never produces a
    spec change without moving at least one folder — a rename-less diff cannot be a real
    sweep's output, and allowing it would let a hand-crafted `auto-archive/*` branch edit
    any consolidated spec with no linked issue at all.
  - Anything else — code, workflow files, `brain/**`, `.memory/**`, a deletion with no
    matching rename, a spec modification that deletes a line — is refused and the diff
    falls through to the ORDINARY `issue-link` rule (closing keyword required on `main`).
- **Fail-closed**: an uncomputable diff (git throws) demotes to "not exempt," never to
  `uncomputable: true` — the PR falls through to the standard rule rather than either
  silently passing or silently hard-failing the whole check run.

Wired into `runIssueLinkCheck` immediately after the existing memory-lane block, in the
same shape: branch-regex short-circuit, then diff recomputation inside a `try`, then
`return { pass: true }` only on a proven-exempt classification.

## Stated residual risk

This predicate does **not** verify that a renamed folder's destination `<iid>`
corresponds to its own source folder's actual issue number — only that (a) the rename is
git-proven byte-identical (`R100`) and (b) the relative path matches. A content-identical
file could, in principle, be "moved" into a *different* `<iid>` than the one its source
folder's name implies, without this predicate objecting.

Judged acceptable for two reasons: forging it still requires git-proven byte-identical
content, not an arbitrary payload (a materially different diff is rejected outright); and
the actual `<iid>` correspondence is `selectSweep`'s job (`archive-sweep.mjs`, design D1),
not `issue-link`'s — this predicate only proves "this diff has the SHAPE a sweep
produces," not "this diff's `<iid>` assignment is semantically correct." A tighter
cross-check against `sdd-layout.mjs#parseChangeId` (deriving the expected `<iid>` from the
source folder name and asserting it matches the destination) is a possible follow-up, not
required to close the PR #1097 failure this ADR addresses.

## Rejected alternatives

**A branch-name-only exemption.** Rejected for the reason stated throughout: spoofable by
anyone who can open a PR from a matching branch name, for an arbitrary diff. This is the
exact mistake ADR-0034 L1 already named and fixed once; repeating it for a second lane
would be a regression, not a parallel decision.

**Folding this into ADR-0034 as an amendment.** Rejected: ADR-0034's decision is scoped to
"memory travels on its own lane" — its L1-L9 sections, `mrAutoMerge` tier table, and
secret-scrub condition (C1) are all about the memory-records lane specifically. The
archive-sweep lane shares a *mechanism* (content-earned exemption via a recomputed
predicate) but not the *domain* — grafting it onto ADR-0034 would make a future reader
hunt through memory-lane decisions to find an unrelated openspec-housekeeping rule. A
sibling ADR, explicitly naming ADR-0034 as its precedent, keeps each decision addressable
by its own domain.

**A label-based override (`skip:issue-link` or similar), mirroring `skip:memory-gate`.**
Rejected: `issue-link` has no override path today (`workflow-governance.md` names it "not
skippable" with no skip-label row, unlike memory-gate's REQ-L3-5), and inventing a label a
bot could self-apply is a materially different — and weaker — trust model than a
content-earned exemption a human never has to remember to apply.

## Not addressed here

The pre-existing `auto-revert/*` post-merge step renders a body ending `Part of #259.`
against `main` and has the IDENTICAL `issue-link` failure mode. It is explicitly out of
scope for this ADR — a separate PR should apply the same content-earned-exemption
discipline there (or extend `classifySweepDiff`'s sibling shape to a `classifyRevertDiff`
predicate over the revert commit's actual diff shape), rather than this ADR silently
widening scope to cover it.

## Doctrine impact

`brain/core/methodology/workflow-governance.md`'s Invariant 1 row currently states
`issue-link` has **no skip label** and is "not skippable." That characterization is still
true in the sense that matters (no human- or bot-applied label bypasses it), but it is
now inexact: two branch-shaped, diff-content-proven exemptions exist
(`memory/<host>-<date>` per ADR-0034, and `auto-archive/<date>` per this ADR). See the
companion draft `workflow-governance-invariant-1-amendment.md` in this same
`brain-drafts/` folder for the proposed doctrine text.
