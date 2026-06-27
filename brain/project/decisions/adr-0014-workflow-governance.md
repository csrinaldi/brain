# ADR-0014 — Workflow Governance: Enforce Load-Bearing Invariants Server-Side

**Status**: Accepted  
**Date**: 2026-06-27

## Context

brain's mission is org-wide workflow governance for humans **and** agents working over a shared
knowledge base (the repo + engram). For that mission to hold, the load-bearing steps of the
workflow must be **enforced**, not merely **guided** — a guide's floor is the least-disciplined
participant, and an agent can always forget, skip, or `--no-verify` its way past advice.

Four invariants are load-bearing — skipping any one corrupts the shared knowledge base or the
review contract:

1. **No merge without an approved ticket** (intent exists before code lands).
2. **No PR over 400 changed lines without `size:exception`** (this is what actually *produces*
   slicing).
3. **Memory dumped before closing** (the next session does not start blind).
4. **An ADR exists for every decision** (durable rationale, no silent architecture drift).

Today none of these is enforced. The branch-pr skill *describes* automated checks
(`Check Issue Reference`, `Check Issue Has status:approved`), but there is no `.github/`
directory and no CI — the enforcement is aspirational. The local hooks (`pre-push`,
`post-merge`) give fast feedback but are `--no-verify`-bypassable, so they are not a guarantee.

The deeper constraint is **what can be mechanically verified at all**. "An approved ticket
exists" is a fact a machine can check. "The captured memory is *good*" or "this PR *made a
decision*" are judgments a machine cannot reliably make. A governance design that pretends
otherwise lies about its own guarantees.

## Decision

Enforce the observable **OUTPUTS** of each invariant at a server-side gate; **guide** the
irreducible **JUDGMENT** in-context. Three reinforcing layers, with exactly one that is a real
guarantee:

- **L1 — server-side (the real guarantee).** `.github/workflows/governance.yml` runs one PR
  check per invariant; **branch protection on `main`** makes those checks *required*. The wall
  is **author-agnostic** — a PR check enforces the output of a PR regardless of who opened it —
  which is precisely why "agents can't skip" holds. Bypass requires a logged repo-admin override
  (`enforce_admins:false`).
- **L2 — local hooks (fast feedback, not a guarantee).** The existing `pre-push`/`post-merge`
  hooks run the same spirit of checks locally; `--no-verify` bypasses them, so L1 stays the true
  gate.
- **L3 — in-context (guidance).** `workflow-governance.md` + skills + low-friction commands make
  the compliant path the easy path. Soft by nature: it raises probability, never reaches 1.0.

**The enforce-outputs / guide-judgment boundary (the irreducible line).** L1 guarantees: a
ticket is linked and approved; size is bounded; memory was materialized; a *labeled* decision
ships an ADR + `HOME.md` update. L1 does **not** guarantee: good capture, recognizing an
*unlabeled* decision, or slicing *well* (vs merely under 400). Those stay L3 + after-the-fact
audit. This boundary is **not a gap to be closed** — it is the line between what a machine can
verify and what requires a mind. The design's job is to push everything mechanically verifiable
to L1 and make the judgment path the low-friction one.

**Per-invariant enforcement.**

- **(1) Approved ticket — fully enforceable.** CI parses the PR body for `Closes|Fixes|Resolves
  #N` and confirms issue `#N` carries `status:approved` (reusing `github.mjs issueView`).
- **(2) Size budget — fully enforceable.** CI sums `additions+deletions` of the diff, excluding
  a configurable `governance.ignoreList` (lock files, `.memory/**`, `openspec/changes/**`);
  `>400` without a `size:exception` label fails.
- **(3) Memory dumped — partially enforceable (the proxy).** CI verifies `.memory/` changed in
  the PR (⇒ `memory:share` ran). It proves the *step happened*, **not** capture quality; pure-docs
  PRs use `skip:memory-gate`. The full `session_summary`-referencing-this-issue check is Phase 2
  (see residual below).
- **(4) ADR for decisions — partially enforceable.** A PR labeled `decision` MUST add an
  `adr-NNNN-*.md` **and** a `brain/HOME.md` update (hard). An architectural-surface **heuristic**
  warns (never blocks, `exit 0`) on likely-unlabeled decisions.

**Distribution model — governance travels with brain.**

- The **workflow file** ships as a **managed path** — the two exact literals
  `.github/workflows/governance.yml` and `.github/PULL_REQUEST_TEMPLATE.md` — so adopting brain
  *is* adopting the gates. It is **never** `.github/**` (that would clobber a consumer's own
  workflows and templates on upgrade).
- **Branch protection is a GitHub *setting*, not a file**, so a new **`branchProtect`** VCS-contract
  verb + a **`brain:protect`** one-time admin command configure `main` (require the governance
  checks + ≥1 review + no direct push; idempotent `PUT`). GitLab parity is a stub today (Phase 3).
- The **check contexts** that `brain:protect` requires and the **workflow job names** derive from
  **one** constant (`scripts/vcs/governance-checks.mjs`); a unit test asserts the YAML job names
  match it, so they **cannot drift** into a deadlocked `main`.

**Self-hosting activation.** S1 foundation → S2 adds the workflow (non-blocking until protection
is on) → S3 adds `brain:protect`; the operator activates protection post-merge (from here ALL PRs
are gated) → S4 adds the memory + decision gates. Open non-compliant branches (e.g.
`feature/issue-11-cli-i18n`) are brought into compliance or merged **before** `brain:protect` —
a documented operator step, never automated.

## Never do

- **Never claim to enforce judgment.** L1 enforces outputs only. Do not present capture quality,
  unlabeled-decision detection, or "sliced well" as guaranteed — they are L3 + audit. Lying about
  the guarantee is worse than the soft spot itself.
- **Never add `.github/**` to managed paths.** Only the two exact literals. A recursive glob
  overwrites consumers' own workflows, issue templates, and CODEOWNERS on `brain:upgrade`.
- **Never let check-names drift from job-names.** Both derive from the single
  `governance-checks.mjs` constant; the drift-guard unit test must stay green, or branch protection
  can require a check that never reports and deadlock `main`.
- **Never auto-activate protection while non-compliant branches are open.** `brain:protect` is a
  coordinated, one-time admin action; the operator reconciles open branches first. The command
  never inspects or rewrites branches.
- **Never make the architectural-surface heuristic a hard block.** A heuristic that can be wrong
  warns and `exit 0`s; only the label-conditional ADR gate is hard.

## Consequences

- **Positive**: the four invariants become real guarantees for humans and agents alike — the gate
  is author-agnostic, so an agent cannot skip what a human cannot skip.
- **Positive**: governance distributes automatically — `brain:upgrade` carries the workflow;
  `brain:protect` arms it. Adopting brain is adopting the gates.
- **Positive**: the enforce/guide boundary is stated honestly in-context, so no one mistakes a
  proxy for a proof.
- **Negative (honest residual)**: Invariant 3 ships as a `.memory/`-changed **proxy**, not the
  full `session_summary` check. The full check is blocked on an engram JSONL schema spike + a
  `session/{issue}` topic_key convention (Phase 2). We enforce that capture *happened*, not that
  it was *good*.
- **Negative**: a lockout window exists if protection is on and CI goes red; mitigated by the
  logged admin override and a single idempotent disable (`gh api -X DELETE …/protection`).
- **Negative**: GitLab `branchProtect` is a stub; full provider parity is Phase 3. The verb is in
  the contract now so the door is open.

## References

- [VCS contract](../../core/methodology/vcs-contract.md) — the verb table the `branchProtect`
  verb extends.
- `workflow-governance.md` (`brain/core/methodology/workflow-governance.md`) — the L3 in-context
  source of truth mapping each invariant to its gate (added in S3).
- [ADR-0006](adr-0006-distribucion-installer-versionado.md) — versioned installer; the managed-path
  + additive-migration mechanics this change rides (the two `.github/...` literals + `0.4.0`
  `governance.ignoreList` migration).
- [ADR-0008](adr-0008-adapter-vcs-provider.md) — VCS adapter; `branchProtect` is provider-agnostic
  (GitHub now, GitLab Phase 3).
- [ADR-0013](adr-0013-auto-adr-onboarding.md) — the prior governance pattern (bootstrap notices →
  Tier 1 draft → Tier 2 human signs); this ADR enforces the *output* (an ADR exists for a labeled
  decision) that ADR-0013 helps author.
