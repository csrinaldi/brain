---
status: archived
issue: 936
absorbs: 930
archived_at: 2026-09-19
archived_against: 1f12020d (origin/main; PR #1074 squash-merged)
---

# Archive report — issue-936-lane-branch-reconcile

**The change is closed.** Issue #936 (the lane sweep must revisit unreconciled branches) and
#930 (`mrList` cannot say whether a merge request was merged) shipped together as PR #1074,
squash-merged into `main` as `1f12020d` on 2026-09-19. All 34 tasks are `[x]`. The
pre-merge verify report returned **pass**: 7/7 requirements, 17/17 scenarios, 0 CRITICAL,
0 WARNING, `npm test` 6151/6151.

## What was archived

`npm run brain:change:archive -- issue-936-lane-branch-reconcile` moved the folder to
`openspec/changes/archive/936/`. The spec is flat (`spec.md`), following #920: no canonical
memory-lane capability exists under `openspec/specs/`, so nothing was merged there.

## Delivery

- `1f12020d` — PR #1074 (`fix(memory)`, closes #936 and #930):
  - `mrList` in both providers reports `state` and `merged`, with an optional `headBranch`
    filter that queries all states and fails closed on a full page. Unfiltered calls are
    unchanged.
  - `lane/delivery.mjs` `contentDelivery()` decides delivered, pending or unknown from the
    paths a lane ref added, fail closed. `surveyDelivery` wraps it.
  - `collectLane` step 8 parents a same-day append on `origin/main` when the existing tip is
    delivered (#1023, #1050).
  - #920 R8 reversed: the PR lookup runs before the push; a closed-unmerged newest PR is
    reported and never reopened.
  - `lane/sweep.mjs` reconciles this host's other `memory/<host>-*` refs after today's ship,
    never under `--dry-run`, and an isolated sweep failure never fails today's ship.
- A fresh-context cold review found no critical issue. Its one warning (a sweep throw could
  fail a successful ship) was fixed before merge.
- In CI the npm tarball size canary went red at 8.06 MB. The maintainer approved raising it
  to 9 MB after the growth was read. The raise moved a spawn in the test file, so the
  `test-spawn-hygiene` allowlist line pin was updated in the same PR.
- The ticket's record (`rec-05e1398e3b5369e3`) travelled on lane PR #1075. That PR hit the
  #1050 shape live on the pre-fix code (it re-listed `rec-b2ce326d64c7a31e`, already merged
  by #1064), and a REST update-branch cleared it.

## Facts measured during the change

- Repo settings on 2026-09-19: `delete_branch_on_merge: true`, `allow_auto_merge: false`,
  `allow_update_branch: false`. Every lane PR therefore waits for a human merge at tier
  `lite` too.
- `npm run brain:memory:ship` already passes `--invoker manual`. Passing it again is refused
  with a message that reads "got manual".

## Open follow-ups

- Two Tier 2 drafts wait for the maintainer under `brain-drafts/`:
  - `adr-0034-l2-auto-merge-note.md`: with `allow_auto_merge` off, `lite` behaves like
    `standard`. The policy question is deferred to epic #864 task 6.1.
  - `vcs-contract-mrlist-row.md`: the `mrList` row in `brain/core/methodology/vcs-contract.md`.
- #1076: whether every vendored `brain/scripts/**` suite must ship in the npm tarball.
- A branch name with a numeric suffix (`memory/<host>-<date>-<n>`) is ignored by the sweep
  without a report line. Nothing produces that shape today (`LANE_BRANCH_RE`).
