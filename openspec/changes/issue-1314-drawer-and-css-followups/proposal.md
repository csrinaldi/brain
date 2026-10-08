---
status: draft
issue: 1314
---

# Proposal: drawer-and-css-followups (#1314, #1318, #1321, #1330)

## What

One batched change closing four approved UI follow-ups: visual polish of the cards, drawer and
Decisions view (#1314, lead), the table-cell display guard (#1318), the theme control rule and
dark-palette contrast test (#1321), and the drawer clamp padding detector (#1330).

## Why

Each issue is a small, already-approved correction found by a region audit or a cold review.
They all live in `brain/scripts/ui/`, and each one is cheaper to land together than as four PRs.

## Scope

- In: the five cosmetic items of #1314; a fake-DOM render guard for table classes (#1318) and the
  R1310-1 wording; `font: inherit` plus a dark-palette contrast pin (#1321); a `clientHeight` and
  `scrollTop` clamp in the fake DOM plus a padding-value assertion (#1330).
- Out: new views, new data sources, any change to the ADR parser or the forge ports.
- Delivery: one PR, commits per issue. The gated diff budget is 1000 lines at `lite`.
