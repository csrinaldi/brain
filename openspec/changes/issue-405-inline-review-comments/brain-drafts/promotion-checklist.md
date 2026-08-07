# Promotion checklist — ADR-0020 Amendment 1 (issue #405)

`brain/**` is Tier 2: the agent drafts, the human writes. Amending an ADR is a **three-step
cascade** — step 1 alone leaves `decision-gate` red, because it requires the ADR and
`brain/HOME.md` to change together in the same commit.

## Step 1 — the ADR

Append the body of `adr-0020-amendment-1.md` (everything below its `---` rule) to
`brain/project/decisions/adr-0020-reviewer-port-verbs-and-two-key-split.md`, immediately
**before** its `## References` section — matching where ADR-0026 places its Amendment 1.

Fill the signature line with the real date and name:

```
**Signed**: DD/MM/2026 — Cristian Rinaldi
```

## Step 2 — `brain/HOME.md`, same commit

`brain/HOME.md:69` currently reads:

```
- [ADR-0020](project/decisions/adr-0020-reviewer-port-verbs-and-two-key-split.md) — External-reviewer VCS port verbs + the reviewActors/approvalActors two-key split
```

Replace with (the parenthetical follows ADR-0026's line 74 convention verbatim):

```
- [ADR-0020](project/decisions/adr-0020-reviewer-port-verbs-and-two-key-split.md) — External-reviewer VCS port verbs + the reviewActors/approvalActors two-key split (**Amendment 1, DD/MM/2026** — `prReviewComment` carries optional inline `comments[]` in the same call; verb count and lock 2 unchanged, #405)
```

**This step is not optional and not cosmetic.** `decision-gate` enforces unconditional
co-occurrence: an ADR touched without `brain/HOME.md` in the same commit fails the gate.

## Step 3 — regenerate `AGENTS.md`

`brain/HOME.md` is one of the five SOURCE_DOCS the generator reads, so `AGENTS.md` must be
regenerated in the same commit or the drift-guard (byte-equality regenerate-and-diff) turns
red.

## Verify before pushing

```
npm run repo:check
npm run brain:nav
npm test
```

## Note on what this unblocks

The amendment ratifies design decisions D1–D5 only. Implementation of #405 additionally
waits on **PR #478** (issue #452), which owns `verdict.mjs` and `parse-verdict.mjs` — the
pair a `file`/`line` schema change touches, and which three cold-review rounds have already
rewritten.
