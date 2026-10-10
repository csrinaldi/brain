---
status: approved
approved: 2026-10-02 (maintainer: rulings R1–R6, "dale" through to the PR; R10 and R11 added the same day; re-scoped by the split ruling the same day)
issue: 1199
---

# Proposal — progress-epic-milestone (issue 1199)

## Re-scope 2026-10-02

The maintainer split this change in two on 2026-10-02. The forge-read work moved to **#1257**, "fix(ui): forge reads never block the server — each lane on its own thread, issueList carries body and state, loading is not failure". #1257 lands first, and this change depends on it.

**Moved to #1257:**
- R4 and R10: the `issueList` `state` and `body` widening, the `updatedSince` input, and the `vcs-contract.md` row draft (now under #1257's `brain-drafts/`).
- R11: no first render waits on the forge, with the cold-start evidence.
- The worker-thread lanes, the pending sections and the loading band.
- The `forgeLoad` signal agreed with brain-ad.
- The closed-issue lane (a full list, then `since`/`updated_after` deltas, a full re-list every 60 runs), the per-state forge cache, and `brain:snapshot --no-closed`.
- The removal of the per-issue `issueView` body reads, and node state taken from the port.
- Follow-up #1256, which persists the forge cache.

A new ruling, R12, was recorded on #1257 the same day: an absent body key is `null`, and a present JSON `null` is `''`. It settles the open "null versus ''" risk that this proposal carried.

**Kept here:** R1–R3 and R5–R9: `countTasks` and the `progress` field, the working-tree and HEAD labels, the epic rollup with its wording (including "counting closed children…" while `forgeLoad.closed.state === 'pending'`), the hierarchy adapter, and the defaults R7–R9.

This change **consumes** `issueList` `state`/`body`, `forgeLoad` and the closed-issue data (#1257's `closedIssues` section). It does not implement them. The approval of the remaining content is unchanged.

## Intent

The UI cannot answer two questions: "how far along is this change?" and "how far along is this epic?".

- **Per-change progress.** `deriveTasks` (`brain/scripts/status/derive.mjs:73-92`) and `parseTasksList` (`brain/scripts/ui/lib/tasks-list.mjs:21-48`) each implement their own copy of the checkbox grammar. Neither emits `{done,total}`. A missing `tasks.md` and an unreadable one look the same, and zero checkboxes would show as `0/0`.
- **Epic rollup.** Today the snapshot reads only open issues, so closed children are invisible and an epic cannot show completion. Epic #878 has about 29 children, about 12 of them closed. #1257 makes the closed issues and their state available; this change counts them.

The scope was narrowed on 2026-10-02: milestone and project progress moved to #1253. Later the same day, the forge-read work moved to #1257 (see above).

## Scope

### In
- `progress` on the snapshot `changes` row, computed by a single pure `countTasks(text)` that both parsers share.
- The drawer and card labels for progress, with the source stated: "at HEAD" or "working tree".
- `status/hierarchy-adapter.mjs`, which exposes the ticket-hierarchy resolver contract (#1251; ADR-0039 in draft) over today's `kind`/`parent`, with closed children taken from #1257's `closedIssues` section.
- A `hierarchy` snapshot section, read by the page through one contract.
- The epic rollup (closed / total, with unknown counted separately, and its loading states keyed off #1257's `forgeLoad.closed`) on the epic's lane header and in its drawer.

### Out (R6, and the re-scope)
- Milestone and project progress (#1253).
- `vcs.hierarchy` config keys, `level:*` labels, `brain:ticket:move` and the drift check (#1251).
- Comparing tickets against code.
- A weighted rollup.
- The creation of `brain/scripts/lib/ticket-hierarchy.mjs`.
- Everything that moved to #1257: the `issueList` widening, `forgeLoad`, the closed lane, the worker threads, pending sections, `--no-closed`, and the body reads.
- Persisting the forge cache (#1256).

## Maintainer rulings (2026-10-02, binding)

| # | Ruling |
|---|---|
| R1 | Per-change progress is the `{done,total}` count of `tasks.md` checkboxes. It is shown as `done / total`, never as a bare %, and is carried as `progress` on the snapshot `changes` row. ONE pure `countTasks(text)` computes it, and both `tasks-list.mjs` and `deriveTasks` use it. A missing `tasks.md`, an unreadable one, and one with zero checkboxes each produce a distinct reason, never `0/0`. |
| R2 | The snapshot remains the single source and reads the working tree. The drawer reads at HEAD and says so. The card says "working tree". The snapshot is not re-sourced to HEAD. |
| R3 | Epic rollup = closed children / total children. A child whose state is unknown is counted as unknown, never as not done. The rollup is shown on the epic's lane header and in the epic's drawer. |
| R4 | **Moved to #1257** by the split ruling. The `issueList` `state` widening. This change consumes it. |
| R5 | The UI is built against the ticket-hierarchy resolver contract (#1251; ADR-0039 in draft) `{issues: Map<number, Entry>, divergences}`, where `Entry = {level, levelSource, parent, children, tracker, milestone, state (tri-state), divergences}`. A distinctly named adapter (`status/hierarchy-adapter.mjs`) implements it over today's `kind`/`parent`. This change never creates `brain/scripts/lib/ticket-hierarchy.mjs` (#1251). `track`, `blocks`, `needs` and `files` stay in epic-graph. |
| R6 | Out of scope: milestones and project progress (#1253); `vcs.hierarchy` and `level:*` (#1251); `brain:ticket:move` and the drift check (#1251); tickets versus code; the weighted rollup. |
| R7 | (Default.) A `tasks.md` with zero checkboxes reads "tasks.md has no checklist items". It never reads `0 / 0`. |
| R8 | (Default.) An epic with no children reads "no children declared", with no number. |
| R9 | (Default.) The rollup counts **direct children only**, matching the resolver's `children`. A nested epic counts as one child, by its own state. |
| R10 | **Moved to #1257** by the split ruling. `issueList` carries `body`; the per-issue body reads are removed. This change consumes it. |
| R11 | **Moved to #1257** by the split ruling. No view's first render waits on a forge read. This change honors it for the rollup: until the closed list lands, the rollup reads "counting closed children…" and never shows 0. |

R7–R9 were orchestrator defaults for the question round below; the maintainer may override any of them.

## Capabilities

- **New:** `change-progress`. It covers `countTasks`, the `progress` field with its three reason states, and the source labels.
- **New:** `epic-rollup`. It covers the adapter contract (R5), the `hierarchy` section, the closed/total/unknown counts, their loading states, and where they are shown.

## Approach

1. **`countTasks(text)`** (pure) returns `{done,total}`, or a reason when the count is zero. `deriveTasks` and `parseTasksList` both consume it. `readOneChange` (`snapshot.mjs:226-246`) maps an absent file and a read error to distinct reasons. The card and SDD view (`static/app.js:805-807,1076`) render `done / total`. The drawer derives its count from its own HEAD items, labelled "at HEAD".
2. **Adapter.** `hierarchy-adapter.mjs` builds `Entry` from the open graph's nodes and #1257's `closedIssues` nodes, and computes `children` once. Its `state` is `null` when unknown. `lane-model.mjs` and the drawer consume only the contract.
3. **Rollup.** `rollup-model.mjs` counts direct children by state and words the closed count from `forgeLoad.closed`: "counting closed children…" while it is `pending`, a stated reason when it failed without data or is disabled, and numbers otherwise.

**Rejected:**
- **Re-sourcing the snapshot to HEAD.** It discards uncommitted progress, and it shifts the meaning of every other snapshot field. Labelling each source (R2) costs less.
- **An open-only rollup.** Without closed children the denominator is wrong, and "closed" cannot be told apart from "unknown", which R3 forbids.
- **Building the real resolver here.** It would pre-empt #1251's config, labels and drift rules, and it would collide on `ticket-hierarchy.mjs`. The adapter lets #1251 swap only the source.

## Affected areas

| Path | Impact |
|---|---|
| `brain/scripts/lib/tasks-list.mjs` (moved from `ui/lib/`), `brain/scripts/status/derive.mjs` | Modified: one grammar, `countTasks` |
| `brain/scripts/status/snapshot.mjs` | Modified: `progress`, the `hierarchy` section |
| `brain/scripts/status/hierarchy-adapter.mjs` | New |
| `brain/scripts/ui/change-route.mjs`, `ui/lib/drawer-model.mjs`, `ui/lib/sdd-model.mjs` | Modified: progress at HEAD, pass-through |
| `brain/scripts/ui/lib/progress-view.mjs`, `ui/lib/rollup-model.mjs` | New |
| `brain/scripts/ui/lib/lane-model.mjs`, `ui/static/app.js` | Modified: `childrenOf` reads `children`; card, SDD line, cluster heading and drawer |
| `*.test.mjs` beside each module | Modified or new |

## Risks

| Risk | L | Mitigation |
|---|---|---|
| This change is built against #1257's shapes before #1257 merges | Med | #1257's spec fixes `forgeLoad`, `closedIssues` and the six-key row by requirement number, and this spec cites them. Apply starts after #1257 merges, or on a branch stacked on it. |
| The working tree and HEAD disagree, so the card and the drawer show different counts | Med | Each surface names its source (R2). The spec pins the labels. |
| The hierarchy shape drifts against #1251 (resolver) | Med | The adapter matches the ticket-hierarchy resolver contract (#1251; ADR-0039 in draft) exactly; #1251 swaps only the source. |
| A just-closed child is briefly absent from its epic's total, for about one interval (#1257's closed lane) | Low | The child is never shown as open or closed wrongly. |
| The cluster cards and the rollup can differ for nested epics | Low | By ruling: the cluster omits a child epic (R1032-2), the rollup counts it (R9). |

## Size forecast

About 330 gated lines added and 20 removed, about 350 changed, excluding tests, against the `lite` budget of 1000 (see `design.md`, "Size"). One PR.

## Rollback

Revert the PR. There is no data migration and no config key. The `progress` and `hierarchy` fields are additive, so consumers that ignore them are unaffected. Reverting this change does not require reverting #1257.

## Success criteria

- [ ] A fixture `tasks.md` with 3 of 5 boxes checked shows `3 / 5` on the card, the SDD view, the drawer and in snapshot `progress`.
- [ ] A missing `tasks.md`, an unreadable one, and one with zero checkboxes each show a distinct reason, never `0/0`.
- [ ] An epic shows closed/total children, and unknown-state children are counted separately.
- [ ] The page and the snapshot agree: both consume one `progress` shape and one adapter contract.
- [ ] An epic's rollup reads "counting closed children…" while `forgeLoad.closed` is `pending`, and never shows 0 for it.
- [ ] `brain/scripts/lib/ticket-hierarchy.mjs` does not exist.

## Proposal question round

R1–R6 settled the main decisions. These questions were open for the maintainer:
- Should a zero-checkbox `tasks.md` read as "not planned yet" or as "no tasks"? The reason text is user-facing.
- Does an epic with no children show a rollup at all, or a stated "no children"?
- Should the lane header rollup count only direct children, or nested descendants as well?

The orchestrator's defaults are R7, R8 and R9 in the rulings table. The maintainer may override any of them.
