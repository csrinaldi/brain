---
status: draft
issue: 1123
---

# Proposal: autonomy is configurable, modes A, B and C

## Problem

The maintainer's goal (#313's VISION, #1121 property 3) is a workflow that is automatic end to
end unless the human intervenes or the product escalates. The doctrine says an agent never
approves or merges its own MR (`agent-authorities.md` Tier 3) and that the human reviews every
MR before merging (Tier 2). The code enforces less than that: `actor-check` is a timestamp
heuristic over the issue's approval, `lite` requires zero approving reviews on the forge, the
VCS port has no merge verb (only `mrAutoMerge`, which arms the forge's auto-merge), and nothing
compares the identity that produced a change with the one that approves or merges it. Neither
the doctrine nor the code describes the configurable model the product needs.

## Intent

Record, as a promote-ready ADR plus the matching amendment to `agent-authorities.md`, the
maintainer's rulings of 2026-09-24 (#1121 ruling 5, #1123):

- three autonomy modes: A (human intent, human merge), B (human intent, platform merge on green
  gates and an independent cold review; the default), C (fully automatic; refused at `regulated`);
- in every mode, the producing identity never approves or merges;
- brain reports the declared mode and the effective mode separately, and never claims B before
  #1133 (`mrMerge`) and #1134 (the identity gate) land.

## Scope

In scope:

- `brain-drafts/adr-0037-autonomy-is-configurable-modes-a-b-c.md` (new ADR).
- `brain-drafts/agent-authorities-tier3.draft.md` (`brain-amendment/1` against
  `brain/core/methodology/agent-authorities.md`: the Tier 3 rule and the Tier 2 merge line).
- This change's `proposal.md`, `spec.md`, `design.md`, `tasks.md`.

Out of scope:

- Any edit under `brain/**`. The maintainer promotes both drafts.
- Code: the merge verb (#1133), the identity gate and the `governance.autonomy` key (#1134),
  distinct identities per agent (#1107), the mode C intent-approver path (no issue yet).

## Success

- Both drafts plan cleanly under `brain:promote`'s own functions.
- `npm run brain:repo:check` passes.
- The maintainer promotes both, and #1133 and #1134 cite ADR-0037 (issue acceptance; after this
  change).

## Risks

- **Doctrine ahead of enforcement.** Until #1133 and #1134 land, B is declared, not effective.
  The ADR states the effective default is A until then.
- **The invariant could forbid today's operation.** Agents push under the maintainer's
  credential and the maintainer merges. The ADR names a `lite`, mode-A-only solo exception and
  flags it for ratification.
- **B read as "no human" at `standard`/`regulated`.** Those tiers keep one required human
  approving review; the ADR says so.
