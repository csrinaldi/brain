# ADR-0032 — A graph block is declared by its fence tag: unspoofability outranks the rendered-artifact rule, and the tag is only half the fix

**Status**: Accepted
**Date**: 2026-08-18 — Cristian

## Context

This repository drew a family line between its fenced-block protocols, deliberately
and with a stated axis. `openspec/changes/issue-495-declared-budget-claim/design.md`
D1 records it:

> | family | shape | why | examples |
> | **posted to the VCS** | ` ```yaml ` + `protocol: <name>` | a comment is rendered by GitHub/GitLab; `yaml` gets highlighting, an unknown info-string renders as plain text | `brain-review/1|2`, `brain-decision/1`, `brain-graph/1` |
> | **a file in the repo, read by a verb** | ` ```<name> ` | nothing renders it for a human reviewer of a diff; the tag *is* the selector | `brain-amendment/1`, `amend-find`, `amend-replace` |

The axis is **rendered for a human, or not**. Where a block is read by a person on a
provider's web page, it takes a language tag the renderer understands and identifies
itself by an interior `protocol:` scalar. Where a block is only ever read by a verb out
of a file, the tag *is* the identity, because no reader is being served by the tag
naming a language.

That reasoning was sound for the question it answered. `checkpoint-report.md` is a
document *definitionally* full of fences — a reviewer's evidence is command output —
so selecting the first fence, or selecting by position at all, could not work. The tag
solved a **locator** problem there.

`brain-graph/1` is listed in the first family **by name**, and it is where the
reasoning fails — because the question it faces is not locating a block but telling a
**declaration** apart from an **illustration**.

`brain/scripts/status/epic-graph.mjs` selects the graph block by filtering every fence
in an issue body for `scalar(content, 'protocol') === 'brain-graph/1'`. Every token in
that predicate is what the module's own header teaches an author to write, and what
`epic-map.test.mjs`'s fixture builder emits. A body that **declares** a graph and a
body that **shows** the protocol while discussing it are byte-identical. No reader can
separate them, so an author explaining the protocol in an issue mints dependency edges
nobody asserted.

`brain/core/methodology/vcs-contract.md`'s `issueRelations` row already settled which
direction is worse:

> a fabricated dependency, worse than an omitted one, and the count is what keeps the
> omission audible.

A fabricated edge does not merely misdraw a diagram. `brain:epic:map` computes
`blockedBy` and `conflictsWith` from these edges, so a fabricated one either holds real
work behind imaginary work or — through a fabricated `files` claim — licenses two
agents onto colliding paths.

## Decision

> **`brain-graph/1` moves to the second family. The declaration is the fence tag** —
> ` ```brain-graph/1 ` — **compared against the first word of the info string, exact
> case. A ` ```yaml ` fence carrying `protocol: brain-graph/1` no longer declares.**
>
> **And the tag is explicitly NOT the fix. It is a narrowing.** The fix is that the
> shared fence splitter, `brain/scripts/lib/fenced-blocks.mjs`, agrees with the
> renderer that produced the text it reads: delimiter-aware (`` ` `` and `~` are peers
> and never close each other), run-aware, indentation-aware, and explicit that a
> blockquoted fence, a four-space-indented fence and an HTML-commented fence are
> content. Whichever of the two halves reverts, the other must still stand on its own.

The family rule in D1 is **not** repealed. It stays correct for
`brain-review/1|2` and `brain-decision/1`, whose entire purpose is to be read by a
human on a rendered page — a verdict is written to be read, and its `protocol:` scalar
is not a locator but a version marker on a body our own emitter produced. What changes
is that the rule's third example was chosen by surface and not by threat model, and
`brain-graph/1` is the one member of that family whose input is **prose an unrelated
author writes**.

The row is corrected rather than quietly reversed: D1's `brain-graph/1` entry moves to
the second family with a pointer to this ADR, so the next reader inherits the reason
instead of finding two documents that disagree.

## Why the rendered-artifact argument does not outweigh unspoofability here

**Because the two costs are not the same kind of thing.** The rendered-artifact
argument buys *legibility* — a reader gets colours on a five-line key/value block. The
scalar selector costs *correctness* — a derived artefact asserts a constraint nobody
declared, in the one place this repository has said repeatedly it will not go: an
artefact that lies more than its source.

**Because the illustration hazard is structural, and highlighting is cosmetic.** The
`protocol:` scalar cannot be made unspoofable by any amount of care, because the thing
that spoofs it is the documentation telling authors what to write. There is no version
of "teach the shape, then refuse to read the taught shape" that works.

**Because the migration is free, measured.**
`openspec/changes/issue-639-graph-block-locator/proposal.md` measured every issue in
this repository, open and closed:

```
bodies mentioning `brain-graph/1` . . . 2   (both PROSE)
bodies carrying a real declared block . 0
```

That measurement is **dated**, and it is cited here as a measurement taken then, not a
standing fact. Its in-repository half was re-verified while this ADR was drafted:
exactly one column-0 `protocol: brain-graph/1` exists anywhere in the tree, in
`openspec/changes/issue-459-epic-map-derived/proposal.md`, and it is an
**illustration** — which is the defect, standing in the tree, in the very proposal that
introduced the protocol. No declaration exists to break. Changing the selector after
this repository's epic issues carry blocks would cost a re-read of every body; changing
it now costs nothing.

**Because the residual ambiguity becomes audible rather than silent.** Two matching
blocks already produce an error naming the count instead of a silent pick. A body that
both declares and illustrates therefore yields a reported refusal and an UNCLASSIFIED
node — never a fabricated edge. A body still written the old way is refused *out loud*,
naming the retag, so "no longer declares" is not "silently stopped working".

## The honest cost, and the one claim behind it that is NOT verified

The cost of leaving the first family is that `brain-graph/1` is not a language any
renderer knows, so the block loses syntax highlighting on both providers.

**The load-bearing assumption is that this is the *only* thing it loses** — that an
unknown info string still renders as a fenced code block on GitHub and GitLab rather
than as raw text with the fence lines visible.

**That assumption was not verified.** It is written here as an assumption because it
could not be measured from the environment this ADR was drafted in: no rendered page
was available. It is stated rather than asserted, because D1's own wording — *"an
unknown info-string renders as plain text"* — is imprecise in a way that matters, and
inheriting an imprecise claim as a fact is how a family rule ends up drawn on a cost
nobody checked.

What settles it: place a ` ```brain-graph/1 ` block in one real issue body on each
provider and read the rendered page. It is free, because this change's own pull request
exists anyway.

**What if the assumption is false?** The decision still holds, and it is important that
this be written down before the check rather than after. If the block renders as raw
text, the cost rises from *no colours* to *five visibly ugly lines in one issue body* —
and it is still weighed against a fabricated dependency, which
`vcs-contract.md` already ranked as the worse harm. What would change is not the
decision but the record: a reader deciding the next protocol's shape deserves the real
number, not a guess that hardened into doctrine.

## The limit of this decision — read this before citing it

**A tag is not unspoofable. It has a half-life, and this decision spends it.**

The moment the documentation teaches ` ```brain-graph/1 `, an author illustrating the
protocol will reproduce *that* — the identical mechanism that made ` ```yaml ` plus
`protocol:` indistinguishable from an illustration. The corpus measurement behind this
change is a measurement of **habit**: authors have illustrated
`brain-review/1|2` and `brain-decision/1` without reproducing their tags, and the
inference that they will treat `brain-graph/1` the same way is an argument by analogy,
not evidence about this protocol.

So the durable discriminator is not the tag. It is **nesting**: a block shown inside an
outer fence, a blockquote, an indented code block or an HTML comment is content,
because that is what the renderer shows the human. That guarantee lives in
`fenced-blocks.mjs` and it does not decay when the tag becomes familiar.

Whoever reads this ADR while choosing a shape for the next protocol: do not read it as
*"tags are unspoofable, use a tag"*. Read it as *"an interior scalar is spoofable by
the documentation itself, a tag is spoofable more slowly, and neither is a substitute
for a reader that agrees with the renderer"*.

## Alternatives considered

**Accept both shapes during a transition.** Rejected. Accepting ` ```yaml ` plus
`protocol:` leaves the fabrication path fully open, which is the entire defect. With
zero declarations in existence there is nothing for a transition to protect.

**Keep the scalar selector and whitelist admissible language tags.** Rejected, with a
worked example: an unmerged attempt did exactly this with
`GRAPH_FENCE_TAGS = ['', 'yaml']`, which keeps `yaml` admissible — so the illustration
path stays open — while the whitelist's exactness newly rejected `yml`, `YAML` and
`yaml title="x"`, bodies that had parsed before. A whitelist creates near-misses to
forgive; having no whitelist creates none.

**Fix only the splitter and keep the scalar selector.** Rejected as insufficient *and*
as unsafe on its own: teaching the splitter to see legally indented openers, while the
selector still reads the interior scalar, would make indented illustrations newly
readable and mint edges from them. The two halves are ordered for this reason —
selector first, splitter second.

**Make `brain-graph/1` a native provider relation instead.** Out of scope here, not
rejected: ADR-0029 already takes the union of the declared block and native relations
and reports the divergence. Native relations are a second source, not a replacement,
and they carry no `files` claim at all.

## Consequences

- **REQ-639-1's selector sentence is superseded.** REQ-639-2, -3, -4 and -5 stand
  unchanged, including the multi-block error that names the count.
- **`openspec/changes/issue-495-declared-budget-claim/design.md` D1's table is
  corrected**, not silently contradicted. `brain-review/1|2` and `brain-decision/1`
  remain in the first family; the axis stays as written, and gains a second
  qualifier — *who writes the input*.
- **A future change that reintroduces the interior-scalar selector, or that accepts
  both shapes, is a doctrine change** and must amend this ADR rather than merely pass
  review.
- **The rendering assumption above must be closed by observation**, and if it is false
  the finding belongs in an amendment to this ADR — the decision does not move, the
  record does.
- **`brain/scripts/review/lib/yaml-block.mjs`'s first-fence contract is untouched.**
  `extractFencedBlock` and its `FENCE_RE` are first-fence-only by design, recorded in
  ADR-0026 and pinned by REQ-487-6 so doctrine and test move together. Nothing in this
  decision reaches it, and no consumer of it changes. That boundary is stated here so a
  later reader does not treat this ADR as licence to unify the two readers into a
  parser that is wrong for both.
- **The strictness question in the splitter is decided in the loose direction, and
  pinned in both.** A closing fence indented up to three spaces, or with a run longer
  than its opener, closes. The neighbouring strict rule in `yaml-block.mjs` was correct
  for a single-block artefact our own emitter wrote with newlines escaped, where
  exactness is provably free. It is not free over human prose: it reports a
  CommonMark-legal document as never closed, which publishes a fabricated accusation
  into an issue. The reason now lives in the module rather than in an analogy, because
  the defect found there was that **neither direction was written down**.

## References

- `brain/scripts/status/epic-graph.mjs` — the selector this changes, and the header
  that taught the old shape
- `brain/scripts/lib/fenced-blocks.mjs` — the shared splitter; the load-bearing half
- `brain/core/methodology/vcs-contract.md` — `issueRelations`: a fabricated dependency
  is worse than an omitted one
- `brain/core/anti-patterns/evidence-reader-empty-on-failure.md` — a refusal must never
  be returned as an absence
- `brain/core/anti-patterns/red-proof-blind-along-an-unvaried-axis.md` — why the axis
  matrix is the exit criterion, and why two predecessors each closed one axis and
  opened another
- `openspec/changes/issue-495-declared-budget-claim/design.md` — D1, the family rule
  this corrects
- `openspec/changes/issue-639-graph-block-locator/proposal.md` — the corpus measurement
- `openspec/changes/issue-709-declaring-selector/design.md` — the splitter contract,
  the axis matrix, and the commit ordering
- ADR-0026 · REQ-487-6 — the first-fence boundary this does not cross
- ADR-0028 — promotion is read-confirm-stage; the commit is the signature
- ADR-0029 — two sources feed one graph; native relations are a peer, not a replacement
- ADR-0031 — a self-asserted claim is not a record; the same reason no agent signs this
