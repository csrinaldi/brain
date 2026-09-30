# vcs-contract.md — the verb count is 29, not 30 (issue #1180)

> **Tier 2 draft. Not yet promoted.** Corrects the count the previous promotion (#1180) wrote. The
> Required-verbs table has 29 rows; `capabilities` is a provider-capability probe documented in
> the separate Phase 3 adapter-status table (see the header of
> `brain/scripts/vcs/verb-contract-drift-guard.test.mjs`), not a base-contract verb.
>
> ```
> npm run brain:promote -- openspec/changes/issue-1180-promote-phase-1-doctrine/brain-drafts/vcs-contract.verb-count.draft.md
> ```

```brain-amendment/1
target: brain/core/methodology/vcs-contract.md
issue: 1180
```

```amend-find
exporting the 30 verbs
```

```amend-replace
exporting the 29 verbs (and the `capabilities` probe)
```
