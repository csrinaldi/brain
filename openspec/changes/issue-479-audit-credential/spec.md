---
status: draft
issue: 479
---

# Spec

## REQ-479-1 — the port resolves the neutral credential
`getVcs()` obtained without an explicit `identity` MUST bind `VCS_TOKEN` when one is
declared. Every verb reached through that port MUST make its calls under it.

## REQ-479-2 — an explicit identity wins
A caller passing `identity` MUST NOT be redirected to the generic credential.

## REQ-479-3 — no credential, no change
With no `VCS_TOKEN` declared, nothing MUST be bound. Ambient resolution is unchanged.

## REQ-479-4 — the fallback is provider-blind
Both providers MUST resolve the same neutral name. No provider may be special-cased.

## REQ-479-5 — the fallback is not a list
It MUST apply to every function export of the provider module, including verbs added later.

## REQ-479-6 — neutral in, provider-specific out
The bound credential MUST reach the wire in the form the provider's tooling consumes
(`GH_TOKEN` on the child env for GitHub). Asserted against the real adapter, not a stub.

## REQ-479-7 — the audit steps declare the credential
Every workflow step that runs `brain-audit.mjs` MUST declare `VCS_TOKEN` in its own `env:`.

## REQ-475-1 — rung 2 is authenticated
`release.yml`'s audit step MUST carry the credential.

## REQ-475-2 — the scope lands with the credential
A workflow declaring a `permissions:` block and running the audit MUST grant
`pull-requests: read` (or write). A credential without the scope MUST be treated as a
violation, not as compliance.

## REQ-475-3 — the guard is shape-independent
The drift guard MUST NOT depend on step key ordering, `run:` style, or whether the step
leads with `name:` or `id:`. A credential named only in a comment MUST NOT satisfy it.

## REQ-475-4 — the guard has teeth
Each condition MUST be proven to fail independently against a non-compliant sample.
