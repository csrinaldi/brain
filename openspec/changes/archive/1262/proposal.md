---
status: approved
approved: 2026-10-04 (issue #1262 carries status:approved)
issue: 1262
---

# Proposal — paused-poller-and-closed-delta (issue 1262)

## Intent

The round-1 cold review of #1260 (#1257) approved with no blockers and left two corrections and one editorial note, deferred here.

1. Under `brain:ui --no-poll` no forge read will ever start, yet `readForge` (`brain/scripts/status/snapshot.mjs`) maps any pending open lane to "loading open issues from the forge…" and drops the poller's own reason ("polling is paused"). The page, and the `loading` band in `ui/lib/banners.mjs`, say a read is in flight forever.
2. `publishClosed` (`ui/poller.mjs`) deletes from `closedHeld` every number in `lastOpenNumbers`. A closed delta that lands before the open list of the same tick filters with the previous tick's open set and can delete a just-closed issue for good.
3. The `holdsAnyAnswer` comment in `ui/forge-cache.mjs` says nothing else writes to the cache, which stopped being true when the closed lane began writing `issueList('closed')` on its own flight.

## Scope

### In
- A pending section carries the lane's own reason and an `idle` flag when the lane says no read will start; the banner states idle sections apart from loading ones (D112, D113).
- `publishClosed` filters at publish time and never mutates `closedHeld` (D114).
- `holdsAnyAnswer` keys off the open lane, with a corrected comment (D115).

### Out
- Any change to the pause/resume behaviour, the poll interval, the closed lane's cadence, or the page's rendering code (`static/app.js` is untouched).
- Changing what a failed lane says.
