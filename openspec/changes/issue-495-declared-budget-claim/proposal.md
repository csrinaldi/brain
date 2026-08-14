---
status: draft
issue: 495
---

# Propuesta — declared-budget-claim (issue 495)

## Qué

`checkpoint-report.md` gains a **declared** budget claim — one fenced
`brain-checkpoint/1` block — and `checkpoint.mjs` reads **only** that block.
Prose stops being scanned for budget claims: not narrowed, **not read**.

## Por qué

`parseBudgetClaim` scans the whole report for any `N/M` whose `M` is a budget
some tier declares. That filter rejects the shapes this repo's reports actually
contain (test counts, slice counts, versions) but cannot reject a *sentence that
mentions another tier's budget*. Issue #495 lists four such sentences, each
producing a `drift:counted-lines-budget` **blocker** carrying `evidence:` the
report never stated — a false block with invented evidence. One of the four is
verbatim from this repo's own `governance-tiers.test.mjs`; another is exactly
the sentence a report *discussing this change* would write.

The maintainer ruled option 1 on 2026-08-12 (issue comment): anchor to a
declared claim line and parse only that. Option 2 (heuristics over prose) is the
anti-pattern this repo has documented, applied to itself; option 3 (downgrade to
detection) makes a wrong blocker cheaper without making it less wrong.

**Measured on the 17 real reports in the tree, before this change:**

| tier | silent (`null`) | parses + matches | `drift:…-budget` blocker |
|---|---|---|---|
| `lite` (brain's own) | 3 | **0** | **14** |
| `standard` | 3 | 14 | 0 |
| `regulated` | 3 | 0 | 14 |

At the tier brain declares for itself, **not one report parses correctly today**:
fourteen produce a blocker and three are silent. The parser is calibrated to a
tier this repo does not operate under.

## Alcance

- **Incluye**
  - `brain-checkpoint/1` — the declared block, render + parse in one module.
  - `checkpoint.mjs` reads it and nothing else; `parseBudgetClaim`,
    `CLAIM_PAIR_RE` and `declaredBudgets()` are deleted, not narrowed.
  - **Fails closed**: absent / malformed / duplicated block → a *stated*
    uncomputable condition, never `null`. `null` is indistinguishable from
    "made no claim", which is this ticket's own defect one level up.
  - `fencedBlocks` extracted to a neutral module (pure move) so this reads
    fenced blocks through the existing implementation rather than a third copy.
  - The four sentences from #495 as fixtures; the declared form asserted at
    **every** tier.
  - The doctrine change as a `brain-amendment/1` **draft** under
    `brain-drafts/` — `brain/core/methodology/reviewer-protocol.md` is Tier 2
    and the maintainer's commit is the signature (ADR-0028).

- **No incluye**
  - Migrating the 17 existing reports. They are archived records; the past is
    recorded, not edited. They become "unparseable, and said so", which is the
    ruling's own first test case.
  - `parseGraphBlock`'s first-fence limitation (`epic-graph.mjs`), which this
    change surfaces but does not touch — filed separately.
  - Any change to what the budget *is* or how it is counted (`diff-size-count`).
