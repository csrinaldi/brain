---
status: approved
issue: 1379
---

# Proposal — awaiting-approval-label (issue 1379)

## What
Rename the user-visible word of the `awaiting-review` state from "Awaiting review" to "Awaiting approval" on every UI surface.

## Why
The state means the ISSUE lacks `status:approved` (`epic-graph.mjs` `awaiting-human`; for undeclared nodes the labels check of #1308). Since #1312 cards also show PR review verdicts, so "Awaiting review" misleads: it reads as a PR waiting on a reviewer. Maintainer ruling 2026-10-07, option A: rename the word only.

## Out of scope
The internal code `awaiting-review`, the `status-awaiting-review` / `state-awaiting-review` classes, the `--state-awaiting-review-*` tokens, the glyph and the precedence.
