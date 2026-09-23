# A local mirror of a frozen pin, argued safe in the wrong direction

> **DRAFT — promotion candidate for `brain/core/anti-patterns/`.** Written by an
> agent, awaiting the owner's promotion and indexing (ADR-0013 draft-and-promote).
> It is NOT indexed in `brain/core/anti-patterns/README.md` until then.

- **Discovered in:** issue #297 (D2 PR3) / `brain-audit.mjs` `payloadSignature`
  mirroring `resolution.mjs`'s module-private `normDiff`
- **Applies to:** any place a caller re-implements a pinned command, format, or
  hash because the authoritative one is private or its surface is frozen —
  dedup keys, cache keys, fingerprints, canonicalizers

## Symptom

Two copies of a security-adjacent pin drift apart, and nothing goes red. The
copy exists for a reason that sounds like scope discipline: `normDiff` and its
config pins are module-private, the module's export surface was frozen by an
earlier PR, and the caller needed a per-merge payload **signature** to group
duplicate `[FAIL-SHA]` carriers. So it re-declared the pinned command locally
and documented the copy.

The dangerous part was not the copy. It was the safety argument attached to it:

> if the local signature ever drifts COARSER, the worst case is an EXTRA
> `[FAIL-SHA]` — the pre-dedup fail-safe behavior

That is **inverted**, and it survived two review passes before anyone traced it.
Coarser means more dedup-key **collisions**. Two distinct payloads land on one
key, so the second one's `[FAIL-SHA]` is **suppressed** — a *missed* emission,
fail-open for the downstream consumer that reverts from that signal. Not an
extra. The cross-check that might have caught it compares booleans (`count > 0`),
so it cannot see a partial suppression at all.

## Cause

A mirror is judged on whether it is *currently correct* — it was byte-identical,
so there was no live exploit — while the thing that actually matters is what
happens when it drifts, and in which direction. Deduplication inverts the naive
intuition: for a *filter*, a coarser rule lets more through; for a *grouping
key*, a coarser rule lets **less** through, because collisions collapse distinct
items into one. Reviewers pattern-match on "coarser = more noise = safe" and
skip the step where the failure direction is derived rather than assumed.

The freeze that motivated the copy also suppresses the obvious fix. "Export the
helper" reopens a frozen surface, which is a decision above the implementer's
authority — so the local copy looks like the humble choice, when it is really
the one that moves risk somewhere nobody is watching.

## Solution / correct pattern

**Derive the failure direction; never assert it.** Write down what a coarser
copy and a finer copy each do to the consumer, concretely. If either direction
loses a signal, the mirror needs a fence before it ships.

**Fence the mirror with a drift-guard that reddens.** A source-scan test that
asserts the local pins stay value-aligned with the authoritative ones, so
divergence breaks the suite instead of silently coarsening:

```js
// Compare VALUES, not formatting — a guard that reddens on a line break is a
// guard nobody keeps.
assert.deepEqual(pins(LOCAL_SRC, 'SIG_ARGS'), pins(AUTHORITATIVE_SRC, 'DIFF_ARGS'));
```

Forge it before trusting it: coarsen the mirror on purpose (drop one pin) and
confirm the guard actually goes red. A drift-guard nobody has seen fail is
decoration.

**Route the real fix, do not silently absorb it.** Exporting the single source
of truth is the correct end state. When a freeze blocks it, the mirror is a
documented, fenced, time-boxed exception and the export question goes to whoever
owns the freeze — not into a comment that says "out of scope".

Related: [A ruling binds a correct property to a mechanism nobody ran](ruling-bound-to-an-unrun-mechanism.md)
— same root, one layer up: a plausible claim about mechanism, accepted without
being run.
