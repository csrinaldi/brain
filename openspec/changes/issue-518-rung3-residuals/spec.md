---
status: draft
issue: 518
---

# Spec

## REQ-518-1 — the printed remedy runs
The command the audit prints MUST pass argument parsing and both 40-hex validations. Proven
by EXECUTING the extracted string, never by asserting its text.

## REQ-518-2 — `<from>` is the window base
The offending merge MUST NOT occupy the `<from>` slot; `from` is the cursor value the human
asserts. The line MUST say that accepting covers the whole audited window.

## REQ-518-3 — no fabricated base
When the range names no base, the command MUST be visibly a placeholder and MUST point at
`cursor.mjs window` for the real values.

## REQ-518-4 — the postmerge workflow is dispatchable
`workflow_dispatch` MUST be present, and MUST NOT accept a range input.

## REQ-518-5 — the squash blind spot is not silently closed
Out of scope here; #518 stays open.
