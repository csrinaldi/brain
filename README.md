# brain

A generic, project-agnostic system for AI-assisted software development.

brain combines three things:
- **Knowledge base** (`brain/`): living documentation, ADRs, domain model, anti-patterns.
- **SDD scaffolding** (`openspec/`): Spec-Driven Development artifacts — proposals, specs, designs, tasks, verify reports.
- **Team memory** (`.memory/`): git-based persistent memory, queryable by AI agents across sessions.

It is **self-hosting**: this repo uses brain itself to document and evolve brain.

---

## The 3 layers

```
brain/core/          ← Generic product. Read-only for consumers. Upstream-first.
brain/project/       ← Consumer-specific: your ADRs, domain, rules.
scripts/             ← Harness verbs (env:init, day:start, ticket:start, …)
openspec/            ← SDD artifacts for active and archived changes.
.memory/             ← Git-based durable team memory (content-addressed chunks).
```

`brain/core/` is the reusable part. `brain/project/` is yours to own.

---

## How to adopt brain

brain installs into a consumer repo from a git tag — no registry, works with
private repos (see [ADR-0006](brain/project/decisions/adr-0006-distribucion-installer-versionado.md)).

```bash
# In your project, install + copy the brain core at a pinned version:
npm run brain:upgrade -- v0.1.0
# (the first run requires the brain scripts; bootstrap them by installing once:
#  npm i -D github:csrinaldi/brain#v0.1.0  and add the npm script alias)
```

Then:

1. Fill in `brain.config.json` with your project identity (name, slug, gitHost, gitProjectId, owner).
2. Copy `.env.example` to `.env` and add your tokens.
3. Run `npm run env:init` — sets up the credential helper, SDD harness, and memory backend.
4. Start every workday with `npm run day:start` — it also **checks for a newer brain version and notifies you** (it never auto-updates).
5. Add your domain knowledge in `brain/project/`, your ADRs in `brain/project/decisions/`.
6. Use `npm run project:feature` to plan a change with SDD, `npm run repo:check` to validate the repo.

### Updating brain

```bash
npm run brain:upgrade -- v0.2.0     # install a newer tag and copy managed paths
npm run brain:upgrade -- v0.2.0 --dry-run   # preview what would change
```

**The golden rule** (ADR-0003 / ADR-0006): `brain/core/**` is **read-only in the
consumer**. The upgrade overwrites only the *managed* paths and never touches your
*local* ones:

| Managed (overwritten on upgrade) | Local (never touched) |
|---|---|
| `brain/core/**` | `brain/project/**` |
| `scripts/**` | `brain.config.json` (migrated additively) |
| `.gitattributes` | `.env`, `openspec/changes/**`, `.memory/**` |

The path manifest lives in [`brain/core/managed-paths.mjs`](brain/core/managed-paths.mjs).
Config schema changes ship as additive migrations in
[`brain/core/config-migrations.mjs`](brain/core/config-migrations.mjs) — new keys are
added with defaults, your existing values are preserved. Improvements to core go
**upstream first** (PR to the brain repo), then you bump the version.

---

## Key commands

| Command | What it does |
|---|---|
| `npm run env:init` | Interactive first-time setup (tokens, harness, memory). |
| `npm run day:start` | Pull memory, show open tickets, check for brain updates. |
| `npm run brain:upgrade -- <tag>` | Install/update the brain core at a version; copies managed paths only. |
| `npm test` | Run the harness unit tests (`node --test`). |
| `npm run ticket:start` | Start work on a ticket (creates branch, worktree). |
| `npm run project:feature` | Start a new SDD change (proposal → spec → design → tasks). |
| `npm run brain:nav` | Verify navigation integrity of `brain/` (no orphans, no broken links). |
| `npm run repo:check` | Check for prohibited references and structural violations. |
| `npm run memory:share` | Materialize memory to `.memory/` before pushing. |

---

## Harness and memory adapters

The harness (`SDD_HARNESS` in `.env`) and the memory backend (`MEMORY_BACKEND` in `.env`) are swappable. Defaults: `gentle-ai` and `engram`.

See [ADR-0001](brain/project/decisions/adr-0001-arquitectura-3-capas-harness-reemplazable.md) and [ADR-0005](brain/project/decisions/adr-0005-adapter-harness-sdd-harness.md) for the design.
