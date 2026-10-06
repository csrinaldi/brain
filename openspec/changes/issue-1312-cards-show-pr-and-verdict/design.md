---
status: approved
issue: 1312
---

# Design — cards-show-pr-and-verdict (issue 1312)

## Technical approach

A new pure module, `brain/scripts/ui/lib/card-review-model.mjs`, builds one index per render:
`cardReviewIndex({prs, reviews, remoteChanges}) -> {show: boolean, byIssue: Map<issue, Footer>}`.
It calls `buildReviewTimeline(reviews, prs)` (`review-timeline.mjs:114`) and groups its `threads`
by `issue`. That function is already the join the Reviews mode and the Verdict queue read
(`app.js:1227`, `app.js:1353`), so the verdict, the rev and the head have exactly one
derivation. `app.js` gains `currentCardReviews()`, the twin of `currentWork()` (`app.js:611`).
`renderNodeCard` (`app.js:987`) adds one `node-review` line after the SDD strip.

## Data shapes this design reads (measured)

| Section | Shape | Where |
|---|---|---|
| `prs` | `[{number, title, headBranch, issue}]`, OPEN PRs only, with no head SHA | `status/snapshot.mjs:494` |
| `reviews` | `[{pr, ok:true, verdicts:[{pr, head_sha, rev, verdict, author, findings, findingCount, malformed}], latest}]` or `{pr, ok:false, reason}` | `snapshot.mjs:187-204`, `:507-509` |
| `prs`/`reviews` while loading | both `pendingLane(forgeLoad.open)`, so they share one lane; `idle:true` means polling is paused | `snapshot.mjs:392-396`, `:427-431` |
| `reviews` when `prs` failed | `uncomputable('no PR list to read threads for …')` | `snapshot.mjs:500-501` |
| `remoteChanges.branches[]` | `{branch, sha (full), tipAt, author, issue, pr:{number,title}|null, …}`; the SHA is the CLONE's `origin/<branch>` | `status/remote-changes.mjs:73-75` |
| timeline round | `{rev, verdict, unknownVerdict, headSha7, author, findingCount, …}` | `ui/lib/review-timeline.mjs:36-57` |

`head_sha` is a full SHA. `verdictsAtHead` compares it by equality (`parse-verdict.mjs:381`).

## Decisions

| # | Decision | Rejected | Why |
|---|---|---|---|
| D139 | A new pure module, `card-review-model.mjs`, consumed by `renderNodeCard` | Adding a field to `lane-model.mjs` rows | `lane-model.mjs:35-39` documents that it never receives PRs, and five row builders would have to widen. The card's other strips (`remoteBadges`, `sddForIssue`) follow the same "pure model, read at render" pattern. |
| D140 | Verdict, rev and head come from `buildReviewTimeline`'s `thread.latest` | Re-reading `reviews[].latest` or `roadmapState`'s `.at(-1)` (`snapshot.mjs:92-94`) | One derivation (#280's "consumes, never duplicates"). `roadmapState`'s pick across several PRs depends on list order. |
| D141 | "Latest" means the last parsed verdict in the PR's thread, whatever its head | Only a verdict on the current head | `prs` carries no forge head (`snapshot.mjs:494`), so "current head" cannot be measured. D142 states the head instead. |
| D142 | The head is stated, never judged: `head a1b2c3d` alone; `· tip here` when it equals the `remoteChanges` branch SHA for `pr.headBranch`; `· origin tip here e4f5a6b` when it differs | Calling it "stale" the way `deriveReview` does | `remoteChanges` holds the last-fetched ref, which can lag the forge in either direction. "Stale" would be an inference the data cannot back. Ruled (a). |
| D143 | Several open PRs: name the highest-numbered PR and count the rest (`+k open PR(s)`) | Refusing the way R1276-3 does, or naming every PR | A small card. The highest number is the most recently opened PR, and the count keeps the others visible. Ruled (e). |
| D144 | When `prs` is not `ok`, no card shows a footer; the band and the In flight notices already name the lane | A per-card marker | With a lane pending, a marker on every card adds noise and says nothing new. Ruled (c). |
| D145 | `prs` ok and `reviews` pending → `verdict not read yet`; `reviews` failed → `verdicts could not be read`; thread `ok:false` → `review thread unreadable` with the reason as the hover title | Hiding the PR | The PR was read. Hiding it would be empty-on-failure. |
| D146 | The footer shows no tasks count | Copying the design's "Tasks n/m" into the footer | The SDD strip already prints `progressLabel` (`app.js:922`). A second count could disagree with it. |
| D147 | The remote line on a card drops `PR #n` when the footer names `#n`, through a `remoteBadges(…, {omitPrs})` option; the panel calls it unchanged | Two mentions of the PR on one card | Card budget. Ruled (d). |
| D148 | Footer text: `PR #885 · rev 2 · REVISE · head a1b2c3d · tip here`, with an optional ` · +1 open PR`. The text wraps (amended at apply: a CSS ellipsis clipped `origin tip here` at card width, hiding the fact the line exists to state), the full SHAs and reasons in `title` | Two lines, as in the design | The card already carries up to 2 remote lines and the SDD strip. |
| D149 | `shapeRound` gains `headSha` (full) next to `headSha7` | Prefix-comparing 7 characters | Exact equality, as `verdictsAtHead` does. Additive, so the queue and the drawer are untouched. |

## Data flow

    state.sections ─┬─ prs ─────────┐
                    ├─ reviews ─────┼─ buildReviewTimeline ─┐
                    └─ remoteChanges ────────────────────────┴─ cardReviewIndex ─ renderNodeCard ─ .node-review

## Interfaces

```js
// Footer = { pr, more, verdict: null | {word, rev, unknown}, head: null | {sha7, tip: 'same'|'differs'|null, tipSha7},
//            note: null | 'no verdict posted' | 'review thread unreadable' | 'verdict not read yet' | 'verdicts could not be read',
//            reason: string|null, text: string }
export function cardReviewIndex({ prs, reviews, remoteChanges }) // -> { show, byIssue }
```

## File changes

| File | Action | What |
|---|---|---|
| `brain/scripts/ui/lib/card-review-model.mjs` | Create | the index and the footer text (about 90 lines) |
| `brain/scripts/ui/lib/review-timeline.mjs` | Modify | `headSha` on the round (+1 line) |
| `brain/scripts/ui/lib/remote-model.mjs` | Modify | the `omitPrs` option on `remoteBadges` (+5 lines) |
| `brain/scripts/ui/static/app.js` | Modify | `currentCardReviews()`, the footer in `renderNodeCard`, `omitPrs` passed in `renderNodeRemote` (+30 lines) |
| `brain/scripts/ui/static/app.css` | Modify | `.node-review` and its verdict classes (+15 lines) |

## Testing (strict TDD)

| Layer | What | How |
|---|---|---|
| Pure | S1–S7 and S9: every footer state, head same/differs/unknown, several PRs, pending/idle/failed lanes | `lib/card-review-model.test.mjs`, with fixtures built by the real `reviewRows` |
| Pure | `headSha` added, the queue unchanged | `review-timeline.test.mjs` |
| Fake DOM | the real `app.js` draws the footer; S5 (no forge wait); S8; S10 (`PR #` once); an XSS verdict word is escaped | `static/review-footer-render.test.mjs` via `test-support/dom.mjs` + `load-app.mjs`; adjust `remote-render.test.mjs:86` for D147 |

## Size

Gated (tests excluded by `governance.ignoreList`): about 140–180 lines. With tests: about 500.
Budget 1000 (`lite`). One PR.

## Rulings (maintainer, 2026-10-05)

RULED 2026-10-05: (a) The card shows the latest verdict even when its `head_sha` differs from the `origin/<branch>` tip this clone holds, naming both SHAs (`head a1b2c3d · origin tip here e4f5a6b`) and never using the word "stale". The local ref can lag the forge, so a mismatch is not proof, and hiding the verdict would hide a fact that was read.

RULED 2026-10-05: (b) The footer appears on every card whose issue joins an open PR, whatever its chip. "Awaiting review" means that the ISSUE lacks `status:approved` (`epic-graph.mjs:764`), not that a PR waits on review. #1230, #1245, #1248 and #1256 get a footer only if an open PR joins them.

RULED 2026-10-05: (c) Nothing on the card while `prs` is pending, idle or failed. When `prs` is read and `reviews` is not, the footer names the PR and says `verdict not read yet`; reviews failed says `verdicts could not be read`; an unreadable thread says `review thread unreadable` with the reason as the title.

RULED 2026-10-05: (d) The card's remote-branch line drops `PR #n` when the footer names it. The Remote work panel is unchanged.

RULED 2026-10-05: (e) Several open PRs join one issue: the footer names the highest-numbered PR plus `+k open PR(s)`. R1276-3 is a worktree rule and was not reused.

## Migration

None. The change adds a view only.
