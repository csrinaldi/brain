# ADR-0034 Amendment 5: the lane replaces its own provably merged branch under a lease (issue #1190)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1190-lane-reship-after-squash/brain-drafts/adr-0034-amendment-5.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0034-memory-travels-on-its-own-lane.md
amendment: 5
issue: 1190
home-summary: the one forced update a lane takes is replacing its own remote branch, by lease on the observed sha, only when the remote tip is content-delivered on main and the newest pull request is merged; a remote rule forbidding it still refuses loudly and the branch is never deleted, #1190
body: ## Amendment 5 — the lane replaces its own merged remote branch under a lease (issue #1190)
body-end: ### Notes for the promoter
```

```amend-find
Correction on any tier is a `supersedes` record (#805), never a force-push
```

```amend-replace
Correction on any tier is a `supersedes` record (#805), never a force-push **[Annotated by Amendment 5 (#1190): this governs correcting a RECORD. The one forced update the lane itself takes is replacing its own remote lane branch, by lease on the observed sha, when that branch is provably merged — see Amendment 5.]**
```

## Amendment 5 — the lane replaces its own merged remote branch under a lease (issue #1190)

**Signed**: DD/MM/YYYY — <Name>

### What changed

`brain:memory:ship` replaces the remote `memory/<host>-<date>` with
`git push --force-with-lease=refs/heads/<branch>:<observed sha>` if and only if BOTH keys hold:

1. the remote tip is content-delivered on `origin/main` (every lane path byte-identical), a git
   read that runs first and makes no port call;
2. the newest pull request for the head is `merged: true` (an open pull request wins; otherwise
   the highest-numbered one decides).

Either key alone, an unknown, or a failed survey keeps `memory.ship.diverged`. A new pull request
is opened for the replaced branch and auto-merge is armed as on any run.

### Why

Both providers squash on auto-merge and nothing deletes the merged branch. A second ship the same
UTC day reparents onto `origin/main`, finds the remote branch at its pre-squash tip, and refused as
diverged. The only way out was a manual remote branch delete, a Tier 2 act, so a lane could not ship
twice in a day without a human step, which breaks this ADR's promise on a fresh consumer (ADR-0036).

### Why this is not a Tier 3 violation

It is not a history rewrite of shared work. The product acts, not an agent. It acts only on its own
lane branch, only after proving that every byte on the branch is already on `main` and that the pull
request merged, so nothing is lost. The lease names the exact sha the survey observed, so any
concurrent push is refused rather than clobbered.

### What this does NOT close, said plainly

- A remote rule forbidding forced updates on `memory/*` (a protection, a ruleset,
  `receive.denyNonFastForwards`) still refuses: the ship fails with `memory.ship.replaceRefused`,
  once, with no retry. The branch is never deleted by the product.
- The cross-day sweep calls the same `shipLane`, so a prior-day pending ref inherits the replace
  path. Both keys are still required, so nothing unmerged is replaced.
- The merged key trusts `mrList`, which carries no head sha: a merged pull request for this head
  name is taken as the proof, backed by the content key.
- A stale lease (the remote moved after the survey) fails with `memory.ship.leaseStale`, is reported
  as a divergence, and is never retried.

### Notes for the promoter

One in-place annotation of the "never a force-push" sentence in L2. Amendment 4 is the latest
amendment today; this is number 5.
