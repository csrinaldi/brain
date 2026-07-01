# Changelog

All notable changes to brain. Distributed via git tags (ADR-0006); consumers
upgrade with `npm run brain:upgrade -- <tag>`. Read this file for **renames /
breaking changes** before upgrading — additive `brain.config.json` migrations
apply automatically, but renames need manual action.

## v0.8.0 — brain:* verb namespace + automated consumer migration (#137)

### New: 8 `brain:*` canonical verbs

All harness commands now have a `brain:`-prefixed canonical name alongside the
original verb, which continues to work as a deprecated alias:

| New canonical verb      | Deprecated alias   |
|-------------------------|--------------------|
| `brain:env:init`        | `env:init`         |
| `brain:day:start`       | `day:start`        |
| `brain:ticket:start`    | `ticket:start`     |
| `brain:project:feature` | `project:feature`  |
| `brain:project:status`  | `project:status`   |
| `brain:tracker:board`   | `tracker:board`    |
| `brain:repo:check`      | `repo:check`       |
| `brain:change:verify`   | `change:verify`    |

Both forms invoke the **same direct `node` target** — no indirection, no
subprocess, no name-coupling. Old verbs are functional in 0.8.0 and will not
be removed before the next MAJOR version.

### New capability: automated `package.json` migration on `brain:upgrade`

`brain:upgrade` now **additively injects** all 8 `brain:*` script keys into
the consumer's `package.json`. Rules:

- **Consumer-wins**: if a key already exists in the consumer's `scripts`, its
  value is never overwritten.
- **Additive only**: no existing key is deleted, renamed, or reordered.
- **Idempotent**: running `brain:upgrade` a second time leaves `package.json`
  byte-identical — no mtime churn.
- **Non-scripts fields** (`version`, `dependencies`, etc.) are never touched.
- Implemented via the `specialMerge` path in `copyManaged`, the same
  mechanism already used for `.claude/settings.json`. Controlled by
  `MANAGED_SCRIPT_KEYS` in `brain/core/managed-paths.mjs` (single source of
  truth — keys and targets are never hardcoded in two places).

**No action required**: `brain:upgrade` handles migration automatically on
the first upgrade to 0.8.0.

## v0.7.2 — core→project link fix + nav guard

- `check-brain-nav` now flags any `brain/core/**` link that resolves into
  `brain/project/**`. Core is generic and shipped to consumers; `brain/project/**`
  is consumer-owned and varies — so a core→project link resolves in brain's own
  self-hosting but **breaks every consumer's `brain:nav`**. Fixed the one offender
  (`core/methodology/workflow-governance.md` referenced `ADR-0014` by path → now by
  name). Discovered dogfooding the catastro/plataforma-scit adoption. (#126)

## v0.7.1 — maintenance

- `gitlab.capabilities()` now returns a `detail` field on the `unknown` outcome,
  so `brain:governance-status` can surface the underlying glab error (parity with
  the other outcomes). No config or behavior changes for consumers.

## v0.7.0 — BREAKING: scripts/ → brain/scripts/ namespace migration (#97)

### BREAKING CHANGE — Manual action required on upgrade

Brain's managed harness directory has moved from the consumer repo root
(`scripts/`) into the `brain/` namespace (`brain/scripts/`). This eliminates the
namespace collision where `brain:upgrade` could overwrite consumer-owned scripts
living at the root `scripts/` path.

**Required migration steps (in order):**

1. **Upgrade brain**: `npm run brain:upgrade -- <new-tag>`
   After this step, `brain/scripts/` is populated with the new harness.

2. **Delete the orphaned root `scripts/`**: the installer never deletes files —
   your old `scripts/` directory remains at the repo root and is now ORPHANED
   (brain no longer manages it). Delete it manually:
   ```bash
   rm -rf scripts/
   ```
   Do NOT delete it before upgrading if you have consumer-owned files there.

3. **Update your `package.json` aliases** (if you seeded them from the README):
   ```json
   {
     "brain:upgrade": "node node_modules/brain/brain/scripts/brain-upgrade.mjs",
     "env:init":      "bash ./brain/scripts/bootstrap.sh",
     "day:start":     "node ./brain/scripts/day-start.mjs"
   }
   ```
   Note the double `brain/` in `node_modules/brain/brain/scripts/...` — this is
   intentional: the installed package is `node_modules/brain/`, and the harness
   now lives at `brain/scripts/` within it.

4. **Run `day:start` after `brain:upgrade`** to self-heal `core.hooksPath`:
   `brain:upgrade` does not write git config. Between the upgrade and the next
   `day:start`, your `core.hooksPath` still points at the old `scripts/hooks`
   (which no longer exists). `day:start` detects this and reconfigures
   `core.hooksPath = brain/scripts/hooks` automatically. During this one-run
   window, git hooks are inactive — run `day:start` promptly.

### Summary of changes

- `scripts/**` → `brain/scripts/**` in the managed-paths manifest.
- `core.hooksPath` reconfigured from `scripts/hooks` → `brain/scripts/hooks`
  by `day:start` on first run after upgrade (self-healing, one-time).
- All npm script aliases in `package.json` updated to `./brain/scripts/...`.
- Bootstrap install path changes from `node_modules/brain/scripts/brain-upgrade.mjs`
  to `node_modules/brain/brain/scripts/brain-upgrade.mjs`.



## v0.6.1 — 2026-06-28

### Fixed

- **pnpm install** (#86): removed the `prepare` script that triggered
  `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` — pnpm 11 blocks git-hosted deps with
  build scripts. brain now installs cleanly via **npm / pnpm / yarn / bun**. The
  `prepare` was useless for consumers (it ran in brain's temporary clone on a
  git-dep install); `core.hooksPath` is configured by `env:init` and self-healed
  by `day:start`.

## v0.6.0 — 2026-06-28

### Added — Workflow governance (ADR-0014, #67)

A **tool-agnostic** governance layer enforcing the 4 load-bearing invariants
(approved ticket · PR ≤400 · memory dumped · ADR for decisions):

- **The floor** (always-on, tool-independent): the generic checks library
  (`scripts/governance/checks/`), the client-hook suite (`commit-msg`,
  `pre-commit`, a reliable `pre-push`), and **`brain:audit`** — re-verifies the
  invariants on merged history (the universal teeth).
- **The hard gate** (additive, capability-aware): `brain:protect` +
  `branchProtect` adapter verb (GitHub; GitLab Phase 3); **`brain:governance-status`**
  reports per-consumer what enforcement the platform/tier actually supports.
- **The golden path**: `brain:start` / `brain:check` / `brain:save` / `brain:ship`
  / `brain:next` — self-gating verbs unifying human + agent.
- **`--no-verify` policy**: a `repo:check` prohibited-reference + a Claude Code
  PreToolUse hook (`.claude/settings.json`).

### Changed

- `pre-push` `.memory/` check is now a **WARNING**, not a hard block — the
  reliability precondition for the `--no-verify` policy (the hook re-materializes
  memory, which churns, so a hard block self-blocked the push).
- New npm scripts: `brain:audit`, `brain:protect`, `brain:governance-status`,
  `brain:start`, `brain:check`, `brain:save`, `brain:ship`, `brain:next`.

### Notes

- **L1 hard enforcement** (branch protection / rulesets) requires **GitHub Pro
  for private repos, a public repo, or self-hosted** — run `brain:governance-status`
  to see your repo's capability. The **floor (hooks + audit) works on every repo,
  tier, and platform**. Activation (`brain:protect`) is a one-time per-repo admin step.

## v0.5.0 — 2026-06-27

### Added

- **Auto-ADR onboarding** (ADR-0013, #53): the bootstrap notices when
  `brain/project/decisions/` has no ADRs and points to the new
  `/project:bootstrap-adrs` agent command, which explores the consumer repo and
  drafts **descriptive** starter ADRs (Stack, Testing, Build) into
  `openspec/changes/auto-adrs/brain-drafts/` (Tier 1). The human accepts each into
  `brain/` via per-action **Tier 2** confirmation; the agent never auto-commits and
  never invents rationale (`Context`/`Consequences` stay `<TODO>` stubs).
- **`memory:import`** verb — `engram sync --import` only (no `git pull`).
- **`post-merge` git hook** — re-imports engram after any pull/merge.

### Fixed

- **Cross-machine `memory:pull` churn** (#59): `engram sync --export` rewrites
  `.memory/manifest.json` and leaves it dirty, blocking a `git pull`
  (*"local changes would be overwritten"*). `memory:pull` is now churn-resilient
  (restore the regenerable manifest → `git pull` → import). The manifest stays
  **committed** — it is engram's authoritative chunk index (see ADR-0002 note);
  gitignoring it would silently lose memory on every fresh machine.

### Changed

- `memory:pull` now performs a safe `git pull` (restore + pull + import), not just
  an import. Use the new **`memory:import`** for the old import-only behavior.

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
