# Amendment draft: `harness-contract.md`, the dead ADR reference and who archives (issue #557, tasks 9.3 and 9.4)

> **Tier 2 draft. Not yet promoted.** `harness-contract.md` is one of the five `SOURCE_DOCS`
> compiled into `AGENTS.md`. The maintainer promotes it:
>
> ```
> npm run brain:promote -- openspec/changes/issue-557-openspec-archive-sweep/brain-drafts/harness-contract.draft.md
> ```
>
> Promotion regenerates and stages `AGENTS.md`.

```brain-amendment/1
target: brain/core/methodology/harness-contract.md
issue: 557
```

## Edit 1 (task 9.3): the dead "Referenced by ADR-0002" (`harness-contract.md:6`)

ADR-0002 is now `adr-0002-memoria-git-based-dos-capas.md` (team memory) and has nothing to do
with this file. ADR-0005 owns it: its decision names `brain/core/methodology/harness-contract.md`
as the harness's "Verb contract". ADR-0001 is the layering context.

**Deviation from design D9, on purpose.** D9 prescribes relative Markdown links
(`../../project/decisions/adr-000N-….md`). `brain/core/**` ships to every consumer as
`STRATEGY.COPY` (`brain/core/managed-paths.mjs`), but `brain/project/**` belongs to the
consumer. In a consumer those links would be dead, which is the defect this task fixes.
`workflow-governance.md:3` already states the convention: *"Core docs reference project ADRs by
name, not by path."* No core doc links into `brain/project/` today. This edit follows that
convention.

```amend-find
> to be compatible with this project. Referenced by ADR-0002.
```

```amend-replace
> to be compatible with this project. Referenced in the brain project by ADR-0005 (harness
> adapter: `SDD_HARNESS` selector + verb contract, which names this file as its contract) and
> ADR-0001 (3-layer architecture with replaceable harness). Core docs reference project ADRs by
> name, not by path, because `brain/project/**` is consumer-owned.
```

## Edit 2 (task 9.4): "human-optional, machine-guaranteed", after the optional-verbs table

`/sdd-archive` stays in "Optional verbs (recommended)". Design D9: moving the row is the first
step toward reading the verb as required, and the ruling rejects that. The table's placement
was never the problem. "Optional" said nothing about who does archive, and this callout says it.

**The location moved since design D9 was written.** D9 cites `harness-contract.md:43-50`. The
worktree-default amendment (#782) added text above the table, which now sits at `:57-67`. The
anchor is the table's last row (`/mr-create`), so the callout lands directly after the table as
D9 intends, whatever the line numbers are.

**Also a deviation from D9's wording, on purpose.** D9's callout says archiving is guaranteed
by `.github/workflows/governance-postmerge.yml` without qualification. The GitLab governance
fragment (`brain/scripts/ci/gitlab-governance.yml`) has no sweep step, and this file ships to
GitLab consumers too. The callout scopes the guarantee to the provider that has it.

```amend-find
| `/mr-create` | Opens a PR/MR linked to an issue. Provider-specific skill. |
```

```amend-replace
| `/mr-create` | Opens a PR/MR linked to an issue. Provider-specific skill. |

> **`/sdd-archive` is human-optional, machine-guaranteed.** No human is required to run it, and no
> gate fails because a change is unarchived: staleness is never an audit failure class. On GitHub,
> the machine does the archiving. After every clean post-merge audit,
> `.github/workflows/governance-postmerge.yml` sweeps changes whose issue is CLOSED into
> `openspec/changes/archive/` through one `auto-archive/<date>` PR. "Optional" here means "not your
> job", not "nobody's job"; running it by hand only makes the next sweep a no-op. The GitLab
> governance fragment has no sweep step yet, so on GitLab archiving is still a manual act.
```

### Notes for the promoter

Two edits, two `amend-find`/`amend-replace` pairs. The anchors were copied verbatim from
`brain/core/methodology/harness-contract.md` at `origin/feature/issue-557-archive-sweep`
(`0367a32d`), and each occurs exactly once (`assessEdit` → `free === 1`). There is no
`brain/HOME.md` act, because the target is not an ADR. `AGENTS.md` is regenerated because this is a
`SOURCE_DOCS` file.
