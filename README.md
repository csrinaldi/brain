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

> Note: the versioned installer (Slice 6) is not yet implemented. For now, use this repo as a template.

1. Clone or fork this repo.
2. Fill in `brain.config.json` with your project identity (name, slug, gitHost, gitProjectId, owner).
3. Copy `.env.example` to `.env` and add your tokens.
4. Run `npm run env:init` — sets up the credential helper, SDD harness, and memory backend.
5. Start every workday with `npm run day:start`.
6. Add your domain knowledge in `brain/project/`, your ADRs in `brain/project/decisions/`.
7. Use `npm run project:feature` to plan a change with SDD, `npm run repo:check` to validate the repo.

---

## Key commands

| Command | What it does |
|---|---|
| `npm run env:init` | Interactive first-time setup (tokens, harness, memory). |
| `npm run day:start` | Pull memory, show open tickets, check for brain updates. |
| `npm run ticket:start` | Start work on a ticket (creates branch, worktree). |
| `npm run project:feature` | Start a new SDD change (proposal → spec → design → tasks). |
| `npm run brain:nav` | Verify navigation integrity of `brain/` (no orphans, no broken links). |
| `npm run repo:check` | Check for prohibited references and structural violations. |
| `npm run memory:share` | Materialize memory to `.memory/` before pushing. |

---

## Harness and memory adapters

The harness (`SDD_HARNESS` in `.env`) and the memory backend (`MEMORY_BACKEND` in `.env`) are swappable. Defaults: `gentle-ai` and `engram`.

See [ADR-0001](brain/project/decisions/adr-0001-arquitectura-3-capas-harness-reemplazable.md) and [ADR-0005](brain/project/decisions/adr-0005-adapter-harness-sdd-harness.md) for the design.
