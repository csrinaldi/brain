---
status: draft
issue: 1251
---

# Proposal — a declared ticket hierarchy, one resolver, `move`, a drift check, and the integration `ticket:start` opens

Issue: #1251 (parent #1121, phase 4). The decision record is the ADR-0039 draft:
`brain-drafts/adr-0039-a-declared-ticket-hierarchy-one-resolver-and-integration-opened-by-ticket-start.md`.
It records the maintainer's rulings of 2026-10-02 and 2026-10-07 (Q1-Q12, Q1-hotfix and C1-C10)
and the questions they still leave open. The `agent-authorities.md` amendment it owes is drafted
beside it (`brain-drafts/agent-authorities-hierarchy-close.draft.md`).

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
   implicit epic/ticket model, with no migration (C4). (`issueList`'s `state` and `body` already shipped in #1257.)
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
   draft integration PR ready when its node's children are all closed (C5, C10). GitLab needs a
   project access token. `day:start` lists merged-but-open issues as the net.
5. **`brain:ticket:move`.** Rewrite the block, the labels, the native milestone mirror and the
   branch together. Refuse to rename a branch while a PR is open on it.
6. **The drift check** in `brain:doctor` (#1130) and `brain:governance-status`, plus the counts of
   branches and PRs still on the legacy grammars (`{type}/issue-…` and `feature/…`, Q6, C9).
7. **The branch scheme.** Hierarchical names with a `tracker` leaf and no type prefix. The legacy
   `{type}/issue-{N}-{slug}` is parsed while any open branch or PR uses it.
8. **The generated children region** in the parent's body, human-only. It replaces the repo-wide
   `epic:map` region and is written by the existing `replaceMapRegion` writer; #1335 stays
   block-only (C8).

## Sequencing

#1114 has landed (PR #1296), so ADR-0038's `vcs` axis object exists on `main`. Implementation
starts after ADR-0039 is promoted and its open questions are ruled.

## Not in this change

- No code. The slices above are implemented after the ADR is promoted.
- The amendments the ADR names, promoted after ADR-0039 in this order: `agent-authorities.md`
  (drafted here), ADR-0029, ADR-0032, ADR-0035, ADR-0018, the `harness-contract.md`
  `ticket:start` row.
