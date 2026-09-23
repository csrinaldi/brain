# Retraction — issue #701's body vs. its comment

**Status: the ticket's comment supersedes its body.** This file records the retraction so a PR
description or a closing comment on #701 can cite it directly, rather than re-deriving the
reasoning from `proposal.md`'s header note.

## What the issue body asked for

A `.gitattributes` `merge=union` rule for `.memory/index.jsonl`, to stop the file from
conflicting on every merge.

## Why that premise is retracted, not just unimplemented

That exclusion is **deliberate and already documented twice**:

- `memory-format.md:238-246` (§`index.jsonl` — derived, regenerable, low-churn)
- ADR-0017:174-182

It was **already attempted once**, as `merge=union` in PR #360, and **rewritten back out**. The
remedy the issue body wants had **already shipped** by the time #701 was filed: `memory:resolve-index`
(#330) discards both sides of an `index.jsonl` conflict and regenerates it from `records/`,
which is strictly stronger than a union merge (a union of two derived-index halves is not
guaranteed to be a valid index; a regeneration always is).

## What #701 actually fixes instead

The comment on #701 — not the body — describes the real, measured defect: `memory:share`
re-materializes records into worktrees that did not author them (95.7% of measured writes were
this). This change (proposal.md, spec.md, design.md in this directory) fixes exactly that, via
one predicate reused at two call sites (the export dedup, and a `pre-commit` gate). It does not
touch `index.jsonl`'s merge policy, which stays exactly as ADR-0017 and PR #360 already settled
it.

## Net effect on the issue body's three symptoms

| Symptom (as the body described it) | After this change |
|---|---|
| `index.jsonl` conflicts on every merge | **Reduced, not closed** — fewer insertions per merge (22 of 23 measured re-exports stop happening), but two branches each authoring a genuinely new record still each append one line. No code in this change touches this; the existing remedy (`memory:resolve-index`) is unchanged and sufficient. |
| Untracked records block `git merge` (exit 2) | **Closed** for the measured class — the 22/23 re-exports that caused this stop being written. |
| `source` prefix widening on export→import→export | **Occasion reduced, defect not fixed** — filed separately (issue #461, ADR-0017 Amendment 1). Out of scope here. |
