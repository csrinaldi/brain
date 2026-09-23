---
status: draft
issue: 599
---

# Proposal — adr-0023-citation-gap (issue 599)

## What

Reword the two `docs/inbox/**` lines that cite `ADR-0023` so they name the
unpromoted draft and the ticket that will produce the ADR, and delete the two
`KNOWN_GAPS` entries that exempt them.

## Why

A reader who follows `ADR-0023` lands on nothing. `brain/project/decisions/`
runs `adr-0022-reviewer-port-base.md` → *(no 0023)* → `adr-0024-…`, and the
citations sit at `docs/inbox/MASTER-PLAN-1.0.md:72`, `:93` and
`docs/inbox/brain-v2-epic-plan.md:114`. The prose is already honest — both call
it a draft — but the pointer is bare, so the citation check must exempt it.

## The decision taken — measured, then acted

#599 orders measurement before writing. **Verdict: the SDD role port does not
exist in the tree.** `roles/` is absent, no role-parity contract test exists,
`brain/scripts/harness/cli.mjs:99` still declares `VALID_OPS = ['init']`, and
`backends/gentle-ai.mjs` carries no `model_tier`/`reads`/`writes` surface.
Nothing the draft at `brain-drafts/adr-0023-sdd-role-port.md` proposes has
shipped.

So **branch (2): reword. No ADR is written here.** #590's "write it from the
code" pattern is unavailable — there is no code to write it from, and an ADR
authored ahead of the mechanism records a decision nobody made.

**0023 is NOT a permanent gap.** The number stays **RESERVED for #312**, the
role-port ticket: the ADR gets written from shipped code and promoted when #312
lands. The reworded lines must say exactly that.

## Scope

- **In:** `docs/inbox/MASTER-PLAN-1.0.md` (2 lines), `docs/inbox/brain-v2-epic-plan.md`
  (1 line, Spanish — keep it Spanish), `test/adr-citation-resolves.e2e.test.mjs`
  (delete both `KNOWN_GAPS` entries, lines 145–150).
- **Out:** writing or promoting any ADR; `brain-drafts/adr-0023-sdd-role-port.md`
  (untouched); `.gitlab-ci.yml:1` (separate defect, separate ticket); #312's
  scope; any other `brain/` source.

## Capabilities

- **New:** None. **Modified:** None. Doc rewording plus a registry deletion — no
  spec-level behaviour changes.

## Acceptance criterion

`npm test` green over the tree with both `KNOWN_GAPS` entries gone. The suite's
`CITATION_RE` is `/ADR-(\d{4})(?!\d)/g` and **case-sensitive**, so the reworded
lines must either stop carrying the uppercase `ADR-0023` token or resolve for
real. Exact wording is design's call.

## Coupling — a design constraint, stated

The reword and the two deletions **must land in the same change**. Leave the
entries and `no registry entry outlives the citation it exempts` (line 334)
reddens in the opposite direction; delete them early and `every cited ADR-NNNN
resolves` reddens. Both lines in `MASTER-PLAN-1.0.md` must be reworded — one
`KNOWN_GAPS` entry covers a `(file, number)` pair, not a line.

## Risks & rollback

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Reword still matches `CITATION_RE` | Med | Acceptance criterion above; `npm test` is the gate |
| Only one of the two `MASTER-PLAN` lines reworded | Med | Coupling section names it explicitly |

`docs/**` is **not** in `brain.config.json` `governance.ignoreList`, so those
lines count toward the 400-line budget; `**/*.test.mjs` is ignored, so the test
edit does not. Total well under budget — single PR, no chain.

**Rollback:** `git revert` the single commit. Three files, no migration, no
generated state.
