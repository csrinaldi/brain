---
status: draft
issue: 709
---

# Spec — the selector is a fence TAG, and the splitter is CommonMark-correct (issue 709)

## The #709 / #710 / PR #703 split — settled here, inherited not gh-verified

No shell/`gh` was available to this phase despite the launch instruction expecting one;
claims below rest on Engram `brain/pr-703-hold` (#2753, the cold review that FILED #709
and #710) and `sdd/issue-709-declaring-selector/explore` (#2763), not on a live issue
read. **This change OWNS**: the tag selector (REQ-639-1 below) and the CommonMark-correct
splitter (REQ-709-2), covering all 14 axes — including run-length and indentation, the two
CommonMark-legal shapes PR #703 misread as defects (#710's non-regression half). **Closed
as a side effect, not by any requirement here**: #710's two regressions against PR #703
(an unterminated foreign fence swallowing a valid declaration; `yml`/`YAML`/attributed
`yaml` returning `null`) are findings against an unmerged diff — closing #703 unmerged
(this change's prerequisite) closes them with no code. A later phase MUST confirm PR
#703's actual state/comments with `gh pr view 703` before archiving this change; this spec
does not certify it. **#709's own corpus tally is an inference by analogy, not a
`brain-graph/1` measurement** (#2763) — the tag is a narrowing, never the reason a
requirement below holds.

## MODIFIED Requirements

### Requirement: REQ-639-1 — The block is selected by its fence TAG, never a `protocol:` scalar or position

(Previously: selected by the `protocol:` scalar inside an untagged ` ```yaml ` block;
position selected nothing.)

`parseGraphBlock` reads every fenced block via the CommonMark-correct splitter
(REQ-709-2) and keeps the one whose info-string's **first word**, compared exact-case,
equals `brain-graph/1`. Position selects nothing. A ` ```yaml ` + `protocol:
brain-graph/1` block MUST NOT declare. The #495-D1 rationale that kept `yaml` (rendering
cost) is superseded on the ground that the cost is cosmetic and outweighed by fabricated
edges any yaml-tagged illustration reproduces (#709) — a doctrine reversal gated by
REQ-709-6, not by this code change alone.

#### Scenario: Untagged, foreign- and yaml-tagged fences are skipped

- GIVEN a body with fences tagged (none), `yaml`, `console`, `js`, none carrying `brain-graph/1`
- WHEN `parseGraphBlock` reads it
- THEN the result is `null` — no fence is selected

#### Scenario: The legacy shape no longer declares, and is refused OUT LOUD

- GIVEN a body containing only a ` ```yaml ` fence with `protocol: brain-graph/1` inside
- WHEN `parseGraphBlock` reads it
- THEN the result is `{ ok: false, error }` naming the retag — never the parsed graph,
  and never `null`

("No dual acceptance" must not read as "silently stopped working" — design D7. An
earlier draft of this scenario said `null`, contradicting D7, the ADR-0032 Decision
and the shipped code; corrected during apply.)

## ADDED Requirements

### Requirement: REQ-709-2 — The shared splitter is CommonMark-correct on all 14 axes

`fenced-blocks.mjs`'s `fencedBlocks` MUST track fence delimiter type (`` ` `` vs `~`) and
run length, close only on a same-type run of same-or-longer length at 0–3 spaces of
indentation, and treat a 4+-space opener as content, never a fence. This is the
load-bearing half: it MUST hold independent of any tag, so an untagged or wrongly-tagged
nested fence is equally inert.

| # | axis | correct answer |
|---|---|---|
| 1 | tag: none/`yaml`/`yml`/`YAML`/`console`/`js`/`brain-graph/1` | only exact-case `brain-graph/1` selects (REQ-639-1) |
| 2 | delimiter: backtick vs `~~~` | both split; neither leaks into the other |
| 3 | nesting both directions | inner fence of the other type is content, not a boundary |
| 4 | run length: closer shorter/equal/longer | only same-or-longer run of the SAME type closes |
| 5 | indentation 0 / 1–3 / 4+ | 0–3 opens and closes; 4+ is an indented code block, not a fence |
| 6 | blockquote nesting (`> `) | fence inside a blockquote is read explicitly, never accidentally boundary-crossing into the outer document |
| 7 | list-item nesting (`- `) | an indented opener under a list item is recognized, not missed |
| 8 | HTML comment wrapping | a fence inside `<!-- … -->` is content; it declares nothing |
| 9 | LF vs CRLF | opener, closer and content match identically under both |
| 10 | unterminated fence | reported via `unterminated`, never silently dropped |
| 11 | info-string trailing attributes (`yaml title="x"`) | first word only is compared; trailing tokens do not block a match on that word, nor invent one |
| 12 | case (`BRAIN-GRAPH/1`, `Brain-Graph/1`) | exact-case only; no match |
| 13 | multiplicity, incl. one declared + one shown | only `brain-graph/1`-tagged fences count toward REQ-639-3's ambiguity error; a yaml-tagged illustration beside one declaration is NOT ambiguity |
| 14 | position: first / last / only fence | position never selects; the tagged fence is found wherever it is |

#### Scenario: The tilde-nesting attack yields no edge

- GIVEN a body with a ` ```yaml `+`protocol: brain-graph/1` line nested inside a `~~~console … ~~~` region
- WHEN the splitter runs
- THEN no backtick fence is recognized inside the tilde region; `parseGraphBlock` returns `null`

#### Scenario: A legally indented closer still closes

- GIVEN a fence opened at column 0 and closed with a run indented 2 spaces
- WHEN the splitter runs
- THEN the block closes there; content after it is not swallowed into the block above

### Requirement: REQ-709-3 — Every refusal is legible, never silent

An axis the splitter or selector cannot decide (an unterminated fence, an undecidable
nested state) MUST report a named reason on the appropriate stream and MUST NOT read as
health. This is `evidence-reader-empty-on-failure` — a defect class this repo tracks by
name — and it MUST NOT recur here.

#### Scenario: Unterminated fence is reported, not silent

- GIVEN a body whose only fence never closes
- WHEN `buildGraph` processes it
- THEN `blocksUnreadable` carries the fence's line and a stated reason; `renderSummary` prints it on its own line; the node stays UNCLASSIFIED, never a silent leaf

### Requirement: REQ-709-4 — The regression net stays green, unedited

`amendment-draft.test.mjs` and `checkpoint-block.test.mjs` (and their consumer suites:
`brain-promote.amendment.test.mjs`, `brain-promote.golden.test.mjs`,
`review/evaluators/checkpoint.test.mjs`, `review/cli.test.mjs`) MUST pass with **zero
edited lines**. An edit to any of them is evidence the splitter change moved a shipped
contract and MUST be treated as a STOP requiring the maintainer's decision, never an
in-flight fix-up.

#### Scenario: Splitter change ships without touching consumer suites

- GIVEN the splitter change is complete
- WHEN the regression suites run
- THEN all pass; `git diff` on those test files is empty

### Requirement: REQ-709-5 — The `yaml-block.mjs` boundary is untouched

`review/lib/yaml-block.mjs`'s `extractFencedBlock`/`FENCE_RE` and its consumers
(`parse-verdict.mjs`, `decision-block.mjs`, `vcs/actor-check.mjs`'s
`sniffDecisionProtocol`) MUST NOT be modified and MUST NOT import `fencedBlocks`.
First-fence-only is deliberate under design.md §E2 rule 17, signed ADR-0026, and pinned
REQ-487-6.

#### Scenario: Boundary shows a zero-line diff

- GIVEN the change is complete
- WHEN the diff is inspected
- THEN `yaml-block.mjs` and its three consumers show zero changed lines

### Requirement: REQ-709-6 — The doctrine reversal is a signed ADR, not a silent flip

Moving `brain-graph/1` across design.md:16-17's family line (from `​```yaml`+`protocol:`
to the tagged-info-string family) MUST be recorded as an ADR drafted per ADR-0028's
read-confirm-stage mechanics. A human signature is a PRECONDITION of this change
closing — an agent MUST NOT apply `status:approved` or sign the ADR itself (#124,
`actor-check` §9's authority split).

#### Scenario: Code ships, signature pending

- GIVEN the selector and splitter code changes are complete and the ADR is drafted
- WHEN the change is proposed for archival
- THEN archival MUST NOT proceed while the ADR is unsigned

#### Scenario: An agent cannot self-authorize

- GIVEN the ADR draft exists
- WHEN any agent-originated action attempts to set its status to `approved` or add a signature
- THEN the action MUST be refused
