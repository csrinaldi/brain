# Proposal: a same-day lane re-ship after a squash merge (#1190)

## Intent

A second `brain:memory:ship` on the same UTC day, after the first lane PR was squash-merged, refuses with `memory.ship.diverged`. The only way out is a manual remote branch delete, a Tier 2 act. Memory that cannot ship the same day without a human step breaks ADR-0034's lane promise on a fresh consumer (ADR-0036).

## Problem

- `mrAutoMerge` squashes on both providers (`axes/vcs/adapters/github.mjs:749`, `gitlab.mjs:1359`), and nothing deletes the merged branch.
- `collect.mjs:298-305` reparents the new commit onto `origin/main`. The remote `memory/<host>-<date>` still holds the pre-squash tip, so `surveyRef` (`ship.mjs:54-74`) reports `behind>0` and `ship.mjs:399-403` throws.
- Evidence: `openspec/changes/issue-1229-phase-1-exit-demo-1-11-0/evidence/plainfiles-66` to `-69` (refusal, manual delete, new sha, PR #4).
- `ship.integration.test.mjs:284` deletes the remote branch after the squash, which hides the case.

## Rulings (maintainer, 2026-10-01)

1. Candidate (a). The ship replaces its own remote lane branch with `git push --force-with-lease=refs/heads/<branch>:<observedRemoteTip>` if and only if BOTH hold: `contentDelivery(remoteTip) === 'delivered'` (every lane path byte-identical on `origin/main`) and the newest PR for the head is `merged === true`. Otherwise `memory.ship.diverged` stays.
2. This is not a Tier 3 violation of `agent-authorities.md`: the product acts, on its own lane branch, only after proving nothing is lost, and the lease blocks clobbering a concurrent push. It is recorded as an ADR-0034 amendment, drafted later as `brain-amendment/1` in `brain-drafts/`. This proposal does not write it.
3. Candidates (b), a fresh branch name, and (c), delete after merge, are rejected for the reasons in `explore.md`.

## Scope

**In**
- `surveyRef` returns `remoteTip`; the two-key replace path in `ship.mjs`, with the lease.
- A named, loud failure when the remote refuses a forced update (for example a `memory/*` rule). No retry, no delete.
- The tests listed in `explore.md` §Tests, including each key alone refusing, and an unmasked variant of `ship.integration.test.mjs:284`.
- Remove the #1190 entry from `docs/KNOWN-LIMITATIONS.md`.
- The ADR-0034 amendment draft, written by a later phase.

**Out**
- Widening `mrList` with a head sha; any new port verb; repository settings; the cross-day sweep.
- Any change to `brain/core/**` or `brain/project/**` outside the drafted amendment.

## Capabilities

- **New:** `memory-lane-ship`, covering the conditions for replacing a remote lane branch and the refusals that remain.
- **Modified:** none.

## Approach

When `behind>0`, read the newest PR before the diverged refusal. Replace by lease only when both keys hold. Keep the stderr backstop at `ship.mjs:429`. The branch name, `lane-paths`, the `issue-link` exemption and auto-merge stay unchanged.

## Affected areas

| Area | Impact |
|---|---|
| `brain/scripts/memory/lane/ship.mjs` | Modified |
| `brain/scripts/memory/lane/ship.test.mjs`, `ship.integration.test.mjs` | Modified |
| `docs/KNOWN-LIMITATIONS.md` | Entry removed |
| `openspec/changes/issue-1190-*/brain-drafts/` | Amendment draft |

## Risks

| Risk | Mitigation |
|---|---|
| The remote forbids force-push on `memory/*` | Fail loud with an error that names the cause. Never retry or delete. |
| One key alone authorizes a replace | Unit tests prove that each key alone refuses. |
| A race between the survey and the push | The lease pins the observed sha, so the push fails safely. |
| Unmerged remote commits are lost | Content containment fails closed. The racing-writer test still refuses. |

## Rollback

Revert the `ship.mjs` change. The ship goes back to refusing, and the manual-delete workaround comes back with the restored KNOWN-LIMITATIONS entry. No data, settings or ports change.

## Success criteria

- [ ] On a fresh consumer, ship, squash-merge, then ship the same day. A PR opens with no manual step.
- [ ] A remote lane branch with unmerged commits is refused and its sha is unchanged.
- [ ] A remote tip with `merged:false`, or one that is not content-delivered, is refused.
- [ ] The #1190 entry is gone from `docs/KNOWN-LIMITATIONS.md`.

## Proposal question round

Skipped. The maintainer's rulings above settle the product decisions.
