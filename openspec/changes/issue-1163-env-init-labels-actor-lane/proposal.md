# Proposal — env:init creates the governance labels, resolves brain.actor and states the lane (#1163, #1164, #1166)

## Problem

The 1.9.0 demo of a fresh consumer showed three first-run failures, all in `env:init`:

- **#1163** — the consumer has no `status:approved` label, so no issue can be approved and its first PR fails `issue-link`. No verb creates the governance labels.
- **#1164** — the first `brain:memory:save` fails with "no configured actor". Neither `env:init` nor the guide sets or mentions `git config --local brain.actor`.
- **#1166** — the guide never mentions `memory.lane.enabled`, which is off by default for consumers, nor how to turn it on.

They ship as one change because all three live in `env:init`.

## Approach

1. **Labels.** A new VCS port verb `labelCreate` (both adapters). `env:init` reads the remote's labels through `labelList`, creates only the missing ones (approved label, the `type:*` set, `size:exception`, `skip:memory-gate`, and on GitHub the `governance:*` alarm labels the postmerge workflow files), and reports what it created.
2. **Actor.** `env:init` keeps a valid existing `brain.actor`, otherwise writes the authenticated VCS identity (`whoami`) to the local git config, otherwise lists a pending step with the exact command. Never derived from `user.name`.
3. **Lane.** `tier-notice.mjs` gains `laneNotice`/`renderLaneNotice` — same two halves, same catalogs, printed by the same `printTierNotice` — stating on/off, why off by default, and the exact command to turn it on.
4. **Failure classes.** Unreachable/unauthenticated VCS, a refused create, or no identity are OPTIONAL with a next step (`MISSING_OPTIONAL`); a defect of the step itself is REQUIRED (`REQUIRED_FAILURES`).
5. **Guide.** `docs/adoption.md` describes the published 1.9.0 package, so it gains only the manual steps 1.9.0 needs. The text for the new behaviour is in `release-notes.md`, applied at the next release cut.

## Out of scope

`hooks/commit-msg` (#1161), the postmerge cursor (#1162) and the memory backend moving into tracked config (#1165). Editing `brain/core/**` or `brain/project/**`: the `vcs-contract.md` row for `labelCreate` is a draft in `brain-drafts/`.
