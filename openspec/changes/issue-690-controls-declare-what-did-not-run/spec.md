---
status: draft
issue: 690
---

# Spec — the declaration states both halves (issue 690)

## REQ-690-1 — A verdict states which control classes did NOT run

`controls_not_applied` is rendered next to `controls`:

```yaml
controls: ["deterministic"]
controls_not_applied: ["inferential"]
```

`controls` alone declares **what ran**. It does not declare that judgment did
not — to reach that a reader must know the vocabulary is closed, know
`inferential` is the other member, and *notice it is missing*. That is absence
carrying the meaning, which is what #683 exists to stop, one notch weaker.

#575 Ruling 3 requires the word **only**, and a positive list alone cannot say
it. Because `CONTROL_CLASSES` is closed and has two members, the complement is
finite, known, and costs one line.

## REQ-690-2 — The complement is DERIVED, never a second list

`complementControls` filters `CONTROL_CLASSES`. A hand-maintained "did not run"
list would drift from the vocabulary the first time either changed — #683's own
rule applied one field over — and would keep asserting a falsehood after #682
lands until someone remembered it.

Pinned as a **property** rather than by examples: for every subset of the
vocabulary, applied ∪ not-applied equals `CONTROL_CLASSES` and the two are
disjoint. The day a judgment evaluator declares `inferential`, the second half
empties itself with no edit.

## REQ-690-3 — Not a `conditions` entry, and the reason is measured

The obvious home was `conditions` — the field §10 uses for *"the evidence behind
this verdict is weaker than it looks"*, and the shape #552 gave the refuter's
`unchallenged` one level down.

Measured before rejecting it: `conditions` is **inert** with respect to the
conclusion (`buildVerdict` only appends to it and renders it; nothing derives the
verdict from it), so putting it there would have been *safe*.

It is still wrong. `conditions` is where a reader looks for something wrong with
**this** verdict's evidence, and a constant that fires on every verdict until
#682 lands turns that channel into wallpaper. A permanent entry in the alarm
channel is worse than an informational field beside the thing it completes.

## REQ-690-4 — Both halves obey one reader

`controls` and `controls_not_applied` are parsed by the same function: same
three-state answer, same closed-vocabulary check, an unknown member landing in
`malformed` rather than being assigned. Two call sites of one rule, never two
implementations of it.

Rendered **always**, `[]` included. Omitting the complement once everything ran
would make its absence mean *"nothing was skipped"* — silence again, in the
field written to remove silence.

## REQ-690-5 — `brain-review/1` is covered end to end

`lite` and `standard` post `/1` by default and its findings carry no
`evidence_class` at all, so the run-level declaration is the **only** thing
carrying the fact there. #683 proved the field on `regulated` → `/2` alone,
which is where it matters least.

An e2e drives a real `lite` run and asserts both halves on the wire and through
`parseVerdict`.

## REQ-690-6 — The structural pin survives a reformat and still catches a removal

#683's pin matched a multi-line source pattern including the **text** of the
error message, so a reformat or a reworded message broke it for a cosmetic
reason — and the natural repair to a test that fails for the wrong reason is to
loosen it until it asserts nothing.

It now anchors on the two facts it owns: the guard call exists and returns
non-zero, and it precedes `buildVerdict`. Proven in both directions — removing
the guard goes red, reformatting it and rewording its message stays green.
