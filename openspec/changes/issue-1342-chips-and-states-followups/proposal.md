---
status: draft
issue: 1342
---

# Proposal — chips-and-states-followups (issue 1342)

## What

One batched change that closes five approved follow-up issues left by cold reviews of the state-chip and review-footer work: #1298, #1303, #1342, #1360, #1365. All five are small, all are in `brain/scripts/ui`, and each is an APPROVE-with-corrections finding that the original PR deferred.

## Why

Each finding is a place where the UI states something its own evidence does not support, or a test that would not catch a regression:

- #1298: the sourced SDD tab decides "present" by excluding known bad states, so a new state would read as present.
- #1303: the in-flight section says "still loading" for a lane the poller says it will not read.
- #1342: roadmap rows drop the Not computed reason; two comments and three design decisions describe code that did not ship; the approval label is a literal in two files.
- #1360: the Ready to close reason states a stale closed count as current.
- #1365: a queued review thread is called unreadable in a mixed Reviews tab; the three verdict colours collapse in the light theme.

## Scope

- Includes: the fixes and tests listed above; in-place "label renamed to Awaiting approval by #1379" notes on the still-active #1308, #1309 and #1312 specs.
- Excludes: any new state, any change to the poller, `brain/scripts/vcs/**`, `axes/**`, doctrine under `brain/**`, and archived change dirs. `governance/approved-label.mjs` (a configurable approved label, a different concern) is not touched.
