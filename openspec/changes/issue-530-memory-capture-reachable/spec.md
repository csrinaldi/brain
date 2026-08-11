---
status: draft
issue: 530
---

# Spec

## REQ-530-1 — capture is exposed as a managed verb
`memory:save` MUST exist and MUST pin a backend that works without engram.

## REQ-530-2 — a derivable field is derived
`project` MUST be resolved from config (slug → name → directory) when not given, and MUST never
resolve to `undefined` or the empty string. An explicit value MUST win.

## REQ-530-3 — a choice is refused, never defaulted
`type` MUST be refused when absent, naming the flag and listing the valid values. It MUST NOT
acquire a default.

## REQ-530-4 — refusals name the flag, not the serializer
No capture failure may surface as an internal serializer message (`canonicalJson`, `non-finite`).

## REQ-530-5 — records can be tied to their ticket
`--issue` MUST be accepted, stored as an integer, and MUST be optional. A non-integer MUST be
refused by name.

## REQ-530-6 — the engram refusal points somewhere that exists
Its message MUST name the records-only route and the verb that reaches it, in every locale.

## REQ-530-7 — the CLI layer is covered
The parser MUST be exercised end to end, not only the backend function beneath it.

## REQ-530-8 — proven by a fresh record
The session MUST be materialised through the shipped verb, not through a script calling
`appendRecord`.
