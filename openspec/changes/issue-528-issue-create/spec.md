---
status: draft
issue: 528
---

# Spec

## REQ-528-1 — the port can open an issue
`issueCreate({ project, title, body?, labels?, config? })` → `{ number, url }` on both
providers, in `VERBS`, the drift-guard and `vcs-contract.md`.

## REQ-528-2 — the approval label is refused
The refusal MUST live at the port, MUST fire on both providers, and MUST precede the write.

## REQ-528-3 — the refusal resolves the label
It MUST follow `resolveApprovedLabel(config, provider)` — a renamed label and GitLab's scoped
form are both caught; a hardcoded literal is not acceptable.

## REQ-528-4 — the refusal throws
It MUST NOT filter the label out and report success.

## REQ-528-5 — transport failures do not throw
`{ number: null, url: null, error }`, matching `mrCreate`.

## REQ-528-6 — no fabricated number
An unparseable URL MUST yield `number: null`.

## REQ-528-7 — the consumer verb closes the loop
`brain:ticket:new` creates and then names the human approval step, by its RESOLVED label.
