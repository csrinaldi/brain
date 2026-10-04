# Design — #1229

The run mirrors #1204 (1.10.1), with these differences: the agent never merges, and the issue is created the way a user would.

- **Consumers.** Two recreated consumers; the maintainer ran `env:init` (backend typed by hand), pushed the adoption commit and ran `brain:protect`. An agent ran everything after.
- **Isolation.** The engram consumer ran with `ENGRAM_DATA_DIR=$HOME/.cache/brain-1110-demo/engram-data`; its checkout B used `engram-data-B`. Checkout B had no `.env` in either repo (`credential-scan.txt`).
- **Seam injections.** Seam 1: a PATH without `~/.local/bin` (no engram). Seam 2: `BRAIN_VCS_TEST_MODULE` with the shipped fake port and a `BRAIN_VCS_TEST_SCRIPT` with an `mrCreate` error. Seam 3: a foreign file committed on the lane branch with the hooks active (no `--no-verify`, no `core.hooksPath`).
- **Product-required manual steps.** Counted against exit clause 1, filed in `report.md`, not harness deviations:
  - the `type:feature` label added after `ticket:start` refused (`plainfiles-12`, `-13`; `engram-12`, `-13`);
  - `git push -u origin <branch>` run after `brain:ship` named it (`plainfiles-17`, `-18`; `engram-17`, `-18`);
  - the remote lane-branch deletion for #1190 (`plainfiles-67`, done by the maintainer);
  - every merge, done by the maintainer (`*-21`, `*-60`, `plainfiles-79`).
- **Harness deviations** (made by the demo itself, recorded, not hidden):
  - The agent added `status:approved` to issue #1 standing in for the maintainer's approval (`plainfiles-11`, `engram-11`).
  - The seam-3 revert commit message was amended before pushing, to add a `Refs #1` trailer (`plainfiles-76`). The amended commit was never published.
  - `plainfiles-50-ship-help-accidental.txt` was transcribed after the fact: `brain:memory:ship -- --help` ran a real ship, unrecorded at that moment, and its exit code was not captured. It opened plainfiles lane PR #3.
  - Seam 3 ran in a temporary worktree (`plainfiles-71`), removed afterwards (`plainfiles-82`), to leave the dirty main checkout untouched.
  - The first seam-3 commit was refused by the commit-msg hook for a missing `#N`; the commit was repeated with `Refs #1` (`plainfiles-72`, `-73`).
  - `plainfiles-63` ran with an inherited `ENGRAM_DATA_DIR` in the environment; only `npm run brain:memory:pull` and the plainfiles search ran there, no engram command.
  - Several early transcripts (`*-16-commit`, `plainfiles-66`) end with `exit=` of the last command in the pipeline, not of the command that matters. From `plainfiles-68` on, each command's exit is echoed right after it. `plainfiles-80` pipes `gh run watch` into `head`, so its `watch-exit=` is head's; the run's own result is the `✓ ... governance-postmerge` line.
  - Every merge was done by the maintainer, not the agent.
