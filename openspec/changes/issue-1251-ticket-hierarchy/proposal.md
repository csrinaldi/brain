---
status: draft
issue: 1251
---

# Proposal — a declared ticket hierarchy, one resolver, `move`, a drift check, and the integration `ticket:start` opens

Issue: #1251 (parent #1121, phase 4). The decision record is the ADR-0039 draft:
`brain-drafts/adr-0039-a-declared-ticket-hierarchy-one-resolver-and-integration-opened-by-ticket-start.md`.
It records the maintainer's rulings of 2026-10-02 and 2026-10-07 (Q1-Q12 and Q1-hotfix) and the
questions they still leave open.

## Why

Brain knows one level, `epic`, and one hop, from a ticket to its epic's tracker. It cannot
declare a milestone or any other level. A tracker branch is created by hand, no draft PR collects
a parent's work, changes made in the forge UI are invisible, a parent's list of children is
hand-written and drifts, and moving a ticket leaves its block, labels, milestone and branch
disagreeing with nothing to notice.

## Slices (from #1251)

1. **The resolver and the config shape.** `vcs.hierarchy` (`levels`, a required `default`, the
   label-or-native and lane-prefix rules) with its validation, and `lib/ticket-hierarchy.mjs`
   replacing `status/hierarchy-adapter.mjs` under the same contract. Precedence
   block > label > native > default; `milestone` is `object | 'none' | null`; partial input via
   `forgeLoad`. (`issueList`'s `state` and `body` already shipped in #1257.)
2. **The native drift lane.** A cached background read of GitHub sub-issues, GitLab epics/work
   items and the native milestone, compared with the resolved hierarchy; unmeasured when
   unsupported.
3. **`ticket:start` initialisation.** Resolve the nearest integrating ancestor, print the whole
   missing tracker chain, and on one confirmation push the trackers, open their draft PRs and write
   `tracker:` into their blocks. Milestones integrate into `main`, epics into their milestone.
   Hotfix: `--base main` on a `hotfix` issue, with "merge main into tracker" proposals afterwards.
4. **The post-merge close.** `issueClose` on a child merged into a tracker, after measuring
   GitLab's behaviour.
5. **`brain:ticket:move`.** Rewrite the block, the labels, the native milestone mirror and the
   branch together. Refuse to rename a branch while a PR is open on it.
6. **The drift check** in `brain:doctor` (#1130) and `brain:governance-status`, plus the count of
   branches and PRs still on the legacy grammar.
7. **The branch scheme.** Hierarchical names with a `tracker` leaf and no type prefix. The legacy
   `{type}/issue-{N}-{slug}` is parsed while any open branch or PR uses it.
8. **The generated children region** in the parent's body, human-only, written by #1335's writer.

## Sequencing

#1114 has landed (PR #1296), so ADR-0038's `vcs` axis object exists on `main`. Implementation
starts after ADR-0039 is promoted and its open questions are ruled.

## Not in this change

- No code. The slices above are implemented after the ADR is promoted.
- The amendments the ADR names (ADR-0029, ADR-0032, ADR-0035, the `harness-contract.md`
  `ticket:start` row, `agent-authorities.md`) are separate drafts, promoted after ADR-0039.
