---
status: spec
issue: 452
epic: 313
artifact_store: openspec
topic_key: sdd/issue-452-parseentrylist-empty-vs-absent/spec
---

# Spec — `parseEntryList` distinguishes empty from absent (issue #452)

Requirements tagged `REQ-452-N`.

## REQ-452-1 — `[]` means EMPTY; `null` means ABSENT **or UNREADABLE**

Corrected after the cold review of PR #478, whose blocker finding was that the first
version of this requirement (and of the code) had only three rows and put unreadable
content in the wrong one.

`parseEntryList(block, key)`, list encoding:

| block content | returns |
|---|---|
| the key's line is not present | `null` |
| key present; only blank lines until the next top-level key or the end of the block | `[]` |
| key present; a body these entry regexes cannot read | **`null`** — uncomputable |
| key present with readable entries | the entries |

Row 3 is the one that matters most and is easiest to get wrong. `ENTRY_OPEN_RE` /
`ENTRY_CONT_RE` are anchored to the exact indentation of ONE emitter, so a foreign
verdict written in 0-indent YAML block sequence — what `yaml.dump` emits by default —
carries findings this parser cannot read. Answering `[]` there asserts *"the reviewer
found nothing"* about a verdict that may carry blockers.

The governing rule is `brain/core/anti-patterns/evidence-reader-empty-on-failure.md`:

> `null` = uncomputable (the fetch failed), `[]` / `''` = genuinely empty.

A fix that closes row 2 by breaking row 3 has moved the defect, not removed it — and in
the more dangerous direction, since a false `[]` is a positive claim while the previous
absence was merely unknown.

## REQ-452-1a — the known boundary, pinned rather than claimed

A **trailing space on the key line** routes the key into the INLINE branch (`scalar`'s
`^key:[ \t]*(.+)$` backtracks, `(.+)` captures the space, `parseJsonScalar('')` throws),
so it returns `null` **even with entries under it**.

Pre-existing on `main` and NOT fixed here — the candidate repair (`(.+)` → `(\S.*)`)
changes `scalar`, which every field in the block reads. It is pinned by a test so this
spec cannot claim a completeness the parser does not have; the cold review's finding 2
was precisely that an earlier draft promoted an incomplete table to a normative
requirement.

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
