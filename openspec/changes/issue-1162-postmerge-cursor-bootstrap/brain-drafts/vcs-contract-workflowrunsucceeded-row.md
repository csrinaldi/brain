# Draft: Required verbs row for `workflowRunSucceeded` (#1162)

Add to the Required verbs table of `brain/core/methodology/vcs-contract.md`, then remove `workflowRunSucceeded` from `DOCUMENTED_BUT_NOT_REQUIRED` in `brain/scripts/vcs/verb-contract-drift-guard.test.mjs`:

| `workflowRunSucceeded` | `({ project?, workflow, branch }) -> Promise<{ state: 'succeeded'\|'none'\|'unknown'\|'unsupported', detail }>` | Has the named workflow ever completed successfully on `branch` (issue #1162)? The evidence that tells a never-created post-merge audit cursor (bootstrap) from a deleted one (a successful run advanced it once). Filtered by `branch`, the default branch: a success elsewhere does not count. `unknown` on any read failure or missing `workflow`/`branch`; never throws; never a fabricated `none`. GH: `gh run list --workflow --branch --status success --limit 1`. GL: `unsupported` (no per-workflow run history and no post-merge audit workflow); callers MUST treat `unsupported` as `unknown`. |
