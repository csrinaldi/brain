# Exploration: issue-1190, a same-day lane re-ship after a squash merge

Written by the orchestrator from the sdd-explore agent's report, because that agent had no write tool. All paths are under `brain/scripts/` unless stated otherwise.

## Root cause

Two pieces that are each correct combine to block the second ship of the day.

1. **The new commit is reparented onto `origin/main`.** After the squash merge, `memory/lane/collect.mjs:298-305` classifies the local lane tip as content-delivered (`contentDelivery`, `memory/lane/delivery.mjs:34`). It then deliberately reparents the new commit onto `origin/main`. That behaviour comes from #936 D3 and the #1050 fix.
2. **The remote branch still holds the pre-squash tip.** The remote `memory/<host>-<date>` points at L1, which is not an ancestor of the new commit. `surveyRef` (`memory/lane/ship.mjs:71`) runs `rev-list <ref>..origin/<branch>` and gets `behind=1`. `ship.mjs:399-403` then throws `memory.ship.diverged` before any push.

So the ship rebuilds from `origin/main` plus the new records; it does not append to the old lane. What blocks it is that the remote branch is never allowed to be replaced.

**Evidence** (`openspec/changes/issue-1229-phase-1-exit-demo-1-11-0/evidence/`):
- `plainfiles-66`: the refusal, with the remote at `fa28cba2` and no open PR.
- `-67`: the maintainer's manual delete.
- `-68`: the remote at a new sha, `0ef721e7`.
- `-69`: after the delete, the same ship opens PR #4.

## Ship path

- **Branch name.** Built in `memory/lane/plan.mjs:209-210` as `refs/heads/memory/${slugifyHost(host)}-${date}`, with the slug truncated to 40 characters (`plan.mjs:66`). The date is UTC, read once in `memory/cli.mjs:563`. Four regexes parse this name, and any change to it touches all four:
  - `plan.mjs:42`: `REF_GRAMMAR_RE`;
  - `ship.mjs:102`: `BRANCH_GRAMMAR`, which already tolerates a `-<n>` suffix;
  - `memory/lane/sweep.mjs:29`: `SWEEP_BRANCH_RE`;
  - `governance/checks/lane.mjs:15`: `LANE_BRANCH_RE`, which is the claim `issue-link`, `lane-paths` and the audit parse.
- **`surveyRef`** (`ship.mjs:54-74`) force-fetches the remote-tracking ref and returns one of three outcomes:

  | Remote state | Result |
  |---|---|
  | missing | `behind:0`, so the ship pushes and creates the branch |
  | fetch failed | `behind:null`, so the push decides |
  | present | real `ahead`/`behind` counts |

- **`diverged`** is a count comparison, not an ancestry or content test. It fires in two places:
  - `ship.mjs:399` (`behind>0`) refuses before touching the network;
  - `ship.mjs:429` (non-fast-forward push stderr) is the backstop.
- **Delivered no-op.** If the local content is already on `origin/main`, the ship pushes nothing and opens no PR (`ship.mjs:379-385`).
- **`decidePr`** (`ship.mjs:192-227`) reads the newest PR for the branch through `mrList({state:'all', headBranch})`. It runs after the diverged pre-check (`ship.mjs:399`) and before the push (`ship.mjs:415`), and acts on that PR's state:

  | Newest PR | Action |
  |---|---|
  | open | reuse it |
  | none, or merged | create a new one |
  | closed-unmerged | refuse |
  | lookup failed | `prLookupFailed` |

- **Auto-merge.** `mrAutoMerge` is armed on every run (`ship.mjs:474`).
- **The sweep never touches today's branch.** `sweep.mjs` deletes local delivered refs from other days. It only reports remote-only refs, because deleting a remote branch is Tier 2.

## Why the squash breaks it

`mrAutoMerge` hardcodes squash on both providers (`axes/vcs/adapters/github.mjs:749`, `gitlab.mjs:1359`). Nothing deletes the merged branch:
- `delete_branch_on_merge` appears nowhere in `brain/scripts`;
- GitLab sends no `should_remove_source_branch`.

The #1050 test hides the case. `memory/lane/ship.integration.test.mjs:263-306` deletes the remote branch after the simulated squash (line 284), so no test covers ship, squash with the branch surviving, then ship.

## VCS port

- **Proving a PR is merged.** `mrList` returns `{number, title, headBranch, state, merged}` on both providers:
  - GitHub: `github.mjs:499-513`;
  - GitLab: `gitlab.mjs:662-673`.

  It fails closed on a full 100-item page. It does not return the head sha (`prView` does, given a number). An additive widening is possible, with #930 as the precedent, but it is not needed if the content proof below is used.
- **No branch-delete verb exists.** Adding one needs:
  - a row in `brain/core/methodology/vcs-contract.md`;
  - an entry in `VERBS` (`vcs/cli.mjs:48`);
  - an implementation in both adapters;
  - coverage in the drift guard and in `axes/vcs/contract.test.mjs`;
  - an ADR-0008 note.
- **No repository-setting writes.** `branchProtect` only PUTs branch protection. Nothing writes `delete_branch_on_merge` or GitLab's `remove_source_branch_after_merge`.

## Candidates

### (a) Replace a provably merged remote branch. Recommended.

**Change.** `surveyRef` also returns `remoteTip`. When `behind>0`, the ship replaces the remote branch with `git push --force-with-lease=refs/heads/<b>:<remoteTip>` only if BOTH hold:
- `contentDelivery` of the remote tip is `delivered`;
- the newest PR for the head is `merged===true`.

Everything else is unchanged:
- a closed-unmerged PR still refuses before the push;
- the stderr backstop at `ship.mjs:429` stays;
- about 40-60 lines change in `ship.mjs`, plus tests;
- no new port verbs, and GitLab parity is free;
- the branch name is unchanged, so `lane-paths`, `lane-scrub` and the `issue-link` exemption are unaffected;
- #1118 and auto-merge are unaffected.

**Unmerged work stays refused.** Content containment is all-or-nothing and fail-closed: any lane path not byte-identical on `origin/main` is `pending`. The racing-writer test (`ship.integration.test.mjs:126-150`) still refuses. The lease pins the observed sha, so a race between survey and push fails safely.

### (b) A fresh branch name per ship. Rejected.

- It still needs (a)'s merged proof, to decide when to bump the name.
- It needs a remote listing, but `plan.mjs` is pure.
- A suffix after the date breaks `LANE_BRANCH_RE` and `REF_GRAMMAR_RE`. A suffix inside the host part corrupts the PR-title parse and the sweep's host match.
- Suffixed refs pile up, because the sweep ignores them.
- The branch name is a claim in ADR-0034 L1, so changing it needs an ADR amendment.

### (c) Delete after merge. Not recommended.

- **With a port verb (`branchDelete`):** it needs the contract changes listed above, plus a caller. Deleting is a Tier 2 action, and the sweep refuses it on purpose.
- **With the repository setting:**
  - it needs a new admin-scoped verb on both providers;
  - it changes a setting the consumer owns, which collides with ADR-0036's cost bar;
  - it does not heal earlier merges;
  - it does not cover a manual merge, which is the evidence case.

## Tests

**Already pin the refusal:**
- `memory/lane/ship.test.mjs:425-445` and `:450-462`;
- `ship.integration.test.mjs:126-150`;
- `memory/cli.ship.test.mjs:197-225`;
- the sweep tests;
- `brain-ship.test.mjs`.

**Add in `ship.integration.test.mjs`**, whose `buildFixtureRepo` at line 47 and `recordingVcs` at line 69 already support it:
1. ship, squash, keep the remote branch, fake PR `{state:'closed', merged:true}`, new record, ship. Expected: lease push and a new PR.
2. The same, with an extra unmerged commit on the remote. Expected: `diverged`, and the remote sha is unchanged.
3. The same, with the PR `merged:false`. Expected: refused.
4. A `ship.test.mjs` row that checks the lease argv.

Also replace the masking delete at `ship.integration.test.mjs:284` with a variant that leaves the branch in place.

## Recommendation

Choose (a), in `ship.mjs` only. It needs:
- an ADR-0034 amendment draft: a provably merged lane branch is replaced by lease, and never force-pushed otherwise;
- removing the `docs/KNOWN-LIMITATIONS.md` entry.

**Main risk.** Forced replacement is a new capability. A remote rule that forbids force-push on `memory/*` would bring the refusal back. The ship must then fail loud, name that cause, and never retry or delete.

**Secondary risk.** The two keys, content delivery and a merged PR, must both be required. Unit tests must prove that each key alone refuses.

**Open doctrine question.** `agent-authorities.md` Tier 3 prohibits modifying git history (`--force`). This would be the product, not an agent, replacing its own branch after proving nothing is lost. That needs the maintainer's ruling.
