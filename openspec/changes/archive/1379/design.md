---
status: approved
issue: 1379
---

# Design — awaiting-approval-label (issue 1379)

## Technical decisions

D163 (RULED 2026-10-07, option A): only the user-visible wording changes, "Awaiting review" -> "Awaiting approval". The label lives once, in `STATES['awaiting-review'].label` (`brain/scripts/ui/lib/state-vocab.mjs`); app.js renders it everywhere (card chip, drawer head, legend, Roadmap row, tooltips), so the change is one literal plus prose comments (`colour.mjs`, `state-vocab.mjs`).

Why the code and tokens stay: `awaiting-review` is the key of the state table, the CSS class `status-awaiting-review` / `state-awaiting-review` and the `--state-awaiting-review-*` tokens, which are shared with the REVISE verdict colours and reworked by #1365. Renaming them would touch the colour contract for no user-visible gain and collide with #1365.

Kept legitimately (a PR review, not the approval state): `brain/scripts/review/cli.mjs` queue line "PR(s) awaiting review".

## Contract / API impact
None. The snapshot, the graph status `awaiting-human` and every code string are unchanged.
