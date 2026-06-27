# ADR-0013 — Auto-ADR Onboarding: Bootstrap Notices, Agent Drafts, Human Signs

**Status**: Accepted  
**Date**: 2026-06-27

## Context

When a consumer repo adopts brain and runs `npm run env:init`, `brain/project/decisions/` is **empty** and nothing drafts the initial ADRs. The team is left to author the entire starter ADR set from scratch — exactly the friction that stops the first architectural decisions from ever being captured. The harness today (`gentle-ai.mjs` `init()`, ADR-0012) only detects a missing `sdd-init/<project>` engram context; it has no notion of a missing project-ADR set.

The hardest constraint on any solution is `agent-authorities.md`. `brain/project/decisions/` is the durable, human-signed source of truth:

- **Tier 1 (autonomous):** the agent may read any file and write freely to `openspec/changes/**`.
- **Tier 2 (confirm per action):** the agent may write to `brain/**` only after explicit per-action human confirmation; the canonical flow is *agent drafts in `openspec/changes/{iid}/brain-drafts/` → human reviews → the artifact reaches `brain/`*.
- **Tier 3 (prohibited):** the agent must **never** commit directly to `brain/decisions/`, even if asked. The anti-pattern is explicit: *"No agent promotes its own artifacts to `brain/`. That signature is human."*

So the feature cannot be "a script that writes ADRs into `brain/`." Bootstrap shell/node code can only **detect and notice**; the intelligence — exploring the repo, drafting prose, running the review — belongs to an agent, and every write into `brain/` must pass a Tier 2 gate. A second constraint: ADR drafting must not hallucinate. The agent captures what the repo **IS** (descriptive facts), not why the team chose it — the signature on the *reasoning* is also human.

## Decision

Auto-ADR onboarding is a **three-stage split** that maps cleanly onto the authority tiers:

1. **Bootstrap detects and notices (no `brain/` write).** `gentle-ai.mjs` `init()` gains a `_checkDecisionsDir` injectable seam (mirroring `_checkEngram` / `_runEngramSearch`, and ADR-0012's seam discipline). The gap fires when `brain/project/decisions/` is **absent OR contains no `.md` files**. On gap, `init()` prints a notice + hint via new i18n keys (ADR-0010) pointing the user to `/project:bootstrap-adrs`. The check is pure filesystem, engram-independent, and never fatal. Brain self-hosting has 12 ADRs, so it never triggers here.

2. **The agent drafts descriptive ADRs in Tier 1.** A conversational command — `.claude/commands/project-bootstrap-adrs.md`, like `sdd-onboard`, **not** an SDD pipeline skill — explores the consumer repo (reading `sdd-init/<project>` from engram first, falling back to direct detection) and drafts a **minimal starter set of 3 descriptive ADRs** (Stack, Testing, Build/package-manager) into `openspec/changes/auto-adrs/brain-drafts/`. Each draft leads with a `## Decision` of detected facts and leaves `## Context` and `## Consequences` as `<TODO>` stubs. The agent assigns the next free `adr-NNNN` (scanning existing files, collision-safe) and follows `brain.config.json docs.language` (ADR-0009). This is autonomous — no confirmation, because nothing under `brain/` is touched.

3. **The human accepts each into `brain/` via Tier 2.** Per-ADR interactive review (**accept / edit / reject / accept-all**); `accept-all` is offered only after the user explicitly states they reviewed the drafts. On accept, the agent writes `brain/project/decisions/adr-NNNN-<slug>.md` and patches `brain/HOME.md` — each gated by explicit confirmation. The `HOME.md` patch reads first, appends links in the exact existing format, and **fails safe** (leaves `HOME.md` untouched and reports the lines to add) if the index anchor cannot be located, so `npm run brain:nav` never finds an orphan. **Rationale stays a human stub** — the agent never fills `Context`/`Consequences`.

This is delivered as a chained-PR epic (feature-branch-chain): Slice 1 (bootstrap detection, headless-testable) → Slice 2 (Tier 1 draft) → Slice 3 (Tier 2 writes) → Slice 4 (idempotency/augment: re-runs draft only for uncovered topics).

## Never do

- **Never auto-commit to `brain/`.** Every write to `brain/project/decisions/` or `brain/HOME.md` is a Tier 2 human-confirmed action. No script, and no autonomous agent step, writes there (Tier 3 prohibited).
- **Never invent rationale.** Drafts are descriptive only — detected facts in `## Decision`, `<TODO>` stubs for `## Context` and `## Consequences`. The agent never argues "we chose X over Y because…".
- **Never orphan `HOME.md`.** If the index anchor is ambiguous, abort the patch, leave `HOME.md` untouched, and report the exact lines — never leave an accepted ADR unindexed.
- **Never emit an empty stub for a no-signal topic.** Skip the ADR and tell the user which topics had no signal, rather than handing over a placeholder masquerading as a decision.
- **Never make the bootstrap gap-check fatal.** A missing decisions dir prints a notice and `env:init` completes (same rule as ADR-0012).
- **Never make `/project:bootstrap-adrs` an SDD pipeline phase/skill.** It is a conversational command (like `sdd-onboard`), not a `delegate_only` skill or harness verb.

## Consequences

- **Positive**: the onboarding gap becomes visible on every `env:init` (Slice 1), and the starter ADR set is one conversational command away — without ever violating the human signature on `brain/`.
- **Positive**: governance is correct by construction — detection is Tier-1-safe filesystem code, drafting is Tier 1 (disposable `brain-drafts/`), and the only `brain/` writes are Tier 2 human-gated. The split mirrors ADR-0012 (seam) and the canonical brain-drafts flow.
- **Positive**: descriptive-only drafts keep the reasoning honest — the team fills the *why*, so an ADR is never a hallucinated justification.
- **Negative**: the Tier 2 wall means a multi-ADR starter set needs explicit confirmations; `accept-all` (behind the "I reviewed" gate) mitigates the friction without weakening the gate.
- **Negative**: detection degrades for non-Node stacks — weak-signal repos get fewer, broader ADRs (or skipped topics), not a complete set.
- **Negative**: ADR numbers can leave gaps when drafts are rejected (numbers are assigned at draft time, not renumbered on accept) — accepted as normal ADR-log behavior, like superseded entries.

## References

- [Agent authorities](../../core/methodology/agent-authorities.md) — the Tier 1/2/3 model; the backbone constraint this ADR operationalizes for auto-ADR drafting.
- [ADR-0003](adr-0003-split-core-project-self-hosting.md) — core/project split; `brain/project/decisions/` is consumer-owned, which is why bootstrap may only notice, not write.
- [ADR-0012](adr-0012-harness-init-adapter.md) — harness `init()` gap-detection + injectable-seam pattern that Slice 1's `_checkDecisionsDir` mirrors.
- [ADR-0010](adr-0010-cli-output-i18n.md) — CLI output i18n; the notice + hint are emitted through message catalogs.
- [ADR-0009](adr-0009-documentation-language-policy.md) — documentation language policy; draft language follows `brain.config.json docs.language`.
- [ia-escribe-brain-sin-gate.md](../../core/anti-patterns/ia-escribe-brain-sin-gate.md) — the signature on `brain/` is human.
