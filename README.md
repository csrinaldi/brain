# brain

A generic, project-agnostic system for AI-assisted software development.

brain combines three things:
- **Knowledge base** (`brain/`): living documentation, ADRs, domain model, anti-patterns.
- **SDD scaffolding** (`openspec/`): Spec-Driven Development artifacts — proposals, specs, designs, tasks, verify reports.
- **Memory** (`.memory/`): git-based **durable** team memory + per-feature **working** memory (`resume.md`), queryable by AI agents across sessions and machines.

It is **self-hosting**: this repo uses brain itself to document and evolve brain.

---

## The 3 layers

```
brain/core/          ← Generic product. Read-only for consumers. Upstream-first.
brain/project/       ← Consumer-specific: your ADRs, domain, rules. Yours to own.
brain/scripts/       ← Managed harness verbs (brain:env:init, brain:day:start, brain:ticket:start, …)
openspec/            ← SDD artifacts for active and archived changes.
.memory/             ← Git-based durable team memory (content-addressed chunks).
```

`brain/core/` (product) and `brain/scripts/` (harness) are the managed,
upstream-first parts. `brain/project/` is yours to own.

---

## How to adopt brain

brain installs into a consumer repo from a git **tag** — no registry, works with
private repos ([ADR-0006](brain/project/decisions/adr-0006-distribucion-installer-versionado.md)).
Every step below is validated end-to-end by `npm run test:fresh-install` (a
clean-container integration test).

> **Before you start** — authenticate to GitHub so git can fetch the (private)
> brain repo over HTTPS: `gh auth login && gh auth setup-git`, or configure a PAT
> credential helper. The `github:` npm shorthand resolves to **SSH**; the
> commands below use **HTTPS** (`git+https`) so they work without an SSH key.

```bash
# 0. If your repo has no package.json yet:
npm init -y

# 1. Install brain at a pinned tag (HTTPS):
npm i -D "git+https://github.com/csrinaldi/brain.git#v0.9.4"

# 2. Add the brain script aliases to your package.json "scripts":
#      "brain:upgrade": "node node_modules/brain/brain/scripts/brain-upgrade.mjs",
#      "brain:env:init": "bash ./brain/scripts/bootstrap.sh",
#      "brain:day:start": "node ./brain/scripts/day-start.mjs"

# 3. Copy the managed paths (brain/core, brain/scripts) into your repo:
npm run brain:upgrade -- v0.9.4

# 4. Initialize the environment (interactive):
npm run brain:env:init
```

> **Using pnpm / yarn / bun?** brain is **package-manager-agnostic** — it detects your
> PM and runs through it. Use your PM's verbs throughout:
>
> ```bash
> pnpm add -D "git+https://github.com/csrinaldi/brain.git#v0.9.4"
> pnpm run brain:upgrade -- v0.9.4     # brain:upgrade installs via your detected PM
> pnpm run brain:env:init
> pnpm run brain:day:start
> ```
>
> (yarn: `yarn add … && yarn brain:upgrade -- v0.9.4`; bun: `bun add -d … && bun run brain:upgrade`.)
> The fresh-install test covers npm / pnpm / yarn / bun fixtures.

`brain:env:init` does the heavy lifting:

- **Creates `brain.config.json`** if missing and derives `vcs.provider`,
  `gitHost`, and `slug` from your git origin (confirm/override the provider on a TTY).
- Prompts for your **`VCS_TOKEN`** (offers to open the provider's PAT page),
  writes it to `.env`, and configures the HTTPS git credential helper.
- Selects and initializes the SDD harness and the memory backend.
- Reports any ecosystem tools to install — run `gentle-ai install` for `engram`
  and `gga`.
- Configures the git **hooks** (`core.hooksPath = brain/scripts/hooks`).

**Safe by design** — `brain:env:init` never overwrites your code or history. It creates
`brain.config.json` only if missing (and only fills empty fields otherwise,
preserving your values), sets *local* git config (per-clone, not committed), and
writes the gitignored `.env`. The only command that overwrites files is
`brain:upgrade`, and it touches only brain's *managed* paths (`brain/core`,
`brain/scripts`, …) — never your `brain/project/`, your config, or your code.

> **Git hooks are per-clone.** `core.hooksPath` is a local git setting (git won't
> auto-install hooks from a clone, by design). Each teammate runs `brain:env:init` once
> per clone — or just `brain:day:start`, which **self-heals** the hook config every workday.

Then:

1. Add your domain knowledge in `brain/project/`, your ADRs in `brain/project/decisions/`.
2. `npm run brain:day:start` every workday — pulls memory, shows open tickets, and
   **notifies you of a newer brain tag** (it never auto-updates).
3. `npm run brain:project:feature` to plan a change with SDD; `npm run brain:repo:check` to
   validate the repo before pushing.

### Updating brain

```bash
npm run brain:upgrade -- v0.9.4             # install a newer tag, copy managed paths
npm run brain:upgrade -- v0.9.4 --dry-run   # preview what would change
```

Read the [CHANGELOG](CHANGELOG.md) before upgrading — **renames / breaking
changes** need manual action (e.g. v0.4.0 renamed the credential var to
`VCS_TOKEN`). Additive `brain.config.json` migrations apply automatically.

**The golden rule** ([ADR-0003](brain/project/decisions/adr-0003-split-core-project-self-hosting.md) /
[ADR-0006](brain/project/decisions/adr-0006-distribucion-installer-versionado.md)):
`brain/core/**` is **read-only in the consumer**. The upgrade overwrites only the
*managed* paths and never touches your *local* ones:

| Managed (overwritten on upgrade) | Local (never touched) |
|---|---|
| `brain/core/**` | `brain/project/**` |
| `scripts/**` | `brain.config.json` (migrated additively) |
| `.gitattributes` | `.env`, `openspec/changes/**`, `.memory/**` |

The path manifest lives in [`brain/core/managed-paths.mjs`](brain/core/managed-paths.mjs);
config schema changes ship as additive migrations in
[`brain/core/config-migrations.mjs`](brain/core/config-migrations.mjs). Improvements
to core go **upstream first** (PR to the brain repo), then you bump the version.

---

## Key commands

| Command | What it does |
|---|---|
| `npm run brain:env:init` | Interactive first-time setup: bootstraps `brain.config.json`, `VCS_TOKEN`, harness, memory. |
| `npm run brain:day:start` | Pull memory, show open tickets, check for a newer brain tag. |
| `npm run brain:ticket:start -- <id>` | Start work on a ticket (creates branch / worktree). |
| `npm run brain:project:feature` | Start a new SDD change (proposal → spec → design → tasks). |
| `npm run brain:upgrade -- <tag>` | Install/update brain core at a tag; copies managed paths only. |
| `npm run feature:checkpoint` / `feature:resume` | Save / restore per-feature working memory (`resume.md`). |
| `npm run brain:repo:check` | Check for prohibited references and structural violations. |
| `npm run memory:share` | Materialize memory to `.memory/` before pushing. |
| `npm run memory:pull` | **Cross-machine sync**: safe pull — discards regenerable manifest churn, runs `git pull`, then imports `.memory/` into local engram. Use this instead of raw `git pull` when `.memory/manifest.json` is dirty (i.e. after `memory:share` ran locally). Raw `git pull` may abort with "your local changes would be overwritten" when the manifest is uncommitted. |
| `npm test` | Harness unit tests (`node --test`). |
| `npm run brain:start` / `check` / `save` / `ship` / `next` | **Golden path** — self-gating workflow verbs (start a ticket → check → save memory → ship a PR; `next` tells you the next step). |
| `npm run brain:audit` | Re-verify the 4 governance invariants on merged history (the tool-independent teeth). |
| `npm run brain:governance-status` | Report what governance enforcement your repo's platform + tier supports. |
| `npm run brain:protect` | One-time admin: activate platform branch protection where the tier allows it. |
| `npm run test:fresh-install -- <tag>` | **Maintainer**: e2e Docker test of the full consumer install from a tag. |

---

## Adapters (everything swappable)

brain follows the adapter pattern throughout — the repo is agnostic to the tools underneath:

| Concern | Selector | Default | ADR |
|---|---|---|---|
| SDD harness | `SDD_HARNESS` (`.env`) | `gentle-ai` | [ADR-0005](brain/project/decisions/adr-0005-adapter-harness-sdd-harness.md) / [ADR-0012](brain/project/decisions/adr-0012-harness-init-adapter.md) |
| Memory backend | `MEMORY_BACKEND` (`.env`) | `engram` | [ADR-0004](brain/project/decisions/adr-0004-adapter-memoria-memory-backend.md) |
| VCS provider | `vcs.provider` (`brain.config.json`) | from git origin | [ADR-0008](brain/project/decisions/adr-0008-adapter-vcs-provider.md) |

See [ADR-0001](brain/project/decisions/adr-0001-arquitectura-3-capas-harness-reemplazable.md) for the replaceable-harness architecture.
