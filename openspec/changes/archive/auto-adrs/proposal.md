# Proposal — Auto-ADRs Onboarding

> **Status:** Draft for implementation · **Relates to:** [agent-authorities.md](../../../brain/core/methodology/agent-authorities.md) (Tier 1/2/3 model — the backbone constraint), [ia-escribe-brain-sin-gate.md](../../../brain/core/anti-patterns/ia-escribe-brain-sin-gate.md) (the signature on `brain/` is human), [ADR-0012](../../../brain/project/decisions/adr-0012-harness-init-adapter.md) (harness `init()` gap-detection pattern), [ADR-0010](../../../brain/project/decisions/adr-0010-cli-output-i18n.md) (output i18n), [ADR-0009](../../../brain/project/decisions/adr-0009-documentation-language-policy.md) (docs language) · **May produce:** a new ADR-0013 "Auto-ADR onboarding" (to be decided in the design/spec phase).

## Context

When a consumer repo adopts brain and runs `npm run env:init`, `brain/project/decisions/` is **empty** and nothing drafts the initial ADRs. The onboarding leaves the consumer to author the entire starter ADR set from scratch — exactly the friction that stops teams from capturing their first architectural decisions. The harness today (`scripts/harness/backends/gentle-ai.mjs` `init()`, ADR-0012) only detects a missing `sdd-init/<project>` engram context; it has **no notion** of a missing project-ADR set, and nothing offers to bootstrap one.

The hardest constraint on any solution is **agent-authorities** (`brain/core/methodology/agent-authorities.md`). `brain/project/decisions/` is the durable, human-signed source of truth:

- **Tier 1 (autonomous):** the agent may read any file and write freely to `openspec/changes/**`.
- **Tier 2 (confirm per action):** the agent may write to `brain/**` only after explicit per-action human confirmation; the canonical flow is *agent drafts in `openspec/changes/{iid}/brain-drafts/` → human reviews → the artifact reaches `brain/`*.
- **Tier 3 (prohibited):** the agent must **never** commit directly to `brain/decisions/`, even if asked. The anti-pattern is explicit: *"No agent promotes its own artifacts to `brain/`. That signature is human."*

So the feature cannot be "a script that writes ADRs into `brain/`." Bootstrap shell/node code can only **detect and notice**; the intelligence — exploring the repo, drafting prose ADRs, running the interactive review — belongs to an **agent**, and every write into `brain/` must pass a Tier 2 gate.

A second constraint: ADR drafting must not hallucinate. The agent captures what the repo **IS** (descriptive facts detected from the codebase), not why the team chose it. Rationale, alternatives, and tradeoffs are left as human-filled stubs — the signature on the *reasoning*, like the signature on `brain/`, is human.

## What to build

The chosen approach is **Approach 2** from the exploration (engram obs #268): a **bootstrap↔agent split**.

- **Bootstrap (shell/node)** detects the gap and prints a notice. It cannot explore a repo or draft prose — it only signals.
- **An agent command `/project:bootstrap-adrs`** (a `.claude/commands/project-bootstrap-adrs.md` file, conversational like `sdd-onboard` — **not** a new SDD pipeline skill) does the intelligence: explore the consumer repo, draft a starter ADR set, run the interactive review, and write accepted ADRs through Tier 2.

The starter set is **minimal: 3 descriptive ADRs** — Stack, Testing, and Build/package-manager. Each ADR captures detected facts (e.g. `Stack: React + TypeScript`) with `Context` and `Consequences` left as `<TODO>` stubs for the human. The agent does **not** invent rationale or argue "we chose X over Y because…".

Delivered as a chained-PR epic (feature-branch-chain strategy):

1. **Slice 1 — Bootstrap gap detection** (shell/node, headless-testable). Add a `_checkDecisionsDir` injectable seam to `scripts/harness/backends/gentle-ai.mjs` `init()` (mirroring the existing `sdd-init` gap notice and ADR-0012's injectable-seam pattern). The gap fires when `brain/project/decisions/` is **absent OR contains no `.md` files**. On gap, print a notice + hint via **new i18n keys** in `scripts/i18n/en.mjs` (ADR-0010) pointing the user to run `/project:bootstrap-adrs`. Unit-test the seam (inject empty / present decisions dir). Add an assertion to `test/fresh-install/in-container.sh` that `env:init` output contains the notice when the decisions dir is missing. Independently shippable; no agent dependency. (brain self-hosting has 12 ADRs → never triggers.)

2. **Slice 2 — Agent command: explore + draft** (Tier 1). `.claude/commands/project-bootstrap-adrs.md`. Reads `sdd-init/<project>` from engram for stack data (falls back to direct detection — `package.json` / lock files / `go.mod` / `pyproject.toml` / CI / key source files). Computes the **next free ADR `NNNN`** by scanning existing files (collision-safe). Drafts the 3 descriptive+stub ADRs into `openspec/changes/auto-adrs/brain-drafts/` — autonomous, no confirmation. Draft language follows `brain.config.json docs.language` (ADR-0009), defaulting to `en`.

3. **Slice 3 — Interactive review + Tier 2 writes**. Presents each draft with a short summary; the user chooses **accept / edit [feedback] / reject / accept-all**. On accept, the agent writes to `brain/project/decisions/adr-NNNN-<slug>.md` and patches `brain/HOME.md` — each write gated by **explicit per-action confirmation** (Tier 2). The agent reads `HOME.md` first, then appends links in the **exact existing format** so `npm run brain:nav` stays green (no orphans). **accept-all** is allowed only after the user explicitly states they reviewed the drafts. The agent **never** auto-commits to `brain/` (Tier 3 prohibited).

4. **Slice 4 — Idempotency / augment mode**. Re-running against a non-empty `brain/project/decisions/` does not re-draft the same set; instead the agent detects topics not yet covered and offers to draft **only** for uncovered topics. A clean re-run with no gap exits cleanly.

## Out of scope (non-goals)

- **Argumentative ADRs.** No inferring rationale, alternatives, or tradeoffs — drafts are descriptive only, with `Context`/`Consequences` as `<TODO>` stubs.
- **The optional thin-scaffold node helper** (`npm run project:adrs:scaffold`) that would write skeletal stubs headlessly — deferred to a later slice.
- **Deep detection for non-Node stacks.** Pure Ruby/PHP/C++ repos degrade gracefully to fewer, broader ADRs rather than failing.
- **Augment mode beyond the minimal 3-topic set** (a richer/8-ADR catalog) — a later slice.
- **Auto-committing to `brain/`** — forbidden by agent-authorities (Tier 3); every `brain/` write stays a Tier 2 human-gated action.
- **Making `/project:bootstrap-adrs` an SDD pipeline phase/skill.** It is a conversational orchestrator command (like `sdd-onboard`), not a `delegate_only` skill.

## Acceptance criteria

Strict TDD applies (`npm test` = `node --test`). Each slice ships its own tests.

**Slice 1 — Bootstrap gap detection**
- [ ] `_checkDecisionsDir` seam exists in `gentle-ai.mjs` `init()` and is unit-tested with an injected decisions dir that is (a) absent, (b) present-but-no-`.md`, (c) populated.
- [ ] The gap notice fires for (a) and (b), and stays silent for (c) — verified against brain self-hosting's 12 ADRs (never triggers).
- [ ] New i18n keys (notice + hint) exist in `scripts/i18n/en.mjs`; output is rendered through `t()` (ADR-0010), not hardcoded.
- [ ] `test/fresh-install/in-container.sh` asserts that `env:init` output **contains the notice** when `brain/project/decisions/` is missing. (Headline acceptance.)

**Slice 2 — Agent command: explore + draft**
- [ ] `.claude/commands/project-bootstrap-adrs.md` exists and is invocable as `/project:bootstrap-adrs`.
- [ ] On run, drafts exactly the 3 starter ADRs (Stack, Testing, Build) into `openspec/changes/auto-adrs/brain-drafts/` — nothing is written under `brain/` in this slice.
- [ ] Each draft is descriptive (detected facts) with `Context`/`Consequences` as `<TODO>` stubs — no invented rationale.
- [ ] ADR numbering starts at the next free `NNNN` (verified against a repo seeded with an existing `adr-0001`).
- [ ] Draft language honors `brain.config.json docs.language` (defaults to `en`).

**Slice 3 — Interactive review + Tier 2 writes**
- [ ] Per-ADR accept / edit / reject / accept-all flow works; reject leaves no `brain/` write.
- [ ] On accept, the file lands at `brain/project/decisions/adr-NNNN-<slug>.md` only after explicit confirmation; no autonomous `brain/` write occurs.
- [ ] `brain/HOME.md` is patched in the existing link format; `npm run brain:nav` reports **no orphans** after the session.
- [ ] **accept-all** is offered only after the user explicitly confirms they reviewed the drafts.

**Slice 4 — Idempotency / augment mode**
- [ ] Re-run against a populated decisions dir does not duplicate existing ADRs; it offers drafts only for uncovered topics.
- [ ] A re-run with full coverage exits cleanly without drafting.

**Epic-wide**
- [ ] `npm test` green across all slices; no code path writes to `brain/` without a Tier 2 confirmation.

## Rollback plan

Each slice is independently revertible.

- **Slice 1** is additive: revert removes the `_checkDecisionsDir` seam, the new i18n keys, and the fresh-install assertion. The notice degrades to silence — `env:init` behaves exactly as before. Lowest risk.
- **Slice 2** adds one command file and writes only under `openspec/changes/auto-adrs/brain-drafts/` (Tier 1, disposable). Revert deletes the command file; drafts are not durable artifacts.
- **Slice 3** is the only slice that touches `brain/`, and only through human-confirmed Tier 2 writes. Any accepted ADR is a normal human-authored file in `brain/project/decisions/` and `brain/HOME.md`; reverting the *command* does not touch already-accepted ADRs (they are now human-owned). A malformed `HOME.md` patch must fail safe (leave `HOME.md` untouched, report to the user), never produce an orphan.
- **Slice 4** is additive logic on the same command; revert restores the Slice-3 behavior (always draft the full set).

## Note on a new ADR

This change establishes a new governed flow — *bootstrap notices a gap; an agent drafts descriptive ADRs in Tier 1; the human accepts each into `brain/` via Tier 2; rationale stays a human-filled stub*. That is an architectural/governance decision distinct from the existing ADRs. It likely warrants a dedicated **ADR-0013 "Auto-ADR onboarding"** documenting the bootstrap↔agent split and its Tier 2 mapping — **to be decided in the design/spec phase**, not authored here. It may also warrant a companion entry in `agent-authorities.md` recording auto-ADR bootstrapping as a sanctioned Tier 2 pattern.
