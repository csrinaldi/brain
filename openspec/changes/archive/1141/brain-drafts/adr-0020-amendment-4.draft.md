# ADR-0020 Amendment 4 — draft (issue #1141)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1141-axes-one-directory-per-axis/brain-drafts/adr-0020-amendment-4.draft.md
> ```
>
> Run it on THIS branch so the citation is right in the same pull request that moves the file.
> The verb renders the plan, waits for the typed word, performs §1c's acts, writes the
> `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them, and stops. **Your commit
> is the signature** (ADR-0028).
>
> **Ordering**: this draft declares Amendment 4, following the already-drafted Amendment 3
> (`adr-0020-amendment-3.draft.md`, still pending in this same directory). Promote Amendment 3
> first — `brain:promote` refuses an Amendment 4 draft against a target that has not yet
> applied Amendment 3 (`amendStatusLine` requires the target to stand at 3 or 4). If Amendment
> 3 lands first under a different number, renumber this draft before promoting.

```brain-amendment/1
target: brain/project/decisions/adr-0020-reviewer-port-verbs-and-two-key-split.md
amendment: 4
issue: 1141
home-summary: the VCS contract suite's bare filename citation is also stale — `vcs.contract.test.mjs` was renamed `contract.test.mjs` and moved to `axes/vcs/`; annotated in place, the verbs, locks and key split are unchanged, #1141
body: ## Amendment 4 — the contract suite's bare filename citation, also stale (issue #1141)
body-end: ### Notes for the promoter
```

```amend-find
`vcs.contract.test.mjs` is what keeps it deliberate
```

```amend-replace
`vcs.contract.test.mjs` (renamed `contract.test.mjs` and moved to `brain/scripts/axes/vcs/`; moved by #1141, see Amendment 4) is what keeps it deliberate
```

## Amendment 4 — the contract suite's bare filename citation, also stale (issue #1141)

**Signed**: DD/MM/YYYY — <Name>

Amendment 3 annotated every backticked `brain/scripts/vcs/providers/...` citation this ADR
made. One more citation names the same contract suite without a directory —
`vcs.contract.test.mjs` — and #1141 renamed the file itself, not only its directory: it is
`brain/scripts/axes/vcs/contract.test.mjs` today, so a reader who greps the old bare name finds
nothing at all, not merely a stale path. Annotated in place under ruling R6 on #961 as amended
(option A) — the maintainer applied the same ruling to #1141's path moves on 2026-09-28. The
four COMMENT-only verbs, the three locks and the reviewActors/approvalActors split are
unchanged.

### Notes for the promoter

Path annotation only. Promote on the #1141 branch, and only after Amendment 3 has landed (see
the ordering note above).
