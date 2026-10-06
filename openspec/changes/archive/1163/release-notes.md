# Release notes — to apply at the next release cut

Apply to `docs/adoption.md` when the release containing #1163, #1164 and #1166 is cut; until then the guide describes the published 1.9.0 and carries the manual steps instead ("Three things `env:init` does not do yet").

## Replace the section "Three things `env:init` does not do yet (brain 1.9.0)" with

### What `env:init` sets up for the first PR and the first memory save

| Step | What `env:init` does | If it cannot |
|---|---|---|
| Governance labels | Creates, through the VCS port, the approved label (`governance.approvedLabel`, default `status:approved`), the `type:*` labels `brain:ship` and `ticket:start` read, `size:exception`, `skip:memory-gate` and, on GitHub, the `governance:*` alarm labels. It only creates what is missing, so a re-run changes nothing, and it reports what it created. | Pending step, exit 0: the summary lists it with `npm run brain:env:init` (re-run once the VCS is reachable and authenticated) and the hand command, e.g. `gh label create "status:approved"`. |
| `brain.actor` | Keeps a valid one you already configured; otherwise writes your authenticated VCS identity as `@<username>` with `git config --local`. It never derives it from `user.name`. | Pending step, exit 0: `git config --local brain.actor @<handle>`. |
| Memory lane | States, on every run, whether the lane is on. It is off by default on every tier because it opens a separate pull request for memory records that a maintainer has to merge. | Nothing to fail; to turn it on: `npm run brain:config -- set memory.lane.enabled true`. |

## Add to the "What the `env:init` summary tells you" table

| Governance labels / `brain.actor` | | VCS unreachable or unauthenticated, a refused label create, or no VCS identity |

## Add to "What `npm run brain:env:init` actually does" (step 2)

"... creates the governance labels, resolves `brain.actor`, states whether the memory lane is on ..."
