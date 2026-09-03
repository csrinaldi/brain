# Proposal: #323 S5 — scope is contract, termination is observable

Tier `lite`, off `main @ 5fb0343`. **Authority**: the maintainer's reframing
on #752 ("the unit was never the problem — the CONTRACT was"; scope ≠ plan),
#713's suggested direction (a surface, not a check; through the VCS adapter),
and the two rulings of 02/09: stranded = `feature/*` trackers, REPORTED;
S5 = contract + guard + surface, the reviewer's consumption follows behind
its own ticket.

## Decisions

- **D1 — `brain-slice-scope/1`**: a fenced JSON block in `tasks.md` (the
  house contract pattern), one per slice: `{slice, claims: [REQ ids],
  terminal_pr}` — scope and termination in ONE declaration, separable from
  the plan around it. The reviewer can someday be handed the BLOCKS without
  the file.
- **D2 — the parser lives in the single accessor** (`sdd-layout.mjs`):
  `parseSliceScopes(text)` — JSON only, refusals as sentences; a malformed
  block is refused, an ABSENT block is legal (legacy is grandfathered by
  absence; new-change enforcement rides the follow-up with the reviewer
  wiring, where the demand gains its consumer).
- **D3 — the structure check validates what is declared**: any tasks.md
  carrying blocks must carry VALID ones — repo-wide, no grandfather needed
  because absence passes.
- **D4 — the stranded surface**: `feature/*` branches with commits ahead of
  the default and no open PR carrying them, REPORTED in `brain:status` —
  computed through plain git + the VCS adapter (never a bare gh call).
  Health and silence stop being the same reading.
- **D5 — S5's own tasks.md eats the dogfood**: it carries the first real
  `brain-slice-scope/1` block in the tree.

## Non-goals

The reviewer consuming the scope (follow-up ticket, filed in this change);
refusing on stranded (report only — the ruling); rebase-home flows (#752's
rejected option c); any change to `verdictsAtHead`.
