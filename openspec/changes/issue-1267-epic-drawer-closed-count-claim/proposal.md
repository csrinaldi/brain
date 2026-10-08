---
status: approved
approved: 2026-10-04 (issue #1267 carries status:approved)
issue: 1267
---

# Proposal — epic-drawer-closed-count-claim (issue 1267)

## Intent

Round-2 cold review of #1265 (#1199) returned two corrections, deferred here.

1. `renderChildren` (`brain/scripts/ui/static/app.js`) always appends "the list shows open children; closed children are counted above" under an epic's rollup. `epicRollup` returns `closed: null` when the closed lane is pending or disabled, when it failed with no `lastCompleteAt`, and when `closedRead.ok` is false. In those states the sentence above reads "counting closed children…", "closed children not read (…)" or "closed children unknown (…)". Nothing is counted, and the note says it was.
2. `openspec/changes/issue-1199-progress-epic-milestone/design.md` (D59, D60, Risks) still lists the unreadable-closed-list gap as open. Commit `bea6a853` (#1265) shipped `closedRead` (`readHierarchy` adds it; `epicRollup` counts only when `hasClosedData(lane) && closedRead.ok`). The design never mentions it and names a follow-up that no longer exists.

## Scope

### In
- A pure `rollupNote(rollup)` in `brain/scripts/ui/lib/rollup-model.mjs`: the sentence when a count exists, `null` otherwise. `app.js` renders it only when it is non-null.
- Render tests for each uncounted state and for the counted case.
- Annotate D59, D60 and Risks of #1199's design in place ("Amended by #1267").
- A sweep of the UI for the same class (a fixed sentence about a value that can be null).

### Out
- The rollup sentence itself (`rollupLabel`) and the cluster heading. They already word every state.
- Any change to `epicRollup`, `closedRead` or the poller.

## Approach

Omit the note when nothing was counted (the acceptance allows "show only when `closed !== null`"). The rollup sentence above already says why nothing is counted, so a replacement sentence would repeat it.

## Risks

None beyond the omission: in an uncounted state the drawer lists open children with no remark about closed ones. The sentence above says closed children are not counted.

## Size

Under 40 gated lines. One PR.

## Success criteria

- In each of the five uncounted states the epic drawer renders no "counted above" text.
- In the counted case (including a failed refresh over a complete list) the note stays.
- #1199's design describes `closedRead` as shipped and names no follow-up for it.
