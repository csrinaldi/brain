# ADR-0032 Amendment 2 — three further declarable keys: `kind`, `tracker`, `parent` (issue #967)

> **Tier 2 draft. Not yet promoted.**
> `brain/project/decisions/adr-0032-graph-block-declared-by-its-tag.md` is a
> signed ADR, so this is an in-place amendment, following the three-act
> convention (`consolidation-protocol.md` §1c): mark the Status line, amend
> nothing in the original body (nothing there is superseded — this is a pure
> addition, not a correction), append a signed `## Amendment 2` section. The
> maintainer promotes it once PR A of #967 (the block gains the three keys,
> `brain/scripts/status/epic-graph.mjs`) has landed:
>
> ```
> npm run brain:promote -- openspec/changes/issue-967-tracker-as-data/brain-drafts/graph-block-kind-tracker-parent.md
> ```
>
> Co-promote the `brain/HOME.md` entry in the same commit (`decision-gate`'s
> ADR ⇔ `HOME.md` co-occurrence rule).

```brain-amendment/1
target: brain/project/decisions/adr-0032-graph-block-declared-by-its-tag.md
issue: 967
body: ## Amendment 2 — three further declarable keys: `kind`, `tracker`, `parent` (issue #967)
body-end: ### What this does not change
```

```amend-find
**Status**: Accepted · **amended 18/08/2026** (Amendment 1 — see below)
```

```amend-replace
**Status**: Accepted · **amended DD/MM/YYYY** (Amendment 2 — see below)
```

## Amendment 2 — three further declarable keys: `kind`, `tracker`, `parent` (issue #967)

**Signed**: DD/MM/YYYY — <Name>

### What this adds

This ADR settled HOW a `brain-graph/1` block is located and told apart from
an illustration (the fence tag, compared exact-case against the first word
of the fence's info string). It said nothing about WHICH keys a declaration
may carry beyond the four `epic-map.test.mjs` already exercised (`track`,
`blocks`, `needs`, `files`). Issue #967 adds three more, read by the same
selector and the same reader (`brain/scripts/status/epic-graph.mjs`'s
`parseGraphBlock`), governed by this ADR's existing rules on malformed and
ambiguous input:

> A `brain-graph/1` block may declare `kind: epic`, `tracker: feature/<name>`
> on an epic, and `parent: <issue>`; absent a `parent:` key a line-initial
> `Parent: #N` is read and the node records that the answer came from prose.

- **`kind`** takes any value verbatim; only the literal `epic` carries
  meaning anywhere downstream. There is no validation — forward
  compatibility with a future `kind` is free without one.
- **`tracker`** is honoured only on a node that itself declares `kind: epic`.
  A `tracker:` on a node that never declared `kind: epic` is carried as a
  said divergence and honoured nowhere — a typo in `kind:` must not silently
  delete a declaration, and a `tracker:` on an arbitrary node must not
  silently redirect a branch. Grammar: `feature/<segment>(/<segment>)*`,
  `..` refused as a path segment. A malformed value is refused out loud
  (`tracker-grammar`), never repaired into the value it nearly was.
- **`parent`** is a bare positive integer with no leading zero
  (`[1-9]\d*`) — the same grammar issue #967 also fixed for the pre-existing
  prose reader, so the block key and the prose fallback cannot drift into
  disagreeing about what a number is. When the `parent:` key is present and
  malformed, it is refused (`parent-grammar`) and does **not** fall through
  to the prose reader — a refused declaration must never quietly succeed
  through a second door. When the key is absent, a line-initial `Parent:
  #N` (exact case, outside every fenced region) is read instead, and the
  node's `parentSource` records `'prose'` rather than `'block'`, so a
  consumer can tell a declared parent from an inferred one. Two DIFFERENT
  numbers named for the key — one line or two — is ambiguity
  (`parent-ambiguous`); the same number said twice is a restatement and
  reads once.
- **No key here is ever inferred from an issue title.** An `epic(...)`
  title prefix remains decorative — R967-9 (`openspec/changes/issue-967-tracker-as-data/spec.md`).

### What this does not change

This ADR's decision — the fence tag is the selector, compared exact-case
against the first word of the info string — is untouched. The malformed-vs-
absent-vs-ambiguous discipline these three keys follow (refuse out loud,
never repair, never guess) is the same discipline `blocks`/`needs`/`files`
already had; this amendment documents new keys under an existing rule, it
does not add a new rule.
