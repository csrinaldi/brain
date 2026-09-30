# vcs-contract.md — labelCreate and workflowRunSucceeded verbs (issue #1180)

> **Tier 2 draft. Not yet promoted.** `vcs-contract.md` is a promoted `brain/core` file, so
> this is an in-place amendment. Converts the two free-form row drafts of #1163 and #1162 into the
> `brain-amendment/1` shape. Row text is verbatim from those drafts. The maintainer promotes it;
> the same commit carries the emptied `PENDING_PROMOTION` in
> `brain/scripts/vcs/verb-contract-drift-guard.test.mjs`:
>
> ```
> npm run brain:promote -- openspec/changes/issue-1180-promote-phase-1-doctrine/brain-drafts/vcs-contract.verbs.draft.md
> ```

```brain-amendment/1
target: brain/core/methodology/vcs-contract.md
issue: 1180
```

```amend-find
 MAY throw like its sibling normalized READs; `labelPreflight` is the total/never-throws layer, not this verb. |

### Normalized `commitStatus` enum
```

```amend-replace
 MAY throw like its sibling normalized READs; `labelPreflight` is the total/never-throws layer, not this verb. |
| `labelCreate` | `({ project, name, color?, description?, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<{ ok: true, created: boolean }\|{ ok: false, error }>` | Creates a label DEFINITION in the remote's label set (issue #1163); the write half of `labelList`. It applies the label to nothing, so it cannot hand anyone an approval — that stays `labelAdd`'s deny-set. `created: false` with `ok: true` means the label already existed (GH: 422 `already_exists`; GL: 409), which is what makes `env:init`'s label step idempotent. GH: `POST repos/{project}/labels`, colour without `#`. GL: `POST projects/{enc}/labels`, colour `#`-prefixed. Never throws. |
| `workflowRunSucceeded` | `({ project?, workflow, branch }) -> Promise<{ state: 'succeeded'\|'none'\|'unknown'\|'unsupported', detail }>` | Has the named workflow ever completed successfully on `branch` (issue #1162)? The evidence that tells a never-created post-merge audit cursor (bootstrap) from a deleted one (a successful run advanced it once). Filtered by `branch`, the default branch: a success elsewhere does not count. `unknown` on any read failure or missing `workflow`/`branch`; never throws; never a fabricated `none`. GH: `gh run list --workflow --branch --status success --limit 1`. GL: `unsupported` (no per-workflow run history and no post-merge audit workflow); callers MUST treat `unsupported` as `unknown`. |

### Normalized `commitStatus` enum
```

```amend-find
exporting the 21 verbs
```

```amend-replace
exporting the 30 verbs
```

```amend-find
| `labelList` | implemented (issue #334) | implemented (issue #334) |
```

```amend-replace
| `labelList` | implemented (issue #334) | implemented (issue #334) |
| `labelCreate` | implemented (issue #1163) | implemented (issue #1163) |
```

```amend-find
| `issueRelations` | implemented (issue #533, `dependencies/*`) | implemented (issue #533, `issues/:iid/links`) |
```

```amend-replace
| `issueRelations` | implemented (issue #533, `dependencies/*`) | implemented (issue #533, `issues/:iid/links`) |
| `workflowRunSucceeded` | implemented (issue #1162) | `unsupported` (issue #1162) — no per-workflow run history; callers treat it as `unknown` |
```
