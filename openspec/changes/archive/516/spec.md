---
status: draft
issue: 516
---

# Spec

## REQ-516-1 — no doctrine statement claims co-occurrence for a MODIFIED ADR
No file under `brain/**` may state or imply that `decision-gate` fails an amendment whose
`brain/HOME.md` marker is missing.

## REQ-516-2 — the added-direction claim stays stated
The correction MUST NOT weaken the two rules that ARE enforced: an **added** ADR requires a
`brain/HOME.md` change, and a `brain/HOME.md` change requires some ADR to be touched.

## REQ-516-3 — no doctrine statement claims a label-conditional gate or a step-2 heuristic
`decision-gate` reads no labels and scans no architectural surfaces. Doctrine describing either
MUST say that it is not implemented.

## REQ-516-4 — ADR-0026's divergence note describes the shipped check
The note MUST be accurate about the added/modified half and MUST keep the label half recorded
as open. It MUST NOT be retired wholesale.

## REQ-516-5 — the absence of a net is stated where the decision is made
§1c MUST say plainly that nothing enforces the amendment marker, at the point a human decides
whether the step is skippable.

## REQ-516-6 — the claims are pinned against the code
A test MUST fail if `decision-gate` becomes label-conditional or gains the surface heuristic,
and its failure MUST name the doctrine files that then have to change.

## REQ-516-7 — Tier 2
Every `brain/**` edit ships as a draft under `brain-drafts/`. The human's commit is the
signature. The promotion MUST carry the full §1d cascade, `AGENTS.md` regeneration included.

## REQ-516-8 — the gate itself does not change
No change to `adrPresence` or to any enforcement surface. Option (2) is refused; option (3) is
scoped to #509.
