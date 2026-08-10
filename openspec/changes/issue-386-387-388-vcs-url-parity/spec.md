---
status: draft
issue: 388
---

# Spec

## REQ-386-1 — no URL carries a literal "undefined" host
Both providers MUST default a falsy `host` to their own public host.

## REQ-387-1 — `patSetupUrl` is host-driven on both providers
A supplied `host` MUST appear in the URL. A falsy one MUST still yield the public default —
the fix adds a default, it does not start demanding a host.

## REQ-388-1 — interpolated values are percent-encoded
A `name` containing `&` or a space MUST survive the round trip whole, and MUST NOT introduce a
second query parameter.

## REQ-388-2 — the scope separator is not data
The comma joining scopes MUST reach the provider literal; each scope MUST be encoded
individually.

## REQ-388-3 — a project slug keeps its separators
Path segments MUST be encoded individually; `/` MUST NOT become `%2F`.
