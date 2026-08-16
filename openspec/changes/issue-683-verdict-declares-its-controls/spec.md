---
status: draft
issue: 683
---

# Spec — the verdict declares which classes of control ran (issue 683)

## REQ-683-1 — The declaration is derived from the EVALUATORS, never from the findings

Each evaluator exports `PRODUCES`, the control classes it is capable of
establishing. `cli.mjs` sets `controls` from whichever evaluator actually ran,
and `unionControls` folds them in a fixed order so two runs of one shape render
identically.

**Deriving from `findings[].evidence_class` is refused, and this is the
requirement rather than an implementation note.** A clean mechanical run has no
findings, so a findings-derived list is empty — and *"no control ran"* would
render identically to *"controls ran and found nothing"*, on exactly the green
verdicts where nobody would look. That is the defect this field removes,
re-created inside its own fix.

Proven end to end: a fixture **with** findings and one **without** must declare
the same controls.

## REQ-683-2 — It is emitted always, `[]` included

`renderVerdict` never omits the key. An absent key is the silence #683 exists to
break; `controls: []` reads as *"nothing declared that it ran"*, which is loud
and true of a verdict built with no declaration.

## REQ-683-3 — It round-trips, which forces the encoding

`parseVerdict` reads `controls` back. The list is **JSON-encoded**, not passed
through `yamlScalar`: `yamlScalar('deterministic')` renders it **bare**, a bare
word is not JSON, and `parseJsonScalar` would then answer `UNREADABLE`. Measured
before choosing, and the same encoding `pin` and `sequencing` already use.

It gets `sequencing`'s **flat-string reader**, not `readList`. Same reason,
already written next door: `parseEntryList` is the inverse of the
findings/follow_ups *entry* emitter, and pointing it at a flat list parsed
`  - deterministic` into `[{…}]` — accepted as readable, then handed to a
consumer reasoning over strings. It happens to work inline today; relying on the
emitter never using the other encoding is the assumption that produced the
`sequencing` bug.

## REQ-683-4 — A class outside the vocabulary is UNREADABLE, never a value

At the writer, `unionControls` throws. At the reader, an unknown member sends
the field to `malformed` rather than assigning it.

A verdict claiming a control that does not exist would be **believed** —
strictly worse than the silence this field replaces, which is recoverable.

## REQ-683-5 — Control classes are a subset of the evidence classes, and the partition is pinned

`CONTROL_CLASSES` is `deterministic` and `inferential` — the same vocabulary
`brain-review/2`'s `evidence_class` uses, at a different altitude: the
finding-level field says how **one** finding was established, this says which of
those a **run** was capable of establishing.

`schema-v2.mjs` allows a **third**, `insufficient`, and it is deliberately
**not** a control: it names a finding whose evidence was not enough, which is
the opposite of a way to establish one. There is no insufficient control.

The two sets are declared separately and their union is asserted equal to
`ALLOWED_EVIDENCE_CLASSES`, so a fourth evidence class cannot be added without
someone deciding which side of the line it is on. Found by the test: the first
cut asserted the two vocabularies were **equal**, and they are not.

## REQ-683-6 — The declaration cannot quietly become false

Before the verdict is built, `checkControlsCoverFindings` asserts every
finding's `evidence_class` is covered by the declaration. A violation **refuses
the run and posts nothing**: a verdict whose self-description is false is the
artefact this ticket exists to prevent.

Absence is skipped (`/1` findings carry no class, and absence is not a claim),
and so is `insufficient`, per REQ-683-5.

## REQ-683-7 — It survives `brain-review/1`

`/1` is what `lite` and `standard` post by default, and its findings carry no
`evidence_class` at all — so it is the tier that needs the declaration most, not
least. The statement is about the **run**, not about a finding, so it is true at
both protocols and uses the one vocabulary rather than inventing a `/1` spelling
of the same idea.
