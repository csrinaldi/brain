---
status: draft
issue: 452
epic: 313
artifact_store: openspec
topic_key: sdd/issue-452-parseentrylist-empty-vs-absent/proposal
---

# Proposal: `parseEntryList` must distinguish empty from absent (issue #452)

Issue #452. Epic #313, Lane B (reviewer / M3 feeders).
Change folder: `openspec/changes/issue-452-parseentrylist-empty-vs-absent/`.

## Intent

`parse-verdict.mjs`'s `parseEntryList` ends with:

```js
return entries.length > 0 ? entries : null;
```

`null` is the sentinel for **"the key is absent"**. That line makes it *also* the
sentinel for **"the key is present and its list is empty"**. `parseVerdict` then guards
`if (followUps !== null) result.follow_ups = followUps`, so both states produce a result
object with no such property at all.

Measured against the real parser on `main` @ `c724942`:

```
follow_ups ABSENT                  | 'follow_ups' in result: false | value: undefined
follow_ups BARE (present, empty)   | 'follow_ups' in result: false | value: undefined
follow_ups with one entry          | 'follow_ups' in result: true  | value: [{"id":"x"}]
```

Rows 1 and 2 are indistinguishable. This is `evidence-reader-empty-on-failure` in the
parser — three states through one sentinel — and it is the **third appearance of the
#381 class in this same pair of functions**, the second in `follow_ups` specifically.

## Decision

Stop overloading `null`. The block-form branch only runs when the key's line was
actually found (`start !== -1`), so at that point an empty list is a real answer:

```js
return entries;
```

`null` keeps exactly one meaning: the key was not there.

## Scope — the parser half only

The ticket and epic #313 both split this change:

- **Parser half (here).** `parseEntryList` stops collapsing. Latent-but-real: brain's own
  `renderVerdict` cannot emit a bare `follow_ups:`, but `parseVerdict` also reads verdicts
  it did not write — `cold-boot.mjs:123` and `board.mjs:104` both parse verdicts posted by
  another actor, an older or newer brain, or a hand-authored comment.
- **Renderer half (NOT here — belongs with #408).** Whether `renderVerdict` should emit
  `follow_ups: []` the way it already emits `findings: []` is a **protocol choice**, not a
  bug fix, and `follow_ups` is structurally unreachable until an evaluator emits
  `pre-existing`/`base-only`. PR #444's REQ-409-6 pins today's absence at both the parser
  and the wire level, with a comment instructing whoever changes it to move the pin rather
  than delete it. That instruction is addressed to #408.

## Found while measuring — NOT fixed here

The state space has a **fourth** member the ticket does not mention, on the *inline*
branch rather than the block branch:

```
findings INLINE unparseable ('findings: {broken')  | 'findings' in result: false | value: undefined
```

`parseJsonScalar` returns `null` on unparseable input, and `parseVerdict`'s `!== null`
guard drops the field. **A verdict whose findings list is corrupt reads as a verdict with
no findings** — "could not be read" presented as "nobody found anything", which is the
same class pointing in a more dangerous direction than the ticketed one.

It is not fixed here for two reasons: it is a **documented** contract (`@returns … null
when the key is absent or unparseable`), and fixing it requires deciding what a consumer
should do with a corrupt list against `parseVerdict`'s never-throws guarantee — a policy
decision, not a one-liner. Filed separately with this measurement.
