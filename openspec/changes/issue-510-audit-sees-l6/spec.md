---
status: draft
issue: 510
---

# Spec — delta requirements

## REQ-510-1 — `adrPresence` answers only the indexing question

`adrPresence(changedFiles, addedFiles)` MUST require a `brain/HOME.md` co-change only when an
ADR path is in `addedFiles`. Omitting `addedFiles` (or passing null) MUST preserve pre-#510
behaviour, so callers that cannot cheaply produce an added-only list are unaffected.

The "HOME.md changed but no ADR" branch MUST keep reading the **touched** set. Keying it on
the added set would fail a PR that edits an ADR and its index entry together — coherent
today, and a regression this change must not introduce.

```
GIVEN a diff that ADDS brain/project/decisions/adr-0099-x.md and does not touch brain/HOME.md
WHEN adrPresence runs
THEN it fails, and the reason NAMES adr-0099-x.md

GIVEN a diff that MODIFIES an existing ADR and does not touch brain/HOME.md
WHEN adrPresence runs
THEN it passes

GIVEN a diff that MODIFIES an existing ADR and also touches brain/HOME.md
WHEN adrPresence runs
THEN it passes

GIVEN a diff that touches brain/HOME.md and no ADR
WHEN adrPresence runs
THEN it fails
```

## REQ-510-2 — the reason states only what the check established

The failure reason MUST NOT assert that a file was *added* unless the added-only list
established it, and MUST name the ADR path(s) it is failing on. The pre-#510 string
("ADR file added but brain/HOME.md was not updated") is inadmissible under its own evidence.

## REQ-510-3 — an uncomputable added list fails closed, and is not defaulted

Every enforcement surface MUST compute the added-only list through the same failure path as
the full list. A read that fails MUST produce `uncomputable`, never `[]` (which reads as
"nothing was added") and never `null` (which reads as "assume everything touched is new").
Both defaults are a verdict about evidence the surface does not have.

## REQ-510-4 — the three enforcement surfaces agree

`run-check.mjs` (CI), `brain-check.mjs` (local) and `lib/merge-walk.mjs` (audit, via
`brain-audit` and `brain-metrics`) MUST reach the same `adrPresence` verdict for the same
merge. A local pass that CI rejects is the defect #340 already records; an audit failure on a
merge CI passed is worse, because `adrPresence` is tree-keyed and rung 3 would open an
auto-revert against it.

```
GIVEN one merge
WHEN the same evidence is evaluated by CI, by brain:check and by the audit
THEN the three verdicts are identical
```

## REQ-510-5 — the audit's blindness is recorded, not covered

I2 (an ADR's content changed without a human gate) has **no owner** on merged history. This
change MUST NOT assert coverage it does not have: no proxy, no similarly-named check standing
in. The blindness is recorded in `KNOWN-LIMITATIONS` and tracked in **#511**.

Measured, so it is not re-litigated: `evaluateBrainWritesReviewed` with `reviews: []` returns
PASS at `lite` (agent-authorship exclusion — reviews never consulted) and WARN at
`standard`/`regulated` (*"never failing on missing evidence"*). L6 catches A10 at no tier.

## REQ-510-6 — the sequencing against A10 is an explicit choice

This change disarms A10. It MUST NOT merge without one of the three postures on #510 having
been chosen and recorded: hold for #511 · keep the audit surface coarse · land and record the
loss with A10 re-frozen by ruling.

A10's frozen invariants (`^M`, never `^A`) MUST NOT be edited to make this change pass.

## REQ-510-7 — evidence rules state which reading of absence they take

Any check reused across PR time and merged history MUST state whether absent evidence means
*not yet* or *never*. A rule that does not say is two rules sharing a name.

## REQ-510-8 — every new guard is proven by mutation

Each guard added here MUST be shown RED against a seeded defect before it is accepted green,
with the mutation's diff printed before the run. Five substitutions silently failed to match
during #478 and produced meaningless greens; a guard nobody watched fail is decoration.

A fixture built only from ADDED paths cannot observe this defect — the whole of it lives in
the gap between the two lists — so the modified-ADR case MUST be driven explicitly.
