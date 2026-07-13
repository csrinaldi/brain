# SDD Harness Contract

> **status:** current | **last-reviewed:** 2026-06-24 | **owner:** @crinaldi

> **Purpose:** defines the abstract verbs that any SDD harness must implement
> to be compatible with this project. Referenced by ADR-0002.

The current harness is `gentle-ai`. Another harness may replace it as long as it implements
this contract — without changes to `project-workflow.md` or `developer-environment.md`.

---

## Required verbs

> **Naming note (v0.8.0+):** the `brain:*` prefix is now the canonical name for all
> brain-managed verbs. The short aliases (e.g. `env:init`, `repo:check`) remain as
> deprecated aliases pointing at the same targets — they will be removed in a future
> major release.
>
> **v0.8.1:** `brain:session:start` is the canonical form of `session:start` (added in v0.8.0
> but missed the prefix). The `session:start` alias continues to work.

| Canonical verb (npm) | Deprecated alias | Verb (Claude) | Responsibility |
|---|---|---|---|
| `npm run brain:env:init` | `env:init` | — | Environment bootstrap: installs tools, configures auth, imports memory, refreshes skill registry. Idempotent. |
| `npm run brain:day:start` | `day:start` | — | Daily startup: VCS auth, ecosystem updates, team memory, ticket board. |
| `npm run brain:session:start` | `session:start` | — | Session context loader: restores manifest churn, hydrates local engram, resolves active change and ticket memory. Read-only, local-only, no network. |
| `npm run brain:ticket:start -- <id> --worktree --base <tracker>` | `ticket:start -- <id>` | `/ticket-start <id>` | Task start. Creates the branch `{type}/issue-{number}-{slug}` in an ISOLATED WORKTREE off `<tracker>`. **Always an isolated worktree; NEVER a branch in the main checkout when parallel work is possible.** `<tracker>` is the integration base (e.g. `feature/v2.0.0`), not `main`, while an epic is in flight. |
| `npm run brain:project:feature -- --issue <id>` | `project:feature -- --issue <id>` | `/sdd-new <id>` | Starts an SDD change: creates `openspec/changes/issue-<id>-<slug>/` with `proposal.md`, `design.md`, `tasks.md`, `spec.md`. |
| `npm run brain:repo:check` | `repo:check` | — | Validates prohibited references across the entire tree. Minimum gate before any commit. |
| `npm run brain:change:verify` | `change:verify` | `/sdd-verify` | Validates the scope of the active change: classifies the diff, runs only the necessary verifications. |
| `npm run memory:share` | — | — | Exports local engram → `.memory/` (versioned in git). Run before pushing. |
| `npm run memory:pull` | — | — | Imports `.memory/` → local engram. Brings the team's memory. |
| `npm run memory:index` | — | — | Reprojects `brain/` → local engram. Needed when ADRs or glossary change. |

> **Worktree convention (load-bearing):** task start is
> `npm run brain:ticket:start -- <id> --worktree --base <tracker>`. The isolated worktree is
> mandatory whenever parallel work is possible — it gives one-branch-per-worktree isolation
> over a shared object store (single fetch, zero extra clone). A branch in the main checkout
> is only acceptable for strictly solo, serial work. This rule prevents the whole team from
> colliding on one working tree.

## Optional verbs (recommended)

| Verb (Claude) | Responsibility |
|----------------|-----------------|
| `/sdd-explore <idea>` | Investigation prior to the proposal. Does not create artifacts. |
| `/sdd-continue` | Advances the next ready phase of the SDD cycle. |
| `/sdd-apply` | Implements the tasks of the active change. |
| `/sdd-archive` | Closes the change and consolidates artifacts. |
| `/retomar` | Recovers the context from the previous session from engram + the VCS board. |
| `/issue-create` | Creates an issue from a description or changeset. Provider-specific skill (e.g. `gitlab-issue`). |
| `/mr-create` | Opens a PR/MR linked to an issue. Provider-specific skill. |

## Artifact contract

An SDD change produces exactly these artifacts under `openspec/changes/issue-<iid>-<slug>/`:

```
proposal.md   — PRD aprobado por humano (obligatorio)
spec.md       — requisitos delta del cambio
design.md     — decisiones técnicas y approach
tasks.md      — checklist de implementación
```

Artifacts live in `openspec/` during the change flight.
Only the durable residue (ADRs, anti-patterns, glossary) is promoted to `brain/` — see
`brain/methodology/consolidation-protocol.md`.

## Current implementation (gentle-ai)

`gentle-ai` implements this contract. Claude skills are installed with
`gentle-ai install` and maintained with `gentle-ai upgrade`. The local registry is
refreshed automatically on `brain:day:start` and `brain:env:init`.

See `brain/methodology/agent-skills.md` for the full skill inventory.

## Implementation note — materialized memory layer

`.memory/` is the canonical directory versioned in git for the team's materialized memory.
The binding to engram (current implementation) uses a symlink `/.engram → .memory/`, so that
engram writes to `.engram/` (its internal convention) and files land in `.memory/`.
ADR-0003 documents the memory model; this symlink is an implementation-agnostic detail.
