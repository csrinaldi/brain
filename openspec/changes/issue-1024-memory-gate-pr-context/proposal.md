# Proposal: memory-gate receives the PR context and reads the default branch (#1024)

## Intent

On GitHub, `memory-gate` never reaches its issue-scoped path. The job in `.github/workflows/governance.yml:147-161` maps only `DEFAULT_BRANCH`, so `loadGithubContext()` (`brain/scripts/vcs/ci-context.mjs:48-72`) never calls `prView`, `ctx.body` stays `null`, and `runMemoryGateCheck` (`brain/scripts/governance/run-check.mjs:291-299`) falls back to the repository-global `memoryPresence()`. `memoryRetrieval()` (`checks/memory-retrieval.mjs`) and REQ-L3-4 (`openspec/specs/governance-v3/spec.md:242-292`) never run in CI. `memory-presence.mjs:30-33` already names this gap.

This change adds no doctrine. It delivers evidence that is already ratified:

| Tier | `GATE_MATRIX['memory-gate']` (`governance-tiers.mjs:170-177`) | Effect after this change |
|---|---|---|
| `lite` (this repository) | `detection`, `coverage-report` | A scoped miss is a `::warning::` (`detection-policy.mjs:49-55`), never red |
| `standard` | `required`, `issue-linked-record` | A scoped miss blocks |
| `regulated` | `required`, `issue-linked-session-summary` | A scoped miss blocks |

Wiring the env alone is not enough. Since ADR-0034, a record reaches `main` on its own lane PR, usually after the feature PR opens. `readRecords` (`run-check.mjs:90-92`) reads only the PR tree, so a strict scoped check would make contributors rebase onto the lane. That brings back the coupling ADR-0034 removed.

## Scope

### In Scope
- In the `governance.yml` `memory-gate` job, add `VCS_TOKEN`, `PR_NUMBER` and `PR_BODY`, mirroring `issue-link` (`:61-71`).
- Evidence read: records are the union of the PR tree and `origin/<default>`, de-duplicated by record `id`. The feature branch never needs to carry the record.
- The gate output names the path that ran (`presence` or `retrieval`) and why. This includes a clean `presence` pass, which prints nothing today.
- Tests: a drift-guard case for the `memory-gate` env, modelled on `ci-context-drift-guard.test.mjs:477-494`, which fails today. Also union-read, dedupe and fetch-failure cases, plus path naming in the output.
- **`skip:memory-gate` becomes real, per tier.** Honoring follows `TIER_PARAMS.honorSkipMemoryGate` (`governance-tiers.mjs:295,309,321`): at `standard` the label, applied by someone other than the PR author, passes the gate with `path=skipped` and the applier named; at `regulated` it is refused and the output says so, as `regulated` already refuses `size:exception`; at `lite` it is noted and not consulted, because the gate only warns there. This is step 2 of the #529 sequence, and the precondition for letting `standard` block.
- A `CHANGELOG.md` "Unreleased" note for `standard`/`regulated` consumers, naming the override.
- Tier 2 drafts (maintainer moves them), see Doctrine touchpoints.

### Out of Scope
- Re-running feature PRs automatically when a record lands on the default branch. This becomes a follow-up issue; until it ships, a manual re-run heals the PR.
- `brain/scripts/ci/gitlab-governance.yml`: no change. GitLab is recorded as unverified. It is probably already scoped through `CI_MERGE_REQUEST_IID` plus a project-level `VCS_TOKEN`.
- A grace period, and a fail-closed path for "no issue detectable".
- Tightening Invariant 3 to recency (#529's step 3).
- The gap between `regulated` `issue-linked-session-summary` and `memoryRetrieval`'s PARTIAL pass (see Risks).

## Decision record (maintainer, 2026-09-18)

The explorer proposed two slices: wiring first, then the default-branch read. The maintainer chose one PR. Shipping the wiring alone would force every `standard`/`regulated` consumer to rebase feature PRs after each lane merge. That is the coupling ADR-0034 removed, and `governance.yml` is a managed path copied into consumers on the next release. Other rulings:
- No grace period. The CHANGELOG note is the rollout.
- `lite` stays at `detection`.
- The re-trigger is a follow-up.
- GitLab stays unverified.
- Path naming ships in this slice.

**#529 ruling (maintainer, 2026-09-18, option A).** `workflow-governance.md:59-62` records the #529 sequence: capture becomes a mechanism (#530), then `skip:memory-gate` becomes real, then Invariant 3 tightens; tightening first "would block every PR with no override". Wiring this change activates `GATE_MATRIX`'s `required` evidence at `standard`/`regulated`, which is a tightening. Step 1 is done (record-first capture, #874; the lane, ADR-0034). The maintainer chose to make the override real in this same PR rather than amend the ruling or keep scoped misses as warnings at every tier. The ruling's order is kept; this PR performs step 2 and the tier-scoped part of step 3 together. Recency (the rest of step 3) stays out of scope.

## Approach

- **Workflow** (`governance.yml` `memory-gate`): add the three env keys. The default branch becomes readable in one of two ways: `fetch-depth: 0` on the job, or a targeted `git fetch origin <default>` done by the reader. The design phase chooses. The targeted fetch in the reader is preferred because it also covers GitLab's shallow clones without a YAML edit.
- **Reader** (`run-check.mjs` `defaultReadRecords`, or a sibling dependency): read `.memory/records/*.jsonl` from `origin/<default>` through git plumbing, with no checkout. Union the result with the PR tree and de-duplicate by `id` (first wins, the same rule as `store.mjs:339-343`). The evaluators stay pure.
- **Degradation**: if the default-branch read fails, evaluate the PR tree alone. A hit still passes. A miss fails closed with an explicit `default branch unreadable` reason. A fetch failure never turns into a silent pass.
- **Override**: the PR's labels reach the gate's context (through `prView`, which the job now calls with `PR_NUMBER`; `ctx` gains the labels next to the body). `skip:memory-gate` short-circuits before evaluation with `path=skipped` where the tier honors it (see In Scope; maintainer ruling 2026-09-18: follow `TIER_PARAMS`, not "every tier" as first drafted). The design decides: who may apply the label (repository triage/write permission versus a named actor list such as `governance.approvalActors`), whether the label's applier must differ from the PR author, how the override is reported to `brain:metrics` (today it counts the label raw and never subtracts it), and the GitLab equivalent (MR labels from the same API call).
- **Output**: `runMemoryGateCheck` returns a `path` and a reason. `main` (`:732-733`) prints them, for example `memory-gate: path=presence (no PR body)` or `path=retrieval #N`.

## Contributor experience

| Tier | Record only on the lane PR (unmerged) | After the lane merges |
|---|---|---|
| `lite` | Warning | Green on the next run, no rebase |
| `standard`/`regulated` | Red, reason names the issue and the missing record, and that `skip:memory-gate` is available | Green after a re-run, no rebase |
| `standard`, `skip:memory-gate` applied by someone other than the author | Green, `path=skipped`, the applier named in the output | — |
| `regulated`, `skip:memory-gate` applied | Refused, the output names the tier; red until the lane merges and a re-run | — |

## Doctrine touchpoints (Tier 2, drafts only)

- `brain/core/methodology/workflow-governance.md:23, 40-62`: the Invariant 3 row and the "repo-scoped and permanently satisfied" text become tier-dependent; the "`skip:memory-gate` does not exist in code" paragraph becomes false; the #529 paragraph gains "step 2 done (#1024)". `AGENTS.md` is compiled from this file and must be regenerated after promotion.
- `brain/scripts/vcs/contributor-scaffold.mjs:130, 277-280`: the PR-template text hedges correctly, so no change is expected. The code comment at `:110-111` ("GitHub's job deliberately does not") becomes stale and gets updated.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `governance-v3`: REQ-L3-4 changes in three ways. The record set is the union of the PR tree and the default branch. Output names the path. A default-branch read failure fails closed on a miss. The spec also adds a CI-wiring requirement so the scoped path actually runs.
- `ci-context`: `memory-gate` becomes a consumer that declares `PR_NUMBER`/`VCS_TOKEN` (`spec.md:159, 242`).

## Affected Areas

| Area | Impact |
|---|---|
| `.github/workflows/governance.yml` | Modified (env, possibly fetch depth) |
| `brain/scripts/governance/run-check.mjs` | Modified (reader, override, path in the result) |
| `brain/scripts/vcs/ci-context.mjs` | Modified (labels in the context) |
| `brain/scripts/brain-metrics.mjs` | Possibly modified (count enforced overrides) |
| `brain/scripts/vcs/contributor-scaffold.mjs` | Modified (PR-template text: "no gate reads it" becomes false; stale comment at `:110-111`) |
| `brain/scripts/vcs/ci-context-drift-guard.test.mjs`, `run-check.test.mjs` | Modified (tests) |
| `CHANGELOG.md` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Consumers with a diverged `governance.yml` get `refuse` at `brain:upgrade` and keep the old unscoped job | Med | CHANGELOG names the exact env block to copy |
| The override becomes the path of least resistance and hides missing capture | Med | `path=skipped` names the applier in every run; `brain:metrics` counts enforced overrides; the design decides who may apply the label |
| Labels are not in `ctx` today; a fetch failure must not read as "no label" and block | Low | Labels arrive with the same `prView` call as the body; an uncomputable context is reported as such, never as a skip |
| Default-branch fetch fails, or the ref is absent in a shallow clone | Med | Explicit fail-closed reason on a miss, with a dedicated test |
| Token scope: `github.token` needs `pull-requests: read`; fork PRs get a read-only token | Low | Same scopes `issue-link` already uses |
| `PR_NUMBER` set but the body fetch fails, so the check silently degrades to `presence` | Med | Output names `presence (body uncomputable)`. The design decides whether this should fail closed |
| `regulated` evidence (`session_summary`) vs the PARTIAL pass in `memoryRetrieval` | Low | Out of scope. Flagged for the spec phase |

## Rollback Plan

Revert the PR. The job returns to `DEFAULT_BRANCH`-only and the reader returns to PR-tree-only. There is no data migration. Consumers who already upgraded revert on their next `brain:upgrade`.

## Success Criteria

- [ ] New drift-guard test: the `memory-gate` job declares `VCS_TOKEN`, `PR_NUMBER`, `PR_BODY`. It fails on `02896d69` and passes after the change.
- [ ] A record for issue N that exists only on `origin/<default>` satisfies `retrieval` for a PR that closes #N, with no rebase.
- [ ] The same record present in both trees counts once.
- [ ] With the default branch unreadable and no PR-tree hit, the gate fails with the explicit reason and never passes.
- [ ] Every run prints `path=presence` or `path=retrieval`, including clean passes.
- [ ] In this repository (`lite`), a scoped miss exits 0 with `::warning::`.
- [ ] At `standard`, a PR carrying `skip:memory-gate` from a non-author passes with `path=skipped` and the applier in the output; without the label, or with the author as applier, the same PR fails. At `regulated` the label is refused with the tier named.

## Follow-up issue to file

"feat(governance): re-run memory-gate on open PRs when their issue's record lands on the default branch". The model is `governance-relabel.yml` + `brain/scripts/governance/relabel-retrigger.mjs`: on a push to the default branch that touches `.memory/records/`, re-run `governance.yml` for open PRs that reference the issues those records name.

## Proposal question round

The maintainer decisions above resolved the explorer's five questions and the #529 conflict. Three remain for spec and design review:
1. When `PR_NUMBER` is set but the body fetch fails, should the check fail closed instead of degrading to `presence`?
2. Should `regulated` treat PARTIAL coverage as a miss, to match `issue-linked-session-summary`?
3. Who may apply `skip:memory-gate`, and must the applier differ from the PR author?
