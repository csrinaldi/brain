# ADR-0011 Amendment 2 — draft (issue #973)

> **Tier 3 draft. Not yet promoted.** ADR-0011 is signed and stands at Amendment 1.
>
> ```
> npm run brain:promote -- openspec/changes/issue-973-adr-r6-erratum/brain-drafts/adr-0011-amendment-2.draft.md
> ```
>
> **Erratum for Amendment 1 (#961, promoted by PR #972).** Amendment 1's signed section says the
> body above it was "not rewritten (ruling R6 on #961)". That was drafted under R6 as first
> ratified. The maintainer amended R6 to option A on 2026-09-14 (issue #961 comment, confirmed on
> PR #966) before Amendment 1 promoted, and the same act annotated the superseded line in the body
> in place — but the sentence describing that act was never updated. This corrects only that
> sentence. See `openspec/changes/issue-973-adr-r6-erratum/proposal.md`.

```brain-amendment/1
target: brain/project/decisions/adr-0011-feature-scoped-working-memory.md
amendment: 2
issue: 973
home-summary: erratum — Amendment 1's sentence claiming the body was not rewritten is corrected; the same act annotated it in place under R6 as amended (option A), #973
body: ## Amendment 2 — erratum: Amendment 1's body was annotated in place, not left untouched (issue #973)
body-end: ### Notes for the promoter
```

## Amendment 2 — erratum: Amendment 1's body was annotated in place, not left untouched (issue #973)

**Signed**: DD/MM/YYYY — <Name>

### What this changes

Amendment 1's signed section (above) says: "The body above is not rewritten (ruling R6 on #961): no
line of this ADR runs a script with a literal `npm run`, so the decision reads the same and this
table is the whole mapping." That sentence was drafted under ruling R6 as first ratified — an
appended amendment, body untouched. The maintainer amended R6 to option A on 2026-09-14 (issue #961
comment, confirmed on PR #966), and Amendment 1's own promotion (PR #972) applied that ruling: the
one line of the body superseded by the rename table was annotated in place, per
`consolidation-protocol.md` §1c act 2. The sentence describing that act was never updated to match.
This amendment rewrites it to state what the act did.

### What this does NOT change

The rename table and the one in-place annotation Amendment 1 made were already correct under R6 as
amended — this touches no other line.

### Notes for the promoter

The anchor is the two-line sentence at `adr-0011-feature-scoped-working-memory.md:68-69`, the only
occurrence of `npm run` in this ADR. Verified against this ADR on this branch with `assessEdit`:
it occurs exactly once (`free = 1`).

```amend-find
The body above is not rewritten (ruling R6 on #961): no line of this ADR runs a script with a literal
`npm run`, so the decision reads the same and this table is the whole mapping.
```

```amend-replace
Every superseded line above is annotated in place under R6 as amended (option A, 2026-09-14): the
historical name stays visible next to its `brain:memory:` rename, and this table is the whole
mapping. **[Amended by Amendment 2 (#973) — this sentence was drafted under R6's original
wording, before the 2026-09-14 amendment.]** No line of this ADR runs a script with a literal
`npm run`, so the decision reads the same.
```
