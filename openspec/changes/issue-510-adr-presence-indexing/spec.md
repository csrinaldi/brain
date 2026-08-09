---
status: draft
issue: 510
---

# Spec — adrPresence keeps the indexing invariant, and only that

## REQ-510-1 — a MODIFIED ADR is not an added one

A PR that modifies an existing ADR without touching `brain/HOME.md` MUST pass
`decision-gate`. A PR that ADDS an ADR without a `brain/HOME.md` entry MUST still fail.

## REQ-510-2 — the verdict names its evidence

The failure reason MUST name the added ADR path(s). The pre-#510 message asserted *"ADR
file added"* on evidence that could not establish adding.

## REQ-510-3 — the asymmetry is deliberate

The *"`brain/HOME.md` changed but no ADR found"* branch MUST keep reading the TOUCHED set.
Keying it on the added set would fail a PR that edits an existing ADR and its index entry
together — coherent, and passing before this change.

## REQ-510-4 — the three enforcement surfaces read the same evidence

CI (`governance/run-check.mjs`), local (`brain-check.mjs`) and the audit
(`lib/merge-walk.mjs`) MUST each supply the added-only list, so none of them can reach a
verdict the others would not.

## REQ-510-5 — an uncomputable added list fails closed

A failed added-list read MUST return `uncomputable` (exit 2). It MUST NOT degrade to `[]`
("nothing was added" — fail-open, every added ADR reading as modified) or to `null`
("assume everything touched is new"). This MUST hold for the SHIPPED reader, not only for
an injected one.

## REQ-510-6 — backward compatibility for non-enforcement callers

`adrPresence(changedFiles)` with the added list omitted MUST behave exactly as it did
before #510, so `brain-promote` and `postmerge/resolution` are unaffected.

## REQ-510-7 — A10 is reinforced, not retired

A10's frozen fixture invariants (`^M` on the offender, no `^A`, the payload live at HEAD,
the offender never on a `[SKIP]` line) MUST hold unchanged. A10 MUST additionally assert
that the report comes from the invariant that owns the MODIFY channel, so the fixture
cannot go green again on a proxy.

## REQ-510-8 — the human-gate check survives the reverter-exemption

A cleanup reverter that edits `brain/**` without an approving review MUST be reported, and
MUST NOT be nominated for auto-revert (`[FAIL-SHA]`). The net-parity exemption clears
tree-keyed failures only; review evidence is not a statement about the tree.

## REQ-510-9 — the narrowing is recorded

The audit's MODIFY-channel guarantee is conditional on being able to read review evidence.
Both paths that forfeit it — abstention on an unresolvable PR, and the pre-evaluation
resolved-skip — MUST be stated in ADR-0029 rather than left to be discovered.
