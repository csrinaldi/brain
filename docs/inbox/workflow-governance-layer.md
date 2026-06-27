# Design — Workflow Governance Layer for brain

**Status:** Draft for review · **Date:** 2026-06-27 · **Author:** session design
**Context:** brain's mission is org-wide workflow governance for humans + agents with
shared knowledge (repo + engram). For that to work, the load-bearing steps must be
*enforced*, not merely *guided* (a guide's floor is the least-disciplined participant).

## The four non-negotiable invariants

1. **No merge without an approved ticket.**
2. **No PR over 400 changed lines without `size:exception`.**
3. **Memory dumped (session summary) before closing.**
4. **An ADR exists for every decision.**

## Core principle

> A step is *guaranteed* only when something downstream **fails closed** without it —
> server-side, where neither a human nor an agent can bypass it. Everything else is
> *guidance*, which raises probability but never reaches 1.0.

So the design **enforces the observable OUTPUTS** of each invariant at a server-side
gate, and **guides the JUDGMENT** (which is irreducibly soft) with in-context docs +
low-friction commands + after-the-fact audit. Naming that boundary honestly is part of
the design — we do not pretend to enforce what cannot be mechanically detected.

## Three reinforcing layers

| Layer | Mechanism | Guarantee | Bypass |
|---|---|---|---|
| **L1 — Server-side** | `.github/workflows/governance.yml` (PR checks) + branch protection on `main` | **Real** — agent & human alike cannot merge without it | only a repo admin override (logged) |
| **L2 — Local hooks** | `pre-commit` / `pre-push` run the same checks for fast feedback | Partial | `--no-verify` (so L1 is the true gate) |
| **L3 — In-context** | governance doc + skills + path-of-least-resistance commands | Soft (probability) | agent can skip/forget |

The **uniform-gate insight:** a PR check enforces the *output of a PR* regardless of
who authored it. That is exactly why it works for "agents can't skip" — the gate is
author-agnostic. Humans and agents flow through the same wall.

## Per-invariant enforcement

### 1. No merge without an approved ticket — FULLY enforceable
- **L1 gate:** CI parses the PR body for `Closes|Fixes|Resolves #N`; calls the GitHub
  API to confirm issue `#N` carries `status:approved`. Missing either → check fails →
  branch protection blocks merge.
- **Residual (by design):** *who* approves the ticket is a human decision — that's the
  point (the human sets intent; the gate enforces that intent exists before code merges).

### 2. No PR over 400 lines without exception — FULLY enforceable
- **L1 gate:** CI computes `additions + deletions` of the PR diff, excluding a
  configurable **ignore-list** (lock files, `.memory/**`, `openspec/changes/**`,
  generated artifacts). If >400 and no `size:exception` label → fail. This is what
  actually *produces slicing* — the agent must split to pass.
- **Residual:** the ignore-list definition (tune per org).

### 3. Memory dumped before closing — PARTIALLY enforceable (the subtle one)
- The dump has two parts: **(a) materialization** (engram → `.memory/`, mechanical) and
  **(b) capture quality** (did the agent `mem_save` the *right* things — irreducibly soft).
- **L1 gate (enforces the step happened):** CI verifies the committed `.memory/` contains
  a `session_summary` observation referencing this change/issue. `mem_session_summary`
  (the close protocol) writes exactly such an observation → materialized into `.memory/`
  → CI greps for it. No summary → no merge. This makes "run the close protocol"
  **mechanical**.
- **L2:** the existing `pre-push` hook materializes `.memory/` (so the summary is
  committed); plus a check that engram has no un-materialized state.
- **Residual (soft):** the *quality/completeness* of the captured knowledge. Mitigation:
  an audit prompt at review ("does the summary cover Goal/Discoveries/Next?") + reviewer
  judgment. We enforce that capture *happened*; we cannot enforce that it was *good*.

### 4. ADR for decisions — PARTIALLY enforceable (the fuzziest)
- You cannot mechanically detect "this PR *made a decision*." So the gate is two-pronged:
- **L1 hard gate (label-conditional):** a PR labeled `decision` MUST include an
  `brain/project/decisions/adr-*.md` file in its diff **and** a `brain/HOME.md` index
  update (else `brain:nav` orphan). Missing → fail.
- **L1 heuristic warning (soft-detect the unlabeled):** CI flags PRs touching
  architectural surfaces (adapters, config schema, new `package.json` deps, new top-level
  modules, the harness/memory/vcs backends) that carry **no** ADR — as a **warning**, not
  a block (heuristics must not hard-fail). Reviewer/agent then labels `decision` or
  dismisses.
- **Residual (soft):** recognizing an unlabeled decision. Mitigation: the heuristic +
  agent-authorities in-context + review.

## Distribution (the governance must travel with brain)

- **The workflow file** ships as a **managed path** (`.github/workflows/governance.yml`)
  — copied to consumers on `brain:upgrade`, so adopting brain *is* adopting the gates.
- **Branch protection** is a GitHub *setting*, not a file → a new **`brain:protect`**
  verb (`gh api`) configures `main` protection (require the governance checks + ≥1 review
  + no direct push), run during `env:init` or documented as a one-time setup. Provider-
  agnostic via the VCS adapter (GitHub rulesets / GitLab push rules).
- A **governance doc** (`brain/core/methodology/workflow-governance.md`) states the four
  invariants and maps each to its gate — the in-context L3 source of truth.

## The honest residual (the irreducible boundary)

L1 guarantees **outputs**: ticket linked, size bounded, summary present, ADR-for-labeled-
decision. L1 does **not** guarantee **judgment**: good capture, recognizing an unlabeled
decision, slicing *well* (vs merely under 400). Those stay L3 + audit. This boundary is
not a gap to be closed — it is the line between what a machine can verify and what
requires a mind. The design's job is to push everything *mechanically verifiable* to L1
and make the *judgment* path the easy one.

## New ADR

- **ADR-0014 — Workflow governance: enforce load-bearing invariants server-side.**
  Records the four invariants, the 3-layer model, the enforce-outputs/guide-judgment
  boundary, and the distribution model (managed workflow + `brain:protect`).

## Phasing (delivery)

- **Phase 1 (biggest guarantee-gain):** `governance.yml` with the four checks +
  `brain:protect` verb + branch protection. Invariants 1 & 2 become hard; 3 & 4 get their
  hard sub-gates.
- **Phase 2:** L2 local-hook fast feedback + the `workflow-governance.md` doc + low-
  friction commands (one command that does ticket→worktree→slices).
- **Phase 3:** the audit/detection heuristics (decision-surface warning, summary-
  completeness prompt) + the provider-agnostic GitLab path.

## Open questions

- The session-summary↔issue linkage: how does a `session_summary` observation reference
  the issue (a `topic_key` convention like `sdd/<issue>/...`, or an explicit issue field)?
- The 400-line ignore-list: exact globs.
- `brain:protect` for GitLab (rulesets differ) — Phase 3.
- Admin-override policy: who can bypass a required check, and is the override audited?
