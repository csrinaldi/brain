---
status: approved
issue: 1312
---

# Tasks — cards-show-pr-and-verdict (issue 1312)

Strict TDD: every phase is RED → GREEN → REFACTOR. A RED task names the test and why it fails today; a GREEN task makes exactly that test pass with the least code; a REFACTOR task changes no behaviour and keeps the suite green. Test runner: `npm test`; one file runs with `node --test <path>`. No network and no real timers. Requirement and decision numbers refer to `spec.md` and `design.md` (decisions D139–D149).

**Gate before apply: cleared.** The maintainer ruled (a)–(e) on 2026-10-05 (all recommended defaults); the rulings are recorded in design.md and spec.md.

## Phase 1 — One verdict derivation, one full head (R1312-2, R1312-4, D140, D149)

- [x] 1.1 RED — `ui/lib/review-timeline.test.mjs`: a round carries `headSha` (full) next to `headSha7`; the queue entry is unchanged. **Fails today:** `headSha` is `undefined`.
- [x] 1.2 GREEN — `shapeRound` gains `headSha`.

## Phase 2 — The pure footer model (R1312-1..6, R1312-8, D139–D145, D148)

- [x] 2.1 RED — `ui/lib/card-review-model.test.mjs`, fixtures built with the real `reviewRows`: S1 (latest rev and verdict, head named), S2 (no verdict posted), S3 (unreadable thread, reason in the title), S4 (head same / differs / no branch, never the word "stale", title carries the full SHAs and the "as of the last fetch" caveat), S6 (reviews pending, idle and failed), S7 (highest number plus `+1 open PR`), S9 (unknown word marked unrecognised), S5 (prs pending/idle/failed give `show: false` and no entry), no tasks count (R1312-8), an issue with no PR has no entry. **Fails today:** the module does not exist.
- [x] 2.2 GREEN — create `ui/lib/card-review-model.mjs`: `cardReviewIndex` calls `buildReviewTimeline`, groups threads by issue and builds `{pr, more, verdict, head, note, reason, text, title}`.
- [x] 2.3 RED — a source test: the module imports `buildReviewTimeline` and never reads `reviews[].latest` or `verdicts` itself (R1312-7, D140).
- [x] 2.4 GREEN — nothing to change if 2.2 respected it; otherwise fix the module.

## Phase 3 — The card names the PR once (R1312-9, D147)

- [x] 3.1 RED — `ui/lib/remote-model.test.mjs`: `remoteBadges(section, issue, now, {omitPrs: [31]})` drops `PR #31` from that line only; another PR's line keeps its part; the default call is unchanged. **Fails today:** the option is ignored.
- [x] 3.2 GREEN — `omitPrs` on `remoteBadges`.

## Phase 4 — The page (R1312-1, R1312-6, R1312-7, R1312-9, D148)

- [x] 4.1 RED — `ui/static/review-footer-render.test.mjs` on the real `app.js` and the fake DOM: S1 footer text and title on a card; S5 no footer while `prs` is pending and the render makes no forge call; S6; S8 (no PR, no footer); S10 (`PR #885` once on the card, remote panel unchanged); a hostile verdict word renders as text, no element; epic-cluster child cards carry the footer. **Fails today:** no `node-review` element.
- [x] 4.2 GREEN — `app.js`: `currentCardReviews()`, `renderNodeReview`, the line in `renderNodeCard`, `omitPrs` passed in `renderNodeRemote`; `app.css`: `.node-review` and its verdict classes.
- [x] 4.3 REFACTOR — `app-source-guard.test.mjs` and `remote-render.test.mjs` stay green.

## Phase 5 — Closing

- [x] 5.1 `npm test`, `npm run brain:repo:check`, `npm run brain:nav`, gated diff, `node --test test/publish-allowlist.e2e.test.mjs`.
- [x] 5.2 Mutations, each failing a test and then reverted: footer derives its own verdict; footer shown while `prs` pending; PR named twice; lower-numbered PR chosen; head mismatch hidden.
- [x] 5.3 Real-browser capture of a card with an open PR, or an honest statement that none joins a card.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~140-180 gated (`*.test.mjs`, `openspec/changes/**` and `.memory/**` excluded) |
| Governance tier budget (`lite`) | 1000 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | None |
| Delivery strategy | ask-on-risk |
| Chain strategy | Not applicable |

Decision needed before apply: No (all five questions ruled 2026-10-05)
Chained PRs recommended: No
Chain strategy: not applicable
