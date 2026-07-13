<!-- generated from brain/HOME.md, brain/core/methodology/agent-authorities.md, brain/core/methodology/harness-contract.md, brain/core/methodology/sdd-layout.md, brain/core/methodology/workflow-governance.md — do not edit.
     Regenerate: SDD_HARNESS=antigravity npm run brain:env:init
     Drift-guarded by antigravity.drift.test.mjs — hand-edits fail CI. -->

---

<!-- source: brain/HOME.md -->

# brain — Knowledge Base

Entry point for the living documentation of this project.

This repo is **self-hosting**: brain uses itself to document and evolve brain.

---

## Getting started

- [Adoption guide](docs/adoption.md) — bring brain into a repo (new repo vs existing repo, step by step)

---

## Generic core (`brain/core/`)

Reusable documentation — applies to any project that adopts this system.
`brain/core/` is upstream and treated as read-only here.

### Methodology

- [Consolidation protocol](brain/core/methodology/consolidation-protocol.md) — how generic improvements flow upstream
- [Agent authorities](brain/core/methodology/agent-authorities.md) — what AI agents can and cannot do
- [Harness contract](brain/core/methodology/harness-contract.md) — abstract SDD verbs any harness must implement
- [SDD canonical layout](brain/core/methodology/sdd-layout.md) — normative openspec/changes/** layout: naming, required artifacts, operational artifacts, single-source accessor
- [VCS contract](brain/core/methodology/vcs-contract.md) — abstract VCS verbs any provider (gh/glab) must implement
- [Feature-working-memory contract](brain/core/methodology/feature-working-memory-contract.md) — the resume.md schema + feature-checkpoint/resume verbs
- [Memory record format](brain/core/methodology/memory-format.md) — the brain-owned durable .memory/ record format (schema, union merge, index)
- [Workflow governance](brain/core/methodology/workflow-governance.md) — four invariants, CI gates, enforce-outputs boundary, lockout recovery

### Anti-patterns (generic)

- [Anti-patterns index](brain/core/anti-patterns/README.md)
  - [config.yaml seq/map mixed](brain/core/anti-patterns/config-yaml-seq-map-mezclados.md)
  - [git diff does not show untracked](brain/core/anti-patterns/git-diff-no-ve-untracked.md)
  - [AI writes brain without human gate](brain/core/anti-patterns/ia-escribe-brain-sin-gate.md)
  - [AI promotes its own artifacts](brain/core/anti-patterns/ia-promueve-sus-propios-artefactos.md)
  - [Self-updating installers are not innocuous](brain/core/anti-patterns/instaladores-autoactualizantes-no-inocuos.md)

---

## Project knowledge (`brain/project/`)

Decisions, domain, and methodology specific to this project.

See [`brain/project/README.md`](brain/project/README.md) for directory conventions.

### Architecture decisions

- [ADR-0001](brain/project/decisions/adr-0001-arquitectura-3-capas-harness-reemplazable.md) — 3-layer architecture with replaceable harness
- [ADR-0002](brain/project/decisions/adr-0002-memoria-git-based-dos-capas.md) — Git-based team memory in two layers
- [ADR-0003](brain/project/decisions/adr-0003-split-core-project-self-hosting.md) — core/project split and self-hosting
- [ADR-0004](brain/project/decisions/adr-0004-adapter-memoria-memory-backend.md) — Memory adapter: MEMORY_BACKEND selector
- [ADR-0005](brain/project/decisions/adr-0005-adapter-harness-sdd-harness.md) — Harness adapter: SDD_HARNESS selector
- [ADR-0006](brain/project/decisions/adr-0006-distribucion-installer-versionado.md) — Distribution: versioned installer via git tags
- [ADR-0007](brain/project/decisions/adr-0007-config-vcs-agnostica-y-checkrefs.md) — VCS-agnostic config and check-refs engine
- [ADR-0008](brain/project/decisions/adr-0008-adapter-vcs-provider.md) — VCS adapter: explicit provider + verb contract
- [ADR-0009](brain/project/decisions/adr-0009-documentation-language-policy.md) — Documentation language policy: core English, project docs configurable
- [ADR-0010](brain/project/decisions/adr-0010-cli-output-i18n.md) — CLI output i18n: message catalogs with English fallback
- [ADR-0011](brain/project/decisions/adr-0011-feature-scoped-working-memory.md) — Feature-scoped working memory: branch-local resume.md
- [ADR-0012](brain/project/decisions/adr-0012-harness-init-adapter.md) — Harness-init adapter: each harness defines its init
- [ADR-0013](brain/project/decisions/adr-0013-auto-adr-onboarding.md) — Auto-ADR onboarding: bootstrap notices, agent drafts, human signs
- [ADR-0014](brain/project/decisions/adr-0014-workflow-governance.md) — Workflow governance: enforce load-bearing invariants server-side
- [ADR-0015](brain/project/decisions/adr-0015-governance-v3-substrate-ladder.md) — Governance v3: six-level fail-closed gate ladder over observable evidence (L1–L6 + substrate rung ladder)
- [ADR-0016](brain/project/decisions/adr-0016-ci-context-normalization.md) — CI Context Normalization: One Seam Over Provider-Specific Pipeline Evidence
- [ADR-0017](brain/project/decisions/adr-0017-memory-format-owned-by-brain.md) — The Durable Memory Record Format Is Owned By Brain, Not By Engram
- [ADR-0019](brain/project/decisions/adr-0019-harness-port.md) — The SDD_HARNESS port: four environment surfaces, artifacts neutral by design

### Project-specific rules

- [check-refs-rules.mjs](brain/project/check-refs-rules.mjs) — prohibited reference rules for this project
- [Anti-patterns (project)](brain/project/anti-patterns/README.md)

---

> Active changes → `openspec/changes/`
> Durable decisions → `brain/project/decisions/`


---

<!-- source: brain/core/methodology/agent-authorities.md -->

# AI Agent Authorities

> **status:** current | **last-reviewed:** 2026-06-24 | **owner:** @crinaldi

> **Purpose:** defines what an agent can do autonomously, what requires
> human confirmation, and what is prohibited. Companion to `consolidation-protocol.md`
> and `anti-patterns/ia-escribe-brain-sin-gate.md`.
>
> **This document is human-authored.** Changes to tiers require an MR
> with human review — they are covered by CODEOWNERS.

---

## Authority tiers

### Tier 1 — Autonomous

The agent may execute without asking for permission:

- Read any file in the repo (`brain/`, `openspec/`, code, scripts)
- Create/modify files in `openspec/changes/**` (in-flight SDD artifacts)
- Create/modify files in `.engram/**` (live memory)
- Write to `scratch/{agent-id}.md` within an active change
- Run `npm run brain:repo:check`, `npm run backend:build`, `npm run brain:change:verify`
- Create issues in GitLab (`/gitlab-issue`)
- Propose commits for human review (but not push or merge without confirmation)
- Save observations in Engram (`mem_save`, `mem_session_summary`)
- Refresh the skill registry (`gentle-ai skill-registry refresh`)

### Tier 2 — Confirm before executing

The agent proposes and waits for explicit human approval:

- **Push to any branch** — the human approves each push
- **Create or merge an MR** — the human reviews the MR before merging
- **Modify files in `brain/`** — the agent drafts the artifact in
  `openspec/changes/{iid}/brain-drafts/`; the human moves it to `brain/`
- **Modify `.gitlab-ci.yml`, `settings.xml`, `CODEOWNERS`** — infrastructure changes
  that affect the whole team
- **Delete branches or committed files** — irreversible destructive actions
- **Resolve semantic conflicts of type `architecture`/`decision`** in Engram
  (see `consolidation-protocol.md §4`)
- **Deploy to the Package Registry** (`npm run backend:deploy`) — affects artifacts
  shared by all consumers

### Tier 3 — Prohibited

The agent must never do this, even if explicitly asked:

- Commit directly to `brain/decisions/`, `brain/anti-patterns/`,
  `brain/domain/`, or `brain/methodology/`
- Approve or merge its own MR
- Modify git history (`--force`, `--amend` of published commits,
  `rebase` of branches others use)
- Add AI attribution in commits (`Co-Authored-By: Claude...`)
- Publish JARs to the Package Registry without explicit human instruction
- Escalate decisions to other agents without the human's knowledge

---

## Escalation rule

If the agent is unclear which tier an action belongs to: **pause and ask**.
Doubt about the tier is already sufficient reason to escalate to the human.

---

## Review

This document must be reviewed when:
- A new tool type or capability is added to the harness
- A Tier 2 action proves to be routine and low-risk (candidate for Tier 1)
- A Tier 1 action produces an incident (candidate for Tier 2 or 3)

Changes to this document require an MR reviewed by `@crinaldi`.


---

<!-- source: brain/core/methodology/harness-contract.md -->

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


---

<!-- source: brain/core/methodology/sdd-layout.md -->

# SDD Canonical Layout

> **status:** current | **last-reviewed:** 2026-07-12 | **owner:** @crinaldi

> **Purpose:** the normative, canonical `openspec/changes/**` layout — the change-dir
> naming pattern, the required artifact set, and the operational/ephemeral artifacts
> that sit outside it. The single accessor for this layout in code is
> `brain/scripts/lib/sdd-layout.mjs` (issue #250, slice B0). Referenced by ADR-0019
> (the `SDD_HARNESS` port draft) and `harness-contract.md`'s artifact contract.

## Change-dir naming

Every in-flight change lives at `openspec/changes/issue-<N>-<slug>/`, where `<N>` is
the GitHub issue number and `<slug>` is a short kebab-case description. **The slug is
MANDATORY** — a bare `openspec/changes/issue-<N>/` dir (no slug) is a naming violation
for NEW change dirs, even though it parses.

## Required artifacts (canonical, flat)

A NEW change dir MUST carry exactly these four files at its root:

```
proposal.md   — human-approved PRD
spec.md       — delta requirements
design.md     — technical decisions
tasks.md      — implementation checklist
```

This is the flat convention. A nested `specs/<capability>/spec.md` variant exists in
older change dirs — it is **LEGACY-ACCEPTED**: readers MUST tolerate it, but the
scaffold (`brain:project:feature`) MUST NEVER produce it. The nested form is not an
equal alternative to the flat one; it is a legacy shape kept readable, not repeated.

A change dir predating this convention that lacks a flat `spec.md` (whether or not it
has a nested one) may be **grandfathered** — see `LEGACY_GRANDFATHERED` in
`sdd-layout.mjs`. That allowlist is sealed at B0: exactly the 12 dirs measured then,
closed to new entries without an ADR-level justification. A NEW change dir must never
appear in it.

## Checked-task pattern

`tasks.md` tracks progress with markdown checkboxes: `- [ ]` (pending) and `- [x]`
(done), matched case-insensitively (`- [X]` also counts). Tooling that counts progress
(e.g. the L4 phase-order gate) counts `- [x]`/`- [X]` lines.

## Archive destination

When a change is archived, it moves under an archive path **owned by
`sdd-layout.mjs`** — call `archivePath(iid)` rather than hardcoding the location. The
concrete value is a design-time decision (see `sdd-layout.mjs`'s design notes), not
asserted here, so this doc never drifts out of sync with the accessor.

## Operational / ephemeral artifacts

`resume.md` is **not** a required artifact. It is machine-written by the memory
checkpoint/resume flow, used as a disambiguation signal when more than one change dir
is active, and explicitly outside `REQUIRED_ARTIFACTS` — staleness is expected, it is
freely discardable, and it is **never a gate condition**. Code represents it as its own
named export, `OPERATIONAL_ARTIFACTS`, so any future tooling that needs to
recognize-but-ignore `resume.md` reads it from the same single source rather than
re-declaring a fourth scattered literal.

## Single source of truth

`brain/scripts/lib/sdd-layout.mjs` is the ONE module exporting `REQUIRED_ARTIFACTS`,
`OPERATIONAL_ARTIFACTS`, `CHANGES_ROOT`, `LEGACY_GRANDFATHERED`, and the layout
path/parse helpers (`changeDir`, `artifactPaths`, `archivePath`, `parseChangeId`,
`isGrandfathered`, `hasSpec`, `missingRequiredArtifacts`). A drift-guard test
(`sdd-layout.test.mjs`) fails if a second, independent definition of the
required-artifact set appears anywhere else in `brain/scripts/**`. Consumers import
from this module rather than re-deriving the layout inline.


---

<!-- source: brain/core/methodology/workflow-governance.md -->

# Workflow Governance — L3 Reference

> **Layer**: L3 (in-context guidance). See ADR-0014 (workflow-governance) in the brain project for the architecture. (Core docs reference project ADRs by name, not by path — `brain/project/**` is consumer-owned and varies per repo.)
> **Status**: current | **Introduced**: S3 (governance change)

This document is the in-context reference for the governance workflow that enforces
brain's four load-bearing process invariants at the server-side layer (L1). It maps
each invariant to its CI gate, states the enforce-outputs/guide-judgment boundary
explicitly, and documents the operational procedures for recovery and rollback.

---

## Four Invariants and Their Gates

Each invariant maps to one GitHub Actions job in `.github/workflows/governance.yml`.
Job names are **load-bearing**: they form the check context strings
(`governance / <job-name>`) that branch protection requires.

| # | Invariant | CI job (`name:`) | Skip label | Character |
|---|-----------|-----------------|------------|-----------|
| 1 | Every PR links an approved ticket | `issue-link` | _(none — not skippable)_ | Hard |
| 2 | PR diff ≤ 400 changed lines | `diff-size` | `size:exception` | Hard with override |
| 3 | Memory dumped before closing (proxy) | `memory-gate` _(S4)_ | `skip:memory-gate` | Hard with override |
| 4 | ADR exists for labeled decisions | `decision-gate` _(S4)_ | label-conditional (see below) | Mixed |

Check context format: `governance / <job-name>` (GitHub prefixes the workflow `name:` field).

The constant `GOVERNANCE_JOBS` in `scripts/vcs/governance-checks.mjs` is the single source
of truth for these names. A drift-guard unit test reads `governance.yml` and asserts the
YAML job names match the constant — fail-closed on any mismatch.

### Invariant 4 — two-step `decision-gate` (S4)

- **Step 1 (hard)**: if the PR carries the `decision` label, require an `adr-NNNN-*.md` AND
  a `brain/HOME.md` change in the diff. Fails the PR if either is missing.
- **Step 2 (heuristic)**: scan known architectural surfaces (`scripts/.*/providers/`,
  `brain/core/`, `config-migrations.mjs`, `package.json`) for changes without the `decision`
  label → emit `::warning::`, always `exit 0`. **Never a hard block** — the heuristic can be
  wrong; it raises attention, not a veto.

---

## Enforce-Outputs / Guide-Judgment Boundary

L1 enforces **observable outputs** of each invariant. It does NOT enforce judgment.

| What L1 enforces | What L1 does NOT enforce |
|-----------------|--------------------------|
| A ticket link exists and has `status:approved` | Whether the ticket describes the right work |
| PR diff ≤ 400 lines (excluding ignore-list) | Whether the PR is sliced coherently |
| `.memory/` changed (memory-gate proxy) | Capture quality or session completeness |
| ADR exists when `decision` label is set | Whether the PR actually made a new decision |

This boundary is **not a gap to close** — it is the line between what a machine can verify
and what requires a human mind. The heuristic in step 2 of `decision-gate` warns and
`exit 0`s precisely because "is this a decision?" is judgment. Only the label-conditional
step is hard.

---

## Lockout Recovery

If branch protection is active and a CI job is red, ALL merges to `main` are blocked.

**Recovery path 1 — fix the CI job:**

Address the underlying issue (fix the PR, update the issue label, add the ADR, etc.)
and push a new commit. The gate re-runs and unblocks automatically.

**Recovery path 2 — admin override (logged):**

`enforce_admins: false` allows repo admins to merge through a failing check without
disabling protection. This is logged in the GitHub audit trail.

**Recovery path 3 — emergency disable (use sparingly):**

```bash
# Admin-only: disable protection entirely to unblock an emergency merge.
gh api -X DELETE "repos/{owner}/{repo}/branches/main/protection"

# After the emergency fix is merged, re-enable idempotently:
npm run brain:protect
```

Verify current protection status at any time:
```bash
gh api "repos/{owner}/{repo}/branches/main/protection" | python3 -c "
import json, sys
p = json.load(sys.stdin)
print('checks:', [c['context'] for c in p['required_status_checks']['checks']])
print('reviews:', p['required_pull_request_reviews']['required_approving_review_count'])
print('force push allowed:', p['allow_force_pushes']['enabled'])
"
```

---

## S3 Dual-Surface Rollback

Branch protection is a **GitHub setting**, not a file. Rolling back S3 requires TWO
separate actions — doing only one leaves the system in a broken state.

**Surface 1 — revert the files** (normal `git revert`):

```bash
git revert <S3-commit-sha>
# Removes: governance-checks.mjs, brain-protect.mjs, the branchProtect verb,
# the vcs-contract.md update, workflow-governance.md (this file), and the
# package.json brain:protect script.
```

**Surface 2 — disable the protection setting**:

```bash
gh api -X DELETE "repos/{owner}/{repo}/branches/main/protection"
```

If you only do surface 1, protection stays active with orphaned check context
references. The checks no longer exist (no CI runs them) but protection still
requires them, which deadlocks `main` permanently. Always disable both.

---

## brain:protect — Operator Reference

`npm run brain:protect` activates branch protection on `main` using the current
governance check contexts from `scripts/vcs/governance-checks.mjs`.

**Who runs it**: a repo admin, once. Not a per-developer step.

**When to run it**: after S3 merges to the tracker branch (`feature/governance`),
after all open non-compliant branches have been:
- merged to main in their current state, OR
- rebased to comply with the governance gates, OR
- explicitly documented as exceptions in the S3 PR description (REQ-E-2).

Activating protection while a non-compliant branch is open means that branch cannot
merge until it complies — it does not affect `main` stability, but it creates work.

**Idempotent**: re-running `brain:protect` refreshes the protection settings safely.
It does not break anything or create duplicate checks.

