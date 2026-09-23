---
status: draft
issue: 499
---

# Diseño — tier boundary written three ways (issue 499)

## D1 — the guard is the deliverable; the prose fix is the instance

The words have been wrong since the core/project reorganization and **everything worked**,
because the executable rule was right the whole time. That is why nobody found it: there was
no symptom. Correcting the words closes this instance and nothing else — the next
reorganization re-breaks them and `brain:nav` reports green again, exactly as it has been.

So the change ships the check first. The prose corrections are drafted (Tier 2, human signs)
and are what turns the gate green.

## D2 — the check lives inside `check-brain-nav.mjs`, not beside it

A citation that resolves nowhere is a navigation break of the same kind as a dead link — the
checker's definition of "link" was simply narrower than the ways `brain/` points at itself.
Putting it in a second script would mean two gates with two definitions of the same
invariant, which is the `hasUsableAnchor` lesson from #405 read forward.

**And the script must stay self-contained.** Measured the hard way: moving the extractor to
`lib/cited-paths.mjs` turned 5 existing tests red with `ERR_MODULE_NOT_FOUND`. This script is
COPIED standalone into fixtures and into the adoption scaffolding, so a relative import
breaks it outside its own tree. Portability is a real constraint here, not a style
preference — the extractor is inline.

Consequence for the tests: they cannot import the extractor, so every assertion goes through
a **spawn** against a fixture. That turned out to be the stronger form anyway — it is the only
shape that cannot pass against a gate that reports without failing, which is exactly the hole
the red-proof found (D4).

## D3 — what the guard proves, and what it does not

**Proves:** every cited `brain/…` path exists. A prohibition can never again name a directory
that isn't there.

**Does not prove:** that the prose states the same boundary as `BRAIN_MANAGED_PREFIXES`. That
would need the doctrine to carry a machine-readable marker, and this ticket's evidence does
not justify that weight. Stated here so the guard is not read as more than it is — an
overclaimed protection is the defect class this ticket is about.

The acceptance in #499 asks for "a test that fails when the prose and `BRAIN_MANAGED_PREFIXES`
diverge again". This delivers the strictly weaker but far cheaper property: **the prose cannot
name a path that does not exist**. Every one of the 22 findings, including all four Tier-3
directories, falls inside it.

## D4 — two findings against this change, from its own red-proof

**The guard was unpinned.** Removing the cited-path count from the exit condition left
`npm test` entirely green while the script still printed all 22 findings. A gate that reports
and does not fail is, in CI, indistinguishable from one that found nothing —
`evidence-reader-empty-on-failure` wearing a checkmark. Now covered.

**The glob filter is dead code.** `.filter(p => !p.includes('*'))` discards nothing: the regex
requires a closing backtick and `*` is outside its character class, so `` `brain/**` `` never
completes a match rather than degrading to `brain/`. The comment claimed otherwise; the test
corrected it, not the reading. Kept as belt-and-braces, **labelled as dead**, and pinned — a
future widening of the class must not silently start demanding that `brain/**` exist.

## Alternativas descartadas

- **Fix the prose and skip the guard.** Fixes the instance. The 22 exist precisely because
  nothing checked.
- **Widen `BRAIN_MANAGED_PREFIXES` to match the prose.** Backwards: the gate is right.
- **Ship the check as a warning first, flip to error later.** A warning gate is the exact
  shape D4 found and rejected in this change's own first version.
- **A separate `check-brain-paths.mjs`.** Two gates, two definitions of one invariant.
