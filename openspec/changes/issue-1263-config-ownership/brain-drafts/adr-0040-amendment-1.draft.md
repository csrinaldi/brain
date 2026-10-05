# ADR-0040 Amendment 1: on GitLab, the owner gate fails closed at `standard` and `regulated` until #1281 (issue #1263)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1263-config-ownership/brain-drafts/adr-0040-amendment-1.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0040-who-defines-the-project-owned-team-config-a-user-layer-and-locked-axes.md
amendment: 1
issue: 1263
home-summary: on GitLab, `team-config-reviewed` cannot pass by approval today — the GitLab adapter's `prReviews` reports no commit for an approval (`commitId: null`), so a current approval cannot be told from a stale one and the gate fails closed; at `standard` and `regulated` every change to `brain.config.json`, the `brain:upgrade` migration rewrites included, is blocked until #1281 accepts GitLab's "reset approvals on push" as current-head evidence; at `lite` it only warns; "on GitLab the gate alone enforces" is annotated in place with this accepted cost, #1263
body: ## Amendment 1 — on GitLab, the owner gate fails closed at `standard` and `regulated` until #1281 (issue #1263)
body-end: ### Notes for the promoter
```

```amend-find
  is never a second hand-kept list. GitLab has no identical equivalent, so on GitLab the gate alone
  enforces.
```

```amend-replace
  is never a second hand-kept list. GitLab has no identical equivalent, so on GitLab the gate alone
  enforces. **[Amended by Amendment 1 (#1263): on GitLab the gate cannot pass by approval today. The
  adapter reports no commit for an approval, so the gate fails closed: at `standard` and `regulated`
  a change to `brain.config.json` is blocked until #1281. See Amendment 1.]**
```

```amend-find
  keep. Brain ships no GitLab CODEOWNERS, and GitLab has no identical equivalent, so on GitLab the
  gate alone enforces.
```

```amend-replace
  keep. Brain ships no GitLab CODEOWNERS, and GitLab has no identical equivalent, so on GitLab the
  gate alone enforces. **[Amended by Amendment 1 (#1263): and today that gate cannot pass by approval
  on GitLab, so at `standard` and `regulated` it blocks every team config change until #1281.]**
```

```amend-find
- **A GitLab CODEOWNERS mirror.** GitLab has no identical equivalent; the gate is the enforcement
  there.
```

```amend-replace
- **A GitLab CODEOWNERS mirror.** GitLab has no identical equivalent; the gate is the enforcement
  there. **[Amended by Amendment 1 (#1263): and that gate cannot pass by approval on GitLab until
  #1281.]**
```

## Amendment 1 — on GitLab, the owner gate fails closed at `standard` and `regulated` until #1281 (issue #1263)

**Signed**: DD/MM/YYYY — <Name>

### What changed

Nothing in the code. This amendment records a cost the ADR did not name.

Section 6, the CODEOWNERS consequence and "What this does NOT close" each say that on GitLab the
gate alone enforces. None of them says that, on GitLab, the gate cannot pass by approval today:

- The GitLab adapter's `prReviews` (`brain/scripts/axes/vcs/adapters/gitlab.mjs`) returns
  `commitId: null` on every entry. GitLab's approvals API says who approved, not on which commit.
- `team-config-reviewed` (`brain/scripts/vcs/team-config-reviewed.mjs`) counts an approval only on
  the current head. An approval with a `null` commit cannot be told from a stale one, so the gate
  fails closed and its reason names the GitLab limitation.
- At `lite` the gate is `detection` and only warns. At `standard` and `regulated` it is required,
  so **every change to `brain.config.json` on a GitLab consumer at those tiers is blocked**. That
  includes the rewrites `brain:upgrade` makes through `config-migrations.mjs`, once committed.
- A GitLab MR pipeline does not re-run when an approval lands, so even a future fix needs the
  pipeline re-run after approving.

Until now this was written only in a comment in `brain/scripts/ci/gitlab-governance.yml`.

### Why

The cold review of the tracker (PR #1296, Opus 5.5 round, head `2b5027ad`) found the ADR
claiming enforcement where the code can only refuse. A reader of ADR-0040 alone would expect a
GitLab owner's approval to satisfy the gate.

### The accepted cost, and its exit

Failing closed is the deliberate choice: passing an approval nobody can tie to the current head
would let a push after approval through unreviewed, which is the stale-approval case the gate
exists to stop. The cost is that a GitLab consumer at `standard` or `regulated` cannot change its
team config through brain's gate until #1281 lands. Brain offers no way through in the meantime.
Any way through is the forge's own control over a failed required job, outside brain.

#1281 (approved) is the exit. It accepts GitLab's project setting "Reset approvals on push" as
evidence that a present approval is on the current head, keeps failing closed when the setting is
off, and names the setting in the reason.

### What this does NOT change

The gate, its tier table, owners read from the base, the founding rule, and GitHub's behaviour,
where `prReviews` reports each review's `commit_id` and the gate passes on a current owner approval.

### Notes for the promoter

Three in-place annotations: section 6's CODEOWNERS bullet, the CODEOWNERS consequence, and the
"A GitLab CODEOWNERS mirror" bullet of "What this does NOT close". ADR-0040 has no amendment today,
so this is number 1. Sources: the cold review of PR #1296, #1281, and the gap comment on the
`team-config-reviewed` job in `brain/scripts/ci/gitlab-governance.yml`.
