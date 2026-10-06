---
status: draft
issue: 1284
---

# Spec — inflight-home-one-line-header (issue 1284)

Capability: `ui-inflight-home` (new). Delta requirements: what MUST be true after this change. The proposal's rulings R-A through R-H are binding and are cited by number. Requirement keywords follow RFC 2119. Every requirement not named here is unchanged.

Scenario grammar: each scenario carries exactly one `WHEN` line and one `THEN` line, with an optional `GIVEN`, so the Spec tab (`ui/lib/spec-cards.mjs`) renders it in full. A scenario with several outcomes states them in its single `THEN` line.

Fixed values used throughout:

- **Sources**: the snapshot sections `changes` (non-archived change dirs on the served tree), `localWorktrees` (this machine's worktrees), `remoteChanges` (pushed branches joined to issues) and `prs` (open pull requests). Issue state comes from `hierarchy`: `open`, `closed` or `null`.
- **In flight**: an issue that is `open` (or has `null` state, R1284-3) and is named by at least one source entry (R-B).
- **`STALE_DAYS`**: a named constant, value 7, exported by `lib/inflight-model.mjs`.
- **Activity time** of a row: the latest of its worktrees' `touchedAt`, its branches' `tipAt` and the date of the last commit touching its change dir on the served tree (R-G), whenever that read succeeded. Absent values are ignored. Only when none of those exists, a bare worktree's head commit time (D103) is the fallback.
- **Pure model**: `lib/inflight-model.mjs`, tested without a DOM. **Render tests** use the fake DOM (`test-support/dom.mjs`, `load-app.mjs`).

## The in-flight list

### R1284-1: Only open issues are in flight, over all three sources (R-B)

The model MUST build one candidate per issue number named by any entry of `changes`, `localWorktrees`, `remoteChanges` or `prs`. A candidate MUST become a row only when its `hierarchy` state is `open` or `null` (R1284-3). A candidate whose state is `closed` MUST produce no row, whichever source names it, and MUST NOT be counted in the stale group or anywhere in the section. Work by other developers counts: a row MUST NOT be dropped because the work is not on this machine. A worktree whose `dirState` is `missing` MUST still make its issue in flight.

#### Scenario: Closed-issue change dirs and branches produce no row
- **GIVEN** a snapshot with 57 non-archived change dirs of which only #267, #284 and #864 are open, and 23 remote branches over 17 issues of which 13 are closed
- **WHEN** the model builds the in-flight list
- **THEN** no row exists for any closed issue, and #267, #284 and #864 each have a row

#### Scenario: A worktree with a missing change dir is in flight
- **GIVEN** open issues #1273 and #1283 each held by a local worktree with `dirState` `missing` and named by no other source
- **WHEN** the model builds the in-flight list
- **THEN** both issues have a row

### R1284-2: One row per issue, aggregating its work and naming its author (R-B)

The model MUST emit exactly one row per in-flight issue. The row MUST aggregate every local worktree, every pushed branch, every open PR and the change dir (when present) of that issue, and MUST expose their counts. The row MUST name the author of other developers' work (the author of a branch tip or PR); it MUST NOT claim an author it could not read.

#### Scenario: Many worktrees and branches collapse to one row
- **GIVEN** open issue #1114 with 6 worktrees, open issue #1263 with 5 worktrees, and open issue #978 with 7 pushed branches
- **WHEN** the model builds the in-flight list
- **THEN** each of the three issues has exactly one row, and the rows report 6, 5 and 7 as their worktree or branch counts

#### Scenario: Another developer's branch names its author
- **GIVEN** open issue #500 with one pushed branch whose tip author is `ana` and no local worktree
- **WHEN** the model builds the in-flight list
- **THEN** the row for #500 names `ana`, and the rendered row's text contains `ana`

### R1284-3: An unknown state is included and marked (R-F)

An issue whose `hierarchy` state is `null` MUST be included as a row marked `state unknown`. An issue that `hierarchy` does not list is not open and MUST NOT get a row, because the open list feeds the hierarchy completely (design D96, ruled 2026-10-04). It MUST NOT be dropped and MUST NOT be presented as done or closed. The rendered row MUST carry the text `state unknown`.

#### Scenario: A null-state issue is kept
- **GIVEN** issue #700 named by a worktree and whose `hierarchy` state is `null`
- **WHEN** the section renders
- **THEN** the row for #700 is present and its text contains `state unknown`

### R1284-4: Activity time and the unknown-activity placement (R-A, R-G)

Each row's activity time MUST be the latest of every measured time among its worktrees' `touchedAt`, its branches' `tipAt` and the date of the last commit touching its change dir on the served tree (read locally, never the forge); the change dir's last commit participates whenever its read succeeded, not only for change-dir-only rows. A worktree's head commit time (D103) MUST be used only as a fallback when none of those three exists; it MUST NOT win over a measured time even when it is newer. When the last-commit read fails or yields no date and no other source gives a time, the row MUST be marked `activity unknown`, MUST be placed at the end of the main list, and MUST NOT be placed in the stale group.

#### Scenario: The latest of the available times wins
- **GIVEN** issue #900 with a worktree `touchedAt` of 2026-10-01 and a branch `tipAt` of 2026-10-03
- **WHEN** the model computes the row
- **THEN** the row's activity time is 2026-10-03

#### Scenario: A fresher change-dir commit beats an older branch tip
- **GIVEN** open issue #901 with a branch `tipAt` of 2026-10-01 and a change dir whose last commit is dated 2026-10-03
- **WHEN** the model computes the row
- **THEN** the row's activity time is 2026-10-03

#### Scenario: The head commit time is a fallback only
- **GIVEN** open issue #902 with a worktree `touchedAt` of 2026-10-01 and `headCommitAt` of 2026-10-03
- **WHEN** the model computes the row
- **THEN** the row's activity time is 2026-10-01

#### Scenario: A change-dir-only row uses the last commit on the dir
- **GIVEN** open issue #267 named only by a change dir whose last commit on the served tree is dated 2026-09-30
- **WHEN** the model computes the row
- **THEN** the row's activity time is 2026-09-30

#### Scenario: A failed last-commit read is unknown, not stale
- **GIVEN** open issue #284 named only by a change dir and a last-commit read that fails
- **WHEN** the model builds the list
- **THEN** the row for #284 is marked `activity unknown`, sits after every dated row in the main list, and is not in the stale group

### R1284-5: Ordering and the stale group (R-A)

The main list MUST be ordered by activity time, newest first, with `activity unknown` rows last; ties MUST break by issue number ascending so the order is deterministic. A row whose activity time is at least `STALE_DAYS` days before the model's reference time MUST be moved to a stale group rendered below the main list, collapsed by default, headed `stale (N)` where N equals the group's row count. Stale rows MUST be visible on expanding and counted; they MUST NOT be hidden or dropped. The reference time MUST be injected (not read from the clock inside the model).

#### Scenario: A row inactive for 7 days is stale
- **GIVEN** a reference time of 2026-10-04 and rows with activity 2026-10-03, 2026-09-27 and 2026-09-01
- **WHEN** the model splits the list
- **THEN** the main list holds only the 2026-10-03 row, the stale group holds the other two, and the rendered group header reads `stale (2)`

#### Scenario: Newest activity first
- **GIVEN** three fresh rows with activity 2026-10-01, 2026-10-04 and 2026-10-02
- **WHEN** the model orders the main list
- **THEN** the order is the 2026-10-04 row, the 2026-10-02 row, then the 2026-10-01 row

## Honesty about partial data

### R1284-6: A pending or failed source is named, never "nothing in flight" (R-C)

While any of `changes`, `localWorktrees`, `remoteChanges`, `prs` or `hierarchy` is pending or failed, the section MUST name each such source (with its failure reason when failed) and MUST NOT render "nothing in flight" or any wording that claims a complete list. Rows computable from the sources already read MUST render provisionally alongside that notice. A source that is pending MUST be worded distinctly from one that failed.

#### Scenario: A pending forge source is named
- **GIVEN** `remoteChanges` pending and `localWorktrees` ready with one open issue held
- **WHEN** the section renders
- **THEN** the section names `remoteChanges` as still loading, shows the worktree row, and its text contains neither `nothing in flight` nor a claim that the list is complete

#### Scenario: A failed source is named with its reason
- **GIVEN** `hierarchy` failed with reason `rate limited` and no other source names an issue
- **WHEN** the section renders
- **THEN** the section names `hierarchy` and `rate limited`, and its text does not contain `nothing in flight`

### R1284-7: An empty list over complete sources is worded as such (R-C)

Only when every source is ready and no issue is in flight, the section MUST render a distinct empty statement (`no open issue is in flight`). This wording MUST NOT appear when any source is pending or failed, and the partial-data wording of R1284-6 MUST NOT appear when every source is ready.

#### Scenario: Complete and empty
- **GIVEN** all five sources ready and every candidate issue closed
- **WHEN** the section renders
- **THEN** it states `no open issue is in flight` and names no pending or failed source

#### Scenario: Empty but partial is not the empty statement
- **GIVEN** `prs` pending and no row from the other sources
- **WHEN** the section renders
- **THEN** the text names `prs` and does not contain `no open issue is in flight`

### R1284-8: The first render never waits on the forge

The first render of the section MUST use only the tree and cache sections (`changes`, `localWorktrees`) and MUST NOT block on `hierarchy`, `prs` or `remoteChanges`. Each forge-backed section MUST be applied as it arrives, re-rendering the section, with the not-yet-arrived ones named per R1284-6. The model MUST be pure: it MUST make no network call and no git call (the R-G last-commit dates are passed in as data).

#### Scenario: Forge sections pending at first paint
- **GIVEN** a snapshot with `changes` and `localWorktrees` ready and `hierarchy`, `prs`, `remoteChanges` pending
- **WHEN** the home view first renders
- **THEN** the section is already present, draws no row (the open/closed filter cannot run yet, D96 ruled 2026-10-04), states the candidate count from the ready sources, and names the three pending sources

#### Scenario: A late section updates the section
- **GIVEN** the section rendered the candidate count while `hierarchy` was pending
- **WHEN** `hierarchy` arrives marking one candidate's issue closed
- **THEN** rows are drawn for the open candidates only, the closed one gets no row, and `hierarchy` is no longer named as pending

### R1284-9: The section sits above the lanes and rows open the drawer (R-H)

On Map & tracks the in-flight section MUST be rendered above the existing track lanes; the lanes and the `?` holding lane MUST remain below it. Activating a row MUST open the same drawer as clicking that issue's card. Every string the section renders MUST be set through `textContent` (the page's `el()`).

#### Scenario: Section precedes the lanes
- **GIVEN** the home view rendered with one in-flight row and at least one track lane
- **WHEN** the DOM order of the section and the first lane is compared
- **THEN** the in-flight section precedes the first lane and the `?` holding lane follows it

#### Scenario: A row click opens the drawer
- **GIVEN** a rendered row for issue #864
- **WHEN** the row is clicked
- **THEN** the drawer opens for issue #864

#### Scenario: A hostile author name is text
- **GIVEN** a branch whose tip author is `<img src=x onerror=alert(1)>`
- **WHEN** the section renders
- **THEN** the row's `textContent` holds that literal string and the section contains no `img` element

## The one-line header

### R1284-10: The header is a single line (R-D)

`buildHeaderModel` and `renderStatus` MUST produce a header of exactly the served branch, the epic short form and the poll state, in one line with no wrapped sentence. When the epic is not resolved, the visible header text MUST contain `epic: not resolved` and MUST NOT contain the `EPIC_JOIN_PENDING` text.

#### Scenario: Unresolved epic shortened
- **GIVEN** a snapshot whose epic join is pending
- **WHEN** the header renders
- **THEN** its visible text contains `epic: not resolved` and does not contain the `EPIC_JOIN_PENDING` sentence

### R1284-11: Nothing the header shows today is lost (R-D)

Every fact the header shows before this change (degraded-source detail, the epic explanation, poll state and every other field `buildHeaderModel` currently yields) MUST remain reachable: the long epic explanation MUST be the header's `title` attribute and MUST also appear in the `#banners` band; other degraded detail MUST appear in the `#banners` band. The header MUST NOT carry a fact only in a place the operator cannot reach without devtools.

#### Scenario: The epic explanation moves, it is not deleted
- **GIVEN** a snapshot whose epic join is pending
- **WHEN** the header and the banners render
- **THEN** the header's `title` attribute equals the `EPIC_JOIN_PENDING` text, and `#banners` contains that text

#### Scenario: Degraded detail is reachable
- **GIVEN** a snapshot with a failed source that the header names today
- **WHEN** the header and the banners render
- **THEN** the failed source's name and reason appear in `#banners`

## Quieter cards

### R1284-12: A card with no work omits the absence line; the drawer keeps it (R-E)

A card for an issue with no change dir and no local or remote work MUST NOT render the `no change directory names issue #N` line. The drawer for that issue MUST still state the absence. A card with a local-only or remote-only line (worktree or branch without a change dir) MUST keep that line unchanged.

#### Scenario: No work, no absence line on the card
- **GIVEN** an issue with no change dir, no worktree and no pushed branch
- **WHEN** its map card renders
- **THEN** the card's text does not contain `no change directory names issue`

#### Scenario: The drawer still says it
- **GIVEN** the same issue
- **WHEN** its drawer opens
- **THEN** the drawer states that no change directory names the issue

#### Scenario: A remote-only card keeps its line
- **GIVEN** an issue with a pushed branch holding no change dir
- **WHEN** its map card renders
- **THEN** the card still renders its remote-only line

### R1284-14: A row shows its issue kind and tasks progress only when measured (#1284 scope A)

A row MUST show the issue kind (`epic`, `feature` or `ticket`, the `hierarchy` entry's `level`) only when that entry's `levelSource` is present and is not `default`, that is, when the level is declared. An entry whose level is the default, unreadable or absent MUST show no kind; the row MUST NOT print `ticket` as if it had been measured. A row MUST show tasks progress only when a non-archived change dir row of the served tree (`changes` section) names the issue and carries a `progress` value; the wording MUST be `progressLabel(progress, SOURCE.workingTree, {prefix: 'tasks'})` (#1199). A row held only by a worktree, branch or PR has no such change dir row and MUST show no progress, because the snapshot does not measure it.

#### Scenario: A declared level is shown
- **GIVEN** open issue #878 whose hierarchy entry has `level` `epic` and `levelSource` `block`
- **WHEN** the model builds the row and the section renders
- **THEN** the row's kind is `epic` and its text contains `epic`

#### Scenario: A default level shows nothing
- **GIVEN** open issue #903 whose hierarchy entry has `level` `ticket` and `levelSource` `default`
- **WHEN** the model builds the row and the section renders
- **THEN** the row has no kind and its text does not contain `ticket`

#### Scenario: Progress comes from the served tree's change dir
- **GIVEN** open issue #904 named by a change dir whose `progress` is 3 of 5, and open issue #905 named only by a remote branch
- **WHEN** the section renders
- **THEN** the row for #904 contains `tasks 3 / 5 · working tree` and the row for #905 contains no `tasks` text

## Bounds

### R1284-13: Read-only, no new data source, no schema change

This change MUST NOT write a file, call the forge from the model, add or alter a snapshot section's schema, or add a route. The one new read (R-G last commit on a change dir) MUST be a local, read-only git call whose result reaches the model as data. Logic that joins sources MUST live in `lib/inflight-model.mjs`, so `app.js` stays within the limits `app-source-guard.test.mjs` enforces.

#### Scenario: The model imports no I/O
- **GIVEN** the source of `lib/inflight-model.mjs`
- **WHEN** its imports are listed
- **THEN** it imports no `node:fs`, `node:child_process` or network module

## Out of scope

- Missing views from the design reference `brain_ui_minimalist_surface_3/screen.png`.
- Dark theme as the default.
- The FIND bar's height.
- Resolving the epic join itself; only how it is shown changes.
- Fixing the archive sweep lag.

## Traceability

| Item | Requirement | Scenarios proving it |
|---|---|---|
| R-B open filter, three sources | R1284-1 | Closed-issue change dirs and branches produce no row; A worktree with a missing change dir is in flight |
| R-B one row per issue, author | R1284-2 | Many worktrees and branches collapse to one row; Another developer's branch names its author |
| R-F unknown state | R1284-3 | A null-state issue is kept |
| R-G activity | R1284-4 | The latest of the available times wins; A change-dir-only row uses the last commit on the dir; A failed last-commit read is unknown, not stale |
| R-A order and stale | R1284-5 | A row inactive for 7 days is stale; Newest activity first |
| R-C partial data | R1284-6, R1284-7 | A pending forge source is named; A failed source is named with its reason; Complete and empty; Empty but partial is not the empty statement |
| First render, #1257 | R1284-8 | Forge sections pending at first paint; A late section updates the section |
| R-H placement, drawer, text-only | R1284-9 | Section precedes the lanes; A row click opens the drawer; A hostile author name is text |
| R-D header | R1284-10, R1284-11 | Unresolved epic shortened; The epic explanation moves, it is not deleted; Degraded detail is reachable |
| R-E cards | R1284-12 | No work, no absence line on the card; The drawer still says it; A remote-only card keeps its line |
| Kind and progress | R1284-14 | A declared level is shown; A default level shows nothing; Progress comes from the served tree's change dir |
| Read-only bounds | R1284-13 | The model imports no I/O |
