# Proposal — Workflow Governance Layer

> **Status:** In progress (v2 — floor + audit + golden path) · **Branch:** feature/governance
> **Relates to:** [agent-authorities.md](../../../brain/core/methodology/agent-authorities.md), [vcs-contract.md](../../../brain/core/methodology/vcs-contract.md), [managed-paths.mjs](../../../brain/core/managed-paths.mjs), [ADR-0012](../../../brain/project/decisions/adr-0012-harness-init-adapter.md), [ADR-0010](../../../brain/project/decisions/adr-0010-cli-output-i18n.md) · **Canonical design:** [docs/inbox/workflow-governance-layer.md](../../../docs/inbox/workflow-governance-layer.md) · **ADR:** ADR-0014 (authored in S1 ✅)

## Context

brain's mission is org-wide workflow governance for humans **and** agents over shared knowledge (the repo + engram). For that to mean anything, the load-bearing steps must be **enforced as far as the environment allows, and made the path of least resistance everywhere** — because a guide's floor is the least-disciplined participant, and an org cannot assume any particular VCS, tier, or harness.

**The four load-bearing invariants:**

1. **No merge without an approved ticket.**
2. **No PR over 400 changed lines without `size:exception`.**
3. **Memory dumped (session summary) before closing.**
4. **An ADR exists for every decision.**

**Core principle:** enforce observable **OUTPUTS** wherever a gate can fail-closed; **guide** the irreducible **JUDGMENT** (capture quality, recognizing a decision) with in-context docs + the path of least resistance. Never claim to enforce what cannot be mechanically verified, and never assume a platform, tier, or harness is present.

**The honest boundary:** a fully tool-independent HARD guarantee does not exist on SaaS — the chokepoint at merge is owned by the platform (branch protection). What IS universal: a default-on local layer + post-hoc verification. brain is honest about this everywhere, and the architecture reflects it.

**Architecture — three composed layers:**

| Layer | Mechanism | Strength | Scope |
|---|---|---|---|
| **Floor** | Generic checks library (node/git) + client-hook suite (commit-msg/pre-commit/pre-push) + `brain:audit` | Soft (hooks bypassable) but **universal** | Every repo, tier, platform |
| **Hard gate** | VCS adapter — `protectBranch()` returns `{enforced, reason, remedy}` (capability-aware, never crashes) | Hard but **conditional** on tier/platform | Where the platform allows |
| **Golden path** | Self-gating brain verbs (`brain:start/check/save/ship/next`) | Guides + self-gates step order | Human and agent alike |

The floor and the hard gate **compose** — they do NOT substitute for one another. The floor is the backbone; the hard gate is additive enforcement where supported; the golden path makes compliance the path of least resistance.

## What to Build

Five slices (chained-PR epic, feature-branch-chain, tracker `feature/governance`), sequenced to resolve the self-hosting bootstrap paradox.

### Slice 1 — Foundation ✅ (done)
ADR-0014, `.github/PULL_REQUEST_TEMPLATE.md`, `governance.ignoreList` config migration, two specific managed paths.

### Slice 2 — Platform CI (GitHub adapter) ✅ (done; reframed)
`governance.yml` with `issue-link` + `diff-size` jobs — understood as **one additive enforcement adapter** (conditional on GitHub, not the universal guarantee). The floor (S4) and the golden path (S5) are the tool-independent backbone.

### Slice 3 — Capability-aware adapter
Make `protectBranch()` return `{enforced, reason, remedy}` (never crashes on 403 or unsupported tier). Add `capabilities()` (probed, not hardcoded — the tier matrix rots). Add `brain:governance status` reporting per-consumer (what is on, what is unavailable, what the remedy is). Activation: per-consumer + deliberate operator step.

### Slice 4 — The Floor (tool-independent guarantee)
Extract the four checks (`diff-size`, `issue-link`, `adr-presence`, `memory-presence`) to a **generic checks library** (pure node/git functions, tool-independent — `diff-size-count.mjs` is the template). Wire the full **client-hook suite**: `commit-msg` (conventional commit + ticket ref), `pre-commit` (repo:check; block direct-to-main), `pre-push` (four invariant checks). Build **`brain:audit`** — re-verify the invariants over the *merged* history: forge-proof (verifies outcome, not a marker), flags and attributes every violation regardless of hook bypass. This is the tool-independent backbone of the guarantee.

### Slice 5 — The Golden Path
The **self-gating verb sequence** (`brain:start/check/save/ship/next`) unifying human + agent:
- `brain:start <issue>` → verify approved ticket → branch/worktree
- `brain:check` → generic checks + tests + repo:check (fast feedback)
- `brain:save` → session summary + materialize memory
- `brain:ship` → re-verify invariants → open PR (template + `Closes #N` + labels)
- `brain:next` → state machine: "your next step is X" (agent-like guidance for humans)

`--no-verify` **policy**: prohibited reference in `repo:check` (scripts cannot use it); harness PreToolUse hook blocks it for agents; `brain:audit` catches what slips through.

## Out of Scope (Non-Goals — Phase 3 / Future)

- **Full Invariant-3 `session_summary` check.** Blocked on engram JSONL schema confirmation + a `session/{issue}` topic_key convention. Phase 3.
- **Enforcing capture quality.** Irreducibly soft — L3 + audit. Not mechanically verifiable.
- **Enforcing "sliced well."** The 400-line gate produces slicing; coherence is judgment, not a gate.
- **Recognizing unlabeled decisions as a hard block.** The architectural-surface signal (S2 `decision-gate` heuristic) is a WARNING only.
- **GitLab `protectBranch` / `pre-receive`.** Phase 3.
- **GitHub rulesets.** Phase 3 (behind the same `branchProtect` verb, no caller change).
- **`.github/**` as a managed glob.** Only the two specific paths are managed — no consumer file clobbering.

## Acceptance Criteria

**Slice 3**
- [ ] `protectBranch()` returns `{enforced, reason, remedy}` on any tier or platform — never crashes.
- [ ] `capabilities()` probes (never hardcodes) and returns `{hardEnforcement: 'available'|'unavailable'|'unknown', detail}`.
- [ ] `brain:governance status` reports the three layers (hooks ON, adapter status, audit ON) per-consumer.

**Slice 4**
- [ ] Generic checks library: four pure functions, each unit-testable independently of CI or hooks.
- [ ] Hook suite: `commit-msg`, `pre-commit`, `pre-push` all wired to the library; installed via `core.hooksPath`.
- [ ] `brain:audit` flags + attributes every violation in merged history regardless of hook bypass; forge-proof.

**Slice 5**
- [ ] `brain:start` refuses if the issue has no `status:approved` label.
- [ ] `brain:ship` refuses if invariants are unmet; PR opened with Closes #N + correct labels on success.
- [ ] `brain:next` returns the correct next step for every state in the workflow.
- [ ] `--no-verify` / `git commit -n` appear in `repo:check` prohibited-refs list.
- [ ] Harness PreToolUse hook blocks any Bash command containing `--no-verify`.

**Epic-wide**
- [ ] Bootstrap order S1→S2→S3→S4→S5 holds: no slice blocked by a gate that does not yet exist.
- [ ] Before `brain:protect` is run, `feature/issue-11-cli-i18n` is explicitly coordinated (operator decision).
- [ ] `npm test` green across all slices.

## Rollback Plan

Each slice is independently revertible.
- **S3**: revert files AND disable protection (`gh api -X DELETE .../protection`). Protection is a setting, not a file.
- **S4**: revert `core.hooksPath` config (hooks stop running); `brain:audit` is read-only (no side effects). Generic library is removable; no data migration.
- **S5**: verb scripts are standalone — revert removes them. `--no-verify` prohibition is a config entry in `repo:check` — revert removes the prohibited-ref entry.

## Note on ADR-0014

ADR-0014 (authored in S1 ✅) records: the four invariants; the enforce-outputs/guide-judgment principle; the **floor (always-on hooks + audit) vs. additive capability-aware hard gate** split; the generic-checks library; the golden-path self-gating verbs + human/agent unification; the `--no-verify` policy; the honest tool-independence boundary. Never-do: claim to enforce judgment; treat client hooks as a substitute for the hard gate; hardcode the tier matrix; auto-activate protection without coordinating open non-compliant branches.
