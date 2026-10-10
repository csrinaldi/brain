# ADR-0024 Amendment 4 (erratum) — draft (issue #1180)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1180-promote-phase-1-doctrine/brain-drafts/adr-0024-amendment-4.draft.md
> ```
>
> Promote AFTER `adr-0004-amendment-3.draft.md` (this cites it by number). **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0024-three-axis-decoupling.md
amendment: 4
issue: 1180
home-summary: erratum — Amendment 3 said ADR-0004's selector decision was otherwise unchanged; it was not — ADR-0004 Amendment 3 moves the selector to tracked config with no default, and the sentence is annotated in place, #1180
body: ## Amendment 4 — erratum: ADR-0004's selector decision did change (issue #1180)
body-end: ### Notes for the promoter
```

```amend-find
fix, never a default. The `MEMORY_BACKEND` selector decision of ADR-0004 is otherwise unchanged.
```

```amend-replace
fix, never a default. The `MEMORY_BACKEND` selector decision of ADR-0004 is otherwise unchanged. **[Amended by Amendment 4 (#1180) — that sentence was wrong. Moving the selector to tracked config with no default IS a change to ADR-0004's selector decision, recorded in ADR-0004 Amendment 3 (#1165). The sentence is what Amendment 3 said, kept as the record.]**
```

## Amendment 4 — erratum: ADR-0004's selector decision did change (issue #1180)

**Signed**: DD/MM/YYYY — <Name>

### What this changes

Amendment 3 (above) said: "The `MEMORY_BACKEND` selector decision of ADR-0004 is otherwise
unchanged." It was not. ADR-0004 decided `MEMORY_BACKEND` in `.env` with a default of `engram`;
the same change (#1165) moved the team's declaration to `memory.backend` in the tracked
`brain.config.json`, removed the default, and made backend-consulting ops refuse when it is
undeclared. ADR-0004 Amendment 3 records that decision and annotates the superseded lines of ADR-0004
in place.

Amendment 3's own promotion did not touch ADR-0004, so nothing caught the sentence: a reader who
opened ADR-0004 alone still read a rule the code no longer follows. This amendment annotates that
sentence in place, under ruling R6 on #961 as amended (option A), the same shape as the errata of
#973. Everything else Amendment 3 says (the resolver's location and the precedence) is accurate.

### What this does NOT change

The resolver, its precedence, and the deletion of `resolveMemory`. Only the claim about ADR-0004 is
corrected.

### Notes for the promoter

One in-place annotation. Promote AFTER the ADR-0004 Amendment 3 draft so that the amendment this
cites exists.
