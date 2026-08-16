---
status: draft
issue: 634
---

# Design

## Decision 1 — report at the snapshot, not at the shared reader

The tempting fix is to make `readRecordObservations` itself noisy, since all six consumers go
through it. It would be wrong twice over: it would put output in a library function that three
callers do not want, and it would print once per *read* rather than once per *report* — the
memory-gate reads the store on every merge in a `brain:audit` walk.

So the accounting travels as data and the decision to speak belongs to each consumer. Exactly
what `memory/cli.mjs` does with the same accounting from the same store.

## Decision 2 — `computeMemoryCoverage` switches readers; `brain-metrics` does not

`brain-metrics.mjs` reads the store twice: once through `readRecordObservations` for the
memory-gate, once through `computeMemoryCoverage` for the coverage line. Only the second one is
counted and printed, so only the second one changed. The memory-gate read stays on the
existence-only reader precisely because that is what it is.

The alternative — one read shared by both — is a refactor this ticket does not need and would
couple a gate to a report.

## Decision 3 — `duplicates` is never `undefined`

On the unavailable path the function returns `emptyDuplicates()`, not `undefined`. A consumer
that has to test whether the field exists before trusting it is a consumer that will eventually
forget to, which is the family this ticket belongs to.

The two fields say different things and are read together: `available: false` is "I could not
look"; `duplicates: {lines: 0}` is "nothing was collapsed". Collapsing those into one nullable
field is how "I could not look" starts reading as "there was nothing there" — the exact shape of
`evidence-reader-empty-on-failure`, which is what #634 is a relocation of.

## Decision 4 — the JSON projection is explicit, and non-mutating

Two properties, each with its own mutation test, because each fails in a way the other would not
catch:

**Explicit, not `delete`.** The projection names `ids`, `lines` and `divergent`. Written as a
`delete duplicates.groups` it would silently start shipping whatever field `normalizeDuplicates`
grows next, and the size regression would return without a test noticing.

**Non-mutating.** `renderJson` and `renderMarkdown` receive the *same* `memCoverage` object. A
projection that stripped `groups` in place would leave the markdown renderer reading a mutated
snapshot depending on which ran first — an order dependency between two pure-looking renderers.
M6 introduces exactly that and fails a pre-existing test alongside the new one.

The 62× measurement is in the code comment, not only here, because the next person to consider
passing the snapshot through whole will be reading the code.

## Decision 5 — the register goes at the chokepoint

Six files read through `readRecordObservations`. Recording "who reads this and which of them
speak" at each of the six would be six copies of one fact, free to drift — the #340 shape. It
goes in the shared reader's docblock, once.

It also carries the *rule* rather than just the list: a consumer that starts COUNTING rather than
testing must switch to `readRecords` and say what it collapsed. That is the part that survives
the next consumer being added.

## Decision 6 — prove the existence-only silence, do not assert it

"These three need no output" is the kind of claim that is easy to write and easy to be wrong
about. It rests on a specific property — `memoryPresence` is `.some()`, dedup is first-wins, so
the predicate is invariant — and a property that specific deserves a test.

The test builds four physical copies of one record, asserts the reader really collapsed them
(`length === 1`), asserts there really were repeats to collapse (`duplicates.lines === 3`), and
only then asserts the gate's verdict. Without the two preconditions it would pass against a
fixture that never had duplicates in the first place, which is #632's shape.

## What was checked and turned out not to exist

The PR template says `memory-gate`, when handed the PR description, *"requires a memory record
scoped to the linked issue"*. There is no such variant in `brain/scripts/governance/` — the only
implementation is the unscoped `memoryPresence` above. That does not change this ticket's
conclusion (an issue-scoped `.some()` would be invariant under dedup too), but it is worth having
on the record before someone reasons about the gate's behaviour from the template.

## Rejected: gating `share()` on `records/` existing

`plainfiles.share.test.mjs` drives `share({root: '/fake/root'})` with an injected `_rebuildIndex`
and asserts that rebuildIndex is called. A gate on `existsSync(records/)` would short-circuit
before the seam and fail both of #246's tests — so gating means changing that contract and its
tests, to fix a misreading that, measured, nothing currently makes: the one consumer that could
be misled resolves store presence from `records/`, not from the index.

Documented instead, with the condition that would flip the decision written next to it.
