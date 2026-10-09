---
status: approved
issue: 1308
---

# Tasks — state-chip-separate-from-track (issue 1308)

Strict TDD: every phase is RED → GREEN → REFACTOR. A RED task names the test and why it fails today; a GREEN task makes exactly that test pass with the least code; a REFACTOR task changes no behaviour and keeps the suite green. Test runner: `npm test`; one file runs with `node --test <path>`. No network and no real timers. Requirement and decision numbers refer to `spec.md` and `design.md`.

**Gate before apply: cleared.** The maintainer ruled Q1–Q3 on 2026-10-05; the rulings are recorded in `design.md` (Rulings, D128) and `spec.md` (R1308-8..10, S10–S13).

## Phase 1 — The work index (R1308-6, D123)

- [x] 1.1 RED — `ui/lib/inflight-model.test.mjs`: `workIndex(sections)` returns `{missing, byIssue}` (no `hierarchy` in `missing`; stale and fresh evidence both indexed), and every issue in `buildInflight`'s `rows ∪ unknown ∪ stale` is in `byIssue`. **Fails today:** there is no `workIndex` export.
- [x] 1.2 GREEN — `ui/lib/inflight-model.mjs`: export `workIndex` built from `collect` and `missingSources` minus `hierarchy`.

## Phase 2 — Lifecycle and track vocabulary (R1308-2..5, 8, 9, D124–D126)

- [x] 2.1 RED — `ui/lib/state-vocab.test.mjs`: the precedence matrix of R1308-8 (`stateOf(node, work)`), S1/S3/S5/S6/S7/S10/S11/S12 as table cases, `unclassified` is no longer a state, `TRACK_MARKS` and `trackMarkOf` (`Track <id>`, `? No track`, `⚠ Configuration missing`, `null` for unreadable). **Fails today:** `unclassified` short-circuits and no `work` is read.
- [x] 2.2 GREEN — `ui/lib/state-vocab.mjs`: drop `STATES.unclassified`; `stateOf(node, work)` with the ruled precedence, stale evidence counted, `not-computed` reasons naming the missing sources; `TRACK_MARKS` and `trackMarkOf`.
- [x] 2.3 REFACTOR — update `colour.mjs` header comment and the existing `state-vocab`/`colour` tests that named `unclassified`; suite green.

## Phase 3 — The models (R1308-1, 6, 7, 10, D127, D128)

- [x] 3.1 RED — `ui/lib/lane-model.test.mjs`: with `work`, card/holding row/epic row/`nodeSummaryFor`/`childrenOf` agree on state and each carries `trackMark`; no `? track` mark; `declare` block for an undeclared node (prefilled `parent`, note) and `null` for a declared one; `declareCommand` is `null` today; per-lane state counts sum to node count. `ui/lib/roadmap-model.test.mjs`: rows take `work`. **Fails today:** no `work` option, no `trackMark`, no `declare`.
- [x] 3.2 GREEN — `ui/lib/lane-model.mjs` and `ui/lib/roadmap-model.mjs`: `work` option, `trackMark` on every row, `declare` on the summary, `DECLARE_SNIPPET` helper for the prefill.

## Phase 4 — The page (R1308-1, 2, 7, 10, D127)

- [x] 4.1 RED — `ui/static/state-chip-render.test.mjs` (boot shape of `inflight-render.test.mjs`): two chips on a card and in the drawer; the `#1263` shape (undeclared + worktree) reads `◐ In flight` with the warning chip; pending `prs` shows `Not computed` and a frame turns it `Planned`; the legend has a state group and a track group; the drawer of an undeclared issue shows the paste block and no command. **Fails today:** one chip, `? Undeclared` state, no groups.
- [x] 4.2 GREEN — `ui/static/app.js` (compute `workIndex` once per render, pass it to every model call, draw both chips, legend groups, drawer declare block) and `ui/static/app.css` (track chip and warning classes).

## Phase 5 — Close

- [x] 5.1 `rg` every other consumer of `STATES.unclassified`, `status-unclassified` and the `? track` mark (`search-model.mjs` and the rest) and update them.
- [x] 5.2 `npm test`, `npm run brain:repo:check`, `npm run brain:nav`, gated diff against `origin/main`.
- [x] 5.3 Mutations, each must fail a test and then be reverted: `unclassified` back before the roadmap state; no work evidence so a worktree-only issue reads Planned; Blocked and In flight swapped; the warning chip dropped for an undeclared node; a stale-only issue reading Planned.
- [x] 5.4 Real-browser proof: home lanes and the drawer of an undeclared issue.

## Micro-decisions en caliente

- Awaiting review for an undeclared node is read from `node.labels` inside `stateOf`; a node with no `labels` array makes no claim (never reads as "not approved").
- `done` is still read from the roadmap (an issue not open is not a graph node), and only when the roadmap is readable.
