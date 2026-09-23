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

## Not an inversion — a missing emitter. (Corrected)

An earlier draft of this file called the engram-first flow a **dependency inversion** and
proposed restructuring the dispatch so records became the substrate and backends projections
over them. **That diagnosis was overstated, and the maintainer was right to push back.**

Being "below engram" is not the defect. Both directions are legitimate and both already exist
as explicit, named adapters:

| direction | adapter | provenance |
|---|---|---|
| records → engram | `engram-import.mjs` | **emits** it via `renderProvenance` |
| engram → records | `engram-export.mjs` (`memory:share`) | **recovers** it via `parseProvenance` |
| capture → records | `memory:save` | native — this change |

So brain's own round-trip is lossless, and the transform the maintainer asked for — *"tell it to
take what is in engram and put it in the record"* — is `memory:share`, and it does carry `issue`.

**The real gap is one step further up.** `exportObservation` recovers the fields only when
`parseProvenance` finds a §4 block:

```js
const recovered = Boolean(parsed.actor && parsed.actorKind);
if (recovered) { …; if (parsed.issue !== undefined) fields.issue = parsed.issue; }
else           { fields.actor = LEGACY_ACTOR; /* issue is never set */ }
```

And `provenance.mjs`'s own header records the measurement: **"0/278 real engram observations
carry this prose — this pair exists for FUTURE first-class writers."** The renderer has a caller
on the records→engram path and **none on the path that captures new knowledge**, which is the
agent calling engram's native `mem_session_summary` from outside brain entirely.

That is the cause of #368's 2157 untagged records, and it is not adoption lag: nothing ever
emitted the block those records would have been read from. Filed as its own ticket rather than
folded in here — this change's subject is reachability, and the emitter is a different defect
with a different fix.

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
