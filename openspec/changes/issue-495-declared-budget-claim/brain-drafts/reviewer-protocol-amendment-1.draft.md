# Draft — reviewer-protocol.md Amendment 1: the budget claim is declared

**Not signed doctrine.** This is a `brain-amendment/1` draft. Promote it with

```
npm run brain:promote -- openspec/changes/issue-495-declared-budget-claim/brain-drafts/reviewer-protocol-amendment-1.draft.md
```

which performs consolidation-protocol §1c's acts, stages them, and stops. **Your
commit is the signature** (ADR-0028). Nothing under `brain/**` is edited by hand.

```brain-amendment/1
target: brain/core/methodology/reviewer-protocol.md
issue: 495
body: ## Amendment 1 — the report's budget claim is DECLARED, not inferred (issue #495)
body-end: ### Notes for the promoter
```

```amend-find
| **False APPROVE** (trusting the implementer's report) | every finding carries `evidence:` = a command the reviewer ran cold; budget/tests/diffstat re-derived, never read from the report; report-vs-tree drift is itself a blocker |
```

```amend-replace
| **False APPROVE** (trusting the implementer's report) | every finding carries `evidence:` = a command the reviewer ran cold; budget/tests/diffstat re-derived, never read from the report; report-vs-tree drift is itself a blocker. The report's own budget claim is **declared** in a `brain-checkpoint/1` block and read from there alone — never inferred from prose (Amendment 1) |
```

```amend-find
| **Uncomputable evidence** (`gh` down) | never APPROVE on uncomputable evidence — emit REVISE with `conditions: [evidence uncomputable]`; fail-closed, mirroring `run-check.mjs` |
```

```amend-replace
| **Uncomputable evidence** (`gh` down; a report carrying no `brain-checkpoint/1` block) | never APPROVE on uncomputable evidence — emit REVISE with `conditions: [evidence uncomputable]`; fail-closed, mirroring `run-check.mjs` |
```

## Amendment 1 — the report's budget claim is DECLARED, not inferred (issue #495)

**This does not weaken §10.** The reviewer still re-derives the budget cold and
still blocks on report-vs-tree drift. What changes is where the reviewer reads
the report's *side* of that comparison.

### The defect

The reviewer used to find the report's claim by scanning the whole document for
any `N/M` whose `M` was a budget some tier declares. That filter rejects the
shapes reports ordinarily contain — test counts, slice counts, version pairs —
and cannot reject a sentence that merely mentions another tier's budget. Four
such sentences were measured, each producing a `drift:counted-lines-budget`
**blocker** whose `evidence:` quoted a claim the report never made. One of them
is verbatim from this repo's own tier-table test; another is exactly what a
report *discussing the tier table* would write.

A false blocker carrying invented evidence is a sharper failure than silence.
§5 forbids the reviewer inventing doctrine; §6.1 requires `evidence:` to be
something the reviewer established cold. A number lifted out of a sentence that
was never a claim satisfies neither.

### The rule

**A checkpoint report states its budget claim in exactly one fenced
`brain-checkpoint/1` block, and the reviewer reads that block and nothing else.**

````
```brain-checkpoint/1
counted_lines: 213
diff_budget: 400
```
````

- `counted_lines` — what the author counted, by the same rule `diff-size-count`
  applies.
- `diff_budget` — the budget the author judged that count against. Stated, not
  assumed: a report quoting a ceiling this repo does not resolve is report drift
  in its own right, and that is now a comparison of two declared numbers rather
  than an inference about one.

The block is located by its **info-string tag**, never by position. A checkpoint
report is definitionally full of fenced blocks, because §10 evidence is command
output; a positional rule would let any of them shadow the claim.

**Prose is not narrowed. Prose is not read.** No table cell, blockquote,
inline-code fraction or sentence anywhere in the report contributes a claim.

### Absent is an answer, and it is not silence

The reader has three outcomes, never two:

| outcome | meaning |
|---|---|
| a claim | one well-formed block |
| **absent** | no `brain-checkpoint/1` block — the report predates this rule, or its author omitted it |
| **malformed** | a block that is unreadable, duplicated, or missing a key |

The last two are **uncomputable evidence** and take §10's existing lock: the
verdict states the reason under `conditions:` and can never be APPROVE. It must
not resolve to "the report made no claim" — that is the same silence this
amendment removes, one level up, inside its own fix.

### Reports written before this amendment

They read as **absent**, and that is the correct answer about them. They are
records of what was reported at the time and are not edited to satisfy a reader
written afterwards. A checkpoint on such a report says so and asks for the
declared block, which is a true statement rather than a fabricated finding.

### Notes for the promoter

Everything below this heading is excluded from the appended section by
`body-end:` — it exists for whoever runs `brain:promote`, not for the doctrine.

- **Two in-place edits**, both to §10's failure table. §1c's test is that a
  reader who never scrolls to the amendment is not left with the superseded rule:
  the False-APPROVE row is where a reader learns the report is not trusted, and
  the Uncomputable-evidence row is where they learn what happens when it cannot
  be read. Both had to change in place.
- **No `**Status**:` act and no `brain/HOME.md` marker.** Those are the ADR
  shape; this target is a methodology document, and `planAmendment` gates both
  on `isAdr`. Do not add them by hand.
- **No source-line citations anywhere above** — `reviewer-protocol.md` cites
  symbols, and its own guard fails the suite on `file.ext:NNN` (#586).
