# Spec — #1251 ticket hierarchy (stated for context; this change carries only the ADR-0039 draft)

The requirements below restate the decisions in
`brain-drafts/adr-0039-a-declared-ticket-hierarchy-one-resolver-and-integration-opened-by-ticket-start.md`.
They are implemented in the slices listed in `proposal.md`, after #1114 lands. Anything the ADR lists
as an open question is not a requirement here.

- REQ-1 `vcs.hierarchy.levels` is an ordered list whose order is the nesting. A parent is a higher level; skipping a level is allowed; an inversion in issue data is reported as a top-level divergence.
- REQ-2 A level declares `label`, `native`, or both; a config with a level that declares neither, or a level entry with a `parent` key, is refused.
- REQ-3 Level labels are `level:<name>`; `type:*` is never read as a level.
- REQ-4 `lib/ticket-hierarchy.mjs` is the one resolver. It returns `{ issues: Map<number, { level, levelSource, parent, children, tracker, milestone, state, divergences[] }>, divergences: [...] }`, with `state` in `'open' | 'closed' | null` and `null` meaning unreadable.
- REQ-5 The native milestone is authoritative; a block that disagrees is reported as a divergence.
- REQ-6 `brain:ticket:move` rewrites the block, the labels, the native milestone and the branch together, and refuses to rename a branch while a PR is open on it.
- REQ-7 A drift check reports every issue whose sources disagree, from the resolver's divergences alone.
- REQ-8 `brain:ticket:start` resolves the nearest integrating ancestor; when its tracker is missing it proposes, and only after confirmation creates, the tracker branch and draft PR (`Closes #<ancestor>`), then writes `tracker:` into the ancestor's block. The ticket's PR targets the tracker with `Part of #<ancestor>`. Brain never merges.
- REQ-9 Branches are hierarchical, with a fixed `tracker` leaf for integrating nodes and no type prefix; today's `{type}/issue-{N}-{slug}` is parsed as an alias for a window. Lane branches keep their names.
- REQ-10 `issueList` returns `state` on every entry, additively, on both providers.
