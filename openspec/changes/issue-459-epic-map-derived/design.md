---
status: draft
issue: 459
---

# Design

Three modules, split so the half that decides things is pure and the half that talks to a
provider is thin.

| module | role |
|---|---|
| `status/epic-graph.mjs` | pure — `parseGraphBlock`, `filesOverlap`, `buildGraph` |
| `status/epic-render.mjs` | pure — `renderMermaid`, `renderSummary`, `replaceMapRegion` |
| `status/epic-map.mjs` | the CLI — fetch, compose, write |

`composeMap` is exported from the CLI so a test asserts the **same text the CLI writes**,
rather than a re-assembly that could drift from it.

## `brain-graph/1`

Read with `extractFencedBlock` / `scalar` / `parseJsonScalar` from `review/lib/yaml-block.mjs`.
Three cheap refusals in order: the protocol string is not in the body → `null`; no fenced
block → `null`; the block's `protocol:` is something else → `null`. Only the first fence is
read, the same single-fence discipline `parseVerdict` applies.

Numeric fields filter to integers and string fields to strings, so a hand-edited block
degrades to a smaller graph rather than to a crash.

## Why mermaid

It renders **natively** in issue bodies on both GitHub and GitLab — no external hosting, no
image to regenerate, no provider lock (ADR-0008 parity). The rich hand-authored diagram
stays a deluxe manual artifact; the embedded self-updating form is mermaid.

Labels are sanitised on the way in — never trusted because "our titles are fine". The
sanitiser replaces each terminating character with a space **and then collapses the runs it
opened**; both halves are asserted, because a label that is safe but ragged is a fix that
only half landed.

## Determinism as a precondition of idempotence

Nodes sort by number and edges by endpoints. Without that, two runs over unchanged state
differ, the marker region is rewritten every time, and the "already up to date, nothing
written" path never fires. The determinism test drives the builder from a **reversed** input
list, so input order is what varies.

## The classification order

`UNCLASSIFIED` is tested **first**, before blockers and before approval. An undeclared issue
has no evidence behind any other answer, and letting it fall through to `READY` would put an
issue nobody has described into the startable set — the map overstating its own coverage,
which is the one thing it exists not to do.

## Pagination

`issueList` returned a silent prefix on both providers. Fixed with each file's own existing
pattern: `--paginate` on the GitHub side (`gh api` does not auto-paginate), a page walk
terminating on a short page on the GitLab side (`runJson` returns only the parsed body and
cannot follow a `Link` header). The GitLab cap was **50**, half GitHub's, so it was the
nearer edge.

## Red-proof

Nine mutations on the new modules, all RED:

| mutant | the lie it would tell |
|---|---|
| undecidable glob reads as non-overlapping | two agents licensed onto one file |
| `needs` direction dropped | a dependency declared from one end goes quiet |
| a closed prerequisite blocks | finished work holds up its successor |
| undeclared classified like any other | an unread issue reported as startable |
| conflicts never computed | everything looks parallelisable |
| sanitiser leaves its gaps | ragged labels |
| out-of-scope edge dropped | "there is no dependency" |
| first run overwrites | the epic's prose lost |
| undeclared hidden from the summary | coverage overstated |

Two more on the pagination fix, both RED: `--paginate` removed, and the GitLab walk stopped
after page 1.

Full suite at the time of writing: **2981 tests, 0 failures**.

## What is deferred, and why it is not a shortcut

Assignees and a body-write verb both change the port — its return contract and its verb set
respectively — which is a `decision`-labelled change with an ADR by the port's own rule. The
map does not paper over either: it prints the region when there is no write verb, and it
says in the rendered output that the executor half is not visible. An empty assignee list
would read as "nobody is on this" when the truth is "brain cannot see", and that
substitution is the exact class of silence this ticket exists to remove.
