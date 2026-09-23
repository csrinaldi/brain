---
status: draft
issue: 495
---

# Tareas — declared-budget-claim (issue 495)

## 1 — the fence reader has one implementation

- [x] 1.1 Move `fencedBlocks` from `lib/amendment-draft.mjs` to
      `lib/fenced-blocks.mjs`; `amendment-draft.mjs` imports it.
- [x] 1.2 **Purity proof**: `amendment-draft.test.mjs` edited by zero lines,
      suite green. If it needs an edit, the move was not pure — stop and say so.

## 2 — `brain-checkpoint/1`

- [x] 2.1 RED: `checkpoint-block.test.mjs` — absent / malformed / duplicated /
      well-formed, and the evidence-fence-does-not-shadow case (REQ-495-1, -3).
- [x] 2.2 GREEN: `lib/checkpoint-block.mjs` — `renderCheckpointClaim` +
      `parseCheckpointClaim`, emitter and inverse in ONE module (the
      `decision-block.mjs` precedent, not the `verdict`/`parse-verdict` split
      that has already cost two drift bugs).
- [x] 2.3 The four #495 sentences as a fixture array; each yields
      `{ ok: false, absent: true }` (REQ-495-3). The
      `governance-tiers.test.mjs`-verbatim one carries a comment saying why it
      is the important one.

## 3 — the evaluator reads only the block

- [x] 3.1 RED: `gatherCheckpointInputs` over a report with a declared block →
      `reportClaims` carries the block's values; over a report without one →
      an uncomputable reason (REQ-495-2, -4).
- [x] 3.2 GREEN: rewire `gatherCheckpointInputs`; **delete** `parseBudgetClaim`,
      `CLAIM_PAIR_RE`, `declaredBudgets()` (REQ-495-5 / D5).
- [x] 3.3 Generalize `evaluateCheckpoint`'s `uncomputable` from "the reversion"
      to a collected list; both reasons reach `conditions` and both force
      REVISE. Pin BOTH in one test — a list with one member proves nothing.
- [x] 3.4 Per-tier assertion (`lite`/`standard`/`regulated`) that a declared
      report parses identically at each (REQ-495-6).
- [x] 3.5 Rewrite/retire the ~14 `parseBudgetClaim` tests. Each retirement is
      justified in one line: the property it held, and where that property now
      lives (or that it died with the parser).

## 4 — measured, not assumed

- [x] 4.1 Run the reader over every `checkpoint-report.md` in the tree, as a
      committed test (`test/checkpoint-claim-declared.e2e.test.mjs`) rather than
      a one-off script — this is the ruling's own first test case.
      **Written differently from the plan, on purpose.** The plan said "assert
      17/17 absent"; a hardcoded count would have to be edited the moment a
      change dir opens, and a test edited without being read is not a guard. What
      it asserts instead: every report gets a DECIDED answer (never `null`, never
      a throw, never a refusal without a reason), and every ARCHIVED report reads
      `absent`. Measured at this commit: 17 reports, 17 absent, plus this
      change's own — the first that parses.
- [x] 4.2 Write this change's OWN `checkpoint-report.md` in the declared form.
      Dogfood: the first report that parses.

## 5 — doctrine (Tier 2, human signature)

- [x] 5.1 `brain-drafts/reviewer-protocol-amendment-1.draft.md` — a
      `brain-amendment/1` draft adding the `brain-checkpoint/1` section to
      `brain/core/methodology/reviewer-protocol.md` and amending §10's
      report-vs-tree AND uncomputable-evidence rows. No `amendment:` key: that
      one is ADR-only, and the verb refuses it on a target with no Status line —
      found by running the verb, not by reading about it.
- [x] 5.2 Verify the draft with `parseAmendmentDraft` + `planAmendment` against
      the real target BEFORE claiming it is promotable — read `extractBody`
      directly rather than believing the plan's display labels (the trap PR
      #630 recorded).
- [x] 5.3 **Do not** run `brain:promote`, do not touch `brain/core/**` or
      `brain/HOME.md`. The maintainer's commit is the signature.
- [x] 5.4 No source-line citations in the draft — `reviewer-protocol.citations.test.mjs`
      will fail the suite on one (#586).

## 6 — red-proof

- [x] 6.1 Mutate: make `parseCheckpointClaim` return `null` on absent instead of
      `{ok:false}` → must redden (REQ-495-4 is the ruling's own point 2).
- [x] 6.2 Mutate: locate the block by position (first fence) instead of by tag →
      must redden the shadowing case.
- [x] 6.3 Mutate: drop the uncomputable reason from `conditions` → must redden.
- [x] Every mutation diffed, **read back from disk**, restored under a trap.

## Micro-decisiones en caliente

- **The declared block is tagged, not `protocol:`-scalared.** Two fenced-block
  families already exist here and they split on "is this rendered for a human in
  a comment, or read by a verb from a file". A checkpoint report is the second.
  See design D1.
- **Unparseable is a `conditions` entry, not a new severity.** §10 already says
  "never APPROVE on uncomputable evidence"; the reversion already does exactly
  this. Reused, not reinvented.
- **`parseGraphBlock` (`epic-graph.mjs`) has the same first-fence limitation**
  this change works around — an issue body whose first fence is a code snippet
  hides its `brain-graph/1` block even though `body.includes(...)` is true. Not
  touched here; filed as its own ticket.
