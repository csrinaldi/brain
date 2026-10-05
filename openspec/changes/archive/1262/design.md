---
status: approved
issue: 1262
---

# Design — paused-poller-and-closed-delta (issue 1262)

Continues the numbering of #1276 (D86–D93) and the #1284 line (D101); the next free decision is D112.

## Technical approach

```
poller.forgeLoad()  open: {state:'pending', reason:'polling is paused'}  (paused and nothing in flight)
   ─▶ snapshot.readForge: pendingLane(entry, LOADING.x)   reason ⇒ {pending, idle, reason} · no reason ⇒ loading wording
   ─▶ pendingFrom(section) keeps reason+idle for hierarchy / localWorktrees
   ─▶ banners.waitingSections: loading[] vs idle[{name, reason}] ─▶ 'loading' band · 'idle' band(s)
poller.publishClosed: published = heldRows − lastOpenNumbers   (closedHeld untouched)
forge-cache.holdsAnyAnswer: open lane landed (issueList('open') | mrList)
```

## Decisions

| # | Decision | Rejected | Why |
|---|---|---|---|
| D112 | **A pending section keeps the lane's reason and says `idle`.** `pendingLane` in `status/snapshot.mjs` returns `{...pending(reason), idle: true}` when the entry has a non-empty `reason`, else today's loading wording. The poller only sets `reason` on a pending entry when `userPaused && nothing in flight`, so a reason on a pending entry IS the statement that no read will start. | Matching the text `polling is paused` in the banner | The banner would then know a sentence owned by another module. A flag is a contract; a string compare is a coincidence. |
| D113 | **The banner splits loading from idle.** `waitingSections` in `ui/lib/banners.mjs` returns `{loading, idle}`; `idle` sections get `not read yet, <reason>: <names>`, one band per distinct reason, after `loading`. `pendingFrom` (`status/report.mjs`) carries `reason` and `idle` to the sections that are pending because `graph` is. | Dropping idle sections from the bands | The page would show empty sections with no explanation. The reason is the whole point. |
| D114 | **`publishClosed` filters; it never deletes.** The published list is `[...closedHeld.values()].filter(not in lastOpenNumbers)`. `closedHeld` is the merged truth of the closed lane and only the closed lane writes it. Both lanes call `publishClosed`, so the next open landing republishes from the intact set with the fresh open numbers. | Ordering the lanes so open always lands first; recomputing `lastOpenNumbers` inside the closed run | Ordering lanes reintroduces the coupling #1257 D56 removed. A filter on read costs one pass over the held set and cannot lose data. |
| D115 | **Per-number "queued" reasons key off the open lane only (decided).** `holdsAnyAnswer` becomes `issueList.has('open') \|\| mrList !== undefined`; the comment is corrected. The reasons claim that the open lane has answered and its bounded body and review lanes have not yet reached this number. A closed landing says nothing about that, so before this change a closed landing alone turned a true "the first forge poll has not completed" into a false "queued". This rests on what the sentences claim and needs no maintainer intent. Reachability is narrow (the server path never reads per-number rows while the open lane is pending), so the change is wording-honesty, not a behaviour users will see often. | Keeping any-write semantics and only fixing the comment | The comment would then describe a rule that makes a reason false. |

## Contract / API impact

Snapshot sections gain an optional `idle: true` on pending sections (additive; consumers that read `pending` and `reason` are unchanged). Banner gains an `idle` band id; the page renders bands generically (`static/app.js` unchanged). No route, CLI or config change.

## Alternatives rejected

See the table. No MAINTAINER QUESTION: part 3's "queued" keying follows from what the reasons claim.
