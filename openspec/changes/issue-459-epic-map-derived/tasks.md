---
status: draft
issue: 459
---

# Tasks — #459 (slice 1)

- [x] **T1** Settle the ticket's blocking design question: dependencies become DATA via a
      declared `brain-graph/1` block, chosen over native provider relations because those
      are new port verbs (ADR-0020) and the two are not exclusive.
- [x] **T2** `epic-graph.mjs` — `parseGraphBlock` on the shared `yaml-block.mjs` primitives,
      `filesOverlap` conservative in the safe direction, `buildGraph` with computed
      parallelisability.
- [x] **T3** `epic-render.mjs` — mermaid (renders natively on both providers), the summary
      that reports the undeclared count, and the marker-bounded write.
- [x] **T4** `epic-map.mjs` — the CLI, with `composeMap` exported so the test asserts the
      text the CLI actually writes.
- [x] **T5** `brain:epic:map` wired in `package.json`.
- [x] **T6** 22 guards over the three modules.
- [x] **T7** Nine mutations RED on the new modules (design.md carries the table).
- [x] **T8** Pagination: `issueList` returned a silent prefix on BOTH providers (GitHub 100,
      GitLab 50). Fixed with each file's own existing pattern, three guards, two mutations
      RED.
- [x] **T9** Full suite: **2981 tests, 0 failures**.
- [ ] **T10** *(slice 2 — filed as #533, not in this change)* assignees, native provider
      relations and a body-write verb — all three are port changes needing a `decision`
      label and an ADR.
