---
status: draft
issue: 495
---

# Spec — declared-budget-claim (issue 495)

## Requisitos delta

**REQ-495-1 — the declared form.** A checkpoint report states its budget claim
in exactly one fenced block whose info-string is `brain-checkpoint/1`:

````
```brain-checkpoint/1
counted_lines: 213
diff_budget: 400
```
````

Both keys are required and both are non-negative integers. The block is located
by its **info-string tag**, not by position, so an evidence fence appearing
earlier in the report cannot shadow it.

**REQ-495-2 — parsed exclusively.** `gatherCheckpointInputs` derives the report's
budget claim from that block and from nothing else. No prose, table cell,
blockquote or inline-code fraction anywhere in the report contributes a claim.

**REQ-495-3 — three answers, never two.** The reader returns one of:
`{ ok: true, countedLines, diffBudget }`; `{ ok: false, absent: true, error }`
when no such block exists; `{ ok: false, error }` when a block exists but is
unreadable or appears more than once. It never returns `null` and it never
throws.

**REQ-495-4 — the migration fails closed.** A report the reader cannot parse
produces a **stated** condition on the verdict —
`evidence uncomputable: report budget claim (<reason>)` — and therefore REVISE,
under the same rule the TDD-RED reversion already follows (reviewer-protocol.md
§10, *"never APPROVE on uncomputable evidence"*). Silence is not an option: an
unparseable report must be distinguishable from a report that made no claim.

**REQ-495-5 — drift still blocks.** When the block parses, the existing two
findings are unchanged in meaning: `drift:counted-lines` when the claim
understates the cold recomputation, and `drift:counted-lines-budget` when the
declared `diff_budget` is not the budget this repo resolves.

**REQ-495-6 — every tier.** A report using the declared form parses at `lite`,
`standard` and `regulated`, asserted per tier rather than at one of them.

**REQ-495-7 — one fence reader.** The block is located through the fence splitter
that already exists (`fencedBlocks`, today in `lib/amendment-draft.mjs`),
relocated to a neutral module as a pure move. No third fenced-block parser is
written.

## Escenarios

### Scenario: the four #495 sentences yield no claim
- **GIVEN** a report containing any of
  - `Reviewed 3/200 findings from the prior round.`
  - `diffBudget matches design §2.C (1000/400/200).`
  - `The old tranche budget was 372/400 before ADR-0026.`
  - `Coverage improved from 180/400 statements to full.`
- **AND** the report carries no `brain-checkpoint/1` block
- **WHEN** the reader runs at any tier
- **THEN** it answers `{ ok: false, absent: true }`
- **AND** the verdict carries `evidence uncomputable: report budget claim (…)`
- **AND** no `drift:*` finding is emitted — the reviewer never states a claim the
  report did not make.

### Scenario: a declared claim parses at every tier
- **GIVEN** a report whose block declares `counted_lines: 213`, `diff_budget: 400`
- **WHEN** the reader runs at `lite`, at `standard` and at `regulated`
- **THEN** all three read `{ ok: true, countedLines: 213, diffBudget: 400 }` —
  the block's content does not depend on the reader's tier.

### Scenario: the declared budget is not this repo's
- **GIVEN** the block above
- **AND** the repo resolves `diffBudget` 1000 (`lite`)
- **THEN** `drift:counted-lines-budget` is a blocker, and its `evidence:` quotes
  400 as **the report's own declared value**, which it now is.

### Scenario: the claim understates the tree
- **GIVEN** a block declaring `counted_lines: 213`
- **AND** the cold recomputation is 372
- **THEN** `drift:counted-lines` is a blocker.

### Scenario: an evidence fence does not shadow the claim
- **GIVEN** a report whose first fenced block is `bash` command output that
  itself contains a line reading `counted_lines: 999`
- **AND** whose `brain-checkpoint/1` block appears later and declares 213
- **THEN** the reader answers 213.

### Scenario: two declared blocks are an error, not a choice
- **GIVEN** a report carrying two `brain-checkpoint/1` blocks
- **THEN** the reader answers `{ ok: false }` naming the count, and the verdict
  states the condition. Picking one would be the guess this change removes.

### Scenario: a malformed block is an error, not an absence
- **GIVEN** a block whose `counted_lines:` is `abc`, or which omits `diff_budget:`
- **THEN** the reader answers `{ ok: false }` **without** `absent: true` — "you
  wrote one and it is wrong" and "you wrote none" are different things to tell
  an author.

### Scenario: the 17 archived reports
- **GIVEN** every `checkpoint-report.md` in the tree at this commit
- **WHEN** the reader runs over each
- **THEN** all 17 answer `{ ok: false, absent: true }` — measured, not assumed,
  and each produces the stated condition rather than a fabricated blocker.
