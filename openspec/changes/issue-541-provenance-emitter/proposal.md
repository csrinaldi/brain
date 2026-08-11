---
status: draft
issue: 541
epic: 313
---

# Proposal — the ruling on the missing emitter, and the counter that makes its absence visible

## The ruling

**(c) is the direction — capture through brain — and (b) is not an alternative to it but its
necessary complement; (a) alone is refused.** The cost of (c) is that it does nothing for
observations written into engram from outside brain, which is why (b) has to exist; the cost of
(b) is that it still depends on being called, which is why the counter shipped here exists.

Stated as a sequence:

1. **Now** — the absence is **counted** on every `memory:share`. Nothing is refused.
2. **(c)** — capture through brain writes structured records where provenance is a **field**, not
   prose to be parsed. Half-shipped by #530 (`memory:save --issue`); it is the path that removes
   the class rather than narrowing it.
3. **(b)** — a shared renderer for anything that still writes *into* engram, so the block is
   composed by the pair's own emitter instead of remembered.
4. **A gate** only once (b) and (c) exist to satisfy it. Not before.

**(a) — doctrine and instruction alone — is refused**, and the measurement is the reason: a prose
convention is exactly what produced 0/278 in 2026-07 and 2070/2163 today. Repeating it is the
apparent-protection class #499 closed.

## Two corrections to my own earlier claims, before the evidence

**This ticket exists because of the first.** #530's first draft called the engram-first flow a
*dependency inversion* and proposed restructuring the dispatch. Wrong: both adapters exist,
`engram-import` **emits** the block via `renderProvenance` and `engram-export` **recovers** it
including `issue`, so brain's own round-trip is lossless. The gap is one step up — nothing emits
on the path where knowledge enters.

**And the second, made while measuring this one.** I reported `actor = getBranch(root)` on the
plainfiles path as "a second emitter defect… structurally wrong". It is not a defect. It is a
**ruled, guarded decision** — `plainfiles.actorkind-consistency.test.mjs` records it as *"two cli
doors, one convention"*: neither door accepts a caller-supplied `actor`/`actorKind`, both derive
the actor from a seam. That is **measured provenance over claimed provenance**, the same
principle #124 applies to approvals. The branch answers *where* rather than *who*, and that
imprecision is the accepted cost of spoof-resistance — a trade, not an oversight. Whether the
trade is still right is a real question and it is **not this ticket's**.

## Measured, re-taken rather than quoted

`provenance.mjs`'s own header carries the 2026-07 note: *"0/278 real engram observations carry
this prose."* Re-measured today from the durable projection:

```
registros totales ................ 2163
materializados SIN provenance .... 2070   (95.7 %)
con issue ........................    6
sin issue ........................ 2157
```

The store grew almost eightfold and the picture is unchanged. And the `issue` count is exact
confirmation rather than an estimate: the **6** are the records this session wrote through
`memory:save --issue`, so `2163 − 6 = 2157` — precisely #368's number. Before this session, **not
one record in the entire store carried the field.**

## What ships here

**The counter, not the gate.** `exportObservation` has always returned `recovered` and the share
loop has always discarded it, so an observation arriving bare got the fallback — `@legacy`, no
`issue` — and the resulting record read exactly like a healthy one. It is now counted and
surfaced.

**Counted, never refused.** Refusing would turn `share` against the 2070 observations this
repository already holds, and the remedy would be measured in how fast someone stops running it.
That is the same trap #529's ruling refused for `memory-gate`: tightening before the writer works
blocks everything with no override.

Also fixed: `share`'s accounting was **returned and never printed** by the CLI's generic dispatch,
so every number it measured died in the return value. The unprovenanced count is surfaced;
without that, adding it would have been a measurement nobody could read.
