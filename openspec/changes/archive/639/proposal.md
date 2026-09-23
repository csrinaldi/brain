---
status: draft
issue: 639
---

# Proposal — the graph block is found by its protocol, not by its position (issue 639)

## What

`parseGraphBlock` locates the declared `brain-graph/1` block by scanning **every**
fence in the issue body and selecting the one whose `protocol:` scalar matches,
instead of taking the first fence and asking whether it happens to be the right
one. A second `brain-graph/1` block becomes an **error naming the count**, and
`buildGraph` carries that out in `blocksUnreadable` for `renderSummary` to print.

Option 1 of the ticket: the ` ```yaml ` + `protocol:` family stays. An issue body
IS rendered for a human, and an unknown info-string renders as plain text — the
reason recorded in #495 design D1. Only the locator was wrong.

## Why

A positional locator asks "is the first fence the block?" when the question is
"which fence is the block?". An issue body is written by a human and routinely
opens with a log excerpt, a command, or a snippet. When the locator missed, the
node read UNCLASSIFIED while declaring a complete block further down —
indistinguishable from "nobody declared this", with every `blocks:` / `needs:`
edge silently absent from the graph. ADR-0029 Decision 2 takes the UNION of
declared and native edges, so a lost declared edge is a lost constraint, and the
map can call a node ready that is not.

## What was measured, because the ticket's stated repro is not the defect

The ticket names its fixture "the demonstrated bypass": a ` ```js ` snippet above
the block. **It was already green**, and by accident rather than by design.
`FENCE_RE` only opens on ` ``` ` or ` ```yaml `, so it skips the tagged foreign
*opener*, latches onto that block's *closing* fence, and swallows through to the
graph block — where `scalar`'s `^protocol:` anchor still finds the key.

Running both parsers over the four candidate shapes:

| body shape | old | new |
|---|---|---|
| ` ```js ` snippet first | parses | parses |
| ` ```bash ` snippet first | parses | parses |
| **untagged ` ``` ` fence first** (a log excerpt) | **null** | parses |
| **` ```yaml ` of another protocol first** | **null** | parses |

So the premise holds and the fixture does not. The shapes that were red are the
ones the locator cannot skip, and the untagged fence is the most ordinary thing
an issue body opens with. The ticket's fixture is pinned anyway, labelled as what
it is — an accident that must not silently become a regression.

## Live incidents today: ZERO, and the ticket asked to say so

Over all 312 issues in this repo, open and closed:

```
bodies mentioning `brain-graph/1` . . . 2   (#639 and #533 — both PROSE)
bodies carrying a real declared block . 0
nodes recovered by this change . . . . . 0
```

**This is a reachable shape, not a live incident.** The block is a protocol
nothing has adopted yet, which is exactly why fixing the locator now costs
nothing and fixing it after #313's issues carry blocks would cost a re-read of
every body.

## Cost

One import moves. No issue body already written changes meaning — the shapes that
parsed before still parse, and two shapes that did not now do. `buildGraph` grows
one reported array beside `relationsUnreadable`, which already exists for exactly
this distinction on the native side.
