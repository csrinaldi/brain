---
status: spec
issue: 452
epic: 313
artifact_store: openspec
topic_key: sdd/issue-452-parseentrylist-empty-vs-absent/spec
---

# Spec — `parseEntryList` distinguishes empty from absent (issue #452)

Requirements tagged `REQ-452-N`.

## REQ-452-1 — three states, three answers

`parseEntryList(block, key)` returns:

| block content | returns |
|---|---|
| the key's line is not present | `null` |
| the key's line is present, no entries follow | `[]` |
| the key's line is present with entries | the entries |

Asserted as three cases, because the whole point is that there are three. A test that
covers only the first and third is the test this defect already survived.

## REQ-452-2 — `parseVerdict` propagates the distinction

`'follow_ups' in result` is `false` when the key was absent and `true` with value `[]`
when the key was present and empty. Same for `findings`.

This is the half that makes the fix observable to a consumer: `parseEntryList` is not
exported, so the distinction only matters if it survives `parseVerdict`'s `!== null`
guard — which it does, unchanged, once `null` means one thing again.

## REQ-452-3 — the inline encoding keeps its behaviour

`findings: []` is caught by `scalar()` before the block branch runs, so it already
round-trips to `[]` today (this is exactly why #381 stayed hidden — the empty case
worked). This change must not alter that path. Pinned so the fix cannot silently move
the working encoding while repairing the broken one.

## REQ-452-4 — the round trip closes for the empty list

`renderVerdict` → `parseVerdict` over a verdict whose `findings` is `[]` yields `[]`,
and the block-form empty list parses to `[]`. The field becomes pinnable **at the parser
level**, which is the concrete thing this change buys: PR #444's REQ-409-6 had to assert
at the wire level (`assert.doesNotMatch(body, /^follow_ups:/m)`) because the parser could
not tell the two states apart — verified there, mutating `renderVerdict` to emit the
empty key left the parser-level assertion green.

## REQ-452-5 — no consumer's behaviour changes

`parseVerdict`'s callers are `cold-boot.mjs:123` and `board.mjs:104`. Neither
truthiness-checks `.findings`/`.follow_ups` — verified by inspection, and `verdict.mjs`'s
`if (v.follow_ups && …)` reads the EVALUATOR's object, not a parsed one. A parsed
`follow_ups: []` is newly truthy where the property was previously `undefined`, so this
must be stated and checked rather than assumed: the suite is the evidence.

## REQ-452-6 — the renderer half stays out, and says so

`renderVerdict` is unchanged. #444's REQ-409-6 pins (`!('follow_ups' in verdict)` and the
wire-level `doesNotMatch`) must both remain green — they describe the renderer's
behaviour, which this change does not touch. If either flips, this change did something
it was not supposed to do.
