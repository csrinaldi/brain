---
status: approved
issue: 1312
---

# Proposal — cards-show-pr-and-verdict (issue 1312)

## What

A lane card whose issue has a joined open PR gets one footer line: the PR number, the latest
brain review verdict on it and that verdict's `rev`, with the verdict's head named against the
branch tip this clone holds. The footer comes only from snapshot sections that are already
served (`prs`, `reviews`, `remoteChanges`). Nothing is fetched to draw it.

## Why

Issue #1312. A card shows a number, its state and track chips, its title, and at most the SDD
strip and the remote-branch lines (`static/app.js:987` `renderNodeCard`). It never shows a
review verdict. It names a PR only through a remote-branch line (`remote-model.mjs:30`), so a PR
whose branch this clone has not fetched is not named on the card at all. The design
(`stitch_brain_ui_dashboard_design_system/brain_ui_interactive_surface/code.html:264-272`) puts
"PR #885 (Round 2)" and "Verdict: REVISE (1)" at the foot of an in-flight card.

The data is already in the snapshot: `prs` (`status/snapshot.mjs:494`) joins every open PR to its
issue through `issueOfBranch`, and `reviews` (`snapshot.mjs:187` `reviewRows`) holds every parsed
verdict per PR. `review-timeline.mjs:114` `buildReviewTimeline` already joins the two for the
Reviews mode and the Verdict queue. The card is the one view of this data that does not read it.

### A finding that changes how the issue reads

The "Awaiting review" chip on #1230, #1245, #1248 and #1256 does NOT mean "waiting on a PR
review". `epic-graph.mjs:764` sets `awaiting-human` when an issue lacks `status:approved`, and
`state-vocab.mjs:47` maps that to the "Awaiting review" label. Those cards wait on a human
approving the ISSUE. This change only names a PR and a verdict that were actually read. An
unapproved issue with no open PR still gets no footer. Whether those four issues have open PRs
was not checked here, because this phase has no forge access.

## Scope

- Includes:
  - A pure model that derives a card's review footer from `prs`, `reviews` and `remoteChanges`,
    reusing `buildReviewTimeline` and adding no second verdict derivation.
  - The footer on every card drawn by `renderNodeCard`: track-lane cards (`app.js:983`) and
    epic-cluster child cards (`app.js:821`). The `?` batch tiles do not draw through
    `renderNodeCard` and are out of scope.
  - Honest states: PR named with no verdict posted, review thread unreadable, verdict on a head
    that differs from the local branch tip, head comparison unknown.
- Excludes:
  - Merged PRs. `prs` is open-only (#1069), and reading merged PRs is #1121's job.
  - Any new forge read, any new snapshot section, and any change to `snapshot.mjs`.
  - Tasks progress. The SDD strip already shows it through `progressLabel` (#1199), and the
    footer does not add a second count.
  - Verdicts from the #880 record store. Until #880 lands, a verdict is a forge comment.
  - Changes to the meaning of the state chip.

## Approach

`lib/card-review-model.mjs` (new, pure) calls `buildReviewTimeline(reviews, prs)` once, indexes
its threads by issue, and gives each issue a footer row. `app.js` computes that index once per
render, the same way `currentWork()` does, and `renderNodeCard` adds one line to the card. See
design.md.

## Risks

- `remoteChanges` holds the clone's last-fetched tip, not the forge head. A head comparison can
  therefore lag. The footer states the two SHAs it compared and draws no conclusion from them.
- `prs` and `reviews` load in the same forge lane. While that lane is pending, no card has a
  footer, so the footer's absence does not prove that no PR exists.
