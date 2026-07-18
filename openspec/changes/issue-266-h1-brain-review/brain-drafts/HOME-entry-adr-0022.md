> **DRAFT — agent-authored, awaiting human promotion.** The exact `brain/HOME.md`
> index entry to insert when promoting ADR-0022 to `brain/project/decisions/`.
> The human inserts it as part of the promotion keystroke (Tier 2 / ADR-0013),
> in the SAME MR as the ADR (`decision-gate` step 1; the #197→#199 lesson).

## Where it goes

Under `## Project-specific (brain/project/)` → `### Architecture decisions`, immediately AFTER the
`ADR-0021` bullet, matching the existing list format.

## The entry (paste exactly)

```markdown
- [ADR-0022](project/decisions/adr-0022-reviewer-port-base.md) — Widen the VCS port for the cold reviewer: baseRefOid on prView (closes H1-2C-BASE)
```

## Co-promotion note — DO NOT split from the ADR

This entry MUST land in the same MR as `brain/project/decisions/adr-0022-reviewer-port-base.md`
(the promoted, signed ADR). `decision-gate` step 1 enforces that an ADR and its `HOME.md` index move
together — a decisions-store change without its index entry (or vice versa) is a broken promotion.
