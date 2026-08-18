---
status: draft
issue: 709
---

# Design — the tag declares, and the splitter agrees with the renderer (issue 709)

## Provenance of every claim below

Stated first, because this change's three predecessors each shipped on an inherited
claim that turned out to be about a different thing.

| claim | status |
|---|---|
| `epic-graph.mjs:84-85` selects on the `protocol:` scalar across every fence (#639 merged) | **measured** — read at `b3c08a5` |
| `fenced-blocks.mjs:39` is backtick-only and column-0-only; `:43` requires an exact-run closer | **measured** — read at `b3c08a5` |
| A ` ```yaml ` fence nested in `~~~console … ~~~` is read as a top-level block and mints an edge | **measured by code trace**: `~~~console` never matches `:39`, so the inner backtick fence opens at top level and its ` ``` ` closes it |
| `scalar()` anchors `^key:` at column 0 (`m` flag, no leading-whitespace allowance) | **measured** — `yaml-block.mjs:66` |
| Exactly **one** column-0 `protocol: brain-graph/1` exists in the whole tree — `issue-459-epic-map-derived/proposal.md:38`, an illustration | **measured** (`rg`) |
| **Zero** `~~~` fences exist anywhere in the tree | **measured** |
| **Zero** indented (1–3 space) fences carry a protocol tag anywhere; **zero** indented fences of any kind exist in any `*.draft.md` | **measured** — this is the blast-radius result for D2 |
| 48 indented (1–3 space) fences exist across 14 files, none of them an input to `amendment-draft` or `checkpoint-block` | **measured** |
| `0 of 312` issue bodies carry a declared block | **inherited**, `issue-639-graph-block-locator/proposal.md:53-61`, and dated. I re-verified only the in-repo half (row 5). |
| An unknown info-string still renders as a fenced code block on GitHub and GitLab, losing only highlighting | **UNVERIFIED — and load-bearing.** See D13. Not asserted anywhere in this change as fact. |
| PR #703's contents, #710's five findings | **inherited** from the orchestrator, who ran `gh`. This agent has no shell. |

## Technical approach

Two changes, in two commits, in a specific order. The **selector** in
`epic-graph.mjs` moves from a scalar a human reproduces while illustrating to the
fence's own info string. The **splitter** in `lib/fenced-blocks.mjs` stops
disagreeing with the renderer that produced the text it is reading: it becomes
delimiter-, run- and indentation-aware, and it grows a channel for the fences it
deliberately refuses so that a refusal is never returned as an absence.

The proposal's framing holds: the tag is a **narrowing** with a half-life, and the
splitter is the **closure**. This design makes the splitter's guarantees stand
alone — every one of them is stated as a rule about what the renderer shows, so
they remain true after the tag becomes something illustrations reproduce.

---

## D0 — Landing order is SELECTOR FIRST. The proposal's order is wrong, and I can show it.

The proposal's rollback section implies the splitter lands first. That order opens a
regression window, measured:

D2 teaches the splitter to see openers indented 1–3 spaces and to de-indent their
content. With the **old** selector still in place, an illustration written under a
list bullet — ` ```yaml ` at 2 spaces, `protocol: brain-graph/1` at 4 — is invisible
today (`:39` never matches an indented line) and becomes a de-indented block whose
`protocol:` scalar sits at column 0 tomorrow. `scalar()` matches. **An edge is minted
from an illustration by the commit that was supposed to prevent that.**
`issue-459-epic-map-derived/proposal.md:38` proves authors write that block verbatim;
the orchestrator's `rg -c '^protocol: brain-graph/1'` → 0 over #709's body proves the
bodies that illustrate it are indented — i.e. exactly the shape this commit would
newly read.

So: **commit 1 = selector, commit 2 = splitter.** Rollback is therefore the reverse
of the proposal's text — revert the splitter first, then the selector. Each revert is
still independently safe: reverting only the splitter restores the narrow tag
selector over the narrow splitter (no edges lost, zero declarations exist);
reverting only the selector restores the scalar selector over the *new* splitter,
which is the regression window above — so **the two reverts are ordered, and that
order is part of the contract.**

## D1 — The selector is the info string's FIRST WORD, exact case. `tag` is not touched.

`fencedBlocks` returns `tag` = the whole trimmed info string, and
`amendment-draft.mjs` / `checkpoint-block.mjs` compare it with `===`. Redefining
`tag` as the first word would widen both of them (` ```brain-amendment/1 x ` would
newly match). So `tag` keeps its exact present meaning and the splitter gains an
additive `lang` = first whitespace-delimited word of the info string.
`epic-graph.mjs` selects on `lang === GRAPH_PROTOCOL`, exact case.

This dissolves #710's finding 2 at the root rather than patching it. That finding
(` ```yml `, ` ```YAML `, ` ```yaml title="x" ` all answering `null`) is a
consequence of **having a whitelist of admissible language tags at all**. There is no
whitelist here: one string declares, everything else is prose. `yml` and `YAML` are
not near-misses to be forgiven — after this change they are not the tag, the same way
`js` is not. Trailing attributes are accepted because a renderer classifies on the
first word too, and refusing a shape the renderer accepts is the disagreement this
whole change exists to remove.

## D2 — The splitter contract. It agrees with the renderer; that is the whole rule.

One sequential state machine over lines, three states — TEXT, FENCE, COMMENT — no
recursion, no CommonMark library, zero dependencies.

| rule | value | reason |
|---|---|---|
| Opener | ≤ 3 leading spaces, then ≥ 3 identical `` ` `` or `~` | CommonMark. 4+ spaces is an indented code block, so what follows is content — the renderer shows it as content. |
| Info string | rest of the line, trimmed. Backtick fences MUST NOT contain `` ` `` in the info string; tilde fences may | CommonMark; also what `:39`'s `[^`]*?` already enforced for backticks. |
| Closer | same delimiter char, run **≥** opener's run, ≤ 3 leading spaces, nothing after but whitespace | CommonMark. Independent of the opener's indent — deliberately. |
| Inside FENCE | every line is content, including a fence of the other type or a shorter run | already true today, and the property `~~~` inside ` ``` ` depends on. |
| Content | each line de-indented by up to the **opener's** indent | CommonMark. **For an opener at indent 0 this is a byte-for-byte no-op** — that is the safety argument in D14. |
| Nesting | none, in either direction. First opener wins; only its matching closer exits | inside a fence CommonMark reparses nothing, and neither do the two providers. |

#710's finding 3 is **decided in the loose direction, and pinned in both**: an
indented closer and a longer-run closer both close. Its caveat asks whether
REQ-487-5's strictness should transfer by analogy. It should not, and the reason is
that REQ-487-5 answers a different question about a different input.
`yaml-block.mjs` reads a **single-block artefact our own emitter wrote**, where
`yamlScalar` escapes newlines so a fence cannot occur inside a value at all — the
anchor is exact because exactness is *provably* free there. `fencedBlocks` reads
human prose with no escaping guarantee, so strictness is not free: it reports a
CommonMark-legal document as `is never closed` and **publishes a fabricated
accusation into the epic issue**. `vcs-contract.md`'s `issueRelations` row already
ordered those harms. The rule and its reason go into `fenced-blocks.mjs`'s header,
because #710's real finding there is that neither direction was written down.

## D3 — A blockquoted fence does not declare, and does not open a block.

A line whose first non-space character (after ≤ 3 spaces) is `>` is not a fence
delimiter and is not fence content while in TEXT. Two reasons: a blockquote is
literally quotation — the canonical "someone else wrote this" shape — and parsing
fences inside block containers needs marker stripping plus lazy-continuation rules,
which is the CommonMark rabbit hole this change refuses to enter. Honest cost: a
genuine declaration written inside a blockquote is not read. That is an omission, the
safe direction, and D6 makes it audible instead of silent.

## D4 — An HTML-commented fence does not declare. It is the strongest non-declaration there is.

`<!-- … -->` renders as **nothing**, so an author who wrapped a block in one has said
more clearly than any other shape that it is not to be read. COMMENT state opens on a
line whose first non-space character (≤ 3 spaces) begins `<!--` and closes on the
line containing `-->` — CommonMark HTML block type 2, precisely specifiable in ~6
lines. Precedence needs no tie-break: a fence opener line begins with `` ` `` or `~`
and a comment opener line begins with `<`, so they are mutually exclusive; and a
`<!--` **inside** a fence is content, because FENCE state is entered first in scan
order.

## D5 — An unterminated fence: CommonMark already decides, and the refusal is legible.

An unterminated opener runs to the end of the document, so everything after it is
content **and a declaration below it is genuinely not a declaration**. Not reading it
is correct, not merely conservative. Two consequences:

- Blocks closed **above** the unterminated opener are complete, and the declaration
  count is therefore *known*, not unknown. They are used.
- Because nothing below can be a block, there is no attribution decision to make.
  #703's `open = unterminated && isGraphFence(unterminated) ? unterminated : null`
  (#710 finding 1, and finding 4's unpinned axis) is **deleted by construction**:
  the splitter reports the unterminated fence unconditionally and the caller never
  asks whose it was.

Note what this costs relative to `main` today: today an unterminated `~~~console`
above a ` ```yaml ` declaration accidentally *recovers* the graph, because the
runaway block's content happens to carry `protocol:` at column 0 and `scalar` finds
it. That accident ends. It is replaced by a named refusal (D6), not by silence.

An unterminated HTML comment is reported through its **own** field,
`unterminatedComment`, never through `unterminated` — overloading `unterminated`
would make `amendment-draft.mjs` print *"the fenced block opened at draft line N is
never closed"* about a comment, and would make `checkpoint-block.mjs`'s
`unterminated.tag === CHECKPOINT_TAG` test silently false.

## D6 — How ambiguity fails: three answers, and a refusal is never returned as an absence.

`evidence-reader-empty-on-failure.md` names the defect exactly: a reader must not
conflate *"genuinely empty"* with *"could not be obtained"*. Applied one level below
where that anti-pattern was found, the splitter grows a third result field:

```js
skipped: { line, tag, lang, reason: 'blockquote' | 'indented-code' | 'html-comment' }[]
```

Every delimiter-shaped line the splitter deliberately refused is recorded with its
reason. `parseGraphBlock`'s answers become:

| condition | answer | where the reader sees it |
|---|---|---|
| exactly one block with `lang === 'brain-graph/1'` | the parsed object | the graph |
| more than one | `{ok:false, error}` naming the count and the lines (REQ-639-3, unchanged) | `blocksUnreadable` → `renderSummary` |
| zero, and the body never mentions `brain-graph/1` | `null` (absent) | UNCLASSIFIED, no noise |
| zero, but a `skipped` entry or an unterminated fence hides a graph-tagged fence | `{ok:false, error}` naming line **and reason** | `blocksUnreadable` → `renderSummary` |
| zero, but a block carries the **legacy** shape (D7) | `{ok:false, error}` naming the retag | `blocksUnreadable` → `renderSummary` |

No refusal draws an edge, so none of them can fabricate a dependency. None changes
the process exit code: an unreadable block is a fact about one issue, not a failure
of the run, and `brain:epic:map`'s exit contract is out of scope here (ADR-0029,
#639). What changes is that the reason is always printed.

## D7 — The legacy shape is refused OUT LOUD.

"No dual acceptance" must not mean "silently stops working". If zero blocks carry the
tag but some block's content carries `protocol: brain-graph/1`, `parseGraphBlock`
returns `{ok:false, error}`: *the declaration is the fence tag since #709 — retag this
block ` ```brain-graph/1 `.* Four lines of code, and it is the entire migration net.

Accepted cost, stated because it is a real false positive: a meta-issue that
*illustrates* the old shape (#709 and #710 do) now reports "retag me" instead of
answering absent. Its status is UNCLASSIFIED either way, so no node moves and no edge
appears — the change is strictly more explanation for the same graph, and the noise
decays as the corpus migrates.

## D8 — The opener is scanned, not matched by a backtracking regex.

#710 finding 5: `` /^(`{3,})\s*([^`]*?)\s*$/ `` backtracks roughly cubically on a
non-matching line of backticks, a long run of spaces and a later backtick. Issue
bodies are the input. The state machine counts leading spaces, counts the delimiter
run and validates the remainder with `indexOf` — linear, allocation-light, no
backtracking possible. Rated theoretical by both of #710's judges; fixed here because
the line is being rewritten anyway and a hand-rolled scanner is *less* code than the
regex it replaces.

## D9 — Column-0 anchoring in `scalar()` stays. De-indentation is the splitter's job.

The trap the orchestrator flagged is real: today's safety for #709/#710/#702/#690/#473
is that `scalar` needs `^protocol:` at column 0 and those illustrations happen to be
indented. Inheriting that luck is not an option — but the fix is **not** to relax
`scalar`. `scalar` is shared by `parse-verdict.mjs`, `decision-block.mjs`,
`checkpoint-block.mjs` and `epic-graph.mjs`, and one of those paths decides whether a
human signature is admissible. Relaxing it is a four-consumer change with a signature
verification in the blast radius, for no gain.

Instead the layering does the work: **indentation is a fence-level concern**, so the
splitter normalises it (D2's de-indent rule) and `scalar` keeps reading keys at
relative column 0, unchanged and unimported-from differently. Column-0 anchoring
therefore *remains part of the contract* — but it is no longer the thing standing
between an illustration and a fabricated edge. D1 and D2 are. That is the point: the
luck is replaced by two stated rules, and neither of them is `scalar`'s.

## D10 — PR #703 is REPLACED, not rebased.

It touches the same four code files (`fenced-blocks.mjs`, `fenced-blocks.test.mjs`,
`epic-graph.mjs`, `epic-map.test.mjs`), so "rebase" means resolving a conflict in
every one of them and then *removing* three regressions its diff introduced
(#710 findings 1, 2, 3). Its 411 additions already exceed the 400-line review budget
on their own. Its `GRAPH_FENCE_TAGS = ['', 'yaml']` keeps `yaml` admissible, which
keeps the illustration path — the actual defect — open. It is a draft, so nothing
depends on it. **Close it unmerged.** #709's branch is based on `origin/main`
@ `b3c08a5` and stays there.

## D11 — The hard boundary, stated as a decision so no later phase strays.

`brain/scripts/review/lib/yaml-block.mjs`'s `extractFencedBlock` and `FENCE_RE` are
**out of scope**, and so are `parse-verdict.mjs`, `decision-block.mjs` and
`actor-check.mjs:231`. First-fence-only is deliberate under design.md §E2 rule 17,
recorded in **signed ADR-0026**, and pinned by **REQ-487-6** so doctrine and test must
move together; `yaml-block.drift.test.mjs` is the sentinel. No file in that list is
edited, and no `fencedBlocks` import is added to any of them. `scalar`,
`parseJsonScalar` and `decodeYamlEscapes` keep their present behaviour (D9). **Exit
criterion: those four files show a zero-line diff.**

## D12 — The ADR is a draft. The signature is a precondition, not a checkbox.

This change moves `brain-graph/1` across a family line the repo drew deliberately, so
it carries **ADR-0032** (next free number: `brain/project/decisions/` tops out at
0031; 0023 is held by an unratified draft). Written to
`openspec/changes/issue-709-declaring-selector/brain-drafts/adr-0032-graph-block-declared-by-its-tag.md`.

**Deviation from the launch prompt, with evidence.** I was told to put the draft in
top-level `brain-drafts/` following `adr-0023-sdd-role-port.md`. I did not. ADR-0023
is the repo's one **unratified** draft, and every ADR that was actually promoted came
from `openspec/changes/{change}/brain-drafts/` — 0027 (`issue-396-…`), 0028
(`issue-378-…`), 0029 (`issue-533-…`), 0030 (`issue-617-…`), 0031
(`issue-671-…`). `agent-authorities.md` Tier 2 names that path in doctrine: *"the
agent drafts the artifact in `openspec/changes/{iid}/brain-drafts/`; the human moves
it to `brain/`"*. And `openspec/changes/**` is explicitly **Tier 1** for an agent,
where top-level `brain-drafts/` is named in no tier at all. Following the one
outlier over five precedents and the written rule would be the wrong kind of
obedience. Moving one file is cheap if the maintainer disagrees.

Preconditions the **apply** phase must honour, none of which an agent may satisfy:

1. The draft is promoted **only** by `brain:promote` (ADR-0028: renders, confirms,
   stages — never commits). The commit is the signature.
2. `**Status**` stays `DRAFT` and carries no `**Signed**:` line and no date-plus-name
   attribution. An agent applying `status:approved` or signing is Tier 3 prohibited
   (agent-authorities; #124; `actor-check` — a claimed identity establishes nothing).
3. `decision-gate` is **added-only** and fails an ADDED ADR with no `brain/HOME.md`
   change (`checks/adr-presence.mjs`; ADR-0026 Amendment 4, #510). So the promotion
   commit MUST carry `brain/HOME.md` **and** the regenerated `AGENTS.md` (§1d).
   `brain:promote` does that cascade — a hand promotion is what forgets it.
4. `brain/project/decisions/**` **ships**: no third-party hostname
   (`shipped-hostnames.test.mjs`, #648), and citations by path + quoted text rather
   than line numbers, which age (#580/#586). The draft obeys both; this design file
   does not have to, and cites lines freely.

## D13 — The one unverified claim, and what it costs if it is false.

The ADR's rendered-artifact argument rests on: *an unknown info-string still renders
as a fenced code block on GitHub and GitLab; only syntax highlighting is lost.*
**Neither this agent nor the orchestrator can verify that here** — it needs a rendered
page, and there is no shell and no network. It is recorded in the ADR as a named
assumption, not as a measurement.

The repo's own precedent does **not** settle it and must not be cited as if it did:
`brain-amendment/1` and `brain-checkpoint/1` do ship tagged info strings, but they
live in repo **files**, and file-versus-rendered-body is precisely the axis
`issue-495/design.md` draws the family line on. Reusing it as proof is the error the
proposal phase already caught once.

What settles it: put a ` ```brain-graph/1 ` block in one real issue body on each
provider and look at the rendered page. This is free — #709's own PR will exist
anyway — and it belongs in the **verify** phase.

What if it is false? The decision still holds, and the ADR says so: the alternative
to a five-line block that renders less prettily is a **fabricated dependency**, and
`vcs-contract.md` already ordered those two harms. What would change is the honesty of
the record, which is why the assumption is written down instead of assumed.

## D14 — Blast radius on the two sibling consumers, and the evidence they are unaffected.

Three independent arguments, in increasing strength:

1. **Additive contract.** `blocks[].tag`, `blocks[].content`, `blocks[].line` and
   `unterminated{tag,line}` keep their exact present shapes and meanings. `lang`,
   `skipped` and `unterminatedComment` are new fields both consumers ignore.
2. **The changed axes are unoccupied, measured.** `~~~` fences in the tree: **0**.
   Indented fences in any `*.draft.md`: **0**. Indented fences carrying a protocol
   tag anywhere: **0**. HTML comments in any `*.draft.md`: **0**. Longer-run closers
   in a `*.draft.md`: the only 4+ backtick fences are two balanced pairs in
   `issue-509-…/consolidation-protocol-amendment.draft.md` and
   `issue-495-…/reviewer-protocol-amendment-1.draft.md`.
3. **Indent-0 extraction is byte-identical.** De-indentation strips *up to the
   opener's indent*, so for an opener at column 0 it removes nothing. Every input that
   parses today has indent-0 openers (argument 2), therefore every such input yields
   byte-identical `content`. This matters more than it looks: `amend-find` content is
   used as an **exact anchor** for in-place edits to signed doctrine files, so a
   one-space shift would silently re-target a destructive edit. Pin the no-op with a
   test.

The existing suites are the net and MUST pass **unedited**:
`fenced-blocks.test.mjs` (its three cases stay verbatim — the ` ``` `-inside-` ```` `
case at `:29` is the one nesting axis that already worked), `amendment-draft.test.mjs`,
`brain-promote.amendment.test.mjs`, `brain-promote.golden.test.mjs`,
`checkpoint-block.test.mjs`, `review/evaluators/checkpoint.test.mjs`,
`review/cli.test.mjs`. An edit to any of them is evidence a shipped contract moved:
**STOP, do not fix up.**

---

## Data flow

```
issue body ──► fencedBlocks (TEXT│FENCE│COMMENT scan)
                 │           │              │
            blocks[]    unterminated   skipped[]  unterminatedComment
              │ lang            │          │            │
              ▼                 └────┬─────┴────────────┘
      lang === 'brain-graph/1'       │  (a refusal, with its reason)
              │                      ▼
      ┌───────┴────────┐     parseGraphBlock ──► {ok:false, error}
      │ exactly one    │                                │
      ▼                ▼                                ▼
   scalar()       >1 → REQ-639-3 error        buildGraph.blocksUnreadable
   (col-0, unchanged)                                   │
      │                                                 ▼
      ▼                                            renderSummary
   {track, blocks, needs, files} ──► edges (SRC_DECLARED)

   NO path from a refusal to an edge. That is the invariant.
```

## File changes

| File | Action | Description |
|---|---|---|
| `brain/scripts/status/epic-graph.mjs` | Modify | **Commit 1.** Selector → `lang === GRAPH_PROTOCOL`; D6's answer table; D7's legacy refusal; header doctrine at `:11-17` and `:80-83` corrected. |
| `brain/scripts/status/epic-map.test.mjs` | Modify | **Commit 1.** Fixture builder emits ` ```brain-graph/1 `; declared-vs-shown, legacy-shape and case cases. |
| `brain/scripts/lib/fenced-blocks.mjs` | Modify | **Commit 2.** D2's state machine, D3, D4, D5, D8; `lang`/`skipped`/`unterminatedComment`; the rule and its reason in the header. |
| `brain/scripts/lib/fenced-blocks.test.mjs` | Modify | **Commit 2.** The 14-axis matrix, appended below the three verbatim cases. |
| `openspec/changes/issue-639-graph-block-locator/spec.md` | Modify | REQ-639-1 superseded by delta (2/3/4/5 unchanged). |
| `openspec/changes/issue-495-declared-budget-claim/design.md` | Modify | D1's table row for `brain-graph/1` corrected, pointing at ADR-0032. |
| `brain/core/methodology/vcs-contract.md` | ~~Modify~~ **Untouched** | The `issueRelations` row's "illustration" is an inline code span, not a fence — nothing to retag. Verified at apply time; the row assumed a fence this file does not contain. |
| `…/brain-drafts/adr-0032-graph-block-declared-by-its-tag.md` | Create | This phase. Draft, unsigned, never promoted by an agent (D12). |
| `brain/project/decisions/**`, `brain/HOME.md`, `AGENTS.md` | **Not by an agent** | D12 preconditions — `brain:promote` + the maintainer's commit. |
| `brain/scripts/review/lib/yaml-block.mjs` + 3 consumers | **Untouched** | D11. Zero-line diff is an exit criterion. |

## Interface

```js
/**
 * @returns {{
 *   blocks: { tag: string, lang: string, content: string, line: number }[],
 *   unterminated: { tag: string, lang: string, line: number } | null,
 *   unterminatedComment: { line: number } | null,
 *   skipped: { line: number, tag: string, lang: string,
 *              reason: 'blockquote'|'indented-code'|'html-comment' }[]
 * }}
 */
export function fencedBlocks(text)
```

`tag` unchanged: the whole trimmed info string. `lang`: its first whitespace-delimited
word.

## Testing strategy — the 14 axes, each with its answer and its reason

Every axis is tested at BOTH layers where both apply: the splitter axis in
`fenced-blocks.test.mjs`, the selector axis in `epic-map.test.mjs`. A green suite that
leaves an axis unvaried proves nothing
(`red-proof-blind-along-an-unvaried-axis.md`) — that is how #639 produced #702 and
#703 produced #710.

| # | axis | answer | reason |
|---|---|---|---|
| 1 | tag: untagged · `yaml` · `yml` · `YAML` · foreign · `brain-graph/1` | only the last declares | D1 — one string declares, there is no whitelist to forgive near-misses |
| 2 | delimiter `` ` `` vs `~` | both open and close, never each other | D2 — the renderer treats them as peers |
| 3 | nesting both directions | inner fence is CONTENT | D2 — nothing inside a fence is reparsed |
| 4 | closer run shorter · equal · longer | shorter = content; equal and longer close | D2 — CommonMark; strictness fabricates "never closed" (#710/3) |
| 5 | indent 0 · 1–3 · 4+ | 0–3 open; 4+ is an indented code block, so content | D2 — 4+ is what the renderer shows as content |
| 6 | blockquote `> ` | does not declare, recorded in `skipped` | D3 |
| 7 | list-item indented fence | declares at 1–3 spaces, content de-indented | D2 — the ordinary legal case |
| 8 | HTML comment | does not declare, recorded in `skipped` | D4 — renders as nothing |
| 9 | LF vs CRLF (opener, closer, content) | identical results | `split(/\r?\n/)` + `trimEnd` on the closer |
| 10 | unterminated fence | blocks above it stand; nothing below is a block; reported | D5 |
| 11 | trailing attributes after the tag | declares | D1 — first word, as a renderer does |
| 12 | case `BRAIN-GRAPH/1` · `Brain-Graph/1` | does not declare | D1 — exact case; #710/2's class dissolves |
| 13 | one · two · one declared + one illustrated | one reads; two → REQ-639-3 error naming the count; declared+illustrated → the illustration is not a declaration, so it reads as one | D1 + D6 |
| 14 | position first · last · only | position is not a selector | #639's ruling, unchanged |

Plus five non-axis obligations: D7's legacy refusal; D14's indent-0 byte-identity;
`skipped` populated with the right reason for each of its three values; the
`unterminatedComment` field never leaking into `unterminated`; and a mutation on the
D5 unconditional-report path (#710 finding 4 was an unpinned attribution axis —
139 pass / 0 fail under a faithful mutation).

## Commit and PR boundaries

Two commits, ordered by D0. Two PR slices, because `delivery_strategy` is
`ask-on-risk` and the forecast is **High**: #703 spent 411 additions on strictly less
than this, and the 14-axis matrix is the bulk of it.

| slice | contents | verification | rollback |
|---|---|---|---|
| 1 | Selector + docs + `epic-map.test.mjs` + the ADR-0032 draft | `npm test`; `brain:epic:map --dry-run` shows no new edge; #709/#710's own bodies report D7's retag rather than an edge | revert commit 1 — zero declarations exist to invalidate |
| 2 | Splitter + the 14-axis matrix | `npm test` with the six consumer suites **unedited**; the ` ```yaml `-in-`~~~console` case yields no edge | revert commit 2 — the unedited suites pass on both sides, which is what makes it safe |

Slice 2 must not land before slice 1 (D0). If the maintainer prefers one PR, it needs
`size:exception` recorded before apply.

## Migration

No data migration. Zero declarations exist to convert (measured in-repo; `0 of 312`
inherited and dated). A body written the old way stops declaring **and says so**
(D7). Docs that taught the old shape are corrected in commit 1, so the corpus is
never in a state where the documentation and the reader disagree.

One instruction for this change's own artefacts, which is the half-life arriving
immediately: illustrations of ` ```brain-graph/1 ` in issue and PR **bodies** must be
shown inside a longer outer fence (` ```` `) — after slice 2 — or as a 4-space
indented code block, which the current splitter already ignores. Eating our own dog
food is the cheapest test of D2 there is.

## Open questions

- [ ] **The rendering claim (D13)** — settle it in verify, on both providers. It does
      not block apply; it blocks the ADR's honesty if left unstated, and it is stated.
- [ ] **`brain-drafts/` location (D12)** — I deviated from the launch prompt with
      evidence. Maintainer's call; one `git mv` either way.
- [ ] **Design length.** This exceeds the 800-word design budget by roughly double.
      The splitter contract *is* the deliverable, and three predecessors shipped by
      leaving one of its axes unstated. Compressing D2–D6 would recreate exactly that
      failure. Flagged rather than done quietly.
