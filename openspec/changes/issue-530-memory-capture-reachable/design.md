---
status: draft
issue: 530
---

# Design

## Where each refusal lives

Both new refusals sit in `plainfiles.save`, next to each other, and **not** in the CLI parser.
The parser is one caller; the backend function is exported and tested directly, and a rule that
only the CLI enforces is a rule the next caller skips. Same reasoning `netAddFull` gives for
duplicating its own vacuity guard on the primitive.

`--issue`'s *parsing* is the parser's job (string → number); its *validation* is the backend's.

## The unreachable rule

`validateWritableRecord`'s W2 — "issue must be an integer" — cannot fire for a non-numeric
value, because `computeRecordId` hashes the field first and `canonicalJson` throws on `NaN`.
The rule was written, tested at its own layer, and never reached from the path that matters.
Rather than reorder the pipeline (which would change the id-hashing contract), the refusal is
placed ahead of it where the caller's input is still recognisable as theirs.

## The inversion — the finding this change does not fix

`cli.mjs` states the durable record layer is **brain-owned and backend-independent** (ADR-0017),
and `reindex` honours it: dispatched directly, never through a backend. `save` does not — it is
dispatched to `backend[op]`, and `engram.save` refuses by design, pointing at engram's native
tool. Under the default backend, capture therefore goes **into engram first**, and
`memory:share` materialises records **out of it**.

So the layer brain owns is downstream of a third-party tool for the one operation that creates
data. That is why the outage was total: no engram, no capture, even though records need nothing
but a file.

The right shape is the opposite, and it is what the user's question names:

```
capture ──► .memory/records/   (the substrate; brain-owned, validated, one chokepoint)
                  │
                  ├──► engram        (index/search adapter)
                  └──► a RAG store   (tomorrow, the same way)
```

Adapters would then be **projections over records**, subscribing to a layer that never depends
on them. `memory:share` already does exactly this in reverse; inverting it is a design change
with an ADR, not a slice of this ticket. **Filed for that reason, not overlooked.**

## Red-proof

Seven mutations, all RED:

| mutant | the lie it would tell |
|---|---|
| M1 `type` gets a default | fabricated meaning on a durable record |
| M2 `project` stops being derived | back to the `undefined` crash |
| M3 the derivation returns `undefined` on empty config | the same crash, one branch deeper |
| M4 an explicit `project` no longer wins | the caller's value silently discarded |
| M5 `--issue` dropped by the parser | every record untagged again |
| M6 a bad `--issue` falls through | the serializer message returns |
| M7 the verb stops pinning the backend | the verb refuses under the default |

**M5 survived the first pass.** Every other guard drives `save()` directly, so the PARSER had no
coverage and deleting `--issue` from it left the suite green. Proving a behaviour at one layer
says nothing about the layer above — the same shape that left `readMergeParent`'s guard
unexercised on #518. A CLI-level test kills it now.

**And a guard of mine was N=1 wearing an N=2 loop.** The reachability test looped `['en','es']`
passing `{ lang }` to `t()`; the option is `locale`, so it resolved the ambient catalogue twice
and asserted one language while reporting two. It now asserts the two strings **differ**, so the
collapse cannot return unnoticed — in the file whose whole subject is measuring honestly.

Full suite: **3053 tests, 0 failures**.
