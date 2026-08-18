---
status: draft
issue: 709
---

# Proposal — the block is DECLARED by its tag, and the splitter stops reading illustrations as fences (issue 709)

## Intent

`brain:epic:map` cannot tell a `brain-graph/1` block an author **declared** from one an
author **showed**, because the selector is made entirely of tokens a human reproduces
while illustrating the protocol, and because the fence splitter beneath it reads
backtick fences only — so text GitHub renders as literal, non-reparsed content inside a
`~~~` region is read as a real top-level block. Either half is enough to mint an edge
nobody asserted. `vcs-contract.md`'s `issueRelations` row already settled which
direction is worse: *"a fabricated dependency, worse than an omitted one, and the count
is what keeps the omission audible."* This change closes both halves and buys the
closure with an omission, never a guess. It refuses to become a Markdown renderer, it
refuses to widen the VCS port, and it refuses to touch the first-fence contract
`yaml-block.mjs` holds under signed ADR-0026.

## Corrections to the inputs, made before building on them

**1 · The base is not what the exploration described.** `origin/main` @ `b3c08a5`
already carries #639/PR #695 **merged**: `epic-graph.mjs:40` imports `fencedBlocks`,
and `:84-85` selects across **every** fence by the `protocol:` scalar, with the
multi-block error of REQ-639-3. There is no `GRAPH_FENCE_TAGS` anywhere in the tree.
Spec and design must be written against `b3c08a5`, not against the exploration's
`extractFencedBlock` snapshot.

**2 · The "same rendering surface" precedent is false — the decision survives on other
ground.** `brain-amendment/1` parses `*.draft.md` **files**; `brain-checkpoint/1`
parses `checkpoint-report.md`, located by `review/mode.mjs:10`'s `CHECKPOINT_REPORT_RE`
over changed files. Neither is a rendered issue or PR body. `issue-495/design.md:12-17`
draws the family line by exactly that axis — rendered-for-a-human → ` ```yaml ` +
`protocol:`; file-in-repo → tagged info-string — and it lists `brain-graph/1` in the
first family **by name**. So the codebase does not contradict #639's objection; it
agrees with its taxonomy. Do not cite the precedent as surface-equivalent — a reviewer
will check it, and the check fails.

The tagged info-string is still right, for three reasons that do hold:

| claim | evidence |
|---|---|
| The rendering cost is cosmetic and bounded | An unknown info-string still renders as a fenced code block on both providers. Only highlighting is lost, on a five-line key/value block. Weighed against a fabricated edge, the trade is already settled doctrine. |
| Migration cost is zero, **measured** | `issue-639-graph-block-locator/proposal.md:53-61` measured all 312 issues: 2 bodies mention `brain-graph/1`, both prose, **0 carry a declared block**. Re-verified here: no declaration exists anywhere in the tree outside docs, comments and fixtures. |
| The residual ambiguity becomes audible, not silent | REQ-639-3 already turns two matching blocks into an error naming the count. A body that both declares and illustrates therefore yields a reported refusal and UNCLASSIFIED — never a fabricated edge. |

**3 · The tag has a half-life, so it must not be sold as the fix.** Once the docs teach
` ```brain-graph/1 `, an author illustrating the protocol will reproduce *that* too —
the identical mechanism that made ` ```yaml ` + `protocol:` indistinguishable from an
illustration. The corpus tally behind the tag is a measurement of **habit**, and per
#709's own comment it is an inference by analogy: the seven measured sites illustrate
`brain-review/1|2` and `brain-decision/1`, not `brain-graph/1`. The durable
discriminator is CommonMark-correct **nesting** — an illustration shown inside an outer
fence, a blockquote, an indented code block or an HTML comment is CONTENT — and that
lives in `fenced-blocks.mjs`. **That is the load-bearing half of this change.** The tag
is a narrowing; the splitter is the closure.

## Root cause, both halves, with citations

**A · The selector is reproducible by illustration.** `epic-graph.mjs:84-85`:

```
fencedBlocks(body).blocks.filter(b => scalar(b.content, 'protocol') === GRAPH_PROTOCOL)
```

Every token in that predicate is what the module's own header (`:11-17`) teaches an
author to write. `epic-map.test.mjs:10-13` builds its fixture from the same documented
shape. DECLARED and SHOWN are byte-identical, so no reader can separate them.

**B · The splitter is backtick-only and column-0-only.** `fenced-blocks.mjs:39` opens on
`/^(`{3,})\s*([^`]*?)\s*$/` — no `~~~`, no 0–3-space indent. `:43` closes only on
`line.trimEnd() === open.run` — exact run length, column 0. Three consequences:

- It can never enter an opaque state for a tilde-delimited region, so a ` ```yaml ` line
  nested inside `~~~console … ~~~` is read as a top-level fence and its `protocol:`
  scalar becomes an edge. **This is #709's attack, and it is a splitter defect.**
- A legally indented closer (1–3 spaces) does not close, so a block runs on and can
  swallow a later illustration into the block above it.
- A legally indented opener (the ordinary list-item case) is missed entirely.

Three protocols consume that splitter. Fixing it there protects all three; getting it
wrong breaks all three.

## Scope

### In scope

1. **`brain/scripts/status/epic-graph.mjs`** — the selector becomes the fence **tag**:
   ` ```brain-graph/1 `, compared against the **first word** of the info string, exact
   case. REQ-639-2/3/4/5 are preserved unchanged; only REQ-639-1's ` ```yaml `-shape
   sentence is superseded by delta.
2. **`brain/scripts/lib/fenced-blocks.mjs`** — delimiter-type-aware and
   indentation-aware nesting: track the fence **type** and **run length**; only a
   same-type, same-or-longer run at 0–3 spaces closes; 0–3 spaces open, 4+ does not;
   content de-indented by the opener's indent. Blockquote and HTML-comment regions
   decided **explicitly**, not by accident.
3. **The regression net.** `fenced-blocks.test.mjs`, `amendment-draft.test.mjs`,
   `brain-promote.amendment.test.mjs`, `brain-promote.golden.test.mjs`,
   `checkpoint-block.test.mjs`, `review/evaluators/checkpoint.test.mjs` and
   `review/cli.test.mjs` MUST stay green **unedited**. An edit to any of them is
   evidence the splitter change moved a shipped contract — that is a STOP, not a
   fix-up.
4. **Migration: none.** Zero declarations exist. The docs that teach the old shape are
   corrected in the same commit: `epic-graph.mjs:11-17`, the `issue-459-*` and
   `issue-639-*` artifacts, `vcs-contract.md`'s `issueRelations` row, and
   `epic-map.test.mjs`'s fixture builder.
5. **No dual acceptance.** A ` ```yaml ` + `protocol: brain-graph/1` block stops
   declaring. Accepting both shapes would leave the fabrication path open, which is the
   whole defect; design may revisit this only with new evidence.
6. **The axis list below**, as the test obligation.

### The axis list

#702 exists because #639 left the **tag** axis unvaried; #710 exists because PR #703
left the **delimiter** axis unvaried. Every axis here MUST be varied by test, and each
must state which answer is correct and why.

| # | axis | values |
|---|---|---|
| 1 | tag | untagged · `yaml` · `yml` · `YAML` · foreign (`console`, `js`) · `brain-graph/1` |
| 2 | delimiter | backtick vs `~~~` |
| 3 | nesting, both directions | ` ``` ` inside `~~~` · `~~~` inside ` ``` ` |
| 4 | run length | closer shorter · equal · longer than opener |
| 5 | indentation | 0 · 1–3 (legal) · 4+ (demotes to an indented code block) |
| 6 | blockquote nesting | `> ` prefixed fence |
| 7 | list-item nesting | fence indented under `- ` |
| 8 | HTML comment wrapping | `<!-- … -->` around the block |
| 9 | line endings | LF vs CRLF (opener, closer, content) |
| 10 | termination | unterminated fence |
| 11 | info-string extras | trailing attributes after the tag |
| 12 | case | `BRAIN-GRAPH/1`, `Brain-Graph/1` |
| 13 | multiplicity | one · two · one declared plus one illustrated |
| 14 | position | first fence · last fence · only fence |

### Out of scope — a hard boundary, named so a later phase does not stray

- **`brain/scripts/review/lib/yaml-block.mjs`'s `extractFencedBlock` / `FENCE_RE`
  (`:45`, `:51`) and its three consumers** — `parse-verdict.mjs:232`,
  `decision-block.mjs:51`, `actor-check.mjs:229-231` (`sniffDecisionProtocol`). First
  fence only is deliberate under design.md §E2 rule 17, recorded in signed **ADR-0026**
  and pinned by **REQ-487-6**, which requires the behaviour stay asserted so doctrine
  and test move together. `yaml-block.drift.test.mjs` is the sentinel. No file in this
  list is edited, and no import of `fencedBlocks` is added to any of them.
- Native provider relations, `issueRelations`, and ADR-0029's union — untouched.
- Any part of #710 not on the axis list above.

### The #709 / #710 split, stated plainly

PR #703 is **not** in `b3c08a5`. Its two regressions against #639 are therefore
findings against an **unmerged diff**: closing #703 closes them, with no code. What
survives of #710 is its other half — CommonMark-legal shapes read as fabricated
defects — and that half is folded into the axis list here. So this change closes #710's
substance and #703's closure closes its regressions. *Caveat: #710's body could not be
read in this sandbox (no shell, no `gh`); this split is conditional on that reading.*

## What happens to PR #703

**SUPERSEDED — close it unmerged. Do not rebase onto it, do not build on it.**

| reason | detail |
|---|---|
| It narrows, it does not close | `GRAPH_FENCE_TAGS = ['', 'yaml']` keeps `yaml` admissible, so the illustration path — the actual defect — stays wide open. |
| Its whitelist is the source of #710's false negatives | `yaml` admitted plus case-sensitive comparison is exactly where legal shapes read as defects. |
| Nothing depends on it | It is absent from `b3c08a5`; there is no integration debt to preserve. |
| It leaves the delimiter axis unvaried | The same failure mode that produced it. |

## Capabilities

This repo uses `sdd-layout.md`'s **flat** convention: a delta `spec.md` inside this
change dir. There is no `openspec/specs/` tree.

- **New capabilities**: None.
- **Modified capabilities**: `issue-639-graph-block-locator/spec.md` **REQ-639-1** — the
  selector moves from the `protocol:` scalar to the fence tag; the requirement's
  ` ```yaml `-shape paragraph is superseded. `issue-495-declared-budget-claim/design.md`
  **D1** — the family table's placement of `brain-graph/1` on the `yaml` side is
  corrected, with the reason recorded rather than quietly reversed.

## Affected areas

| Area | Impact | Description |
|---|---|---|
| `brain/scripts/lib/fenced-blocks.mjs` | Modified | Delimiter-, run- and indentation-aware CommonMark nesting. **Shared by three protocols.** |
| `brain/scripts/status/epic-graph.mjs` | Modified | Tag selector; header doctrine corrected. |
| `brain/scripts/lib/fenced-blocks.test.mjs` | Modified | The axis matrix lands here. |
| `brain/scripts/status/epic-map.test.mjs` | Modified | Fixture builder emits the tagged shape; declared-vs-shown cases. |
| `openspec/changes/issue-639-*/spec.md`, `issue-495-*/design.md` | Modified | Superseding notes. |
| `brain/scripts/review/lib/yaml-block.mjs` + 3 consumers | **Untouched** | ADR-0026 / REQ-487-6 boundary. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Shared-splitter blast radius — `brain:promote` and the checkpoint evaluator break | **High** | The existing suites are the net and MUST pass unedited. Any required edit is a STOP. Ship the splitter change as its own reviewable unit. |
| Three prior attempts each closed one axis and opened another (#639→#702, #703→#710) | **High** | The 14-axis table is the exit criterion, not a wish list. A green suite that leaves an axis unvaried proves nothing (`red-proof-blind-along-an-unvaried-axis.md`). |
| Hand-rolling CommonMark drifts from CommonMark | Medium | Implement only the axes in the table, each with a stated correct answer. Zero external deps stands. Undecidable shapes answer **absent**, and absence is reported. |
| The tag's half-life — illustrations converge on the tag | Medium | Accepted and named. REQ-639-3 turns convergence into a reported refusal, never an edge. |
| A stricter splitter silently drops a legal declaration | Medium | There are zero declarations to drop today. Every omission must be audible via `blocksUnreadable` / `unterminated`, never silent. |
| The corpus tally is an inference by analogy, not a `brain-graph/1` measurement | Confirmed | Recorded as inference. The **migration** claim does not rest on it — `issue-639/proposal.md:53-61`'s `0 of 312` does. |
| #709 and #710's own bodies illustrate the shape and may already be minting edges | Unverified | Suspected live incidents, not merely reachable. Verify with `brain:epic:map --dry-run` before and after. |

## Rollback plan

Two independent reverts, in this order. `git revert` the `epic-graph.mjs` selector
commit to restore the `protocol:`-scalar shape (safe on its own — zero authored
declarations exist to invalidate). `git revert` the `fenced-blocks.mjs` commit to
restore the backtick-only splitter; because the three consumer suites were never
edited, they pass on both sides of that revert, which is what makes it safe. Keeping
the two in separate commits is a rollback requirement, not a style preference.

## Dependencies

- None external. Node ESM, zero dependencies, `node:test`.
- Prerequisite housekeeping: close PR #703 unmerged.

## Success criteria

- [ ] A `brain-graph/1` block shown inside `~~~console … ~~~` yields **no** edge.
- [ ] The same block shown inside a longer backtick fence, a blockquote, a 4-space
      indented region, or an HTML comment yields **no** edge.
- [ ] A tagged ` ```brain-graph/1 ` block declares, at any position, at 0–3 spaces of
      indentation, with LF or CRLF.
- [ ] A ` ```yaml ` + `protocol: brain-graph/1` block no longer declares, and the docs
      that taught it are corrected in the same commit.
- [ ] Declared-plus-illustrated yields REQ-639-3's error naming the count — never an
      edge, never a silent pick.
- [ ] All 14 axes are varied by test, each with its correct answer stated and reasoned.
- [ ] `amendment-draft`, `brain-promote` and `checkpoint` suites pass **unedited**.
- [ ] `yaml-block.mjs` and its three consumers show a zero-line diff.
