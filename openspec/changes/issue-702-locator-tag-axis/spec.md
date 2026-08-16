---
status: draft
issue: 702
---

# Spec — two facts qualify a block, and neither is its position (issue 702)

## REQ-702-1 — A fence qualifies on its TAG and its protocol

`parseGraphBlock` reads a fenced block as a `brain-graph/1` declaration only when
**both** hold:

- its info-string is one of `GRAPH_FENCE_TAGS` — `''` (untagged) or `'yaml'`;
- its `protocol:` scalar equals `brain-graph/1`.

Exactly the two tags the pre-#639 `FENCE_RE` opened on. A ` ```js `, ` ```bash `,
` ```console `, ` ```text `, ` ```json `, ` ```diff `, ` ```sh ` or ` ```markdown `
fence declares nothing, however well-formed its contents.

Position still selects nothing — #639's fix is intact. A body whose first fence is
an untagged log excerpt or a ` ```yaml ` block of another protocol still parses its
graph block from a later fence.

## REQ-702-2 — Both directions of the tag axis are pinned

The suite varies the tag, not only the position: foreign tags refused, both
eligible tags accepted. Iterated over a list rather than asserted on one example,
because a guard proven on the single tag someone happened to think of is the
`red-proof-blind-along-an-unvaried-axis` shape that let this through — mutating
the filter to require an eligible tag left all 49 of #639's tests green.

## REQ-702-3 — An unterminated fence carrying the protocol is UNREADABLE, not absent

A body whose graph block is opened and never closed returns
`{ ok: false, error }` naming the opening line, lands in `blocksUnreadable`, and
draws no edge.

`null` is defined as ABSENT — "no block was declared". Answering `null` here is
the conflation this function exists to remove, and it is the malformation a human
most ordinarily produces.

## REQ-702-4 — The open fence is attributed on the same two facts, never guessed

`fencedBlocks` reports the unterminated fence's partial `content` alongside its
`tag` and `line`, and the graph reader applies the identical predicate it applies
to a closed block.

The tag alone cannot attribute it: `brain-checkpoint/1` can be recognised from its
info-string, `yaml` cannot. Without the content a consumer must either guess —
reporting a broken declaration where a human was mid-sentence — or stay silent,
which is the defect. An unterminated ` ```js ` fence is therefore ABSENT, not a
broken declaration.

This is an addition to `fenced-blocks.mjs`, not a second reader: the lines were
already accumulated and withheld. `amendment-draft.mjs` and `checkpoint-block.mjs`
read `tag`/`line` by property access and are unaffected.

## REQ-702-5 — An assertion pins what its message claims

`assert.equal(g.edges.length, 0, 'an unreadable block asserts nothing…')` read `0`
under every mutation: `{ ok: false }` carries no `needs`/`blocks`, and no fixture
declared an edge either way.

The fixture now carries `needs: [1]` on the first of the two duplicate blocks, so
a reader that silently picked it would draw `1→9`, and the assertion names that
mutation. An assertion whose message overstates its coverage is worse than none —
it tells the next reader the axis is guarded.
