# Promotion checklist — the `memory-gate` scope ruling (issue #529)

`brain/**` is Tier 2: the agent drafts, the human signs. This is a **one-file** promotion —
no ADR, no `brain/HOME.md` cascade, so `decision-gate` is not involved.

## Before you sign

Two things to agree with, because they are the ruling and not just wording:

1. **The gate stays as it is for now.** It will not notice the next outage. That is the accepted
   cost, and it is accepted because the alternative today blocks every PR with no override.
2. **The order is #530 → `skip:memory-gate` implemented → recency.** Signing this is also
   signing that order.

If you disagree with either, the draft is wrong and should come back rather than be promoted
with an edit — the ordering is the substance.

## Step 1 — the table row

In `brain/core/methodology/workflow-governance.md`, replace the invariant-3 row with the
replacement in `workflow-governance-invariant-3.md` §1.

## Step 2 — the scope subsection

Insert §2's subsection immediately after the invariant table, before the line beginning
*"Check context format:"*.

## Step 3 — the redundant caveat

Trim the metrics caveat per §3. Optional in the sense that leaving it costs nothing but a
duplicated rule; not optional if you want one statement per rule.

## Step 4 — commit

```bash
git add brain/core/methodology/workflow-governance.md
git commit -m "docs(governance): invariant 3 is repo-scoped — the ruling #519 asked for (closes #529)"
```

## Verify

```bash
npm run brain:repo:check   # no prohibited references, artifact structure valid
npm run brain:nav          # no orphans, no broken links
```

Neither reads prose, so both passing means only that nothing structural broke. The ruling itself
is not machine-checkable, which is the honest reason it needed a human signature rather than a
gate.

## After

- Close #529 **with the ruling quoted in the closing comment**, not just a link to this file.
  #519 and #368 both closed carrying an unmade decision inside them; the quote is what stops
  this from being the third.
- #530 is the next ticket in the sequence and is already open.
