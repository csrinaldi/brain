# Issue #973 — R6-erratum drafts for the five #961 ADR amendments

## Intent

PR #972 promoted five ADR amendments for #961 (ADR-0002 Amendment 3, ADR-0011 Amendment 1,
ADR-0014 Amendment 1, ADR-0017 Amendment 3, ADR-0034 Amendment 1). Each signed section carries a
sentence of this shape:

> The body above is not rewritten (ruling R6 on #961): no line of this ADR runs a script with a
> literal `npm run`, so the decision reads the same and this table is the whole mapping.

(ADR-0017: "The body and Amendments 1-2 above are not rewritten".)

That sentence is false as written. It was drafted under ruling R6 as first ratified (an appended
amendment, body untouched). The maintainer amended R6 to option A on 2026-09-14 ([issue #961
comment](https://github.com/csrinaldi/brain/issues/961#issuecomment-5667409631), confirmed on
PR #966) before any of the five amendments promoted, so the same promotion that produced them
(PR #972) annotated every superseded line of each ADR's body in place — the opposite of what the
sentence says. Nobody updated the sentence to match. Neither the fresh review of #966 nor the
apply of #972 caught it; the cold review of #972 did, after merge (`judgment:cold-1`).

This change adds one erratum amendment per ADR. Each rewrites only that sentence to state what the
act did: superseded lines above are annotated in place under R6 as amended (option A), the
historical names stay visible, and the table is the full mapping. Nothing else changes — the
rename tables and the in-place annotations from the #961 amendments were already correct.

## Acceptance criteria (from issue #973)

- No ADR under `brain/project/decisions/` says its body was not rewritten when the same act
  annotated it.
- `AGENTS.md` and `brain/HOME.md` regenerate byte-equal (drift test green).
- Full suite green.

These are satisfied once a human promotes the five drafts in this folder through
`npm run brain:promote` (see `apply-progress.md` for the exact commands and order) — this change
only prepares and proves the drafts. It never runs the promote verb itself.

## Scope

Five `brain-amendment/1` drafts under `brain-drafts/`, one per ADR:

| Draft | Target ADR | New amendment |
|---|---|---|
| `adr-0002-amendment-4.draft.md` | `adr-0002-memoria-git-based-dos-capas.md` | 4 |
| `adr-0011-amendment-2.draft.md` | `adr-0011-feature-scoped-working-memory.md` | 2 |
| `adr-0014-amendment-2.draft.md` | `adr-0014-workflow-governance.md` | 2 |
| `adr-0017-amendment-4.draft.md` | `adr-0017-memory-format-owned-by-brain.md` | 4 |
| `adr-0034-amendment-2.draft.md` | `adr-0034-memory-travels-on-its-own-lane.md` | 2 |

Each draft carries exactly one `amend-find`/`amend-replace` pair, rewriting the false sentence
identified above. No other line of any target ADR changes.

## Non-goals

- Does not touch `brain/core/**`, `brain/project/**`, `brain/HOME.md`, or `AGENTS.md` directly —
  those are Tier 2/3 and are only written by a human running `brain:promote`.
- Does not re-litigate ruling R6 or option A — the maintainer's 2026-09-14 ruling
  (issue #961 comment, confirmed on PR #966) is taken as settled.
- Does not change the rename tables, the in-place `amend-find`/`amend-replace` pairs the #961
  amendments already applied, or any other content in the five ADRs.
