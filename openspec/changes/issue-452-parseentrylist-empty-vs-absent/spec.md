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
| key present; the scan stops on content these regexes cannot read — **at any entry count** | **`null`** — uncomputable |
| key present; every line read, scan ended cleanly | the entries |

Row 3's "**at any entry count**" is the correction from the SECOND cold review of PR #478.
A first version applied the unreadable test only when zero entries had parsed, so a list
that read one entry and then hit unreadable content returned the truncated prefix as a
confident, complete list — the same inversion one branch further up, and this table
asserted the opposite of what the code did.

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

Pre-existing on `main` and NOT fixed here. **Measured**, rather than asserted: applying
the candidate repair (`(.+)` → `(\S.*)` in `scalar`) and running the full suite fails
exactly one test — the pin below that documents the defect.

```
$ npm test          # with scalar's (.+) -> (\S.*)
not ok 1731 - #452/#478-F2: a trailing space on the key line routes to the INLINE branch
# tests 2496  # pass 2494  # fail 1
```

So the deferral is a **scope** decision, not a risk assessment: `scalar` is read by every
field in the block and its contract (what a whitespace-only value returns) belongs with
the sentinel policy being settled in #477, not bolted onto this change. An earlier draft
justified the deferral by implying breakage the tree does not show — flagged by the
second cold review, and the measurement above replaces the implication.

The behaviour is pinned by a test so this spec cannot claim a completeness the parser does
not have; the first cold review's finding 2 was precisely that a draft promoted an
incomplete table to a normative requirement.

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
