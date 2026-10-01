# Design — #1204

The run mirrors #1185 (1.10.0) and #1081's runbook.

- **Consumers.** Two recreated consumers; the maintainer ran `env:init` and `brain:protect`. An agent ran everything after.
- **Isolation.** The engram consumer ran with `ENGRAM_DATA_DIR=$HOME/.cache/brain-1101-demo/engram-data`, and its checkout B used `engram-data-B`. Checkout B had no `.env`.
  - The plainfiles consumer was NOT isolated from engram, because nothing was expected to touch engram there.
  - Its first `env:init` accepted the `[engram]` default on Enter (E6, #1205). That run indexed 20 `brain/` documents into the operator's real engram store under the project `brain-test-plainfiles`: `evidence/plainfiles-02-env-init-enter-default.txt`, lines 74–96.
  - Those observations were **not** cleaned up. They remain in the operator's store next to the ones left by the same accident in #1185.
  - Deleting them from a personal store is the operator's call, not the demo's.
- **Seam injections.** Seam 1: a PATH without engram. Seam 2: `BRAIN_VCS_TEST_MODULE` with the shipped fake port. Seam 3: a foreign file committed on the lane branch with the hooks active (no `--no-verify`, no `core.hooksPath` override); the hooks allowed it and the `lane-paths`/`issue-link` gates failed in CI.
- **Product-required manual steps.** These count against exit clause 1 and are filed as findings in `report.md`, not as harness deviations:
  - **F1 (#1206):** the `type:feature` label was added by hand after `brain:ship` refused. Nothing earlier in the flow asks for it.
  - **F2 (#1207):** `git push -u origin <branch>` was run by hand after `brain:ship` failed with a raw GraphQL error.
  - **#1190:** the merged remote lane branch was deleted by hand before the seam-2 injection, the same workaround as #1185.
  - **E6 (#1205):** the operator's Enter on the backend prompt declared `engram`. The orchestrator had to correct it with `brain:config set memory.backend plainfiles` before the second `env:init`: `evidence/plainfiles-02b-config-set-backend.txt`. That file is reconstructed from the session log, not captured live, and says so.
- **Harness deviations** (made by the demo itself, recorded, not hidden):
  - The first `env:init` transcript command was split when pasted. `script` wrote to its default `typescript` file, which was then moved to `evidence/plainfiles-02-env-init-enter-default.txt`.
  - Every pull request, feature and lane alike, was merged with `gh pr merge --squash` by the agent, which was authorised for these two throwaway repos only. The lane's `auto-merge was refused (unsupported)` is the known `allow_auto_merge: false` setting.
