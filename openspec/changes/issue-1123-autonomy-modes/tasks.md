---
status: draft
issue: 1123
---

# Tasks: ADR-0037 and the Tier 3 amendment

## Phase 1: draft (agent)

- [x] 1.1 Read #1123, #1121, #1107, #1133, #1134; read ADR-0026, ADR-0033, ADR-0034, `vcs-contract.md`, `reviewer-protocol.md`
- [x] 1.2 Confirm `0037` is free in `brain/project/decisions/` and `brain/HOME.md` on `origin/main`
- [x] 1.3 Write `brain-drafts/adr-0037-autonomy-is-configurable-modes-a-b-c.md`
- [x] 1.4 Write `brain-drafts/agent-authorities-tier3.draft.md` with anchors copied from `origin/main`
- [x] 1.5 Run the promote planner functions on both drafts; every anchor free = 1
- [x] 1.6 `npm run brain:repo:check` passes

## Phase 2: signature (maintainer)

- [ ] 2.1 Ratify or amend the ADR's "Requires ratification at promotion" items
- [ ] 2.2 `npm run brain:promote -- openspec/changes/issue-1123-autonomy-modes/brain-drafts/adr-0037-autonomy-is-configurable-modes-a-b-c.md`, type `PROMOTE`, run the printed commit
- [ ] 2.3 `npm run brain:promote -- openspec/changes/issue-1123-autonomy-modes/brain-drafts/agent-authorities-tier3.draft.md`, type `PROMOTE`, run the printed commit
- [ ] 2.4 Open the PR (`Closes #1123`); `decision-gate` sees the added ADR and the `brain/HOME.md` line together
- [ ] 2.5 Cite ADR-0037 from #1133 and #1134; open an issue for mode C's intent-approver path
