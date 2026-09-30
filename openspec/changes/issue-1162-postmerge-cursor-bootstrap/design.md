# Design: post-merge cursor bootstrap (#1162)

## Root cause
`governance-postmerge.yml` window step treats `ABSENT` as an alarm unconditionally
(`if [ "$state" = "ABSENT" ]` -> `governance:cursor-missing`, "NEVER auto-create the cursor").
`cursor.mjs` deliberately cannot create the ref (`advanceCursor` needs a 40-hex `from`).
No install step, `brain:protect` or `env:init` ever creates it. The fail-closed rule is
right for a cursor that was lost; it is wrong for one that never existed.

## Where: the first post-merge run, not `env:init` / `brain:protect`
- The ref lives on origin and must be pushed with the runner's `contents: write`; `env:init` runs on a developer machine that may have no remote, no push right, or run before the adoption commit merges.
- The post-merge run is the only actor that sees both facts the decision needs: the remote ref state and the run history of the workflow.
- One code path also covers consumers already installed, with the behavior change stated in the residuals below.

## Safety argument (no unaudited commit is skipped, and no adoption is reverted)
Base = the adoption commit itself (`git log --first-parent --diff-filter=A --reverse -- <workflow>`, first entry), in every shape. The window `base..HEAD` audits everything after it. Rationale: a gate cannot be authoritative over the commit that installs it, and nothing after the adoption escapes the audit. The audit walks every first-parent commit (`listAuditedCommits`, direct pushes included), so an earlier draft that used the adoption's PARENT made an over-budget adoption fail `diffSize`, `issueLink` and `memoryPresence`, get emitted as `[FAIL-SHA]`, and be reverted by `auto-revert/<adoption-sha>`: a fresh consumer would have moved from `cursor-missing` to "revert your own adoption". Measured with the real `brain-audit.mjs` (see the end-to-end tests). That risk is removed, not accepted. No adoption commit found -> `UNKNOWN`, never a guess. Pre-adoption history stays governed by the existing `governance.auditBaseline` and is unchanged.

## New vs deleted
Evidence outside the ref, read through the VCS port (never `gh` inside `cursor.mjs`): `workflowRunSucceeded({project, workflow, branch})`, filtered by the DEFAULT branch so a success elsewhere does not count. A successful run is only possible after a clean audit advanced the cursor, so its existence proves the cursor existed. `none` -> bootstrap. `succeeded` -> deleted -> alarm (REQ-3). `unknown` or `unsupported` (GitLab) -> alarm, never a bootstrap.

## Residuals (named, not hidden)
1. Run retention. GitHub expires run history (90 days by default). A cursor deleted after every success expired reads as new; with base = adoption the first window then re-audits from the adoption and can re-nominate offenders a human already accepted (an `accept` only advances the cursor; it leaves no record the bootstrap could consult, and `governance.auditBaseline` is a repo-level static ref, not a record of accepts). Consulting `auditBaseline` does not help: it bounds pre-gate history and the window already starts at the adoption. Bounded: it is an over-audit, never a skip, and it alarms rather than reverts anything not auto-revertible.
2. A renamed or re-added workflow. The adoption commit is the first commit that ADDS the path on the first-parent line, so a rename of the workflow file (or delete and re-add) makes that rename commit the adoption, and the window starts later than the original adoption. Nothing between is skipped that the gate did not already exempt by rename, but the start moves forward.

3. Consumers ALREADY installed (the 6/6 failing demo repos). Verified: their runs all failed at `ABSENT` (no run ever succeeded), so the evidence reads `none` and the base becomes their adoption commit, which may be old. Their FIRST window audits every merge since adoption for the first time, in one run, and a tree-keyed offender among them is nominated for `auto-revert/<sha>` against current main (pinned by a test: an old over-budget commit after adoption yields exit 1 and `[FAIL-SHA]`). This is the intended "nothing escapes" outcome, and it is a behavior change: expect possibly several revert PRs, or `revert-blocked` alarms where reverts conflict. To avoid it, an operator sets `governance.auditBaseline` to a recent ref, or creates the cursor by hand at a chosen recent commit, BEFORE the first run on the new code. Not handled in code on purpose: any automatic cap would be a silent skip.
4. Trigger payloads. `github.event.repository.default_branch` is empty on `schedule` runs, so the bootstrap resolves the default branch from the remote's HEAD symref (`ls-remote --symref origin HEAD`) when `--branch` is empty or absent. Tested for push, workflow_dispatch and schedule.

## Mechanics
`bootstrapCursor({git, workflowPath, priorAudit})` (async) in `cursor.mjs`; states `bootstrapped | present | refused | unknown`. Creation: `git push --force-with-lease=refs/governance/audit-cursor: origin <adoption>:refs/governance/audit-cursor`. The CLI (`cursor.mjs bootstrap <workflow> --branch <default>`) resolves the port lazily. `cursor.mjs` declares `SUBCOMMAND_PORT_REACH` (`window`/`accept` false, `bootstrap` true), the design #535 gave multiplexers, so only steps that run `bootstrap` need `VCS_TOKEN`; `advance` (accept) declares nothing (least privilege). `workflow-auth.mjs` now strips a trailing `)` from a subcommand token so `$(node cursor.mjs window)` resolves. The workflow re-runs `cursor.mjs window` after a clean bootstrap; the audit/advance path is untouched.

## VCS contract
New read verb `workflowRunSucceeded`. GitHub: `gh run list --workflow --branch --status success --limit 1`. GitLab: explicit `unsupported`. The `vcs-contract.md` Required Verbs row is drafted at `brain-drafts/vcs-contract-workflowrunsucceeded-row.md` (brain/core is read-only here); until promoted, the verb is listed in the drift guard's `DOCUMENTED_BUT_NOT_REQUIRED` with a removal note.

## GitLab
`brain/scripts/ci/gitlab-governance.yml` has no post-merge job, cursor or `governance:cursor-*` alarm: no equivalent step, nothing to fix.

## Doctrine
No change to `brain/**` needed; workflow-governance.md does not describe cursor initialization.
