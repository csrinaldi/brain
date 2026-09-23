---
status: draft
issue: 459
epic: 313
---

# Proposal — the epic map is derived, and dependencies stop being prose

## What was wrong

#313's body carries lanes, dependencies, priorities and "what can run in parallel" as
**hand-maintained prose**. A maintained diagram drifts; the only question is when it is
noticed. It has drifted at least once already: the 2026-08-02 errata records a planning
pass misdirected by a stale body that proposed work already closed.

The failure mode is the one this repo keeps paying for — an artefact that *looks* like a
protection. Someone reads the epic to decide what to start next, and the epic answers
confidently from a snapshot nobody re-took.

## The design question the ticket asks to settle first

> dependencies must become **data, not prose**

Two ways to make them data:

**(a) native provider relations** — GitHub sub-issues plus `blocked-by` via GraphQL,
GitLab issue links.
**(b) a declared block in the issue body**, read by the same fenced-YAML primitives every
other brain protocol uses.

This change takes **(b)**, and the reason is a slicing reason rather than a preference:
(a) is **new port verbs**, and widening the port is a `decision`-labelled change with an
ADR behind it — ADR-0020's own rule. (b) needs no new verb, behaves identically on both
providers because it is just issue text, and the two are not exclusive. When the relations
land, they become a second source feeding the same builder.

```yaml
protocol: brain-graph/1
track:    A
blocks:   [435, 94]
needs:    [479]
files:    ["brain/scripts/status/**"]
```

It reuses `yaml-block.mjs` rather than growing a third fenced reader — that module's header
anticipates exactly this, and its `FENCE_RE` was hardened in #487 so a fence inside a value
cannot truncate a block. A second parser would be the defect #340 records.

## What the map refuses to do

**Absent is not empty.** An issue with no block is `UNCLASSIFIED` and reported **with its
count**, never dropped and never treated as a free-standing leaf. A node that vanishes
because it lacks metadata is the same class of silence as a commit the audit never
enumerates (#518): the map would report a graph it had not read.

**Parallelisability is computed, never declared.** Two ready nodes conflict when their
`files` claims overlap. A declared `parallel: true` boolean would be an assertion with no
evidence behind it. The matcher is deliberately not a full glob engine, and anything it
cannot decide it calls an **overlap** — an approximate matcher that answers "no overlap"
licenses two agents onto one file, so it is conservative in the safe direction.

**An out-of-scope edge is drawn, not dropped.** Dropping it would make the map claim there
is no dependency, which is a stronger and falser statement than "there is one, and it is
not in this set".

**Outside the markers is read-only.** The write is bounded by `BEGIN`/`END` comments and
everything around it is byte-identical afterwards — asserted by test, not by care. The
whole value of a regenerated projection evaporates if regenerating it can lose the prose
around it. An absent marker region appends rather than rewriting, so a first run on an
untouched epic is additive.

## The truncation this uncovered

The map's central claim is that a derived artefact cannot lie more than its source. It
could — `issueList` was **unpaginated on both providers**: GitHub returned at most one page
of 100, GitLab at most 50. Every consumer read that prefix as "the issues". brain has ~39
open issues today, so GitLab was one sprint from silently truncating the graph, and a
truncated list makes the map assert an absence of dependencies it never looked for.

Fixed here rather than deferred, because the feature's load-bearing claim depends on it,
using the pagination pattern each provider file already carries for `prReviews`,
`labelEvents` and `labelList`.

## Scope — slice 1

**Out:** the *"who is executing"* half. `issueList` normalises assignees away and
`issueView` never carried them, so surfacing them changes the port's **return contract** —
a `decision`-labelled change with an ADR, by the port's own rule. Reporting an empty
assignee list would be worse than reporting none: it reads as "nobody is on this" when the
truth is "brain cannot see". The map says so out loud instead, and slice 2 carries it
together with the native relations.

**Out:** a body-write verb. The port has no `issueUpdate`, so the verb prints the region
for an operator to paste rather than pretending it wrote it. Also slice 2.

Read-only reporting throughout — `brain:metrics`' character (M9): zero new gates, nothing
it emits can block a merge.
