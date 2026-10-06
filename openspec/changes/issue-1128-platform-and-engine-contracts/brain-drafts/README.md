# brain-drafts for #1128 + #1129: the agent-platform and review-engine contracts

Ruling 7 (2026-10-06) sends the doctrine through drafts that the maintainer promotes. An agent may
not promote any of them. **The promoter's commit is the signature** (ADR-0028).

Promote them **after the #1128/#1129 PR merges**, so that the doctrine never describes code `main`
lacks. All five drafts go in ONE promotion PR, for the reason below.

## Two shapes

- **New methodology documents** (`agent-platform-contract.md`, `review-engine-contract.md`).
  `brain:promote` has no shape for a new non-ADR document (`brain-promote.mjs:149-153`: only
  `adr-NNNN-slug.md` is a new file, and every other draft must carry a `brain-amendment/1` block). The
  precedent is #863's `memory-backend-contract.md`: copy the file by hand, delete its "Promotion note"
  blockquote, add the `brain/HOME.md` Methodology entry, and sign with the commit.
- **In-place amendments** (`*.draft.md`, `brain-amendment/1`): `npm run brain:promote -- <path>`,
  which runs `planAmendment()` before it writes anything.

## Why one PR: `decision-gate`

`decision-gate` fails a PR whose diff touches `brain/HOME.md` but no ADR path (invariant 4,
`workflow-governance.md`). The two new documents' HOME entries would fail it on their own. Together
with the ADR-0038 amendment, which touches an ADR and `brain/HOME.md`, they pass.

## Promotion order

| # | Draft | Target | How | Why here |
|---|---|---|---|---|
| 1 | `review-engine-contract.md` | `brain/core/methodology/review-engine-contract.md` (new) | copy, remove the promotion note, add the HOME Methodology line after `vcs-contract.md` | the engine half; drafts 3 and 5 cite it |
| 2 | `agent-platform-contract.md` | `brain/core/methodology/agent-platform-contract.md` (new) | same | the platform half; drafts 3 and 4 cite it |
| 3 | `adr-0038-amendment-2.draft.md` | ADR-0038 Amendment 2 | `brain:promote` | the vocabulary §5 delegated; regenerates `AGENTS.md`, picking up the HOME lines from 1-2 |
| 4 | `adr-0024-amendment-6.draft.md` | ADR-0024 Amendment 6 | `brain:promote` | cites ADR-0038 Amendment 2 |
| 5 | `adr-0033-amendment-4.draft.md` | ADR-0033 Amendment 4 | `brain:promote` | cites ADR-0038 Amendment 2 and the engine contract |

No two drafts share a target file, so no anchor can conflict across drafts. Steps 3-5 each add their
own `brain/HOME.md` marker. ADR-0023 is not amended: role projection is not a platform verb yet
(ruling 3).

If a target ADR gains an amendment before its draft is promoted, `brain:promote` refuses the stale
number. Renumber the draft and its in-place `Amendment N` brackets.

## Checked

`planAmendment({ draftText, targetText, homeText, gitUserName, today: '2026-10-06' })` against
`main` at `4b847561` (`brain/HOME.md` as on `main`):

| draft | ok | acts |
|---|---|---|
| `adr-0038-amendment-2.draft.md` | `true` | status 1, 4 in-place edits, body, HOME marker: all `pending` |
| `adr-0024-amendment-6.draft.md` | `true` | status 1, 4 in-place edits, body, HOME marker: all `pending` |
| `adr-0033-amendment-4.draft.md` | `true` | status 1, 3 in-place edits, body, HOME marker: all `pending` |

The ADR-0038 number is **2**. `main` carries Amendment 1 only. The same draft numbered 3 is refused:
"the target stands at Amendment 1 — expected 2". Re-run before promoting (tasks 4.8).

Re-run at apply time (tasks 4.8), `origin/main` at `b3c5c3d2`: all three drafts `ok: true`, numbering unchanged
(ADR-0038 stands at Amendment 1, ADR-0024 at 5, ADR-0033 at 3). `agent-platform-contract.md` now names #1367 as
the owner of the two re-owned guard entries, and documents the descriptor's optional `rank`.
