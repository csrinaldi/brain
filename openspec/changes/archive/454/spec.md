---
status: draft
issue: 454
---

# Spec — governance.agentActors

## REQ-454-1 — a registered agent identity does not re-arm
A commit authored by an identity in `governance.agentActors` MUST NOT count as foreign for
`lite`'s distinct-act evidence.

## REQ-454-2 — absent by default, byte-identical behaviour
With the key absent, behaviour MUST be identical to pre-#454. The key MUST NOT be added to
`config-migrations.mjs`: a gate is never weakened by upgrade.

## REQ-454-3 — unresolvable authorship stays foreign
An author the provider cannot resolve MUST remain foreign regardless of what is declared.

## REQ-454-4 — the exemption narrows the foreign set, never empties it
A third-party commit MUST still re-arm even when an agent identity is exempt in the same list.

## REQ-454-5 — the reader is threaded
`gatherActorCheckInputs` MUST read the key and thread it. A reader that is never threaded is
a reader that does nothing in production (#367's defect class).

## REQ-454-6 — the SHIPPED reader defaults to []
The real reader — not only an injected one — MUST return `[]` for a config without the key.

## REQ-454-7 — §9 unchanged
An agent identity MUST still be refused permission to APPLY the approved label. Exemption
from re-arming and permission to approve are different powers.

## REQ-454-8 — no vendor name in the governance decision path
No declared agent identity may appear under `brain/scripts/vcs/**` or
`brain/scripts/governance/**`. The guard MUST derive what it forbids from the config, so it
names no platform itself. Adapters are exempt by scope: naming a platform is what an adapter
is for.

## REQ-454-9 — the two keys name disjoint identities
`agentActors` and `reviewActors` MUST NOT overlap in the shipped config — conflating the
roles makes the refusal messages describe a role the identity does not have.
