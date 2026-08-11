---
status: draft
issue: 530
epic: 313
---

# Proposal — the writer existed; what was missing was every way to reach it

## The ruling

**Option (c) — make capture possible where the work happens — and it is far smaller than the
ticket assumed: reachability, not new machinery.** The cost is one npm verb, one derivation and
two refusals; what it buys is that an agent in the environment where the outage happened can
write a durable record at all, which nothing could do before.

(b) folding capture into the golden path stays deferred, exactly as #530 states: it blocks in
the environment where capture was impossible, and (c) is its precondition.

## Measured before writing anything

| | state |
|---|---|
| a records-only writer needing no engram | **exists** — `plainfiles.mjs#save`, fully tested |
| reachable by default | **no** — `MEMORY_BACKEND` defaults to `engram` |
| exposed as a managed verb | **no** — `index`/`share`/`pull`/`reindex` existed; `save` did not |
| works on its most obvious invocation | **no** |
| engram's own refusal | pointed at `engram save` — a binary `command -v` cannot find here |

`memory save "t" "c"` threw:

```
canonicalJson: unsupported value type 'undefined'
```

naming neither the field nor the flag. A working writer existed and every signpost pointed
somewhere else.

## The asymmetry that is the fix

Both `type` and `project` are required by `buildRecord`, and they are **not** the same kind of
missing:

- **`project` is a fact.** It is this repository, and `brain.config.json` already says which. So
  it is **derived** — slug → name → directory. Asking for it would be asking the caller to
  retype something the tool knows.
- **`type` is a choice** among seven. Defaulting it would stamp a fabricated meaning onto a
  durable record, so it is **refused by name**, with the list.

Derive facts, never opinions.

## Two things the measurement turned up

**The crash path had zero coverage.** Every existing `plainfiles.save` test passes *both* fields,
so the omission was never exercised: the tests were green and the verb was unusable.

**`--issue` did not exist at all.** The record format has carried the field since the beginning,
`validateWritableRecord` has a rule for it (W2, "must be an integer") — and **no verb ever
populated it**. #368 measured 2157 records with it empty; that is not adoption lagging, it is a
flag that was never there. Worse, W2 is **unreachable** for a non-numeric value: `computeRecordId`
hashes the field and `canonicalJson` throws on `NaN` first, so the rule read as enforced while
the path never arrived. `--issue abc` failed with *"non-finite numbers are not supported"* —
right direction, useless message. Both are fixed here, and the six records this change
materialises are the first in the repository's history to be issue-tagged by a verb.

## The proof is the records, not the code

#530's acceptance is explicit: *"Records are being written again, proven by a fresh one, not by
reading the capture code."* This session is materialised **through `npm run memory:save`** — the
verb this change makes reachable — not by a script calling `appendRecord`. Six records, every one
carrying `issue`, every one `project: brain` derived from config.

## What this does NOT fix — corrected after review

An earlier draft called the engram-first flow a dependency inversion and proposed restructuring
the dispatch. **That was overstated.** Being below engram is fine; both directions already exist
as explicit adapters (`engram-import` emits provenance, `engram-export`/`memory:share` recovers
it), so brain's own round-trip is lossless.

The real gap sits one step further up: **nothing emits the §4 provenance block on the path that
captures new knowledge** — the agent calling engram's native tool from outside brain.
`provenance.mjs`'s own header measured it as **0/278 observations**, and that, not adoption lag,
is why #368 counted 2157 records with no `issue`. Filed as its own ticket; see `design.md`.
