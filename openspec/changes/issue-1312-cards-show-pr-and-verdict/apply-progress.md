---
issue: 1312
---

# Apply progress — cards-show-pr-and-verdict (issue 1312)

Mode: Strict TDD. All 5 phases complete (tasks.md fully ticked). Single PR; delivery ask-on-risk, no exception needed (gated diff 119 added / 7 deleted).

## TDD cycle evidence

| Task | RED (failing first) | GREEN | REFACTOR |
|---|---|---|---|
| 1 headSha | `review-timeline.test.mjs` D149: `headSha` undefined | `shapeRound` adds `headSha` | none needed |
| 2 footer model | `card-review-model.test.mjs`: module not found (12 tests) | `card-review-model.mjs`; two source-guard tweaks (no `.at(-1)`, title wording without "current") found by the tests | none |
| 3 omitPrs | `remote-model.test.mjs` D147: option ignored | `omitPrs` on `remoteBadges` | none |
| 4 page | `review-footer-render.test.mjs`: 7 of 9 failing (no `node-review`) | `currentCardReviews`, `renderNodeReview`, `omitPrs` pass, CSS | `remote-render.test.mjs` and app-source-guard stay green |

## Deviations

- D148 amended: the footer wraps instead of using a CSS ellipsis, because the real-browser capture showed the ellipsis clipped `origin tip here`, the fact the line exists to state.
- The browser proof ran the server from the worktree (the code under test), not from `/home/gandalf/IA/brain`.
- No open PR joined a card at capture time (the only open PR, #1361, belongs to closed issue #1115). The screenshot uses a local proxy that injects a synthetic PR, verdicts and a differing origin tip into the served snapshot and stream; the page code is unchanged.

## Mutations (each failed a test, then reverted)

1. Footer derives its own verdict (`thread.rounds.at(-1)`): source-guard test fails.
2. Footer shown while `prs` pending (`show: true`): S5 model test fails.
3. PR named twice (`omitPrs: []`): S10 render test fails.
4. Lower-numbered PR chosen: S7 model test fails.
5. Head mismatch hidden (`differs` becomes `null`): two S4 tests fail.

## Batch 2 (review round 1) — cold-1: a never-fetched thread reads "unreadable"

Fixed at the source (D150, R1312-6, S6b). `forge-cache` stamps every miss with `code: NOT_FETCHED_YET` (exported from `status/report.mjs`); `reviewRows` emits `{pr, ok:false, pending:true, reason}` for it, any other failure stays `{pr, ok:false, reason}`; `threadState` maps pending to `queued`.

| Test | RED | GREEN |
|---|---|---|
| forge-cache marker, snapshot row, timeline `queued`, card model, footer render, Reviews view, change-route, drawer | 8 failing (missing export, then wrong wording) | marker + mapping in each consumer |

Sweep of review-thread consumers:

- Card footer `ui/lib/card-review-model.mjs` footerOf: fixed.
- Verdict queue / Reviews view `ui/lib/review-timeline.mjs` threadState + totals.queued, `ui/static/app.js` renderReviews summary and renderReviewThread: fixed.
- Drawer Reviews tab `ui/change-route.mjs` buildReviewsTab (carries `pending`, all-queued reason) and `ui/lib/drawer-model.mjs` reviewEntries: fixed.
- Snapshot report line `status/snapshot.mjs` (reviews): fixed (counts not read yet apart).
- `roadmapState` (`status/snapshot.mjs`): unaffected, filters `r.ok` and words nothing.
- `ui/lib/actors-model.mjs` reviewCountsByAuthor: unaffected, skips `!ok` and words nothing.

Mutation: threadState no longer maps pending to `queued` -> 4 tests failed (model, timeline, footer render, Reviews view); reverted.
