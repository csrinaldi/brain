# ADR-0002 Amendment 4 — draft (issue #973)

> **Tier 3 draft, promoted by the maintainer in PR #974 (round 3, `73b34ebd`).** At drafting time ADR-0002 was signed and stood at Amendments 1-3.
>
> ```
> npm run brain:promote -- openspec/changes/issue-973-adr-r6-erratum/brain-drafts/adr-0002-amendment-4.draft.md
> ```
>
> **Erratum for Amendment 3 (#961, promoted by PR #972).** Amendment 3's signed section says the
> body above it was "not rewritten (ruling R6 on #961)". That was drafted under R6 as first
> ratified. The maintainer amended R6 to option A on 2026-09-14 (issue #961 comment, confirmed on
> PR #966) before Amendment 3 promoted, and the same act annotated every superseded line in the
> body and in Amendment 2 in place — but the sentence describing that act was never updated. This
> corrects only that sentence. See `openspec/changes/issue-973-adr-r6-erratum/proposal.md`.

```brain-amendment/1
target: brain/project/decisions/adr-0002-memoria-git-based-dos-capas.md
amendment: 4
issue: 973
home-summary: erratum — Amendment 3 said the body was not rewritten, but its own promotion had annotated the body and Amendment 2 in place under ruling R6 on #961 as amended (option A); that sentence is rewritten, #973
body: ## Amendment 4 — erratum: the body Amendment 3 called untouched was annotated in place (issue #973)
body-end: ### Notes for the promoter
```

## Amendment 4 — erratum: the body Amendment 3 called untouched was annotated in place (issue #973)

**Signed**: DD/MM/YYYY — <Name>

### What this changes

Amendment 3's signed section (above) said, before this amendment rewrote it: "The body above is not
rewritten (ruling R6 on #961): no line of this ADR runs a script with a literal `npm run`, so the
decision reads the same and this table is the whole mapping." That sentence was drafted under
ruling R6 as first ratified — an appended amendment, body untouched. The maintainer amended R6 to
option A on 2026-09-14 (issue #961 comment, confirmed on PR #966), and Amendment 3's own promotion
(PR #972) applied that ruling: every line of the body and of Amendment 2 superseded by the rename
table was annotated in place. The sentence describing that act was never updated to match. This
amendment rewrites it to state what the act did.

### What this does NOT change

The rename table and the in-place annotations Amendment 3 made were already correct under R6 as
amended — this rewrites no other line of the body or of an earlier amendment.

### Notes for the promoter

The anchor is the two-line sentence at `adr-0002-memoria-git-based-dos-capas.md:121-122`, the only
occurrence of `npm run` in this ADR. Verified against this ADR on `origin/main` with `assessEdit`:
it occurs exactly once (`free = 1`).

```amend-find
The body above is not rewritten (ruling R6 on #961): no line of this ADR runs a script with a literal
`npm run`, so the decision reads the same and this table is the whole mapping.
```

```amend-replace
Every superseded line in the body above and in Amendment 2 is annotated in place under ruling R6 on
#961 as amended (option A, 2026-09-14): the historical name stays visible next to its
`brain:memory:` rename, and this table is the whole mapping. **[Amended by Amendment 4 (#973) —
rewritten: the previous sentence said the body was not rewritten, although Amendment 3's own
promotion had annotated it in place.]** No line of this ADR runs a script with a literal `npm run`,
so the decision reads the same.
```
