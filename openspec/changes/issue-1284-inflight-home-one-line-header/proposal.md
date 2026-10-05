---
status: draft
issue: 1284
---

# Proposal: In-flight home section, one-line header, quieter cards (issue #1284)

## Intent

The UI home does not answer the first question an operator asks: what is in flight right now. The
data exists in four snapshot sections, but nothing joins it, and the raw sections mislead. Most
change dirs and pushed branches belong to closed issues. The header wraps because it carries a long
epic-join sentence. Cards with no work behind them repeat an absence line. This change adds one
honest in-flight list, collapses the header to one line, and removes the card noise. Nothing the
header shows today is lost.

## Measured facts (live snapshot, 2026-10-04)

| Source | Measurement | Consequence |
|---|---|---|
| `changes` | 57 non-archived change dirs on main; 54 belong to CLOSED issues (archive sweep lag); only #267, #284, #864 open | an open-state filter is mandatory |
| `remoteChanges` | 23 branches over 17 issues, 13 of them CLOSED (`hidden` filters only base/lane/merged); #978 has 7 branches; `.pr` null on all; `prs` had 0 open | same open filter; branches aggregate per issue |
| `localWorktrees` | 18 entries for open issues, 9 distinct issues (#1114 x6, #1263 x5); #1273 and #1283 have dirState `missing` | ONE ROW PER ISSUE; a worktree with no change dir is still in flight |
| activity | worktrees carry `touchedAt`, branches carry `tipAt` | these are the activity sources |
| issue state | from `hierarchy` (`open` / `closed` / `null`) | null needs an explicit rule (R-F) |

## Maintainer rulings (binding)

- **R-A (stale)**: show ALL in-flight issues, most recent activity first. Issues with no activity for 7 days or more go below, in a collapsed, counted `stale (N)` group. The 7 days is a named constant. Stale issues are visible and counted, never hidden.
- **R-B (definition)**: an issue is in flight when it is OPEN and has at least one of these: a change dir naming it on the served tree (`changes`), a local worktree holding it (`localWorktrees`), or a pushed branch or open PR joined to it (`remoteChanges`, `prs`). Other developers' work counts too, and the row names the author.
- **R-C (partial data)**: while a source section is pending or has failed, the section names the missing source. It never claims "nothing in flight" or a complete list.
- **R-D (epic)**: `EPIC_JOIN_PENDING` (`lib/header-model.mjs:23`) leaves the header. A short `epic: not resolved` stays. The explanation is reachable through the `title` attribute and the existing `#banners` band.
- **R-E (cards)**: a card with no change dir and no local or remote work drops the `no change directory names issue #N` line (`lib/sdd-model.mjs:273`). The drawer still states the absence.
- **R-F (unknown state)**: an issue whose `hierarchy` state is `null` is included and marked `state unknown`. It is never silently dropped and never counted as done. Ruled 2026-10-04.
- **R-G (activity of a change-dir-only row)**: when an issue is in flight only through a change dir on the served tree, its activity time is the date of the last commit touching that dir on the served tree (`git log -1`, local). If that read fails, the row sits at the end of the main list marked `activity unknown`. It is never put in the stale group, because staleness was not measured. Ruled 2026-10-04.
- **R-H (placement)**: the in-flight section sits above the existing track lanes on Map & tracks. The lanes and the `?` holding lane stay below it, changed only by R-E. From the approved issue body.

## Scope

### In scope
- **A. In-flight section**: a pure model (new `lib/inflight-model.mjs`) joins the four sources, filters to open issues, aggregates one row per issue (worktrees, branches, PRs, change dir, author), sorts by latest activity, and splits off stale rows. A renderer in `app.js` draws the section on the home view.
- **B. One-line header**: `renderStatus` / `buildHeaderModel` produce a single line (served branch, epic short form, poll state). Degraded detail moves to the separate band, following the design reference `brain_ui_minimalist_surface_3/screen.png`.
- **C. Card noise**: R-E in `sddForIssue` / `renderNodeSdd`.

### Out of scope (non-goals)
- Missing views from the design reference.
- Dark theme as the default.
- The FIND bar's height.
- Resolving the epic join itself (R-D only shortens how it is shown).
- Fixing the archive sweep lag (it is measured here, not fixed).

## Capabilities

### New Capabilities
- `ui-inflight-home`: the in-flight definition, aggregation, ordering, stale grouping, partial-source honesty, the one-line header, and the card absence rule.

### Modified Capabilities
- None. No UI spec exists in `openspec/specs/`.

## Approach

The join logic lives in pure `lib/*-model.mjs` modules, tested without a DOM. `app.js` only renders, inside the limits that `app-source-guard.test.mjs` enforces. The first render uses the tree and cache sections. Forge-backed sections (`hierarchy`, `prs`, `remoteChanges`) arrive progressively, and the section states which ones are still loading (#1257).

## Affected Areas

| Area | Impact |
|---|---|
| `brain/scripts/ui/lib/inflight-model.mjs` | New |
| `brain/scripts/ui/lib/header-model.mjs`, `lib/banners.mjs` | Modified |
| `brain/scripts/ui/lib/sdd-model.mjs` | Modified (line 273) |
| `brain/scripts/ui/static/app.js` (`renderStatus`, `renderBands`, home section, `renderNodeSdd`) | Modified |
| `brain/scripts/ui/static/*.css` | Modified |

## Acceptance criteria

- [ ] Given the 2026-10-04 shapes, closed-issue change dirs and branches produce no row; #267, #284 and #864 do.
- [ ] #1114 (6 worktrees) and #1263 (5 worktrees) each produce exactly one row; #978's 7 branches produce one row.
- [ ] #1273 and #1283 (`dirState` `missing`) appear as in flight.
- [ ] Rows are ordered by the latest of `touchedAt`, `tipAt` and, for a change-dir-only row, the last commit touching the dir (R-G), newest first. A row inactive for at least `STALE_DAYS` (7) days sits in a collapsed `stale (N)` group, and N equals its row count.
- [ ] A `null`-state issue renders with `state unknown` and is not dropped.
- [ ] A row for another developer's work names its author.
- [ ] With any source pending or failed, the section names that source and never renders "nothing in flight".
- [ ] The first render does not wait on the forge.
- [ ] The header renders on one line: it contains `epic: not resolved` and not the `EPIC_JOIN_PENDING` text, and the full reason is in `title` and in `#banners`.
- [ ] Every field the header shows today is still reachable.
- [ ] A card with no work omits the absence line, and its drawer still states it.

## Size estimate

Tier `lite`, budget 1000 gated lines. Estimated ~350–500 gated lines (model ~150, app.js ~150, header/banners ~60, CSS ~60). Tests are excluded from the budget.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `app-source-guard` limits push logic into app.js | Med | keep the join in a lib model |
| Activity is undefined for a row backed only by a change dir | Med | open question 1 |
| A slow `hierarchy` read empties the list | Med | R-C: state the pending source, render rows provisionally |

## Rollback Plan

UI-only and read-only. Revert the merge commit. No data, config or snapshot schema changes.

## Open questions

None. Questions 1-3 of the first draft were ruled on 2026-10-04 (R-F, R-G, R-H). The scope was checked against the body of issue #1284 by the orchestrator.
