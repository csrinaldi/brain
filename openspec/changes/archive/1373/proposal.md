---
status: complete
issue: 1373
---

# Proposal — memory-followups (issue 1373)

One batched change closes three approved issues: #1373 (feature, lead), #1377 and #1300 (bugs).

## What

- **#1373** The drawer's Records tab shows each record's title and excerpt, from the derivation the Memory ledger already uses, and a row opens its full content inline.
- **#1377** Table rows stop leaking `|` into record excerpts, and opened records that leave a surface's rows stop being held.
- **#1300** The #1267 amendment notes cite the commit that is on main, and the plain counted epic case has a render test.

## Why

- #1313 gave the ledger a title, an excerpt and an inline view, and left the drawer tab out on purpose (it reads a different data shape and would add a second render path to review). The tab still shows only type, id and actor.
- The cold review of #1375 found the two #1377 defects: 43 of 2505 summaries carry a literal `|`, and an open record pushed out of the 50-row window is held for the life of the page, so D160's "bounded by what is open" is bounded by clicks.
- The cold review of #1299 found `b354737e`, a pre-squash branch commit, cited as where `closedRead` shipped (`bea6a853`, #1265), and R1267-1's counted case tested only at the model level.

## Scope

- Includes: `change-route.mjs`, `lib/drawer-model.mjs`, `lib/memory-model.mjs` (one export), new `lib/record-hold.mjs`, `static/app.js`, `memory/lib/record-summary.mjs`, their tests, the two non-archived change dirs that cite `b354737e`.
- Does not include: a second excerpt derivation, a new route, a new worker path, a change to the ledger's columns, an archived change dir (none cites `b354737e`).
