# Design — #1204

The run mirrors #1185 (1.10.0) and #1081's runbook.

- **Consumers.** Two recreated consumers; the maintainer ran `env:init` and `brain:protect`. An agent ran everything after.
- **Isolation.** The engram consumer ran with `ENGRAM_DATA_DIR=$HOME/.cache/brain-1101-demo/engram-data`; its checkout B used `engram-data-B`. Checkout B had no `.env`.
- **Seam injections.** Seam 1: a PATH without engram. Seam 2: `BRAIN_VCS_TEST_MODULE` with the shipped fake port. Seam 3: a foreign file committed on the lane branch with the hooks active (no `--no-verify`, no `core.hooksPath` override); the hooks allowed it and the `lane-paths`/`issue-link` gates failed in CI.
- **Deviations from the product's verbs** (recorded, not hidden):
  - The demo issues were labelled `type:feature` by hand after `brain:ship` refused for lack of a `type:*` label. The refusal is a documented prerequisite; the demo setup had omitted the label.
  - `git push -u origin <branch>` was run before `brain:ship`; `brain:ship` does not push (see the new finding on its error text).
  - The merged remote lane branch was deleted by hand before the seam-2 injection (#1190, same workaround as #1185).
  - Pull requests were merged with `gh pr merge --squash` by the agent, authorised for these throwaway repos only.
