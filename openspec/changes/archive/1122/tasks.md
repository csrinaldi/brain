---
status: draft
issue: 1122
---

# Tasks: ADR-0036, the fresh-consumer definition of done

## Phase 1: draft (agent)

- [x] 1.1 Read #1122, #1121 and #1081's exit comment; confirm every cited issue with `gh issue view`
- [x] 1.2 Confirm `0036` is free in `brain/project/decisions/` and `brain/HOME.md` on `origin/main`
- [x] 1.3 Write `brain-drafts/adr-0036-a-change-is-done-when-it-works-on-a-fresh-consumer-install.md`
- [x] 1.4 Run the promote planner functions on the draft: transform, `HOME.md` insertion, content guards
- [x] 1.5 `npm run brain:repo:check` passes

## Phase 2: signature (maintainer)

- [ ] 2.1 `npm run brain:promote -- openspec/changes/issue-1122-fresh-consumer-done/brain-drafts/adr-0036-a-change-is-done-when-it-works-on-a-fresh-consumer-install.md`, type `PROMOTE`, run the printed commit
- [ ] 2.2 Open the PR (`Closes #1122`); `decision-gate` sees the added ADR and the `brain/HOME.md` line together
- [ ] 2.3 Cite ADR-0036 from #1136
