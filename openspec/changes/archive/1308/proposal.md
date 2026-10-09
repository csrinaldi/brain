---
status: draft
issue: 1308
---

# Proposal — state-chip-separate-from-track (issue 1308)

## What

Split the one chip a node card and the drawer header carry into two: a **lifecycle state** chip
(`◐ In flight`, `○ Planned`, `⊘ Blocked`, …) and a **track** chip (`Track A`, `? No track`,
`? Undeclared`). Lifecycle "In flight" is derived from the same evidence the home's "In flight"
section already uses (#1284: an open issue named by a change dir, a local worktree, a remote
branch or a PR).

## Why

Issue #1308. One chip slot carries two unrelated facts, and the wrong one wins:

- `state-vocab.mjs:50` returns `? Undeclared` for `status === 'unclassified'` BEFORE it reads the
  roadmap state (`:52`). An issue with no `brain-graph/1` block (and no native relation) therefore
  never shows its lifecycle, however much work is in flight. #1263 (open PR, 8 worktrees, listed in
  the home "In flight" section) and #1273 read `? Undeclared`.
- For declared nodes, `In flight` is assigned only by `roadmapState` (`status/snapshot.mjs:87-99`),
  which needs an open PR on the canonical branch. A worktree, a pushed branch or a change dir
  without a PR reads `○ Planned`. Together the two explain why zero cards across the lanes show
  `◐ In flight` while the legend lists it, and why the card contradicts the "In flight" section
  above it on the same page.

The design (`stitch_brain_ui_dashboard_design_system/brain_ui_interactive_surface/screen.png`)
already draws them as two chips: `◐ IN_FLIGHT` and `TRACK A`.

## Scope

- Includes:
  - One pure lifecycle function reused by lane cards, `?` holding rows, epic clusters, the drawer
    header, the drawer's children list and the roadmap rows, so none can disagree.
  - In-flight evidence read through the SAME join `inflight-model.mjs` uses (exported, not copied).
  - A track chip on cards and in the drawer header, replacing the `? track` mark and the drawer's
    plain `track A` text.
  - The legend split into a state group and a track group; lane-header state counts read the new
    lifecycle state.
  - Honest degradation: while an evidence source is pending or failed, a node with no evidence in
    the sources that did arrive reads `— Not computed`, never `Planned`.
- Does not include:
  - The epic's own aggregate state (#1309). This change computes a node's OWN lifecycle; the epic
    rollup may later consume it, and nothing here decides how an epic aggregates its children.
  - Any change to `epic-graph.mjs`'s `status` (`unclassified`, `awaiting-human`, …) or to
    `roadmapState` in the snapshot. The data stays; only how the UI reads it changes.
  - Moving undeclared nodes out of the `?` holding lane — lane grouping is by track and stays so.

## Rulings honoured (epic #878)

- Never show an unmeasured value as measured: a missing source yields `Not computed`, never
  `Planned`; an unreadable body yields no track claim at all.
- The first render never waits on the forge: local sources (change dirs, worktrees) can establish
  `In flight` immediately; forge sources only ever add evidence when they arrive.
