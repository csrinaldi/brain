# Design — env:init labels, actor and lane notice (#1163, #1164, #1166)

## Decisions

**D1 — one new module, `lib/env-init-setup.mjs`.** Pure-ish functions (`desiredLabels`, `ensureLabels`, `resolveBrainActor`) take an injected port double and git accessors, so unit tests never touch a VCS. A thin CLI (`labels`, `actor`) is what `bootstrap.sh` runs. The label vocabulary is NOT redeclared: `TYPE_LABELS` (contributor-scaffold.mjs, the source `brain:ship`'s type set is drawn from), `resolveApprovedLabel` (what every gate reads) and `ALARM_LABELS` (pinned to the workflow file by a test that fails when the workflow files a label the list lacks).

**D2 — `labelCreate` is a new port verb**, not a wrapper around `gh label create`. The port has `labelList`/`labelAdd`/`labelRemove` and no way to create a label definition; a raw `gh` call would break the GitHub/GitLab parity and `no-gh-glab-spawn-regression`. GitHub: `POST repos/{p}/labels`. GitLab: `POST projects/{id}/labels` (colour must be `#`-prefixed). "Already exists" is success. Its `vcs-contract.md` row is a draft in `brain-drafts/`; until the maintainer's `brain:promote` lands it, `verb-contract-drift-guard.test.mjs` lists `labelCreate` in `DOCUMENTED_BUT_NOT_REQUIRED` with a note to remove it in that commit.

**D3 — list-then-create, not create-and-tolerate.** `labelList` is read first so a re-run makes zero writes and never restyles a label a maintainer already customised; `created:false` from the verb is only the race-safety net.

**D4 — actor: keep, then whoami, then pending.** An existing valid value is never overwritten (a human's choice outranks an inference). The brief listed the VCS identity first; keeping an existing value first differs only when both exist and disagree, where overwriting would be destructive. Never `user.name`.

**D5 — lane notice reuses `tier-notice.mjs`.** `laneNotice`/`renderLaneNotice` beside the tier ones; `printTierNotice` prints both, so `brain-config.mjs ensure` (which already chains the dynamic import to avoid the top-level-await cycle) needs no change and there is no second notice mechanism.

**D6 — failure classes by exit code.** `bootstrap.sh#_setup_step` maps exit 0/3/other to done/`MISSING_OPTIONAL`/`REQUIRED_FAILURES`; pending text comes from the step's `NEXT:` line so the final summary is self-contained. The step lives in section 5b, outside the memory-backend selection block (#1165 conflict avoidance).

## Alternatives rejected

- Creating labels in `brain:protect` or `brain:ticket:start`: runs too late — the first PR is the failure, and `ticket:start` is per ticket.
- Resolving the actor from `git config user.name`: a display name is not a handle; the memory format refuses non-handle actors and a guess would mint provenance nobody asserted.
