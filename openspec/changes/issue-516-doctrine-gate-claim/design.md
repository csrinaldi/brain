---
status: draft
issue: 516
---

# Design

## The only design question: what does a prose fix leave behind?

Option (1) is prose by definition, and a prose-only change is exactly the shape that decays —
the doctrine and the code have no connection, so they drift again the moment either moves. #529
shipped prose-only and recorded the sequencing as its answer. Here a cheaper answer exists,
because the two claims being corrected are *machine-checkable statements about the code*:

- *"the gate is label-conditional"* → drive `runCheck('decision-gate')` with and without the
  label and assert the verdicts are **identical**.
- *"a heuristic scans architectural surfaces"* → drive a diff touching all three named surfaces
  with no ADR and assert a plain pass.

Neither test asserts prose. Both assert the code fact the prose describes, and their failure
messages name the doctrine files. So the direction that can drift silently is closed: if
someone implements either claim, they cannot do it without being told which doctrine moves in
the same change. The direction that remains open — doctrine promising something not yet built —
is the label row, and it is now *labelled as such* rather than read as shipped.

## Why the tests are in `run-check.test.mjs` and not in `adr-presence.test.mjs`

The claim is about `decision-gate`, the CI job, not about the pure function. A test on
`adrPresence` alone could stay green while `run-check.mjs` gained a label branch around the
call — which is precisely the mutation used to prove the first pin. The pin has to sit at the
layer where a label could plausibly be read.

## Why `ctx.labels` and not an invented key

`ctx.labels` is the real context key — `diff-size` reads `size:exception` from it. A test using
a made-up key would pass for the wrong reason forever: identical verdicts because the key does
not exist, rather than because the gate ignores labels it could have read.

## The fifth site, and why it is worth more than the four

`workflow-governance.md` compiles into `AGENTS.md`. The four sites #516 names are read by a
human deciding a step; the fifth is read by every agent on every run. It also differs in kind:
sites 1–4 describe behaviour that **used to be true**, while the fifth describes behaviour that
**never was**. A stale statement and an aspirational one look identical to a reader and need
different corrections — the first is rewritten, the second must be marked as not implemented,
because retiring it silently would discard a design intent nobody has decided against.

## Red-proof

Two mutations, each one an IMPLEMENTATION of the doctrine's own claim rather than a strawman —
which is the point: the doctrine describes a plausible gate, and building it is the natural
thing a future contributor would do.

| | mutation | result |
|---|---|---|
| M1 | `decision-gate` returns pass unless the PR carries the `decision` label (step 1 as documented) | **4 tests RED** |
| M2 | a `brain/core/**` change with no ADR hard-fails (step 2, as a block) | **1 test RED** |

## The promotion script

Hand-written, because `brain:promote` handles a NEW ADR and refuses the amendment path
(`brain-promote.mjs:335`) — which is #509, and which is the same absence this ticket is about.
It anchors on exact strings, refuses on any anchor found ≠ 1 times rather than editing something
adjacent, is idempotent, and **regenerates `AGENTS.md` itself**.

That last part is written from the verb's behaviour, not from the doctrine text: #529's
hand-rolled script was written from the doctrine and missed the `AGENTS.md` step, which CI
caught on the human's signing commit. The script here was **executed and reverted** before
shipping — five sites across four files plus `AGENTS.md`, `brain:nav` green, the
`antigravity.drift` guard green, and a second run reporting *"already promoted"*.
