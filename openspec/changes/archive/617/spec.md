---
status: draft
issue: 617
---

# Spec — supersede-adr-0006 (issue 617)

## REQ-617-1 — ADR-0030 records the decision, not the mechanism

The registry choice, the mandatory scope, what survives from ADR-0006, and what
must be re-derived rather than translated. It touches no code.

## REQ-617-2 — Every superseded passage of ADR-0006 is annotated in place

`consolidation-protocol.md` §1c act 2: *"A reader who never scrolls to the
amendment must not be left with the superseded rule."* Five passages assert the
private-repo premise or reject the registry; each gets an annotation next to it.

## REQ-617-3 — The supersession is narrow, and says so

The three-pillar model, `brain/core/**` read-only, additive migrations,
check-and-notify-never-auto-update and `specialMerge` all survive. Both drafts
state this explicitly, so the supersession is not read wider than it is.

## REQ-617-4 — Both drafts are verified against the real parsers

`transformDraft` for the new ADR; `parseAmendmentDraft` + `planAmendment` for the
amendment, against the actual ADR-0006 text. An anchor matching ≠ 1 times refuses
the whole run, so this is checked before the human sees it.

## REQ-617-5 — The residual is stated, not hidden

ADR-0030 is signed while `main` still carries `private: true`, an unscoped name
and a git-URL install spec. Both drafts say so. The decision preceding the
mechanism is deliberate and visible.
