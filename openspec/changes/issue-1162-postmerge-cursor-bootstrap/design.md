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
- One code path also covers consumers already installed (no migration).

## Safety argument (no unaudited commit is skipped)
Base = parent of the adoption commit (`git log --first-parent --diff-filter=A --reverse -- <workflow>`, first entry). The window `base..HEAD` therefore contains the adoption commit and everything after. Everything before adoption predates the gate (the existing `governance.auditBaseline` covers pre-gate history and is unchanged). Adoption as root: base = root, nothing precedes it. Nothing found -> `UNKNOWN`, never a guess.
Risk named: the adoption commit is itself audited, so a `diff-size` failure on it is auto-revertible by the normal path; consumers with a large adoption diff should label it `size:exception` or set `auditBaseline`. Not changed here.

## New vs deleted
Evidence outside the ref: `gh run list --workflow governance-postmerge.yml --status success --limit 1`. A successful run is only possible after a clean audit advanced the cursor, so its existence proves the cursor existed. None -> bootstrap. Some -> deleted -> alarm (REQ-3). Query failure -> `unknown` -> alarm. Residual: GitHub run retention (90 days default) can expire the history; a cursor deleted after all successes expired reads as new. That is bounded (the first window is still adoption..HEAD, an over-audit, never a skip) and named.

## Mechanics
`bootstrapCursor({git, workflowPath, priorAudit})` in `cursor.mjs`; states `bootstrapped | present | refused | unknown`. Creation: `git push --force-with-lease=refs/governance/audit-cursor: origin <base>:refs/governance/audit-cursor` (empty expectation = ref must not exist). The workflow re-runs `cursor.mjs window` after a clean bootstrap; the existing audit/advance path is untouched. `advance` gains `GH_TOKEN` because `cursor.mjs` now contains a `gh` reader (workflow-auth drift guard).

## GitLab
`brain/scripts/ci/gitlab-governance.yml` has no post-merge job, cursor or `governance:cursor-*` alarm: no equivalent step, nothing to fix.

## Doctrine
No change to `brain/**` needed; workflow-governance.md does not describe cursor initialization.
