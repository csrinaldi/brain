# agent-authorities.md — the hierarchy close workflow is an automation act, not an agent act (issue #1251)

> **Tier 2 target. Not promoted, and an agent may not promote it.** Changes to this document
> require an MR reviewed by `@crinaldi`. Promote it after ADR-0039, which it cites.
>
> ```
> npm run brain:promote -- openspec/changes/issue-1251-ticket-hierarchy/brain-drafts/agent-authorities-hierarchy-close.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/core/methodology/agent-authorities.md
issue: 1251
body: ## Hierarchy close workflow (issue #1251)
body-end: ### Notes for the promoter
```

```amend-find
- **Delete branches or committed files** — irreversible destructive actions
```

```amend-replace
- **Delete branches or committed files** — irreversible destructive actions **[amended, #1251: the hierarchy close workflow's deletion of a merged tracker branch is an automation act, not an agent act; see "Hierarchy close workflow"]**
```

## Hierarchy close workflow (issue #1251)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0039 (ruling C5, 2026-10-07) closes a node's issue when its integration PR merges into its
parent's target, a tracker or `main`. When an epic's tracker merges, its tracker branch is deleted.
When a milestone's tracker merges into `main`, its tracker branch is deleted and the native
milestone mirror is closed. In the same step it rewrites the parent's generated children region in
the issue body (ruling N5), through the proven region writer that touches nothing outside the
region's markers. The same workflow marks a draft integration PR ready when every child of its node
is closed (ruling C10). When an integration PR merged before its node was Ready to close, it closes
nothing and deletes nothing, and reports the node as merged but open (ruling N4).

These are **automation acts**. A forge CI workflow runs them on `pull_request` `closed` with
`merged == true`, as the automation identity (`GITHUB_TOKEN` with `issues: write` and
`contents: write` on GitHub; a project access token in a CI variable on GitLab, because
`CI_JOB_TOKEN` cannot write issues). They run at every tier and report what they did. No agent
runs them, and no agent gains a verb from this section:

- an agent still may not delete a branch without confirmation (Tier 2);
- marking a PR ready is not merging, and the merge still follows ADR-0037's autonomy mode;
- the workflow writes issue state, the children region of an issue body, branches and PR state,
  never `brain.config.json` and never any other part of an issue body.

### Why

A forge merge happens on the server. A git `post-merge` hook is client-side and never fires on it,
and an agent is not present at merge time to ask for confirmation. Without a server-side step, a
child merged into a tracker stays open, because closing keywords act only on merges into the
default branch, and every rollup above it is wrong.

### What this does NOT close, said plainly

- **Nothing enforces that only the workflow does this.** The row describes who runs the acts; it is
  doctrine until the workflow exists.
- **A run that does not happen is caught late.** A fork PR's read-only token, a missing GitLab
  variable or an outage leaves the issue open. `day:start`, under the user's credentials, lists
  every PR merged into a tracker whose issue is still open; it reports, it does not close. It also
  regenerates stale children regions (ruling N5). Whether that write is Tier 1 for an agent that
  runs `day:start` is an open question on ADR-0039, and this section does not decide it.

### Notes for the promoter

One in-place annotation, Tier 2's delete-branches row, plus this section.
