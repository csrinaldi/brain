# Promotion checklist — ADR-0020 (issue #405)

> ## ⛔ STOP — Amendment 1 is ALREADY PROMOTED, and is SUPERSEDED
>
> Amendment 1 was signed 06/08/2026 and merged in `697bbf3`, an ancestor of `main`.
> `brain/HOME.md` and `AGENTS.md` moved with it. **Following the steps below as written
> would re-promote it**, and re-promote text the GitLab implementation has since falsified
> (it claims inline comments post "in the same provider call" with "no second postable
> artifact"; GitLab makes 4 calls and 3 artifacts).
>
> The live cascade is **Amendment 2** — `adr-0020-amendment-2.md` in this folder, tracked
> as issue **#491**. It carries its own three-step cascade section with the exact
> replacement text; use that, not this file.
>
> This file is kept for the SHAPE of the cascade, which is unchanged and is the part worth
> reusing. Everything below describes Amendment 1's promotion, which is history.
> (Found by the cold review of PR #490, round 2 — C-3. The file was not in the diff, which
> is precisely why nothing caught that it had gone stale: an artefact left untouched still
> makes claims about the tree.)

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

`brain/HOME.md:69` read, **before Amendment 1 was promoted**:

```
- [ADR-0020](project/decisions/adr-0020-reviewer-port-verbs-and-two-key-split.md) — External-reviewer VCS port verbs + the reviewActors/approvalActors two-key split
```

It no longer does — Amendment 1's parenthetical is on it now, and Amendment 2 replaces
that parenthetical. See `adr-0020-amendment-2.md` for the current line and its replacement.

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
