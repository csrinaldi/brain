# Spec: memory-lane-ship, replacing a merged remote lane branch (#1190)

Capability: `memory-lane-ship` (new). Delta over `brain:memory:ship` in `brain/scripts/memory/lane/ship.mjs`.
Terms: "remote tip" is the sha of `origin/<lane-branch>` observed by the survey. "Content-delivered" means
`contentDelivery(remoteTip) === 'delivered'`: every lane path is byte-identical on `origin/main`.
"Newest PR" follows `decidePr`'s rule over `mrList({state:'all', headBranch})`: an open PR wins; otherwise the highest-numbered PR for the head.

## REQ-1: The replace path needs both keys

The ship MUST replace the remote lane branch only when `behind>0`, the remote tip is content-delivered, AND the
newest PR for the head has `merged === true`. The push MUST be
`git push --force-with-lease=refs/heads/<branch>:<observedRemoteTip>`. `surveyRef` MUST expose `remoteTip`.

### Scenario 1.1: both keys hold
- Given a remote lane branch at the pre-squash tip, whose content is all on `origin/main`
- And the newest PR for the head is `{state:'closed', merged:true}`
- And a new record was collected, so `behind>0`
- When the ship runs
- Then it pushes with `--force-with-lease=refs/heads/<branch>:<observedRemoteTip>`
- And it opens a new PR and arms auto-merge.

### Scenario 1.2: the lease pins the observed sha
- Given the replace path is taken
- When the push argv is built
- Then the lease value names the exact sha the survey observed, never a bare `--force` or a lease without a sha.

## REQ-2: Each key alone refuses

With only one key, the ship MUST throw `memory.ship.diverged` before any push, and the remote sha MUST be unchanged.

### Scenario 2.1: content-delivered but the PR is not merged
- Given the remote tip is content-delivered
- And the newest PR is `merged:false` (or no PR exists)
- When the ship runs
- Then it fails with `memory.ship.diverged` and the remote sha is unchanged.

### Scenario 2.2: PR merged but the content is not delivered
- Given the newest PR is `merged:true`
- And at least one lane path of the remote tip is not byte-identical on `origin/main`
- When the ship runs
- Then it fails with `memory.ship.diverged` and the remote sha is unchanged.

## REQ-3: Unmerged remote commits stay refused

A remote lane branch holding commits not on `origin/main` MUST be refused, with the sha unchanged, whatever the PR state.

### Scenario 3.1: a racing writer
- Given the remote lane branch carries an extra commit whose content is not on `origin/main`
- When the ship runs
- Then it fails with `memory.ship.diverged`, no push is attempted, and the remote sha is unchanged
- And the existing racing-writer test still passes.

## REQ-4: A closed-unmerged PR keeps its behaviour

When the newest PR is closed and `merged:false`, the ship MUST keep the existing `closedUnmerged` outcome (non-throwing, exit 0), before the push.

### Scenario 4.1
- Given the newest PR is `{state:'closed', merged:false}`
- When the ship runs
- Then it returns the existing `closedUnmerged` outcome (exit 0, no push) and the remote sha is unchanged, even if the content is delivered.

## REQ-5: A rejected forced update fails loud

If the lease check or the remote refuses the forced push (for example a branch rule forbidding force-push on
`memory/*`), the ship MUST exit non-zero with an error that names the cause. It MUST NOT retry, and MUST NOT delete
the remote branch.

### Scenario 5.1: the remote forbids force-push
- Given both keys hold and the remote rejects the force-push
- When the ship runs
- Then it exits non-zero with a message naming the force-push refusal and the likely branch rule
- And the push is attempted exactly once, no delete is issued, and the remote sha is unchanged.

### Scenario 5.2: the lease is stale
- Given both keys hold and the remote tip moved after the survey
- When the lease push is rejected
- Then the ship exits non-zero naming the stale lease, does not retry, and does not delete.

## REQ-6: Existing behaviours are unchanged

### Scenario 6.1: missing remote
- Given no remote lane branch
- When the ship runs
- Then it pushes without force and creates the branch.

### Scenario 6.2: fast-forward
- Given `ahead>0` and `behind=0`
- When the ship runs
- Then it pushes without force or lease.

### Scenario 6.3: delivered no-op
- Given the local content is already on `origin/main`
- When the ship runs
- Then it pushes nothing and opens no PR.

### Scenario 6.4: open PR reused, auto-merge armed
- Given the newest PR is open
- When the ship runs
- Then that PR is reused, and `mrAutoMerge` is armed on every run that ends with a PR.

### Scenario 6.5: branch name and exemption
- Given any ship
- Then the branch name is still `memory/<host>-<date>`, and `lane-paths` and the `issue-link` exemption are unaffected.

## REQ-7: Fresh-consumer acceptance

On a fresh consumer, ship, squash-merge, then ship again the same UTC day MUST open a PR with no manual step
(ADR-0036).

### Scenario 7.1
- Given a fresh consumer fixture where the first lane PR was squash-merged and the remote branch survives
- And a new memory record is saved
- When `brain:memory:ship` runs the second time
- Then it exits zero, replaces the branch under the lease, and a new PR is open
- And no remote branch delete was performed by a human or the product.

### Scenario 7.2: the test is not masked
- Given the integration suite
- Then it contains a variant that leaves the remote branch in place after the simulated squash, in addition to the existing one that deletes it.

## REQ-8: Known limitation removed

### Scenario 8.1
- Given `docs/KNOWN-LIMITATIONS.md`
- Then it has no entry for #1190.
