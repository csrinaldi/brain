# Changelog

All notable changes to brain. Distributed via git tags (ADR-0006); consumers
upgrade with `npm run brain:upgrade -- <tag>`. Read this file for **renames /
breaking changes** before upgrading — additive `brain.config.json` migrations
apply automatically, but renames need manual action.

## v0.4.1 — 2026-06-27

### Fixed

- `brain-upgrade` (and the install flow) now use `git+https://…#<tag>` instead of
  npm's `github:` shorthand, which resolved to SSH and failed for the **private**
  brain repo on HTTPS-only consumers (CI / containers without an SSH key).
  `package.json` gains a `repository` field; the install URL is derived from it
  and normalized to `git+https`. (#44)

## v0.4.0 — 2026-06-27

### ⚠ BREAKING

- **VCS credential env var is now generic `VCS_TOKEN`** (was provider-specific
  `GITHUB_TOKEN` / `GITLAB_TOKEN`). **Action for consumers**: rename the variable
  in your `.env` to `VCS_TOKEN`, then re-run `npm run env:init` to refresh the git
  credential helper. (#33)

### Added

- **CLI output i18n** — harness output externalized to message catalogs
  (`scripts/i18n/`) with an English canonical fallback, driven by `docs.language`. (#11)
- **Feature-scoped working memory** — a second memory layer that travels with the
  feature branch (`openspec/changes/<feature>/resume.md` + `feature-checkpoint` /
  `feature-resume` verbs), hydrated into local engram, never merged to `main`.
  (ADR-0011, #16)
- **Harness-init adapter** — each SDD harness defines its own `init` via
  `scripts/harness/`; `bootstrap.sh` dispatches instead of an inline `case`.
  (ADR-0012, #27)
- **`env:init` bootstraps `brain.config.json`** for a fresh consumer: creates it
  from the schema and derives `vcs.provider` + `gitHost` + `slug` from the git
  origin (interactive provider confirm on a TTY). (#41, #35)

### Changed

- Restored the `.memory/` ↔ `.engram` abstraction: `.memory/` is the committed
  canonical directory, `.engram` a local symlink. The pre-push memory guard now
  actually works. (#234)
- The feature-working-memory contract is promoted to `brain/core/`. (#26)

### Fixed

- `feature-checkpoint` resolves the single active change that has a `resume.md`
  in multi-change repos. (#25)
- The harness SDD-context check resolves the engram project as the bare repo
  name (no spurious "context not found" notice). (#37)
- Stale `ADR-0003` references corrected; `package-lock.json` gitignored
  (zero-dependency repo). (#23, #28)

## v0.1.0

Initial versioned release: NX monorepo, VCS provider adapter, versioned
installer with managed paths + additive migrations, memory backend adapter,
check-refs engine.
