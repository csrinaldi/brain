<!-- generated from brain/HOME.md, brain/core/methodology/agent-authorities.md, brain/core/methodology/harness-contract.md, brain/core/methodology/sdd-layout.md, brain/core/methodology/workflow-governance.md — do not edit.
     Regenerate: AGENT_PLATFORM=antigravity npm run brain:env:init
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
- [Reviewer protocol](brain/core/methodology/reviewer-protocol.md) — the cold external reviewer as doctrine: three structural locks against reviewer-as-authorizer, the reviewActors/approvalActors two-key split, four COMMENT-only port verbs, and the brain-review/1 verdict schema

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
- [ADR-0006](brain/project/decisions/adr-0006-distribucion-installer-versionado.md) — Distribution: versioned installer via git tags (**Amendment 1, 13/08/2026** — **SUPERSEDED by ADR-0030** — the private-repo premise that chose git tags no longer exists; distribution moves to a scoped registry package, #617)
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
- [ADR-0020](brain/project/decisions/adr-0020-reviewer-port-verbs-and-two-key-split.md) — External-reviewer VCS port verbs + the reviewActors/approvalActors two-key split (**Amendment 1, 06/08/2026; Amendment 2, 07/08/2026** — `prReviewComment` carries optional inline `comments[]`; at most ONE payload the provider accepts carries the verdict, but GitLab needs N+1 calls — verb count and lock 2 unchanged, #405)
- [ADR-0021](brain/project/decisions/adr-0021-reviewer-port-head-and-rollup.md) — Widen the VCS port for the cold reviewer: headRefOid on prView + a prStatusRollup read verb; retire the H1-1 cold-boot seam
- [ADR-0022](brain/project/decisions/adr-0022-reviewer-port-base.md) — Widen the VCS port for the cold reviewer: baseRefOid on prView (closes H1-2C-BASE)
- [ADR-0024](brain/project/decisions/adr-0024-three-axis-decoupling.md) — Three-axis decoupling: AGENT_PLATFORM · SDD_ENGINE · MEMORY_BACKEND (extends ADR-0005/0019; trims the phantom platform allow-list)
- [ADR-0025](brain/project/decisions/adr-0025-release-audit-gate-ordering.md) — Release Audit Gate Ordering and Substrate Enforcement
- [ADR-0026](brain/project/decisions/adr-0026-governance-doctrine-tiers.md) — Governance doctrine tiers: a declared lite/standard/regulated axis orthogonal to the detected substrate ladder (amends ADR-0015 REQ-L4-2/L5-1/L6-1; resolves #329; **Amendment 1, 04/08/2026** — at `lite`, distinct-act re-arms only on foreign commits, #418; **Amendment 2, 08/08/2026** — a signed `brain-decision/1` block is additional sufficient `lite` evidence for `actor-check`, #473; **Amendment 3, 09/08/2026** — `governance.agentActors` identities do not re-arm the approval at `lite`, #454; **Amendment 4, 11/08/2026** — `decision-gate` is added-only (#510) and label-blind; the doctrine describing it was corrected, #516; **Amendment 5, 12/08/2026** — `governance.reviewActors` is removed from the `lite` re-arm exempt set: a read-only identity has no commits to exempt, #581; **Amendment 6, 13/08/2026** — the platform `required_approving_review_count` is a tier parameter — 0 `lite`, 1 `standard`, 1 `regulated`, #94)
- [ADR-0027](brain/project/decisions/adr-0027-upgrade-rollback-is-restorable-not-atomic.md) — `brain:upgrade` rollback is restorable, not atomic: restates #396's exit criterion from whole-tree byte-identity to restorability of the managed-path copy, names each residual gap instead of implying coverage, and (Decision #3, amended 03/08/2026) refuses only what cannot be rolled back — writes resolving outside the repo — rather than every symlink
- [ADR-0028](brain/project/decisions/adr-0028-brain-promote-read-confirm-stage.md) — `brain:promote` is read-confirm-stage: the mechanics are automated, the signature is not (**Amendment 1, 12/08/2026** — `brain:promote` also performs §1c's in-place amendment cascade; the four locks and the human signature are unchanged, #509)
- [ADR-0029](brain/project/decisions/adr-0029-two-sources-one-graph.md) — Two sources feed one graph: the union is taken, the divergence is reported
- [ADR-0018](brain/project/decisions/adr-0018-gitlab-governance-fragment.md) — The GitLab governance surface is an opt-in fragment, not a pipeline
- [ADR-0030](brain/project/decisions/adr-0030-distribution-scoped-registry-package.md) — Distribution moves to a scoped registry package; ADR-0006's premise no longer exists (**Amendment 1, 13/08/2026** — reachability is a named cost — a registry name needs a registry, where a git URL reached any host; the git-URL install survives as a measured, equivalent escape hatch, #629; **Amendment 2, 14/08/2026** — the deferred organisation scope is no longer deferred — the package is `@logikas/brain`, and a scoped package must declare `access: public` or publish private, #653)
- [ADR-0031](brain/project/decisions/adr-0031-ai-attribution-is-a-claim-not-a-record.md) — AI attribution in commits is an unverifiable claim, not a provenance record

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

- Commit directly to `brain/core/**` or `brain/project/**` — the knowledge half,
  whatever its subdirectories are called
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
`brain/core/methodology/consolidation-protocol.md`.

## Current implementation (gentle-ai)

`gentle-ai` implements this contract. Claude skills are installed with
`gentle-ai install` and maintained with `gentle-ai upgrade`. The local registry is
refreshed automatically on `brain:day:start` and `brain:env:init`.


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
| 2 | PR diff ≤ the declared tier's budget — **1000** `lite` · **400** `standard` · **200** `regulated` | `diff-size` | `size:exception` — **refused at `regulated`** | Hard with override — **none at `regulated`** |
| 3 | `.memory/` has EVER held a session summary (repo-scoped) | `memory-gate` _(S4)_ | _(none — `skip:memory-gate` is named but unimplemented)_ | Soft — see below |
| 4 | An ADDED ADR co-occurs with a `brain/HOME.md` entry | `decision-gate` _(S4)_ | _(none — the gate reads no labels)_ | Hard, in one direction — see below |

> **Invariant 2 is tier-resolved, and this text restates the numbers by hand** (#496). The
> authority is `TIER_PARAMS` in `brain/scripts/vcs/governance-tiers.mjs` — `diffBudget` and
> `honorSizeException` per tier. Doctrine restating a value the code owns is a drift risk
> accepted deliberately here rather than left implicit: a reader needs the numbers in front of
> them, and the alternative — a pointer with no values — is what let this row say a flat `400`
> for as long as it did. **Whichever tier YOUR repo declares is the denominator** a checkpoint
> report must cite — `npm run brain:governance-status` prints it. A report quoting a budget the
> repo does not operate under is itself a blocking finding (`parseBudgetClaim`, #472).
>
> Stated conditionally on purpose: this file is `STRATEGY.COPY` into every consumer, while
> `brain.config.json` is not managed at all. A sentence naming *this* repo's tier would travel
> and be false on arrival — the defect that got `AGENTS.md` removed from the managed set in
> #397, "a file describing the wrong repository".

### Invariant 3 scope — what `memory-gate` does and does not check

**It is repo-scoped and it is permanently satisfied.** `memoryPresence` asks whether ANY
`session_summary` observation exists in `.memory/records/`. There are 205. The gate therefore
passes on every PR regardless of whether that PR captured anything, and it will keep passing if
nothing is ever captured again.

**Nothing enforces per-change capture.** The PR template's "Memory materialized before closing"
is a promise the checklist makes and no gate keeps. Read invariant 3 as *"this repository has a
memory layer"*, never as *"this change was remembered"*.

Measured 2026-08-11 (issue #529): `.memory/records/` went **seven days** without a new record
while **34 merges** landed. `memory-gate` was green on all of them — correctly, by the definition
above. That is the gap this scope note exists to stop hiding.

**`skip:memory-gate` does not exist in code.** No path checks for it. It is listed here and in
`AGENTS.md` as documentation of an intent, and `brain:metrics` counts its usage raw without ever
subtracting it. Applying the label changes nothing.

**This is a ruling, not a resting place** (issue #529). The sequence is: #530 makes capture a
mechanism rather than a habit → `skip:memory-gate` becomes real → invariant 3 tightens to
recency. Tightening it before the writer is reliable would block every PR with no override,
which is how a gate teaches people that gates are obstacles.

Check context format: `governance / <job-name>` (GitHub prefixes the workflow `name:` field).

The constant `GOVERNANCE_JOBS` in `scripts/vcs/governance-checks.mjs` is the single source
of truth for these names. A drift-guard unit test reads `governance.yml` and asserts the
YAML job names match the constant — fail-closed on any mismatch.

### Invariant 4 scope — what `decision-gate` does and does not check

**It reads no labels, and it runs on every PR.** `adrPresence` takes the changed-file list and
the added-file list; no call site passes labels and the workflow job carries no condition. The
`decision` label changes nothing about the verdict.

**It fails in exactly two cases** (measured 2026-08-11, issue #516):

| condition | verdict |
|---|---|
| an ADR is **added** and `brain/HOME.md` is not in the diff | fail |
| `brain/HOME.md` is in the diff and **no** ADR path is touched | fail |
| anything else, including a **modified** ADR alone | pass |

The two are keyed differently on purpose: the first reads the ADDED list, the second the
TOUCHED list. That asymmetry is #510's content — a PR correcting one line of an old ADR must
not be forced to re-index it (the previous behaviour blocked PR #507 for months) — and its
consequence is that **an amendment's `brain/HOME.md` marker has no gate behind it**
(`consolidation-protocol.md` §1c now says so; the net belongs in the amendment verb, #509).

**There is no step-2 heuristic.** This file described one — a scan of
`scripts/.*/providers/`, `brain/core/`, `config-migrations.mjs` and `package.json` emitting a
`::warning::` for changes without the `decision` label. Nothing scans those surfaces and
nothing emits that warning; the description was aspirational and read as shipped. An
architectural change carrying no ADR simply passes, in silence.

Both facts are pinned by test (`run-check.test.mjs`, #516), each proven a real detector by a
mutation that IMPLEMENTS the claim. If either is ever built, those tests fail and name this
section, so the doctrine cannot silently fall behind the code again.

---

## Enforce-Outputs / Guide-Judgment Boundary

L1 enforces **observable outputs** of each invariant. It does NOT enforce judgment.

| What L1 enforces | What L1 does NOT enforce |
|-----------------|--------------------------|
| A ticket link exists and has `status:approved` | Whether the ticket describes the right work |
| PR diff ≤ the tier's budget (excluding ignore-list) | Whether the PR is sliced coherently |
| `.memory/` changed (memory-gate proxy) | Capture quality or session completeness |
| An added ADR is indexed in `brain/HOME.md` | Whether the PR actually made a new decision |

This boundary is **not a gap to close** — it is the line between what a machine can verify
and what requires a human mind. *"Is this a decision?"* is judgment, and `decision-gate` does
not attempt it: it verifies a cascade (an added ADR is indexed) and says nothing about whether
an ADR was owed. Applying the `decision` label is a human act with no gate reading it.

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

---

## governance-metrics — `brain:metrics` Operator Reference

`brain:metrics` is a **read-only reporting verb**, introduced M9 (issue #324). It
re-derives governance-effectiveness signals from brain's own merged git history by
re-executing the SAME pure check functions `brain-audit` runs (shared via
`scripts/lib/merge-walk.mjs`) over the same first-parent merge walk — measurement
cannot drift from enforcement because it is the same code, not a re-derived copy.
It introduces **zero new gates, invariants, or CI-blocking behavior**: nothing it
reports can fail a merge, and it persists no state between runs (each report is
point-in-time only).

**Usage:**

```bash
npm run brain:metrics                                    # origin/main..HEAD, monthly, markdown
npm run brain:metrics -- <git-range>                     # e.g. HEAD~30..HEAD, origin/main..HEAD
npm run brain:metrics -- <git-range> --json               # flat JSON array, one object per period
npm run brain:metrics -- <git-range> --period=week         # ISO 8601 weekly buckets instead of monthly
npm run brain:metrics -- --help                            # usage text, exits 0
```

The range argument is **positional**, mirroring `brain:audit`'s own signature (never
a `--range=` flag) — `git log` already accepts range syntax like `HEAD~30..HEAD` or
`origin/main..HEAD` directly.

**What it measures, per period bucket:**

| Signal | What it is |
|---|---|
| Changes merged | Count of first-parent merges landing in the bucket |
| Median lead time | Median of: issue's **last** `status:approved` label-add at-or-before merge → merge date |
| `diff-size` / `issue-link` / `decision-gate` (raw / enforced) | `raw` = the check's real result, ignoring any exemption; `enforced` = `raw` minus `size:exception`-labeled and net-parity-exempted merges (the same exemption decisions `brain-audit` itself makes) |
| `size:exception` / `skip:memory-gate` usage | Raw count of merges whose PR carries the label, by period |
| `size:exception` usage by author | A separate "Exception usage by author" table: `size:exception` count per (period, label-adding actor) pair. The actor is read from the PR's own label-add events, not the linked issue's; unresolvable actors (VCS not configured, `labelEvents` fetch failure) are bucketed as `unknown` — never dropped |
| `phase-order` / `actor-check` / `brain-writes-reviewed` | Single pass/fail count column (DETECTION_JOBS never block merge, so there is no raw/enforced split). Supported on both providers — see the GitLab caveat below |
| Uncomputable | Merges where a per-merge git-plumbing read failed — counted visibly, never silently dropped or silently passed |

**Reported once, separately from the per-period table (repo-level, not a time series):**

- **`memory-gate` (memoryPresence) at HEAD** — whether a `session_summary` observation
  exists in `.memory/records/` right now. This check reads repo state ONCE per
  `brain-audit`/`brain-metrics` run, so its result is IDENTICAL for every merge in
  the window — a per-period column would be a constant masquerading as a series.
- **Memory-records coverage** — total records under `.memory/records/`, how many
  carry a populated `issue` field, and the resulting coverage %. Labeled **"adoption
  pending"** in every report: the `issue` field is not yet populated in practice
  across brain's own history, so this number is expected to read near 0% until
  memory-record tagging is adopted. Reports `Unavailable` (never a fabricated 0%
  passed off as measured) when `.memory/records/` is missing or unreadable.

**Caveats — read before trusting a number:**

- **Lead time is an issue-approval proxy, not PR-review-approval time.** It measures
  the gap between the referenced ISSUE's `status:approved` label and the merge —
  not how long the pull request itself sat in review. A short lead time can still
  reflect a long-considered issue approved well before the PR existed.
- **`memoryPresence`/`memory-gate` is repo-global, not per-merge.** See above — do
  not read it as "did this specific merge have memory captured".
- **`skip:memory-gate` is documented, not enforced.** The label is named in
  `AGENTS.md` and this file, but no code path anywhere checks for it or exempts
  anything on its presence — unlike `size:exception`, which `diff-size` genuinely
  honors. `brain:metrics` reports `skip:memory-gate` usage as a RAW label count only
  and **never subtracts it** from an enforced count — subtracting it would invent an
  exemption that does not exist in code.
- **`decision-gate` counts are label-conditional.** Only PRs carrying the `decision`
  label contribute to its raw/enforced counts, matching its mixed (Step 1 hard /
  Step 2 heuristic) enforcement described above.
- **GitLab detection-job reporting uses a `status` fallback.** GitLab's
  `prStatusRollup` always normalizes `conclusion: null` (its commit-status model has
  no field distinct from the terminal `status`) — reading `conclusion` alone would
  silently report 0/0 for all three detection jobs on every GitLab repo forever.
  `detectionConclusion()` falls back to `status` when `conclusion` is `null`, mapping
  GitLab's own vocabulary (`success` → pass, `failed` → fail; anything else —
  `pending`/`running`/`canceled`/`skipped`/etc. — stays uncounted). This is verified
  against a GitLab-shaped fixture in `brain-metrics.test.mjs`, but has not yet been
  confirmed end-to-end against a live GitLab repo (GitHub is the only provider
  exercised in brain's own real-history integration run, Phase 8).

**Failure policy differs from `brain-audit` on purpose.** `brain-audit` is
fail-closed and exits 2 on an uncomputable merge (never a silent PASS on an
enforcement gate). `brain:metrics` is a reporting tool: a per-merge git-plumbing
failure is caught and counted in the `Uncomputable` column instead, and the run
still exits 0. It exits non-zero ONLY when the requested range itself cannot be
resolved (an invalid `<git-range>`), with an actionable error suggesting valid
range syntax — never as a verdict about governance health.

