---
status: draft
issue: 702
---

# Proposal — a human SHOWING is not a machine DECLARING (issue 702)

## What

Four defects a cold dual review of merged PR #695 found, all in #639's own fix:

1. **The tag axis.** `parseGraphBlock` qualifies a fence on two facts now — an
   eligible info-string (` ``` ` or ` ```yaml `, exactly what the old `FENCE_RE`
   opened on) **and** the `protocol:` scalar.
2. **The axis is pinned.** Tests vary the tag in both directions.
3. **The unterminated fence** answers `{ ok: false, error }` instead of `null`,
   attributed from the partial content `fencedBlocks` now reports.
4. **One assertion** rewritten to pin what its message claims.

Out of scope, deliberately: the ADR-0009 finding. See below.

## Why

#639 was right that position is the wrong selector. It removed position and put
**nothing** in its place, widening the reader from "the first fence" to "any
fence". The cold review measured the price:

```
```console
$ gh issue view 42
protocol: brain-graph/1
blocks: [1, 2]
```
→ before #702: {"track":"Z","blocks":[1,2]}, two `sources:["declared"]` edges
```

Two dependency edges fabricated out of a pasted transcript. `#639` traded a class
of OMITTED edges for a class of FABRICATED ones and its PR body never said so.

`brain/core/methodology/vcs-contract.md` had already ruled that direction on
`foreignRelations`: **a fabricated dependency is worse than an omitted one.** An
omission delays one ticket; a fabrication licenses the wrong start order, and
ADR-0029 Decision 2 takes the UNION of the two edge sources, so nothing downstream
can subtract it again.

The shape is reachable on bodies this repo already has. Measured over all 316
issues, **6** carry a column-0 fence whose `protocol:` scalar is a real brain
protocol — #690, #683, #673, #631, #606, #473 — every one of them an
*illustration*. The day any of them quotes `brain-graph/1` instead, it becomes a
false declaration; #473, which quotes its block twice, would be reported as
"declared a block that could not be read" while declaring nothing at all.

## Why the tag, and not the tagged info-string

The ticket's Option 2 — moving to ` ```brain-graph/1 ` — is stronger and stays
rejected for the reason **#495 design D1** records: an issue body IS rendered for
a human by the forge, and an unknown info-string renders as plain text. Requiring
` ``` `/` ```yaml ` restores exactly the discipline the old locator had, keeps
#639's real fix intact, and changes no body already written.

## The unterminated fence, and why the primitive changed

#639 read `fencedBlocks(body).blocks` and dropped `unterminated` on the floor, so
a body whose block is missing its closing fence answered `null` — which #639's own
spec defines as *"no block was declared"*. The absent-is-not-empty conflation the
ticket existed to remove was live **inside its own fix**.

Attribution is the whole difficulty. `checkpoint-block.mjs` attributes an open
fence from its tag, because ` ```brain-checkpoint/1 ` is distinctive. `yaml` is
not: it says nothing about which protocol was being written. So `fencedBlocks` now
reports the open fence's partial `content` as well, and the graph reader
attributes it on the **same two facts** a closed block is read on. No guessing, no
second fence reader, and no silence.

That is a pure addition to a shared primitive — the lines were already accumulated
in `open.body` and were being withheld. Its two other consumers read `tag` and
`line` by property access and are unaffected.

## Out of scope: the ADR-0009 finding

Ticket item 4 — `renderSummary` emitting Spanish into a GitHub issue body via
`issueUpdate`, against ADR-0009's *"GitHub-facing artifacts → English,
unconditionally"* — is **not** in this change, and the ticket says why: it is a
doctrine question about a renderer that predates the ADR, it touches every line of
`renderSummary` rather than the one #695 added, and folding it in here would mix a
ruling with a bug fix. It needs its own ticket and a maintainer's ruling.

## Cost

One constant, one predicate, one branch. No body already written changes meaning
except the ones that were being read wrongly. `fencedBlocks` returns one more
field.
