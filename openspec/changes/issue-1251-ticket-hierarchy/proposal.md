---
status: draft
issue: 1251
---

# Proposal — a declared ticket hierarchy, one resolver, `move`, a drift check, and the integration `ticket:start` opens

Issue: #1251 (parent #1121, phase 4). The decision record is the ADR-0039 draft:
`brain-drafts/adr-0039-a-declared-ticket-hierarchy-one-resolver-and-integration-opened-by-ticket-start.md`.
It records the maintainer's rulings of 2026-10-02 and lists the open questions they leave.

## Why

Brain knows one level, `epic`, and one hop, from a ticket to its epic's tracker. It cannot
declare a release, a feature or a milestone. `issueList` carries no `state`. A tracker branch is
created by hand, no draft PR collects a parent's work, and moving a ticket leaves its block,
labels, milestone and branch disagreeing with nothing to notice.

## Slices (from #1251)

1. **The resolver and the config shape.** `vcs.hierarchy` with its validation, and
   `lib/ticket-hierarchy.mjs` returning `{ issues, divergences }`. `issueList` gains `state` (#1199).
2. **`ticket:start` initialisation.** Resolve the nearest integrating ancestor, and propose and
   confirm (Tier 2) its tracker branch and draft PR. Write `tracker:` into its block, branch the
   ticket from it, and have the ticket's PR target it with `Part of`.
3. **`brain:ticket:move`.** Rewrite the block, the labels, the native milestone and the branch
   together. Refuse to rename a branch while a PR is open on it.
4. **The drift check** in `brain:doctor` (#1130) and `brain:governance-status`.
5. **The branch scheme.** Hierarchical names with a `tracker` leaf and no type prefix. Today's
   `{type}/issue-{N}-{slug}` is parsed as an alias for a window.

## Sequencing

**Implementation waits until #1114 lands.** `vcs.hierarchy` lives inside the `vcs` axis object
that ADR-0038 defines, and ADR-0038 is on the #1114 tracker, not on `main`. This change carries
only the ADR draft until then.

## Not in this change

- No code. The slices above are implemented after the ADR is promoted.
- The amendments the ADR names (ADR-0029, ADR-0032, ADR-0035, the `harness-contract.md`
  `ticket:start` row) are separate drafts, promoted after ADR-0039.
