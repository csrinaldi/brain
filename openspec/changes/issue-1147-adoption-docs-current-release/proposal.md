---
status: draft
issue: 1147
---

# Proposal — adoption docs for the current release (issue #1147)

## What

Rewrite `docs/adoption.md` and `docs/KNOWN-LIMITATIONS.md` for the current npm
release (`@logikas/brain`, ADR-0030), and add `docs/definition-of-done.md`. This is
the phase-0 documentation slice of #1126, itself under epic #1121.

## Why

`docs/adoption.md` still documented the pre-ADR-0030 git-tag install (`v0.7.1`) and
said nothing about the GitHub App the archive sweep needs (#1106), the new-consumer
`lite` tier default (ADR-0026 Amendment 8), the `claude` default platform
(ADR-0024 Amendment 2), or how a new repository makes its first commit under the
installed hooks (#1112 item 4). `docs/KNOWN-LIMITATIONS.md` still framed brain as a
"1.0 pilot" and listed mostly internal/self-hosting concerns rather than the open
consumer-path defects found by the #1081 demonstration. Nothing wrote down what
"done" means for the product (ADR-0036).

## Scope

- Includes: `docs/adoption.md` (full rewrite), `docs/KNOWN-LIMITATIONS.md` (full
  rewrite, consumer-path defects only), `docs/definition-of-done.md` (new). A
  `brain-drafts/` note proposing one `brain/HOME.md` line (Tier 2 — human moves it).
- Does not include: any code fix for the defects it documents (#1112, #1113,
  #1115–#1119, #1107, #1114); those stay open and linked. Does not include
  `docs/methodology-map/index.html` — that interactive map still shows the
  superseded git-tag install as its "Install" node and needs its own pass; out of
  scope here to avoid re-deriving a much larger artifact under this issue's budget.
