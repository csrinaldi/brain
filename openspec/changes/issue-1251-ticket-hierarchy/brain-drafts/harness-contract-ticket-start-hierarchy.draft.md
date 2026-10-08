# harness-contract.md — `brain:ticket:start` under a declared hierarchy, and a `brain:gc` row (issue #1251)

> **Tier 2 target. Not promoted, and an agent may not promote it.** Changes to this document
> require an MR reviewed by `@crinaldi`. Promote it after ADR-0039, which decides what it records.
>
> ```
> npm run brain:promote -- openspec/changes/issue-1251-ticket-hierarchy/brain-drafts/harness-contract-ticket-start-hierarchy.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/core/methodology/harness-contract.md
issue: 1251
body: ## `ticket:start` under a declared hierarchy (issue #1251)
body-end: ### Notes for the promoter
```

```amend-find
`<tracker>` is the integration base (e.g. `feature/v2.0.0`), not `main`, while an epic is in flight. |
```

```amend-replace
`<tracker>` is the integration base (e.g. `feature/v2.0.0`), not `main`, while an epic is in flight. **[amended, #1251, ADR-0039: this row is the implicit model, unchanged for a repository without `vcs.hierarchy`. With a declared hierarchy the branch is hierarchical (`release-1300/epic-878/issue-56-slug`), the base is the nearest integrating ancestor's tracker, and a missing tracker chain is proposed under one confirmation. On either model a parentless issue, a `hotfix` included, starts from `main`. See "`ticket:start` under a declared hierarchy".]** |
```

```amend-find
| `npm run brain:day:start` | `day:start` | — | Daily startup: VCS auth, ecosystem updates, team memory, ticket board. |
```

```amend-replace
| `npm run brain:day:start` | `day:start` | — | Daily startup: VCS auth, ecosystem updates, team memory, ticket board. **[amended, #1251, ADR-0039: also reports pending hierarchy items and offers to run `brain:gc` interactively; it performs none of `brain:gc`'s acts itself.]** |
| `npm run brain:gc` | — | — | **[added, #1251, ADR-0039 decision 12]** The hierarchy sweep, one pass under the user's credentials: closes merged-but-open nodes that qualify for the direct close, proposes remainder PRs, deletes trackers with no commits their target lacks, regenerates stale generated children regions. Tier 2 acts ask first; without a TTY or under CI it only reports. `brain:doctor` (#1130) absorbs it later. |
```

```amend-find
resolves the active change and ticket memory, reports memory recency. Read-only, local-only, no network. |
```

```amend-replace
resolves the active change and ticket memory, reports memory recency. Read-only, local-only, no network. **[amended, #1251, ADR-0039: it may show a cached count of pending hierarchy items, for example "3 hierarchy items pending — run `npm run brain:gc`", read from a local cache; it never sweeps and never calls the forge.]** |
```

## `ticket:start` under a declared hierarchy (issue #1251)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0039 makes the ticket hierarchy declared data. The `brain:ticket:start` row now describes two
models.

**Without `vcs.hierarchy`, the implicit model (ruling N1, 2026-10-07).** The row stands as it is:
`{type}/issue-{number}-{slug}` branches, a hand-made `feature/…` tracker one hop up, read from the
epic's `tracker:`. That grammar is never retired for such a repository (ruling N2).

**With `vcs.hierarchy` declared:**

- **The branch is hierarchical.** Each ancestor that declares a `branch` pattern contributes a
  segment from its issue number, and the ticket's own segment is the leaf:
  `release-1300/epic-878/issue-56-slug`. The change type comes only from the `type:*` label.
- **The base is the nearest integrating ancestor's tracker** (`release-1300/epic-878/tracker`),
  resolved through the hierarchy resolver, not one hop to a `kind: epic` parent.
- **A missing tracker chain is proposed under one confirmation** (ruling Q1). The verb prints
  every branch it will push and every draft PR it will open, top-down, and does nothing remote on
  "no". Pushing and opening PRs stay Tier 2.

**On either model, a parentless issue starts from `main`** (rulings C2 and C3). A hotfix is such
an issue, labelled `hotfix`, and needs no flag. `--off-tracker` is unchanged.

The isolated worktree is still the default, and `--in-place` is still the opt-out (#782).

**`brain:gc`, `day:start` and `session:start`** (ADR-0039 decision 12, rulings T1 and T1-gc,
2026-10-07). When a provider cannot automate one of the hierarchy's post-merge acts, control
degrades to a new verb, `brain:gc`, which sweeps the hierarchy in one pass at each act's tier.
`day:start` reports what is pending and offers it. `session:start` keeps its row's contract,
read-only, local-only, no network: it shows only a cached pending count.

### What this does NOT change

The verb's name, the worktree default, the `type:*` label requirement (#1206), and the implicit
model's behaviour.

### Notes for the promoter

Four in-place edits: annotations on the `brain:day:start`, `brain:session:start` and
`brain:ticket:start` rows, and a new `brain:gc` row after `brain:day:start`; plus this section.
