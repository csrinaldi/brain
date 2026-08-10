---
status: draft
issue: 480
---

# Spec

## REQ-480-1 — the ten shapes
A1–A7 MUST be caught. A9 MUST NOT be flagged. No spelling of a command may change the
verdict.

## REQ-480-2 — the requirement is derived from the invoked code
Whether a step needs a credential MUST be decided from the import closure of the entry
point it invokes, not from a pattern in the workflow text.

## REQ-480-3 — undecidable is a violation
An entry point that cannot be resolved, or a script that does not exist, MUST be reported.
An empty violation list MUST never be the answer to input the guard could not read.

## REQ-480-4 — unrecognised commands read as reaching
A command absent from the inert list MUST be treated as reaching the server.

## REQ-480-5 — the guard stays usable
A step made only of inert commands MUST NOT be flagged, and a credential named only in a
shell comment MUST NOT satisfy the rule while a shell comment mentioning a provider CLI
MUST NOT trip it.

## REQ-480-6 — the credential is matched by key
Any expression MAY fill it. Pinning an expression form is forbidden.

## REQ-480-7 — style does not change the verdict
Key order, `run:` scalar style, and whether the step leads with `name:`, `id:`, `uses:` or
`run:` MUST NOT affect the answer.

## REQ-480-8 — every audit workflow, not one
The guard MUST cover every workflow that runs `brain-audit.mjs`.

## REQ-480-9 — the scope condition
A workflow declaring a `permissions:` block and reaching the server MUST grant
`pull-requests` read. A credential without the scope MUST be a violation.

## REQ-480-10 — one implementation
The rule MUST exist once and be imported by its consumers.

## REQ-480-11 — limitations are asserted, not denied
Known blind spots (an inherited job-level `env:`, multiplexer entry points) MUST be recorded
by test or comment stating what is true, never by a rationale that is false.
