---
status: applying
issue: 863
---

# Design: #863 — how the ruling lands

## D0 — Tier discipline: drafts, not writes

`brain/core/**` and `brain/project/**` are Tier 2/3. Two anti-patterns forbid an agent writing
them (`ia-escribe-brain-sin-gate`, `ia-promueve-sus-propios-artefactos`); `brain-writes-reviewed`
and CODEOWNERS enforce it at the PR. So this change ships **drafts** under `brain-drafts/`:

| draft | shape | promotion |
|---|---|---|
| `memory-backend-contract.md` | new methodology document | manual copy to `brain/core/methodology/`, HOME entry, AGENTS regen — `brain:promote` has no "new doctrine doc" shape (only new ADR, or in-place amendment) |
| `adr-0002-amendment-1.draft.md` | `brain-amendment/1`, ADR, 3 acts + signed section | `brain:promote` |
| `adr-0004-amendment-1.draft.md` | `brain-amendment/1`, ADR, 2 acts + signed section | `brain:promote` |
| `harness-contract.draft.md` | `brain-amendment/1`, doctrine, 3 acts | `brain:promote` |
| `agent-authorities.draft.md` | `brain-amendment/1`, doctrine, 1 act | `brain:promote` |
| `consolidation-protocol.draft.md` | `brain-amendment/1`, doctrine, 1 act (§3 only; §5 is #862's) | `brain:promote` |

Every amendment draft was run through `planAmendment` (the verb's pure planner) before this
PR: `ok`, every anchor exactly once. The verb itself requires a TTY and a typed word — that is
the maintainer's act, in one sitting, six promotions, one signing commit.

## D1..D6, D2b — the ruling as ratified (2026-09-08)

Recorded in proposal.md; the contract text is their normative form. In one line each:
idempotence = delta under guard, arbitrated by the two-hydrations test, plus a one-time heal;
capture = a producer contract (four declarations), open set, `mem_save` non-durable; write
target = the invoking checkout, never an ephemeral tree; retirement sequenced 2.3 → 3.2 → 2.4;
contract mirrors `vcs-contract.md`; deletion allowed to the adapter only, records never;
amendments to ADR-0002 and ADR-0004 rather than a new ADR.

## D7 — what this PR changes outside drafts

- `openspec/changes/issue-864-memory-2-0/tasks.md`: 0.0 and 1.2 ticked; 2.4 marked *depends
  on 3.2* (D3); 3.2 gets its ticket number; new task **1.2a** — the one-time heal of the three
  pre-guard rows (D1/D5), a slice under this ruling; 2.2 gains the `main`-as-actor note from
  #870.
- Nothing under `brain/`, nothing in code.

## Delivery

Single PR to `main`, `Closes #863`, `Parent: #864`. Then the maintainer's promotion sitting.
