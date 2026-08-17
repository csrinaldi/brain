---
status: draft
issue: 495
---

# Diseño — declared-budget-claim (issue 495)

## Decisiones técnicas

### D1 — the block is tagged by info-string, not by a `protocol:` scalar

This repo already has **two** fenced-block families and they differ for a reason:

| family | shape | why | examples |
|---|---|---|---|
| **posted to the VCS, and never a spoofing target** | ` ```yaml ` + `protocol: <name>` | a comment is rendered by GitHub/GitLab; `yaml` gets highlighting, an unknown info-string renders as plain text — and these protocols are written by brain's own emitter into its own comments, so no human authors a body that merely ILLUSTRATES one | `brain-review/1|2`, `brain-decision/1` |
| **the tag IS the selector** | ` ```<name> ` | either nothing renders it for a human (a file read by a verb), or it is rendered but human-authored, where an interior scalar is spoofable and the tag is not | `brain-amendment/1`, `amend-find`, `amend-replace`, `brain-graph/1` |

> **Corrected by issue #709 / ADR-0032.** `brain-graph/1` sat in the first row, and
> the row's criterion — "is it rendered for a human?" — was the wrong discriminator
> for it. `brain-graph/1` is the one protocol here written by a HUMAN into an issue
> body, which means an author teaching its shape reproduces `protocol: brain-graph/1`
> verbatim, and the reader cannot distinguish that illustration from a declaration.
> Unspoofability outranks the rendered-artifact rule; the rendering cost is cosmetic.
> The families still differ for a reason — the reason is not the one this table
> originally stated.

`checkpoint-report.md` is the second kind. It takes the second shape.

That choice also settles the locator problem, which is the real one here: a
checkpoint report is *definitionally* full of fenced blocks, because §10's
evidence is command output. `yaml-block.mjs`'s `extractFencedBlock` reads the
**first** fence only — correct for a comment that is one block, wrong for a
document. Selecting by info-string tag needs no position rule and cannot be
shadowed by evidence.

### D2 — `fencedBlocks` moves to a neutral module (pure move)

`lib/amendment-draft.mjs` already owns a line-based sequential fence splitter
that returns every block with its tag, content and opening line, and reports an
unterminated fence instead of silently dropping it. That is exactly the reader
this needs. Importing the *amendment* module into a *review* evaluator would be
the wrong dependency, and copying it would be `#340 one-rule-two-implementations`.

So: `fencedBlocks` (and its unterminated-fence result) move to
`brain/scripts/lib/fenced-blocks.mjs`, and `amendment-draft.mjs` imports it.
Proof of purity, the same one `yaml-block.mjs`'s own extraction used (#473):
**`amendment-draft.test.mjs` is edited by zero lines across this move.**

`yaml-block.mjs` is left alone. It is the inverse of the *emitter* family and
its `FENCE_RE` hardening (#487) is about values containing fences — a different
problem, still correctly solved there.

### D3 — three answers, modelled on `parseAmendmentDraft`

The ruling's point 2 — *unparseable must say so, never `null`* — already has a
precedent in this tree. `parseAmendmentDraft` answers `{ok:false, absent:true}`
for "no contract block", `{ok:false, error}` naming the count for "more than
one", and `{ok:false, error}` for a malformed field. `parseCheckpointClaim`
mirrors it key for key, so there is one shape for "declared contract in a
Markdown file" rather than two.

`absent` is kept distinct from plain `!ok` because the two produce different
sentences for the author: *"this report predates the declared form"* versus
*"your block is wrong"*.

### D4 — an unparseable claim is a CONDITION, not a finding

`evaluateCheckpoint` already has the right mechanism and it is doctrine, not an
invention: the TDD-RED reversion, when it cannot be computed, pushes
`evidence uncomputable: …` into `conditions` and forces REVISE.
reviewer-protocol.md §10 states the general rule — *"never APPROVE on
uncomputable evidence — emit REVISE with `conditions: [evidence uncomputable]`"*.

An unparseable budget claim is the same category, so it takes the same
mechanism rather than a new severity. What changes in `evaluateCheckpoint` is
that `uncomputable` stops being a property of the reversion alone and becomes a
list the evaluator collects — one generalization, no second rule.

This is also what makes the migration honest: all 17 archived reports become
REVISE-with-a-stated-reason instead of, as today at `lite`, 14 fabricated
blockers and 3 silences.

### D5 — `parseBudgetClaim` is deleted, not narrowed

Ruling point 1 is *"prose is no longer read for budget claims at all — not
narrowed, **not read**"*. `parseBudgetClaim`, `CLAIM_PAIR_RE` and
`declaredBudgets()` go with it. Keeping a narrowed prose scanner as a fallback
would leave two sources of truth for one claim, which is the shape the reviewer's
own doctrine tells us to collapse.

Consequence, stated rather than discovered later: **~14 tests in
`checkpoint.test.mjs` disappear or are rewritten.** They are the specification of
a parser that no longer exists. The properties worth keeping — every tier,
selection is not positional, a denominator no tier declares is not a claim —
survive as properties of the *declared* reader, where they are cheaper to state.

## Contract / API impact

Yes, twice.

1. **`checkpoint-report.md` gains a required block.** This is a doctrine change
   to a Tier-2 artefact (`brain/core/methodology/reviewer-protocol.md`), so it
   ships as a `brain-amendment/1` **draft** under `brain-drafts/` and the
   maintainer's `brain:promote` commit is the signature (ADR-0028). Nothing
   under `brain/core/**` is edited by hand in this change.
2. **`parseBudgetClaim` is removed from `checkpoint.mjs`'s exports.** Its only
   consumers are inside this change (the evaluator and its own test file) —
   measured, not assumed.

## Alternativas descartadas

- **Heuristics over prose** (#495 option 2 — exclude inline code, blockquotes,
  past tense). Rejected by the ruling and by this repo's own anti-pattern: each
  of the four sentences would get a rule, and the fifth shape arrives with the
  next report. The parser has no notion of *where* a claim lives, and heuristics
  do not give it one.
- **Downgrade `drift:*-budget` to detection** (#495 option 3). Makes a wrong
  blocker cheaper without making it less wrong, and gives back the policy #472
  chose deliberately.
- **A `protocol:` scalar inside a ` ```yaml ` fence** (family 1). Would require
  reading every fence in the document and parsing each one's first key to find
  the claim — strictly more work than a tag, for a file no comment renderer ever
  sees.
- **Requiring the declared block to be the report's first fence.** Cheapest
  locator, and an authoring rule with no reason behind it that would break the
  moment someone opens a report with a summary snippet.
- **Migrating the 17 archived reports to the declared form.** They are records of
  what was reported at the time. Editing them to satisfy a reader written after
  the fact is the thing `LEGACY_GRANDFATHERED`'s comment calls out: the past is
  recorded, not edited.
