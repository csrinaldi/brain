# brain-drafts — issue #557 phase 9 (PR4, doctrine)

Promote-ready drafts. An agent drafted them and the maintainer signs them. Each `brain/**` draft is
promoted with `npm run brain:promote`, which renders the draft, shows the plan, asks for the
typed word `PROMOTE`, writes and stages the cascade (including `AGENTS.md`), and stops. The
signature is the human's own `git commit`.

| Draft | Target | Shape | Order |
|---|---|---|---|
| `adr-0035-archive-sweep-issue-link-exemption-is-content-earned.md` | `brain/project/decisions/` (new file) + `brain/HOME.md` index line + `AGENTS.md` | new ADR | 1 |
| `workflow-governance-invariant-1.draft.md` | `brain/core/methodology/workflow-governance.md` (3 edits) + `AGENTS.md` | amendment (`brain-amendment/1`) | 2 (cites ADR-0035) |
| `harness-contract.draft.md` | `brain/core/methodology/harness-contract.md` (2 edits, tasks 9.3 + 9.4) + `AGENTS.md` | amendment (`brain-amendment/1`) | 3 |
| `openspec-readme.patch` | `openspec/README.md` (tasks 9.1 + 9.2) | `git apply`: not under `brain/**`, so `brain:promote` does not handle it | 4 |

**Commit after each promote, before running the next one.** Every run stages `AGENTS.md`, and
`brain:promote` refuses to write a path that already has staged changes
(`brain/scripts/brain-promote.mjs#checkWritePreconditions`, "STAGED changes this run would destroy").

## Commands

From the worktree, on `feat/issue-557-s4-doctrine`:

```bash
npm run brain:promote -- openspec/changes/issue-557-openspec-archive-sweep/brain-drafts/adr-0035-archive-sweep-issue-link-exemption-is-content-earned.md
#   type PROMOTE, then run the `git commit` it prints

npm run brain:promote -- openspec/changes/issue-557-openspec-archive-sweep/brain-drafts/workflow-governance-invariant-1.draft.md
#   type PROMOTE, then run the `git commit` it prints

npm run brain:promote -- openspec/changes/issue-557-openspec-archive-sweep/brain-drafts/harness-contract.draft.md
#   type PROMOTE, then run the `git commit` it prints

git apply openspec/changes/issue-557-openspec-archive-sweep/brain-drafts/openspec-readme.patch
git add openspec/README.md
git commit -m 'docs(openspec): fix the dead ADR link and state that closed changes archive automatically (#557)'
```

## Deliberate deviations from design D9

- **harness-contract.md edit 1 names ADRs, it does not link them.** `brain/core/**` ships to
  consumers as `STRATEGY.COPY`, and `brain/project/**` is theirs. D9's relative links would be
  dead links in every consumer, and `workflow-governance.md:3` already sets the rule: core docs
  reference project ADRs by name, not by path.
- **harness-contract.md edit 2 scopes "machine-guaranteed" to GitHub.**
  `brain/scripts/ci/gitlab-governance.yml` has no sweep step.
- **The callout's anchor is the table's last row, not `:43-50`.** The table moved to `:57-67`
  after #782's worktree-default amendment.
- `openspec/README.md` does not ship to consumers, so D9's relative link there is correct as
  written.

## Finding carried into ADR-0035

`classifySweepDiff` also accepts an **added** file anywhere under `openspec/changes/archive/*/`
(the `status === 'A'` branch). `archive-sweep.mjs`'s header does not state this and no test pins
it. ADR-0035 records the predicate as it actually runs and names this as residual risk 2, with
the follow-up that closes it.
