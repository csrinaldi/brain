---
status: draft
issue: 1122
---

# Proposal: a change is done when it works on a fresh consumer install

## Problem

Brain's tests run in brain's own repository, which has preconditions no consumer has. Defects
that depend on those preconditions keep reaching consumers: the v0.9.5 suite shipped to
consumers (#211), #397, #1094, #1113, #1112, #1116. The #1081 consumer demonstration found ten
defects (F1 to F10) that brain's own suite never saw. Nothing in brain's doctrine says that a
green suite in brain is not enough, and nothing defines the bar that would be.

## Intent

Record, as a promote-ready ADR, the maintainer's ruling of 2026-09-24 (#1121, rulings 1 and 4):
**a change is done when it works on a fresh consumer install, at a cost one person can pay.**
The ADR defines both halves operationally and creates the publish gate that #1136 implements.

## Scope

In scope:

- `brain-drafts/adr-0036-a-change-is-done-when-it-works-on-a-fresh-consumer-install.md`, in the
  shape `brain/scripts/brain-promote.mjs` accepts for a new ADR.
- This change's `proposal.md`, `spec.md`, `design.md` and `tasks.md`.

Out of scope:

- Any edit under `brain/**`. The maintainer promotes the draft (`agent-authorities.md` Tier 2/3).
- The publish gate itself (#1136), `brain:doctor` (#1130), the `lite` default (#1124), the
  platform default (#1125), autonomy modes (#1123), and the 1.x upgrade test (#1131).

## Success

- The draft plans cleanly under `brain:promote`'s own planner functions (transform, `HOME.md`
  index insertion, content guards).
- `npm run brain:repo:check` passes.
- The maintainer promotes the ADR, `brain/HOME.md` indexes it, and #1136 cites it (issue
  acceptance; after this change).

## Risks

- **Doctrine ahead of enforcement.** Until #1136 ships, the bar is a review question. The ADR
  states that instead of implying a gate exists.
- **Overclaiming coverage.** A matrix read as "every consumer" would repeat the class. The ADR
  names what the gate does not cover.
