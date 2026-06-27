# Proposal — Workflow Governance Layer

> **Status:** Draft for implementation · **Relates to:** [agent-authorities.md](../../../brain/core/methodology/agent-authorities.md) (Tier 1/2/3 — the brain/ signature is human), [vcs-contract.md](../../../brain/core/methodology/vcs-contract.md) (the verb the new `branchProtect` extends), [managed-paths.mjs](../../../brain/core/managed-paths.mjs) (distribution mechanism), [ADR-0012](../../../brain/project/decisions/adr-0012-harness-init-adapter.md) (harness init pattern), [ADR-0010](../../../brain/project/decisions/adr-0010-cli-output-i18n.md) (i18n), the branch-pr skill (references checks that do not yet exist) · **May produce:** a new ADR-0014 "Workflow governance: enforce load-bearing invariants server-side".

## Context

brain's mission is org-wide workflow governance for humans **and** agents over shared knowledge (the repo + engram). For that to mean anything, the load-bearing steps must be **enforced**, not merely **guided** — a guide's floor is the least-disciplined participant, and an agent can forget or skip any step that nothing downstream fails on.

Today brain enforces **none** of its four invariants server-side. The branch-pr skill *describes* checks (`Check Issue Reference`, `Check Issue Has status:approved`) but `.github/` does not exist — there is no workflow, no PR template, no branch protection. The current state is guidance-only: every step depends on the participant choosing to do it, and this very session reached `main` via `--no-verify` and direct merges. The local hooks (`pre-push` materializes `.memory/`, `post-merge` imports it) give fast feedback but are `--no-verify`-bypassable, so they are not a guarantee.

The four load-bearing invariants:

1. **No merge without an approved ticket.**
2. **No PR over 400 changed lines without `size:exception`.**
3. **Memory dumped (session share) before closing.**
4. **An ADR exists for every decision.**

**Core principle:** a step is *guaranteed* only when something downstream **fails closed** without it — server-side, where neither a human nor an agent can bypass it. So this change **enforces the observable OUTPUTS** of each invariant at a server-side gate, and **guides the JUDGMENT** (which is irreducibly soft) with an in-context doc, skills, and low-friction commands. The honest boundary: **L1 enforces outputs, not judgment.** L1 guarantees the ticket is linked, the size is bounded, `.memory/` changed, and an ADR ships with a labeled decision. L1 does **not** guarantee good capture, recognizing an *unlabeled* decision, or slicing *well* (vs merely under 400). Those stay L3 + audit. This is not a gap to close — it is the line between what a machine can verify and what requires a mind. Naming it is part of the design.

**Three reinforcing layers:**

| Layer | Mechanism | Guarantee | Bypass |
|---|---|---|---|
| **L1 — Server-side** | `.github/workflows/governance.yml` + branch protection on `main` | **Real** — agent & human alike cannot merge without it | repo-admin override (logged) |
| **L2 — Local hooks** | existing `pre-push` / `post-merge` run the same intent for fast feedback | Partial | `--no-verify` (so L1 is the true gate) |
| **L3 — In-context** | a new `workflow-governance.md` doc + skills + low-friction commands | Soft (probability) | agent can skip/forget |

The **uniform-gate insight:** a PR check enforces the *output of a PR* regardless of who authored it. That author-agnosticism is exactly why it works for "agents can't skip" — humans and agents flow through the same wall.

### The Invariant-3 honest residual (an intentional, stated weakening)

The full "Invariant 3" check would verify the committed `.memory/` contains a `session_summary` observation referencing *this* change/issue. That check is **BLOCKED** and is **NOT** in this change:

- The engram `.memory/chunks/*.jsonl.gz` schema is internal/undocumented — the field name for an observation's type is unconfirmed, and grepping a brittle internal format in CI is fragile.
- There is **no convention** linking a `session_summary` to an issue number (no `session/{issue}` topic_key, no explicit field).

So this change ships the simpler **`.memory/`-changed proxy**: CI verifies the PR diff touches `.memory/` (i.e., `memory:share` produced new observations). A `skip:memory-gate` label exempts pure-docs PRs that legitimately produce no observations. What we give up, stated plainly: this proves the *step ran*, **not** that capture was *complete or good*. We do **not** pretend to enforce capture *quality*. The full session-summary check is **Phase 2**, contingent on two unblocks: (a) confirm the engram JSONL record shape, and (b) define a `session/{issue}` topic_key convention.

## What to build

Four chained PRs (feature-branch-chain strategy), sequenced to resolve the **self-hosting bootstrap paradox** — brain cannot be gated by a governance layer it does not yet contain, so the layer must be introduced before it is activated.

### Slice 1 — Foundation (the paperwork slice; zero CI, zero protection)
- **ADR-0014** "Workflow governance: enforce load-bearing invariants server-side" recording the four invariants, the 3-layer model, the enforce-outputs/guide-judgment boundary, the Invariant-3 weakening, and the distribution model. Patch `brain/HOME.md` index.
- **`.github/PULL_REQUEST_TEMPLATE.md`** — the file the branch-pr skill already references but that does not exist (issue-link section, size note, decision/ADR checkbox).
- **`governance.ignoreList`** config key via a `brain/core/config-migrations.mjs` migration (defaults: lock files, `.memory/**`, `openspec/changes/**`, generated artifacts) — the configurable diff-size ignore-list.
- **Managed-paths** prep: add the **specific** paths `.github/workflows/governance.yml` and `.github/PULL_REQUEST_TEMPLATE.md` to `managed` in `brain/core/managed-paths.mjs`. **Never** `.github/**` — that would clobber consumer-owned GitHub files (other workflows, issue templates).

### Slice 2 — Hard gates I + II (the biggest guarantee-gain)
- **`.github/workflows/governance.yml`** with two jobs:
  - **`issue-link`** (Invariant 1): parse PR body for `Closes|Fixes|Resolves #N`; call the GitHub API to confirm issue `#N` carries `status:approved`. Reuses `github.mjs issueView()` shape. Missing link or unapproved → fail.
  - **`diff-size`** (Invariant 2): compute `additions + deletions` excluding `governance.ignoreList` globs; if >400 and no `size:exception` label → fail. This is what actually *produces slicing*.
- This PR ADDS the workflow, so it runs (if at all) against itself non-blocking; branch protection is still off. **This is the first self-governing PR** — it carries an approved issue and stays under 400 lines, proving the gates on real input.

### Slice 3 — `brain:protect` + activation (the gate goes live)
- **`brainProtect` / `branchProtect` verb** in the VCS contract (`brain/core/methodology/vcs-contract.md`) + implementation in `scripts/vcs/providers/github.mjs` using **classic branch protection** (`gh api -X PUT /repos/{owner}/{repo}/branches/main/protection`, idempotent) requiring the governance checks + ≥1 review + no direct push. The **GitLab impl throws a clean "not yet implemented"** (Phase 3). **Check names are a single source** — the `required_status_checks` contexts must stay in sync with the `governance.yml` job names.
- **`scripts/brain-protect.mjs`** verb script wiring it up.
- **`brain/core/methodology/workflow-governance.md`** — the L3 doc stating the four invariants and mapping each to its gate.
- **Distribution note:** `env:init` points the operator to run `brain:protect` as a **one-time admin action**, not a per-dev step.
- **After this PR merges, the operator runs `brain:protect`.** From that moment ALL subsequent PRs are gated. This PR is itself the first PR governed by the Slice-2 CI now living in `main`.

### Slice 4 — Gates III + IV (fully governed)
- Add to `governance.yml`:
  - **`memory-gate`** (Invariant 3, proxy): PR diff must touch `.memory/`; `skip:memory-gate` label exempts pure-docs PRs.
  - **`adr-gate`** (Invariant 4): label-conditional **HARD** gate — a PR labeled `decision` MUST include a `brain/project/decisions/adr-NNNN-*.md` file **and** a `brain/HOME.md` update in the diff (else fail). Reuses `scripts/check-refs.mjs` ADR-naming structure.
  - **architectural-surface heuristic WARNING** (never a hard block): flag PRs touching adapters / config schema / new deps / new top-level modules that carry no ADR and no `decision` label → warn, exit 0.
- From here brain is fully self-governing.

## Out of scope (non-goals — all Phase 3 / future)

- **The full Invariant-3 `session_summary` check.** Blocked on engram JSONL schema confirmation + a `session/{issue}` topic_key convention. Phase 2 only.
- **Enforcing capture *quality*.** We enforce that the memory step ran; whether the summary is complete/good stays L3 + reviewer audit. Not mechanically verifiable.
- **Enforcing "sliced well."** The 400-line gate produces *some* slicing; whether the slice is *cohesive* is judgment, not a gate.
- **Recognizing *unlabeled* decisions as a hard block.** The architectural-surface signal is a WARNING only — heuristics must never fail closed.
- **GitLab `branchProtect`.** The verb is added to the contract now to leave the door open; the GitLab impl throws "not yet implemented". Phase 3.
- **GitHub rulesets.** Classic branch protection is simpler and sufficient for now; rulesets (org-level, newer API) are Phase 3.
- **Heuristic tuning** of the architectural-surface detector — Phase 3.
- **`.github/**` as a managed glob.** Only the two specific files are managed, to avoid clobbering consumer GitHub config.

## Acceptance criteria

Strict TDD applies (`npm test` = `node --test`). Each slice ships its own tests where code is added.

**Slice 1 — Foundation**
- [ ] `brain/project/decisions/adr-0014-workflow-governance.md` exists; `brain/HOME.md` indexes it; `npm run brain:nav` reports no orphans.
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` exists with issue-link, size, and decision/ADR sections.
- [ ] `governance.ignoreList` config migration applies idempotently; default globs present in a migrated `brain.config.json`.
- [ ] `managed-paths.mjs` lists exactly `.github/workflows/governance.yml` and `.github/PULL_REQUEST_TEMPLATE.md` (not `.github/**`); a managed-paths test asserts the two paths and the absence of a broad `.github/**` glob.
- [ ] No CI runs and no branch protection exists after this slice — `main` behaves as before.

**Slice 2 — Hard gates I + II**
- [ ] `governance.yml` `issue-link` job fails a PR with no `Closes #N` and a PR whose `#N` lacks `status:approved`; passes when both hold.
- [ ] `diff-size` job fails a >400-line PR without `size:exception`, excludes `governance.ignoreList` globs from the count, and passes with the label.
- [ ] This PR is self-compliant: it has an approved issue and is under 400 lines (ignore-list applied).
- [ ] Branch protection is still **off** — the workflow runs informationally, not blocking.

**Slice 3 — `brain:protect` + activation**
- [ ] `branchProtect` verb is documented in `vcs-contract.md`; `github.mjs` implements it idempotently; the GitLab impl throws a clean "not yet implemented".
- [ ] `required_status_checks` contexts in the protection payload match `governance.yml` job names exactly (single-source check-name test).
- [ ] `npm run brain:protect` is idempotent (re-running produces the same protection state, no error).
- [ ] `workflow-governance.md` exists and maps each invariant → its gate; `env:init` output points the operator to run `brain:protect` once.
- [ ] **Activation step:** after merge, running `brain:protect` makes the governance checks + ≥1 review + no-direct-push **required** on `main`; a subsequent direct push to `main` is rejected.

**Slice 4 — Gates III + IV**
- [ ] `memory-gate` fails a PR whose diff does not touch `.memory/`; `skip:memory-gate` label exempts it.
- [ ] `adr-gate` fails a `decision`-labeled PR missing an `adr-NNNN-*.md` and/or a `brain/HOME.md` change; passes when both are present.
- [ ] The architectural-surface heuristic prints a WARNING (exit 0, never a block) for an ADR-less arch-surface PR with no `decision` label.

**Epic-wide (self-hosting sequence)**
- [ ] The bootstrap order S1→S2→S3→S4 holds: no slice is blocked by a gate that does not yet exist.
- [ ] Before `brain:protect` is run, the open `feature/issue-11-cli-i18n` branch (which predates compliance) is **explicitly coordinated** — brought into compliance or merged — as a **user decision**, never automatic.
- [ ] `npm test` green across all slices.

## Rollback plan

Each slice is independently revertible; the activation step has a distinct rollback from the file changes.

- **Slice 1** is pure paperwork/config — revert removes ADR-0014 (and its HOME.md link), the PR template, the config migration, and the managed-paths entries. `main` behaves exactly as before. Lowest risk.
- **Slice 2** adds one workflow file. While branch protection is off, the workflow is informational; reverting deletes `governance.yml` with no effect on merge ability.
- **Slice 3** has **two** rollback surfaces: (a) revert the verb/script/doc files normally; (b) **turn protection OFF** via `gh api -X DELETE /repos/{owner}/{repo}/branches/main/protection` (or `brain:protect --off`, if provided). Protection is a *setting*, not a file — reverting code does **not** lift it; the operator must explicitly disable it. **Lockout window:** while protection is on and CI is red/misconfigured, *all* merges (including the fix) are blocked. Mitigation: protection allows a logged repo-admin override, and disabling protection is a single idempotent API call.
- **Slice 4** is additive jobs in `governance.yml` — revert removes the `memory-gate`, `adr-gate`, and heuristic steps; gates I+II remain. If the new gates block a legitimate merge, the `skip:memory-gate` / `size:exception` / `decision` labels provide per-PR escape hatches before any rollback is needed.

## Note on a new ADR

This change establishes a new governed architecture — *enforce the observable outputs of four invariants server-side; guide the irreducible judgment in-context; distribute the gate as a managed workflow + a `brain:protect` verb*. That is a load-bearing architectural decision warranting a dedicated **ADR-0014 "Workflow governance: enforce load-bearing invariants server-side"**, authored in Slice 1. The ADR must record the enforce-outputs/guide-judgment boundary and the **Invariant-3 honest residual** (proxy now, full check Phase 2) so the weakening is on the record, not silently assumed.
