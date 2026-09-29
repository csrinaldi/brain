# Amendment draft — `reviewer-protocol.md` names the VCS adapters' new home (issue #1141)

> **Tier 2 draft. Not promoted, and an agent may not promote it.** Run it on THIS branch:
>
> ```
> npm run brain:promote -- openspec/changes/issue-1141-axes-one-directory-per-axis/brain-drafts/reviewer-protocol.paths.draft.md
> ```
>
> Path edits only. #1141 moved `vcs/providers/` to `axes/vcs/adapters/` and
> `vcs.contract.test.mjs` to `axes/vcs/contract.test.mjs`. The three locks, the verbs and the
> COMMENT-only posting are unchanged.

```brain-amendment/1
target: brain/core/methodology/reviewer-protocol.md
issue: 1141
```

```amend-find
(set by the `branchProtect` verb in `providers/github.mjs`). A reviewer running `gh pr review --approve`
```

```amend-replace
(set by the `branchProtect` verb in `axes/vcs/adapters/github.mjs`). A reviewer running `gh pr review --approve`
```

```amend-find
| GitHub | `event: 'COMMENT'` is hardcoded at every call site in `providers/github.mjs` — the initial post (inline and plain) and the retry alike. No call constructs any other event. |
```

```amend-replace
| GitHub | `event: 'COMMENT'` is hardcoded at every call site in `axes/vcs/adapters/github.mjs` — the initial post (inline and plain) and the retry alike. No call constructs any other event. |
```

```amend-find
| GitLab | **stronger** — GitLab's notes API has no review-event concept at all (`providers/gitlab.mjs`). A plain note is posted, and there is no APPROVE state for it to reach (REQ-266-3). |
```

```amend-replace
| GitLab | **stronger** — GitLab's notes API has no review-event concept at all (`axes/vcs/adapters/gitlab.mjs`). A plain note is posted, and there is no APPROVE state for it to reach (REQ-266-3). |
```

```amend-find
(`brain/scripts/vcs/providers/{github,gitlab}.mjs`), each incapable of approving. Normalized
```

```amend-replace
(`brain/scripts/axes/vcs/adapters/{github,gitlab}.mjs`), each incapable of approving. Normalized
```

```amend-find
table. The parameterized contract suite (`providers/vcs.contract.test.mjs`) runs one assertion
```

```amend-replace
table. The parameterized contract suite (`axes/vcs/contract.test.mjs`) runs one assertion
```
