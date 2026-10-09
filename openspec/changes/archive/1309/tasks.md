---
status: approved
issue: 1309
---

# Tasks — epic-state-follows-children (issue 1309)

Strict TDD: each phase is RED, then GREEN, then REFACTOR. A RED task names the test and why it fails today. A GREEN task makes exactly that test pass with the least code. A REFACTOR task changes no behaviour. Runner: `npm test`; one file runs with `node --test <path>`. Requirement and decision numbers refer to `spec.md` and `design.md`.

**Gate before apply: cleared.** The maintainer ruled (a) to (d) on 2026-10-05: a new `Ready to close` state, in-flight children with zero closed read In flight, `closed:null` plus an in-flight child reads In flight, and an uncounted or unresolved zero reads Not computed.

## Phase 1 — The vocabulary and the rollup evidence (D133, D137, D138)

- [x] 1.1 RED — `ui/lib/rollup-model.test.mjs`: `epicRollup` returns `openChildren`, the sorted numbers of open children, also when `closed` is `null`. Fails: the field does not exist.
- [x] 1.2 GREEN — `ui/lib/rollup-model.mjs`: `openChildren`.
- [x] 1.3 RED — `ui/lib/state-vocab.test.mjs` and `ui/static/tokens.test.mjs`: `ready-to-close` is a state (mark `◉`, class `state-ready-to-close`, distinct from every other class and mark), has tokens in the three theme blocks, meets AA 4.5:1, and the "eight codes" assertion becomes nine. Fails: no such state.
- [x] 1.4 GREEN — `ui/lib/state-vocab.mjs` entry; `ui/static/app.css` tokens and rules (`.roadmap-state`, `.node`, `.node-state`, `.legend-item`).

## Phase 2 — One authority (R1309-1..7, D130–D132, D135, D137)

- [x] 2.1 RED — `ui/lib/state-vocab.test.mjs`: a table over S1–S10 built from the REAL `epicRollup` (never hand-written rollups): Planned only when measured; 17/39 In flight; lane pending/disabled/failed, `closedRead` not ok, hierarchy pending: Not computed with the rollup's words; `closed:null` with an in-flight child In flight; in-flight child with zero closed In flight; all-closed Ready to close; `unknown>0` and `unresolved>0` Not computed; blocked, awaiting and closed epics keep their precedence; a non-epic and the legacy no-rollup call are unchanged. Fails: `stateOf` ignores children.
- [x] 2.2 GREEN — `stateOf(node, work, rollup)` with `epicProgress`.

## Phase 3 — The models agree (R1309-1, D134)

- [x] 3.1 RED — `ui/lib/lane-model.test.mjs` and `ui/lib/roadmap-model.test.mjs`: the lane epic row, `nodeSummaryFor`, `childrenOf` and the Roadmap epic row give the same code for the #878 shape given `epics`; the hierarchy `level` and the graph `kind` agree under the adapter. Fails: no `epics` option.
- [x] 3.2 GREEN — `epics` option through `buildLaneModel`, `nodeSummaryFor`, `childrenOf`, `buildRoadmapModel`; `stateAndMarks` and `safeStateOf` compute the rollup for an epic node only.

## Phase 4 — The page (R1309-8, D134, D136)

- [x] 4.1 RED — `ui/static/epic-state-render.test.mjs`: every `app.js` model call site passes `epics`; the Roadmap chip carries the reason as `title`. Fails: neither.
- [x] 4.2 GREEN — `app.js`: `currentEpics()`, the five call sites, the Roadmap chip tooltip.
- [x] 4.3 REFACTOR — nothing duplicated; suite green.

## Phase 5 — Close

- [x] 5.1 `npm test`, `npm run brain:repo:check`, `npm run brain:nav`, the gated diff, the publish allowlist canary.
- [x] 5.2 Mutations, each must fail a test and be reverted.
- [x] 5.3 Real-browser proof of #878's drawer and the Roadmap.
