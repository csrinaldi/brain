---
status: draft
issue: 702
---

# Tasks — issue 702

- [x] **T1** Re-reproduce every cold-review finding against `origin/main` before
  writing anything. All four reproduced; the `console` transcript drew two
  `declared` edges, the unterminated fence answered `null`.
- [x] **T2** `epic-graph.mjs` — `GRAPH_FENCE_TAGS` and the `isGraphFence`
  predicate; qualification reads tag AND protocol (REQ-702-1).
- [x] **T3** `fenced-blocks.mjs` — the unterminated fence reports its partial
  `content` (REQ-702-4). Pure addition; two other consumers unaffected.
- [x] **T4** `epic-graph.mjs` — an unterminated fence that qualifies returns
  `{ ok: false, error }` naming the line (REQ-702-3).
- [x] **T5** `epic-map.test.mjs` — six cases varying the TAG axis in both
  directions and the unterminated shapes, including the foreign-tag open fence
  (REQ-702-2, REQ-702-3, REQ-702-4).
- [x] **T6** `fenced-blocks.test.mjs` — the `content` field is asserted, and the
  existing `deepEqual` updated (REQ-702-4).
- [x] **T7** `epic-map.test.mjs` — the overclaiming assertion rewritten to name
  the mutation it pins (REQ-702-5).
- [x] **T8** Mutation red-proof, one axis at a time:
  - M1 drop the tag guard (the #639 state) → **3 red**
  - M2 drop the unterminated branch → **1 red**
  - M3 `unterminated` stops reporting `content` → **3 red**, across both modules
  - M4 silent pick of the first duplicate → **3 red**
  - restored → 62 pass, 0 fail
- [x] **T9** Full suite: **3932 pass, 0 fail**. `brain:repo:check` and
  `brain:nav` clean.
- [ ] **T10** *Not done, deliberately* — ticket item 4 (ADR-0009: `renderSummary`
  writes Spanish into a GitHub issue body). Doctrine question, needs its own
  ticket and a maintainer ruling. See `proposal.md`.
