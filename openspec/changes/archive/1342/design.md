---
status: draft
issue: 1342
---

# Design — chips-and-states-followups (issue 1342)

## Decisions

### D164 — The sourced SDD tab reads an allow-list (#1298)
`READABLE_STATES = {present, truncated}` in `change-route.mjs`; `present = READABLE_STATES.has(doc?.state)`. `buildSourcedSddTab` is exported so a test can feed it a state the code does not know. The R1282-3 test asserts the detail is not the fallback.

### D165 — `idle` is a third source state, not a flavour of pending (#1303)
`missingSources()` emits `state: 'idle'` for `pending && idle`. `noticeFor`, the hierarchy notice and `describeMissing` (state-vocab) word it "not read yet, <reason>". `hierarchyOf` carries `idle`. The sweep of `pending === true | .pending` in `ui` found the other consumers (`banners`, `drawer-model`, `card-review-model`, `local-overlay`, `rollup-model`, `app.js saidUnavailable`) already print the section's own reason or "not read yet", so none changes. The snapshot test loop adds `hierarchy` and `localWorktrees`, so a `pendingFrom` that drops `idle` fails.

### D166 — A roadmap row carries the Not computed reason (#1342)
`roadmapRow` sets `stateReason` to the thrown-state reason, else, for Not computed only, `state.reason` (work path) or the roadmap's own reason (legacy path). `renderRoadmapRow` sets the same text as the `title`. Limiting it to Not computed keeps the row quiet where the chip's tooltip already carries the basis (#1309 D136).

### D167 — The approval label lives in a leaf module (#1342)
`ui/lib/approval-label.mjs` exports `APPROVED_LABEL`. It is dependency-free so the browser (D9) and the server both import it; `epic-graph.mjs` imports it from `ui/lib`. Alternative rejected: export from `epic-graph.mjs` and import in `state-vocab.mjs` — the browser module graph must not reach `status/`.

### D168 — Fix the #1308 text, not the code (#1342)
D123: `buildInflight` and `workIndex` share `missingSources` and `collect`; making `buildInflight` call `workIndex` would need `hierarchy` in the missing list that `workIndex` drops, so the text is corrected. D126/D128: the shipped CSS styles the chip with `--warn`/`--warn-bg`. The `colour.mjs` comment points at `stateOf` without restating the order; the `state-vocab.mjs` header defines Not computed for both paths. Notes "label renamed to Awaiting approval by #1379" are added in place to the still-active #1308, #1309 and #1312 specs and the #1309 design (none is archived).

### D169 — Ready to close reuses the rollup's stale qualifier (#1360)
`rollup-model.mjs` exports `staleSuffix(load)`; `rollupLabel` and the Ready to close reason both use it, so the two cannot drift.

### D170 — A thread is worded by its own state (#1365)
When rounds are empty and every thread is unreadable-or-queued, the reason keeps the two single-phrase forms when all threads agree and otherwise lists each as `#N (not read yet: …)` or `#N (unreadable: …)`.

### D171 — Verdict tokens are dedicated (#1365)
`--verdict-approve|revise|stop` (light `#166534 #92400e #991b1b`, dark `#4ade80 #fbbf24 #fb7185`). The `--state-awaiting-review-*` tokens stay: the Awaiting approval state still uses them (#1379). `tokens.test.mjs` computes contrast on surface, paper and each chip ground, and a rule scan forbids `--state-*-fg` on the verdict classes.

## Contract / API impact
None. `buildSourcedSddTab` gains an export; the snapshot shape is unchanged; `missingSources` gains the state value `idle`.

## Discarded alternatives
- Showing every `state.reason` on roadmap rows: noise for In flight rows whose chip title already says it.
- Importing the label from `epic-graph.mjs` in the browser: breaks D9.
