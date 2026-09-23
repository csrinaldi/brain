---
status: draft
issue: 634
---

# Proposal — the readers that COUNT now say what they collapsed; the ones that only TEST are proved silent

## The ruling

**Report at the readers that print a number; stay silent at the readers that test existence, and
prove the silence rather than assert it.** The reviewer's cold boot stays silent too, as a
recorded ruling with its reasoning. `share()`'s new side effect is documented, not gated — with
the option not taken written down.

The shape of the fix is the same discipline `memory/cli.mjs` already follows: one line, only when
there is something to say. Not a warning banner, and not a report on every surface that happens
to touch the store.

## Measured before writing anything

On this repo's corpus, today:

```
physical lines : 2185
unique records : 2046
duplicates     : {"ids":49,"lines":139,"divergent":0}
```

And what `brain:metrics` printed:

```
- memory records coverage: 13/2046 tagged with `issue` (0.6%) — adoption pending
```

`2046` is the deduped count. Nothing in the output said the store holds `2185` lines, so an
operator who watched that denominator drop by 139 between two runs had no way to learn why. "It
got more correct" was not an answer the tool could give.

After:

```
- memory records coverage: 13/2046 tagged with `issue` (0.6%) — adoption pending
  - the store holds 2185 physical line(s); 139 of them repeat 49 id(s) and are collapsed into
    the 2046 above. Normal for `merge=union` (ADR-0017, REQ-MF-3) — run `npm run memory:reindex`
    for the per-id locations.
```

## The three existence-only consumers: silence, PROVED

`memory-gate`, `brain:check` and `brain:audit` all end in the same predicate:

```js
export function memoryPresence(observations) {
  const obs = Array.isArray(observations) ? observations : [];
  if (obs.some(o => o?.type === 'session_summary')) return { pass: true };
  …
```

Dedup keeps the **first** copy of every repeated `id`, so every record present among the physical
lines is still present in the deduped list. `.some()` over one equals `.some()` over the other,
for *any* predicate — their verdicts cannot move. That is a proof, not a judgement call, and it
is the reason no output is owed: noise on a gate is how gates come to be ignored.

It is also verified rather than argued: a test builds a store with four physical copies of one
record, confirms the reader really collapses it and that there really were repeats, and asserts
the gate reads the same verdict off the collapsed list.

There is no issue-scoped variant of this check in the repo, despite the PR template describing
one — checked, and worth knowing before anyone reasons about it from the template.

## The reviewer: silent, on the record

The acceptance asks for *"a decision on the record, not an omission"*. The ruling is **no**, and
it is written into `cold-boot.mjs` where the reader lives.

A verdict is about a pull request. How many physical lines the store spends on a doctrine record
is a fact about repository hygiene — a `merge=union` residual arriving from unrelated branches
— and surfacing it in a review would let it colour a judgement it has no bearing on, about
something the PR author cannot act on. Deduping there is not merely acceptable but required:
otherwise a doctrine record gets weighed twice because two branches both appended to the month
file it lives in.

The silence is conditional on the accounting being reported *somewhere*, which is exactly what
#574 and this ticket establish. The comment says so, so the ruling can be revisited rather than
quietly inherited if that stops being true.

## `share()` on a store-less repo: documented, not gated

Reproduced:

```
before: <repo>/                       (nothing)
after:  <repo>/.memory/index.jsonl    (empty)
```

Documented rather than gated. #598's intent is that a share which *read* the store leaves a
canonical index, and an empty store is still a store that was read. The ambiguity this could
create — "zero records" versus "no store at all" — is already resolved where it could mislead:
`computeMemoryCoverage` answers it from `existsSync(records/)`, never from the index, and reports
`available: false` for the second case. Gating would change a verb's contract to fix a misreading
that nothing currently makes.

The docblock records the option not taken and the condition under which it would become right.

## Found while implementing: the JSON report would have bloated 62×

`renderJson` denormalizes `memoryRecordsCoverage` onto **every** period row, and
`duplicates.groups` carries all 49 repeated ids with their `file:line` occurrences. Passing the
snapshot through whole was measured at **6871 bytes per row against 111 without** — roughly
79 KiB of byte-identical repetition on a twelve-period run.

So the JSON report takes the counts and drops the groups. Projected explicitly rather than by
deleting a key, so a field added to `duplicates` later cannot silently start bloating it again —
and without mutating the caller's object, since the markdown renderer reads the same snapshot and
still needs the groups. Both of those have their own mutation test.

## Acceptance

- [x] A store with duplicates makes every count-printing consumer say so; a clean store leaves
      them silent — both directions asserted, and a mutation that makes the line unconditional
      fails five tests.
- [x] The reviewer's treatment is a decision on the record.
- [x] `share()`'s behaviour on a store-less repo is documented, with the alternative recorded.
- [x] The existence-only consumers were considered, and the finding is recorded at the one
      chokepoint all six readers share — not in three places, and not only in this document.

## Links

- #598 / #574 — the dedup this reports, and the polarity being relocated · #631, #633 — the same
  shape in the reviewer and the hooks · ADR-0017 · `evidence-reader-empty-on-failure`
