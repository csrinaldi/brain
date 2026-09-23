# The shipped `decision-gate`, measured — the one true statement all four sites must agree with

**Tier-2 promotion required.** Every destination below is under `brain/`. This file is the
*evidence*; the three files beside it carry the replacement text.

Measured 2026-08-11 on `main` at `eb8810d`, by driving `adrPresence` and `runCheck` directly
and by reading every call site.

## The rule, in full

`decision-gate` is `adrPresence(changedFiles, addedFiles)`. It fails in exactly two cases:

| # | condition | verdict |
|---|---|---|
| A | an ADR was **added** and `brain/HOME.md` is not in the diff | **fail** — *"ADR added without a brain/HOME.md entry: …"* |
| B | `brain/HOME.md` is in the diff and **no** ADR path is touched at all | **fail** — *"brain/HOME.md changed but no ADR file found"* |
| — | anything else, including a **modified** ADR alone | pass |

Note that A and B are not one rule seen from two sides. **A is keyed on the ADDED list; B is
keyed on the TOUCHED list.** That asymmetry is deliberate and is #510's whole content: a PR
correcting one line of an ADR from months ago must not be forced to re-index it (that
behaviour blocked PR #507 for months), while a PR that edits the index without touching any
ADR is incoherent regardless.

## The truth table, driven

```
FAIL  NEW adr, no HOME       — ADR added without a brain/HOME.md entry: …
PASS  NEW adr + HOME
PASS  MODIFIED adr, no HOME     ← the case §1c claims is caught
PASS  MODIFIED adr + HOME
FAIL  HOME alone               — brain/HOME.md changed but no ADR file found
```

## And two things the gate has never done

- **It reads no labels.** `adrPresence` takes `(changedFiles, addedFiles)` and nothing else; no
  call site passes labels; the workflow job carries no `if:` condition. It runs on **every** PR.
- **There is no step-2 heuristic.** Nothing anywhere scans `scripts/.*/providers/`,
  `brain/core/`, `config-migrations.mjs` or `package.json` for changes lacking a `decision`
  label, and nothing emits the `::warning::` the doctrine describes.

Both are now pinned by test (`run-check.test.mjs`, `#516`), each proven a real detector by a
mutation that IMPLEMENTS the claim: making the gate label-conditional turns 4 tests red, and
implementing the surface heuristic turns 1 red. The failure messages name the doctrine files
that must move in the same change.

## Why all three enforcement surfaces agree

`run-check.mjs` (CI), `brain-check.mjs` (local) and `merge-walk.mjs` (post-merge audit) all
pass `addedFiles`. There is no surface on which the pre-#510 behaviour survives, so the
correction below is not "true in CI, false locally" — it is true everywhere.

## What this means for §1c

The amendment marker in `brain/HOME.md` has **no gate behind it**, and the two remaining nets
do not close it either:

- `brain:nav` passes, because `HOME.md` already links the ADR. It is the *marker* that goes
  missing, not the link.
- `phase-order` is detection-only at `lite`.

So an amendment can land with the index still describing the previous version, silently. That
is an apparent protection — the class #499 closed in the doctrine — and it is the reason §1c's
sentence is the load-bearing one of the five: it is what a human reads while deciding whether
step 2 is skippable.

## What is NOT claimed here

The label-conditional divergence is **not** resolved by this change and must stay recorded.
ADR-0026 line 193 already names it; the correction below makes that note accurate about the
added/modified half while keeping the label half open, because it is still open.
