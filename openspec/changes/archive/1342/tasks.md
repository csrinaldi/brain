---
status: draft
issue: 1342
---

# Tasks — chips-and-states-followups (issue 1342)

## #1298
- [x] 1.1 RED/GREEN: allow-list `present`, export `buildSourcedSddTab`, test an unknown state, tighten the R1282-3 reason assertion

## #1303
- [x] 2.1 RED/GREEN: `idle` in `missingSources`, `noticeFor`, hierarchy notice, `describeMissing`, `hierarchyOf`
- [x] 2.2 Extend the snapshot idle loop to `hierarchy` and `localWorktrees`
- [x] 2.3 Sweep `pending === true | .pending` in `brain/scripts/ui`

## #1360
- [x] 3.1 RED/GREEN: `staleSuffix` shared by the rollup label and the Ready to close reason; test a failed lane with `lastCompleteAt`
- [x] 3.2 `stateOf` docstring states the #1309 precedence

## #1342
- [x] 4.1 RED/GREEN: Not computed reason on the roadmap row (model test and render test)
- [x] 4.2 `colour.mjs` comment, `state-vocab.mjs` header
- [x] 4.3 `approval-label.mjs` imported by `epic-graph.mjs` and `state-vocab.mjs`
- [x] 4.4 #1308 design D123, D126, D128 corrected
- [x] 4.5 "label renamed by #1379" notes in #1308, #1309, #1312 (none archived)

## #1365
- [x] 5.1 RED/GREEN: per-thread wording in a mixed Reviews tab
- [x] 5.2 RED/GREEN: `--verdict-*` tokens, rules, contrast test

## Close
- [x] 6.1 Full suite, repo:check, nav, gated diff, tarball size, one mutation per issue

## Micro-decisions
- `governance/approved-label.mjs` (configurable approved label) is a separate concern and is left alone.
