# Amendment draft — `vcs-contract.md` names the VCS adapters' new home (issue #1141)

> **Tier 2 draft. Not promoted, and an agent may not promote it.** Run it on THIS branch:
>
> ```
> npm run brain:promote -- openspec/changes/issue-1141-axes-one-directory-per-axis/brain-drafts/vcs-contract.paths.draft.md
> ```
>
> Path edits only. #1141 moved `scripts/vcs/providers/` to `scripts/axes/vcs/adapters/`;
> the dispatcher and every verb are unchanged.

```brain-amendment/1
target: brain/core/methodology/vcs-contract.md
issue: 1141
```

```amend-find
delegates to `scripts/vcs/providers/<provider>.mjs`. Credentials live in `.env`
```

```amend-replace
delegates to `scripts/axes/vcs/adapters/<provider>.mjs`. Credentials live in `.env`
```

```amend-find
Create `scripts/vcs/providers/<name>.mjs` exporting the 21 verbs and add `<name>` as a
```

```amend-replace
Create `scripts/axes/vcs/adapters/<name>.mjs` exporting the 21 verbs and add `<name>` as a
```
