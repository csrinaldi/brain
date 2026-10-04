# Draft: Required verbs row for `issueClose` (#1188)

Add to the Required verbs table of `brain/core/methodology/vcs-contract.md` (and an adapter-status row: GitHub implemented, GitLab implemented, both #1188), then remove `issueClose` from `PENDING_PROMOTION` in `brain/scripts/vcs/verb-contract-drift-guard.test.mjs` and bump the verb count:

| `issueClose` | `({ project, number }) -> Promise<{ ok: true }\|{ ok: false, error }>` | Closes an issue (issue #1188). The post-merge workflow closes the alarm issues a later clean run resolves. The payload is the state change and nothing else: no body, title or labels (the mirror of `issueUpdate`, which cannot carry `state`). GH: `PATCH repos/{project}/issues/{number}` with `state: closed, state_reason: completed`. GL: `PUT projects/{enc}/issues/{number}` with `state_event: close`. Never throws. |
