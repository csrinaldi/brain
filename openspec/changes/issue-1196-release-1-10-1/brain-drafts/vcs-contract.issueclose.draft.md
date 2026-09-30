# vcs-contract.md — issueClose verb (issue #1196)

> **Tier 2 draft. Not yet promoted.** `vcs-contract.md` is a promoted `brain/core` file, so
> this is an in-place amendment. Converts the free-form row draft of #1188
> (`openspec/changes/issue-1188-audit-memory-predicate-and-alarm-close/brain-drafts/vcs-contract-issueclose-row.md`)
> into the `brain-amendment/1` shape. Row text is verbatim from that draft. The maintainer promotes it;
> the same commit carries the emptied `PENDING_PROMOTION` in
> `brain/scripts/vcs/verb-contract-drift-guard.test.mjs`:
>
> ```
> npm run brain:promote -- openspec/changes/issue-1196-release-1-10-1/brain-drafts/vcs-contract.issueclose.draft.md
> ```

```brain-amendment/1
target: brain/core/methodology/vcs-contract.md
issue: 1196
```

```amend-find
callers MUST treat `unsupported` as `unknown`. |

### Normalized `commitStatus` enum
```

```amend-replace
callers MUST treat `unsupported` as `unknown`. |
| `issueClose` | `({ project, number }) -> Promise<{ ok: true }\|{ ok: false, error }>` | Closes an issue (issue #1188). The post-merge workflow closes the alarm issues a later clean run resolves. The payload is the state change and nothing else: no body, title or labels (the mirror of `issueUpdate`, which cannot carry `state`). GH: `PATCH repos/{project}/issues/{number}` with `state: closed, state_reason: completed`. GL: `PUT projects/{enc}/issues/{number}` with `state_event: close`. Never throws. |

### Normalized `commitStatus` enum
```

```amend-find
exporting the 29 verbs
```

```amend-replace
exporting the 30 verbs
```

```amend-find
| `workflowRunSucceeded` | implemented (issue #1162) | `unsupported` (issue #1162) — no per-workflow run history; callers treat it as `unknown` |
```

```amend-replace
| `workflowRunSucceeded` | implemented (issue #1162) | `unsupported` (issue #1162) — no per-workflow run history; callers treat it as `unknown` |
| `issueClose` | implemented (issue #1188) | implemented (issue #1188) |
```
