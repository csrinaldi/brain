---
status: draft
issue: 671
---

# Proposal — the AI-attribution rule gets its reason and its mechanism (issue 671)

## What

Three things the rule was missing, and one repair it exposed:

1. **An ADR** carrying the reason — drafted to `brain-drafts/` for the
   maintainer to move and sign (`brain/project/**` is Tier 3 for the agent).
2. **A mechanism** in `hooks/commit-msg` and `hooks/pre-receive`.
3. **A parity guard** over the three places the rule is now implemented.
4. **`tranche.mjs`'s finding repaired** — it cited a file that does not exist.

## Why

`agent-authorities.md` Tier 3 forbids AI attribution in commits — the only
bullet in that list without a stated reason, in a list headed *"even if
explicitly asked"*. An unexplained absolute gets re-litigated, and on 2026-08-15
it was, when an agent harness mandating the opposite met this doctrine.

And it was decaying, measured on `main`:

```
commits:                 264
Co-Authored-By: Claude:   28   (10.6%)
Claude-Session:           28
```

Nobody noticed until someone looked — #575's thesis in this repo's own git log.

## What the measurement exposed

`review/evaluators/tranche.mjs` was the only check referencing the rule, and it
carried **three** defects in six lines:

- it cited **`CLAUDE.md`**, a file this repository does not contain;
- the rule it cited is about **commits**, and it tested **`prBody`**;
- its pattern missed `Claude-Session:` entirely.

A finding that reads as verified and points at no text at all is worse than the
rotted line numbers #580 and #586 repaired.

## Scope

The rule binds **forward**. The 28 commits already on `main` are not rewritten —
that is the Tier-3 prohibition three bullets above this one, and the cost is
already paid.
