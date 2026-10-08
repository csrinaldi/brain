---
status: draft
issue: 1251
---

# Proposal — a declared ticket hierarchy, one resolver, `move`, a drift check, and the integration `ticket:start` opens

Issue: #1251 (parent #1121, phase 4). The decision record is the ADR-0039 draft:
`brain-drafts/adr-0039-a-declared-ticket-hierarchy-one-resolver-and-integration-opened-by-ticket-start.md`.
It records the maintainer's rulings of 2026-10-02 and 2026-10-07 (Q1-Q12, Q1-hotfix, C1-C10, N1-N5,
M1-M4, R1, S1,
T1 and T1-gc) and the questions they still leave open. Every amendment it owes is drafted beside it;
`brain-drafts/README.md` gives the promotion order and each draft's validation.

## Why

Brain knows one level, `epic`, and one hop, from a ticket to its epic's tracker. It cannot
declare a milestone or any other level. A tracker branch is created by hand, no draft PR collects
a parent's work, changes made in the forge UI are invisible, a parent's list of children is
hand-written and drifts, and moving a ticket leaves its block, labels, milestone and branch
disagreeing with nothing to notice.

## Slices (from #1251)

1. **The resolver and the config shape.** `vcs.hierarchy` (`levels`, a `default` required once a
   hierarchy is declared, the label-or-native and lane-prefix rules) with its validation, and
   `lib/ticket-hierarchy.mjs` replacing `status/hierarchy-adapter.mjs` under the same contract.
   Precedence block > label > default, native data never a value (C1); `milestone` is
   `object | 'none' | null`; partial input via `forgeLoad`. No `vcs.hierarchy` means today's
   implicit epic/ticket model, with no migration (C4): today's `feature/…` trackers and
   `{type}/issue-…` branches, one hop, never retired (N1, N2). (`issueList`'s `state` and `body` already shipped in #1257.)
2. **The native drift lane.** A cached background read of GitHub sub-issues, GitLab epics/work
   items and the native milestone, compared with the resolved hierarchy; unmeasured when
   unsupported.
3. **`ticket:start` initialisation.** Resolve the nearest integrating ancestor, print the whole
   missing tracker chain, and on one confirmation push the trackers, open their draft PRs and write
   `tracker:` into their blocks. Milestones integrate into `main`, epics into their milestone.
   Branch segments come from issue numbers (`release-1300/tracker`, C6). Hotfix: a parentless
   issue labelled `hotfix` starts from `main` with plain `ticket:start` (C2, C3), with "merge main
   into tracker" proposals afterwards.
4. **The close workflow.** A forge CI workflow on a merged PR into a tracker or `main` closes the
   node at every level, deletes merged trackers, closes the native milestone mirror, and marks a
   draft integration PR ready when its node's children are all closed (C5, C10). It reads the
   PR's `Closes #N` to know what to close (N3) and executes it only when the resolver places N
   under the node whose tracker is the base, reporting any other keyword (M2). It rewrites the
   children region in the same step (N5), and closes nothing for a node merged before it was ready
   (N4); such a node closes through a remainder PR from the same tracker, which `brain:gc`
   proposes and a human confirms (Tier 2, R1), or directly when the tracker has no commits its
   target lacks (M3), which the workflow does on the `issues` `closed` event (S1). It runs in every project,
   the implicit model included (N1). GitLab needs a project access token. `brain:gc`, offered by
   `day:start`, sweeps what the workflow could not do (T1, T1-gc).
4b. **The `integration-ready` gate.** Refuses an integration PR merge before its node is Ready to
   close, judged through the resolver. It runs in every project: where `vcs.hierarchy` is declared,
   detection at `lite` and required at `standard` and `regulated` (N4); on the implicit model,
   detection-only at every tier (M1).
5. **`brain:ticket:move`.** Rewrite the block, the labels, the native milestone mirror and the
   branch together. Refuse to rename a branch while a PR is open on it.
6. **The drift check** in `brain:doctor` (#1130) and `brain:governance-status`, plus the counts of
   branches and PRs still on the legacy grammars (`{type}/issue-…` and `feature/…`, Q6, C9), in a
   repository that declared a hierarchy (N2).
7. **The branch scheme.** Hierarchical names with a `tracker` leaf and no type prefix, in a
   repository that declared a hierarchy. There the legacy forms are parsed while any open branch or
   PR uses them; without a hierarchy they are the grammar and stay (N2).
8. **The generated children region** in the parent's body, human-only. It replaces the repo-wide
   `epic:map` region and is written by the existing `replaceMapRegion` writer, from the close
   workflow and from `brain:gc` as the net (C8, N5, T1-gc); that write is Tier 1 (M4). #1335
   stays block-only. Every project gets it (N1).

## Sequencing

#1114 has landed (PR #1296), so ADR-0038's `vcs` axis object exists on `main`. Implementation
starts after ADR-0039 is promoted and its open questions are ruled.

## Not in this change

- No code. The slices above are implemented after the ADR is promoted.
- The amendments the ADR names are drafted in `brain-drafts/` and promoted after ADR-0039, in the
  order `brain-drafts/README.md` gives.
- Provider gaps (GitLab's missing issue-event trigger, a missing token) degrade to the `brain:gc` sweep, which `day:start` offers and `session:start` counts from a local
  cache
  (T1): reported, and proposed at Tier 2 where the act is Tier 2.
