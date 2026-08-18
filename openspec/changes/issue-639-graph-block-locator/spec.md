---
status: draft
issue: 639
---

# Spec — the locator reads the protocol, and says when it cannot (issue 639)

## REQ-639-1 — The block is selected by its `protocol:` scalar, never by position

> **SUPERSEDED by issue #709** (`openspec/changes/issue-709-declaring-selector/spec.md`,
> REQ-639-1 MODIFIED; ADR-0032). The half of this requirement that killed
> position-based selection **stands** and is what #709 builds on. The half that made
> the `protocol:` scalar the selector **does not**: that value is one an author
> teaching the shape reproduces verbatim, so a body ILLUSTRATING the protocol and a
> body DECLARING it were byte-identical to the reader, and no code path could tell
> them apart. The selector is now the fence TAG. REQ-639-2 through REQ-639-5 are
> untouched by #709.

`parseGraphBlock` reads every fenced block in the body and keeps those whose
`protocol:` scalar equals `brain-graph/1`. Position selects nothing.

A body whose first fence is an untagged log excerpt, a ` ```yaml ` block of
another protocol, or a tagged snippet, and whose later fence carries a
well-formed `brain-graph/1` block, parses to that block.

~~The ` ```yaml ` + `protocol:` shape is unchanged. Moving to a tagged
info-string (` ```brain-graph/1 `) would be cleaner and is wrong here: an issue
body is rendered for a human, and an unknown info-string renders as plain text
(#495 design D1). The family split is right; only the locator was wrong.~~

Reversed by #709 / ADR-0032. The rendering cost is real and believed cosmetic — an
unknown info-string is expected to still render as a fenced code block, losing only
highlighting (#709 design D13, **not yet confirmed against a rendered page** — that
observation is #709's Phase 8.1) — and it is outweighed by the fabricated edges an
unspoofable selector prevents. The family
split was not right for this block: `brain-graph/1` belongs with
`brain-amendment/1` and `brain-checkpoint/1`, where the tag IS the selector.

## REQ-639-2 — One fence reader, not a third

The scan goes through `lib/fenced-blocks.mjs`'s `fencedBlocks` — the document
reader #495 extracted as a pure move — and the values are still read with
`yaml-block.mjs`'s `scalar` / `parseJsonScalar`. That is the same split
`checkpoint-block.mjs` uses, and it is a split by SHAPE OF INPUT: one locator
for a document with many blocks, one for a comment our own emitter wrote.

No new fence regex is added anywhere. A third copy of this rule is the defect
#340 records.

## REQ-639-3 — Two blocks is an error naming the count, not a silent pick

More than one `brain-graph/1` block in one body returns `{ ok: false, error }`
whose message states the count and the body lines. Two values for one key is
ambiguity, and the reader must stop picking — the rule `parseAmendmentDraft` and
`parseCheckpointClaim` already hold.

The old locator answered with whichever came first and said nothing.

## REQ-639-4 — THREE answers, because "unreadable" is not "absent"

| answer | means |
|---|---|
| the graph object | one well-formed block |
| `{ ok: false, error }` | a block was declared and could not be read |
| `null` | no block was declared |

`null` keeps meaning ABSENT — the contract #459 wrote and the reason the builder
marks an undeclared node UNCLASSIFIED rather than dropping it. Success keeps its
bare shape rather than growing an `ok: true` envelope, because `null` already
draws the distinction the envelope exists to draw in `checkpoint-block.mjs`.

## REQ-639-5 — An unreadable block is carried out and printed

`buildGraph` returns `blocksUnreadable: [{ number, error }]`, beside
`relationsUnreadable`, and `renderSummary` prints it on its own line.

The node's status stays UNCLASSIFIED — honest, since no source placed it — and it
draws no edge: an unreadable block asserts nothing and is not half a declaration
to be salvaged. Without the reported line, "could not read what it declared" and
"declared nothing" land together under **Sin ubicar** and read as one fact. That
is this ticket's own defect, one level up, inside its fix.
