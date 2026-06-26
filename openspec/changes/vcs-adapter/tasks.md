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
- [x] 2.1 `gitlab.mjs`: implement the 10 verbs reproducing the current behavior (glab + API).
- [x] 2.2 `github.mjs`: implement the 10 verbs via `gh` (+ `project-resolve` identity, `commit-status` mapping).
- [x] 2.3 Tests for each provider against the contract (normalization verified) — `scripts/vcs/providers.test.mjs`.

## PR3 — Read-only callers
- [x] 3.1 Refactor `tracker-board.mjs` → dispatcher (`authCheck`, `whoami`, `issueList`). New `scripts/vcs/lib/repo.mjs` (origin identity). Output stays Spanish (separate concern).
- [x] 3.2 Refactor `project-status.mjs` → dispatcher (`authCheck`, `issueList`, `mrList`); only the VCS section, Maven/Nx untouched.
- [x] 3.3 Verified `tracker:board` and `project:status` end-to-end against GitHub (issue #2 listed via gh).

## PR4 — Auth + sync
- [x] 4.1 Refactor `day-start.mjs` → dispatcher (`authCheck`, `authLogin`, `whoami`, `commitStatus`, `repoCloneUrl`). New `scripts/vcs/lib/token.mjs` (provider→token env). Comments translated to English.
- [x] 4.2 Verified: targeted e2e of `commitStatus`/`repoCloneUrl` against this GitHub repo; main-sync ff-only + recovery logic preserved.

## PR5 — Ticket
- [x] 5.1 Refactor `ticket-start.mjs` → dispatcher (`issueView`, `repoCloneUrl`); `iid`→`number` in branch naming. Comments English; output stays Spanish (i18n later). Verified `issueView(#2)` e2e against GitHub.

## PR6 — Bootstrap + tools
- [ ] 6.1 Refactor `bootstrap.sh`: provider-agnostic credential helper, `authCheck`/`authLogin`/`patSetupUrl`/`issueList` via dispatcher.
- [ ] 6.2 `install-tools.sh`: install `gh` or `glab` based on `vcs.provider`.

## Closure
- [ ] README + `brain/core/methodology/harness-contract.md` updated.
- [ ] Verify criterion: no script invokes `glab` or `/api/v4/` directly (`rg` clean).
- [ ] `repo:check` + `npm test` green.
