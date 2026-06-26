# Tasks — VCS Adapter

> Implements [proposal.md](proposal.md) following [design.md](design.md). Grouped by chained PR (see design.md §Chained PR plan). Each PR is independently mergeable and revertible.

## PR1 — Foundation (additive, zero behavior change)
- [x] 1.1 Create `brain/core/methodology/vcs-contract.md` — the 10 abstract verbs + normalized shapes.
- [x] 1.2 Add v0.2.0 migration in `brain/core/config-migrations.mjs` that adds `vcs.provider` (additive).
- [x] 1.3 Create dispatcher `scripts/vcs/cli.mjs` (reads `vcs.provider`, delegates; usable as lib and CLI).
- [x] 1.4 Skeletons `scripts/vcs/providers/{github,gitlab}.mjs` (verb signatures, unimplemented).
- [x] 1.5 Shared normalization helpers (status enum, naming).
- [x] 1.6 Tests: additive v0.2.0 migration + dispatcher provider resolution.
- [x] 1.7 Apply the migration to this repo's `brain.config.json` (`vcs.provider: github`).

## PR2 — Providers
- [ ] 2.1 `gitlab.mjs`: implement the 10 verbs reproducing the current behavior (glab + API).
- [ ] 2.2 `github.mjs`: implement the 10 verbs via `gh` (+ `project-resolve` no-op, `commit-status` mapping).
- [ ] 2.3 Tests for each provider against the contract (normalization verified).

## PR3 — Read-only callers
- [ ] 3.1 Refactor `tracker-board.mjs` → dispatcher (`authCheck`, `whoami`, `projectResolve`, `issueList`).
- [ ] 3.2 Refactor `project-status.mjs` → dispatcher (`authCheck`, `issueList`, `mrList`).
- [ ] 3.3 Verify `tracker:board` and `project:status` end-to-end against GitHub (this repo).

## PR4 — Auth + sync
- [ ] 4.1 Refactor `day-start.mjs` → dispatcher (`authCheck`, `authLogin`, `whoami`, `commitStatus`, `repoCloneUrl`).
- [ ] 4.2 Verify the check-and-notify and main sync still work.

## PR5 — Ticket
- [ ] 5.1 Refactor `ticket-start.mjs` → dispatcher (`issueView`, `repoCloneUrl`); `iid`→`number` in branch naming.

## PR6 — Bootstrap + tools
- [ ] 6.1 Refactor `bootstrap.sh`: provider-agnostic credential helper, `authCheck`/`authLogin`/`patSetupUrl`/`issueList` via dispatcher.
- [ ] 6.2 `install-tools.sh`: install `gh` or `glab` based on `vcs.provider`.

## Closure
- [ ] README + `brain/core/methodology/harness-contract.md` updated.
- [ ] Verify criterion: no script invokes `glab` or `/api/v4/` directly (`rg` clean).
- [ ] `repo:check` + `npm test` green.
