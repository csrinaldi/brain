# vcs-contract.md — `prReviews` carries `commitId` (issue #1263, slice 4)

> **status:** Tier 2 draft. Not yet promoted. `vcs-contract.md` is a signed `brain/core/**`
> artefact, so an agent may not commit it — `brain/core/anti-patterns/ia-escribe-brain-sin-gate.md`.
>
> ```
> npm run brain:promote -- openspec/changes/issue-1263-config-ownership/brain-drafts/vcs-contract-prreviews-commitid.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/core/methodology/vcs-contract.md
issue: 1263
body: ## prReviews commitId (issue #1263)
body-end: ### Notes for the promoter
```

```amend-find
({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<Array<{ state, author, body }>\|null>` | Provider-agnostic PR/MR review read
```

```amend-replace
({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<Array<{ state, author, body, commitId }>\|null>` | Provider-agnostic PR/MR review read
```

```amend-find
a genuinely empty thread is `[]`, not `null`. |
```

```amend-replace
a genuinely empty thread is `[]`, not `null`. Additive `commitId` (issue #1263 S4, the #930/#1199 pattern): the head commit the review was submitted against, so a gate can tell a CURRENT approval from a stale one. GH: the Reviews API's `commit_id`, `null` if absent. GL: always `null` — neither the notes nor the approvals endpoint says which commit an approval was against; a caller that needs a current approval (`team-config-reviewed`) treats `null` as "cannot verify" and fails closed, never as current. Pre-existing consumers ignore the field. |
```

## prReviews commitId (issue #1263)

**Signed**: DD/MM/YYYY — <Name>

### What changed

The `prReviews` row gains an additive `commitId` per entry: GitHub's `commit_id`, `null` on GitLab.

### Why

`team-config-reviewed` (ADR-0040) needs an owner's approval on the CURRENT head. The adapters dropped
`commit_id` and `branchProtect` sets no `dismiss_stale_reviews`, so an approval of an innocuous edit
survived a later commit that rewrote `brain.config.json`.

### What this does NOT close, said plainly

GitLab cannot say which commit an approval was against, so there the gate fails closed at
`standard`/`regulated` rather than guessing.

### Notes for the promoter

Two `amend-find`/`amend-replace` pairs on the `prReviews` row, each anchor occurring once in the
target. Not an ADR: no `brain/HOME.md` marker and no amendment number.
