> ⚠️ DRAFT — AWAITING HUMAN SIGNATURE. An agent copied this ADR from the
> `openspec/changes/issue-144-governance-v3/brain-drafts/` staging area into
> `brain/project/decisions/`. Per `agent-authorities.md` and the
> `ia-promueve-sus-propios-artefactos` anti-pattern, the agent may only place it here
> in DRAFT state — **a human must review and sign it** (change `Status` to `Accepted`
> and add name + date below) for this ADR to be in force. Until signed, it is not a
> governing decision. This is precisely the constraint the change itself enforces
> (L6, §6 below): the ADR about "no agent writes to `brain/`" is, itself, not promoted
> to `brain/` by the agent that drafted it.

# ADR-0015 — Governance v3: Six-Level Fail-Closed Gate Ladder Over Observable Evidence

**Status**: Draft — awaiting human signature (do NOT treat as Accepted until signed)
**Date**: 2026-07-01 (drafted; signing date to be set by the human reviewer)

## Context

ADR-0014 established the enforce-outputs / guide-judgment boundary and a first set of
gates (`issue-link`, `diff-size`, and the promised-but-unbuilt `memory-gate` /
`decision-gate`). Two gaps remained open after ADR-0014 shipped:

1. **No gate was actually fail-closed.** Branch protection on `main` (L1's "real
   guarantee") is inactive on brain's own free-tier-private repo (`403` on
   `repos/csrinaldi/brain/branches/main/protection`), so `issue-link` and `diff-size`
   *rendered* but nothing *required* them.
2. **SDD phase discipline lived outside the repo.** The actual proposal → spec →
   design → tasks → apply order, human approval, and Tier-2 "no agent writes to
   `brain/`" were encoded only in `gentle-ai`'s `SKILL.md` prompt files — harness-locked
   (a different harness has no idea) and unenforceable (a prompt is skippable).

Issue #144 (Governance v3) closes both gaps: it migrates phase discipline into an
in-repo evidence check and makes every gate **capability-aware**, so it enforces at the
highest rung the project's substrate allows instead of depending on branch protection
(rung 1) alone — which brain's own repo can never reach.

## Decision

Six enforcement levels ship as generic Node scripts over git/PR evidence, composed
exactly like the existing `issue-link` / `diff-size` jobs — no harness coupling, no
parallel mechanism (openspec/changes/issue-144-governance-v3/design.md §0).

### The six levels

| Level | Enforces | Mechanism | Req IDs |
|---|---|---|---|
| **L1** | `repo:check` + `brain:nav` + `npm test` run in CI, author-agnostically — closes the `--no-verify`-bypassable pre-push-hook gap | `.github/workflows/governance.yml` (`local-checks` job) | REQ-L1-1 |
| **L2** | `brain:audit` fails closed on the release/tag path (rung 2) and auto-reverts post-merge failures (rung 3) | `.github/workflows/release.yml`, `.github/workflows/governance-postmerge.yml` — both wrap `brain/scripts/brain-audit.mjs` unchanged | REQ-L2-1, REQ-L2-2 |
| **L3** | `memory-gate` (memory dumped before closing) and `decision-gate` (ADR ships for a labeled decision) as required CI jobs | `brain/scripts/governance/run-check.mjs` over `governance/checks/memory-presence.mjs` / `adr-presence.mjs` | REQ-L3-1, REQ-L3-2, REQ-L3-3 |
| **L4** | SDD phase order — spec.md + design.md exist, status transitions are monotonic, no code lands outside `openspec/changes/**` before `tasks.md` has ≥1 checked item — as an in-repo evidence check, not a harness prompt | `brain/scripts/vcs/phase-order-check.mjs` (sibling to `check-refs.mjs`) | REQ-L4-1 .. REQ-L4-5 |
| **L5** | The actor who applies `status:approved` differs from the PR author and the issue author (no self-approval) | `brain/scripts/vcs/actor-check.mjs` | REQ-L5-1, REQ-L5-2 |
| **L6** | `brain/core/**` / `brain/project/**` writes are approved by a human other than the author (Tier-2 "no agent writes to `brain/`"); CODEOWNERS is an optional rung-1 enhancement, not the enforcement | `brain/scripts/vcs/brain-writes-reviewed.mjs` (evidence-based) + optional `.github/CODEOWNERS` | REQ-L6-1 |

Every gate is split into a pure evaluator (fixture-testable, no I/O) and a thin git/`gh`
wrapper — the same discipline `brain-audit.mjs` already uses — so the whole set is
unit-testable with zero new dependencies (design §8).

### The four-rung substrate ladder

Fail-closed does not have to live at merge-time. `brain/scripts/vcs/substrate.mjs`
generalizes the `{enforced, reason, remedy}` shape `protectBranch()` already returns to
**every** gate, and each gate enforces at the **highest rung its substrate allows**,
degrading gracefully:

| Rung | Where fail-closed lives | Guarantee | Requires |
|---|---|---|---|
| **1 — merge** | branch protection / self-hosted `pre-receive` | bad state never enters `main` | Pro/public repo, or self-hosted |
| **2 — release** | the publish/tag script runs `brain:audit` fail-closed | bad state may enter `main` but is never **released** | the project controls its own release (always true) |
| **3 — auto-correct** | post-merge CI opens an auto-revert PR on failure | bad state does not **persist** | CI presence (free tier has it) |
| **4 — floor** | detection + loud signal only (`brain:governance-status`) | nothing hidden | nothing |

No gate depends on any single rung being available — rung 2 is the primary enforcing
guarantee for repos that can never reach rung 1 (including brain's own), which is why
L2 (wiring `brain:audit` into the release path) is priority work, not a fallback.
**Gates never lie about which rung is active**: `brain:governance-status` reports the
active rung and the remedy to climb higher, and a rung-4 (detection-only) project is
surfaced as release-blocking-visible, never rendered as a passing/neutral status
(REQ-HONESTY-1, REQ-HONESTY-2).

### The `REQUIRED_JOBS` / `DETECTION_JOBS` detection→prevention flip

`governance-checks.mjs` splits its single job list into two:

```js
export const REQUIRED_JOBS  = ['issue-link', 'diff-size', 'memory-gate', 'decision-gate'];
export const DETECTION_JOBS = ['phase-order', 'actor-check', 'brain-writes-reviewed'];
export const GOVERNANCE_JOBS = [...REQUIRED_JOBS, ...DETECTION_JOBS];
```

A gate ships in `DETECTION_JOBS` — it runs in CI and reports, but branch protection
(`checkContexts()`, consumed by `brain:protect`) does not require it. Promotion to
enforcing is **moving the job's name from `DETECTION_JOBS` to `REQUIRED_JOBS`** — no
job code change, for gates that already fail closed on an uncomputable diff (e.g.
`decision-gate`, per `run-check.mjs`). The drift-guard test keeps asserting
`governance.yml`'s job names equal the full `GOVERNANCE_JOBS` set, so the two lists
cannot drift from the YAML.

**Documented exception — `phase-order`.** Unlike `decision-gate`,
`phase-order-check.mjs`'s wrapper deliberately degrades an *uncomputable* diff (missing
`BASE_SHA`/`HEAD_SHA`, git failure) to `warn` → exit `0` while it is detection-only, to
protect REQ-L4-5's zero-false-positive requirement. Promoting `phase-order` to
`REQUIRED_JOBS` **verbatim** would turn that into a silent fail-open — a required gate
passing without ever evaluating. So `phase-order`'s promotion is **not** a code-free
flip: it MUST first switch its uncomputable-diff branch to fail-closed, mirroring
`run-check.mjs`'s handling of `decision-gate`, **before** the list move happens. This is
tracked as an explicit precondition on the promotion follow-up, not an implicit
assumption (design §7).

### Epic Invariant (non-goal)

Governance v3 enforces that the governed **process happened** — the SDD phases
completed in order with the required artifacts, approval was applied by a human, and
`brain/core` / `brain/project` writes were reviewed — never that the work is
**correct**. It MUST NOT claim to enforce judgment-level correctness: review quality,
slice quality ("sliced well" vs. merely under 400 lines), and whether a memory capture
is *good* (vs. merely present) stay guide + audit only, per ADR-0014's enforce-outputs /
guide-judgment boundary. Every gate inspects **evidence** (file state, git history, PR/
issue metadata, merged diff), never the **producing tool** — no gate branches on which
harness, agent, or human authored a commit — which is what makes the whole set
harness-agnostic by construction and preserves ADR-0001 and ADR-0002.

## Never do

- **Never claim to enforce judgment.** No gate output, log line, or status report may
  imply that a passing gate means the work is *correct* — only that the process
  happened. This is the Epic Invariant; it is a non-goal, not a residual gap to close
  later.
- **Never promote `phase-order` to `REQUIRED_JOBS` without first fixing its
  uncomputable-diff branch to fail-closed.** A verbatim list-move would introduce a
  silent required-gate fail-open — the exact failure mode the ladder exists to prevent.
- **Never let a gate branch on which harness, agent, or tool produced the evidence.**
  Every L1–L6 gate reads file state, git history, or PR/issue metadata — never a
  harness marker (`SKILL.md`, `.claude/**`) or an agent-identifying commit trailer.
- **Never let `REQUIRED_JOBS`/`DETECTION_JOBS` drift from `governance.yml`'s job
  names.** The drift-guard test asserts the full `GOVERNANCE_JOBS` union against the
  YAML; a mismatch can deadlock `main` (a required check that never reports) or
  silently under-enforce (a reporting job never wired to branch protection).
- **Never report a rung-4 (detection-only) project as a passing/neutral status.**
  `brain:governance-status` must render it as the weakest state, distinguished
  visually/textually, never equivalent to an enforcing rung.
- **Never build L6's enforcement on CODEOWNERS alone.** CODEOWNERS is platform- and
  rung-1-dependent (GitHub needs branch protection, GitLab needs Premium+, Bitbucket has
  none) — it is an *optional* rung-1 enhancement on top of the evidence-based
  `brain-writes-reviewed` check, never the sole mechanism.
- **Never ship `.github/CODEOWNERS` as part of a `.github/**` glob.** It is an exact
  managed-path literal, mirroring `governance.yml` and `PULL_REQUEST_TEMPLATE.md`
  (ADR-0014) — a glob would clobber a consumer's own `.github/` tree.

## Consequences

- **Positive**: brain's own free-tier-private repo gets a real enforcing guarantee
  (rung 2, the release-gate) despite never being able to reach rung 1 — the ladder was
  designed precisely so no single rung is a hard dependency.
- **Positive**: SDD phase discipline is now sourced from an in-repo, harness-agnostic
  script (`phase-order-check.mjs`) instead of a skippable prompt — it strengthens
  ADR-0001 (three-layer harness-replaceable) and ADR-0002 (git-based memory) rather than
  eroding them.
- **Positive**: the detection→prevention flip lets every new gate ship safely (report
  first, harden, then require) with a one-line promotion, not a rewrite.
- **Negative (honest residual)**: until an operator arms rung 1 (branch protection),
  L4/L5/L6 run as detection only — a violation is loud but does not block merge. This is
  surfaced honestly via `brain:governance-status`, never silently.
- **Negative (honest residual)**: `phase-order`'s promotion carries an explicit
  precondition (fail-closed the uncomputable-diff branch first) that is easy to skip if
  this ADR is not consulted before the list-move — flagged here so it is not lost.
- **Negative**: GitLab `branchProtect` / rung-1 CODEOWNERS parity remains a stub
  (Phase 3, per ADR-0014); L6's rung-1 enhancement is GitHub-only today.

## References

- `openspec/changes/issue-144-governance-v3/proposal.md` — the substrate ladder and the
  "enforce the FIN, not the MEDIO" principle this ADR records.
- `openspec/changes/issue-144-governance-v3/design.md` — §7 (the two-tier registry
  flip and the `phase-order` promotion precondition), §1 (the substrate detector
  contract).
- `openspec/changes/issue-144-governance-v3/specs/governance-v3/spec.md` — the
  Epic Invariant statement and the full REQ-L1..L6 / REQ-LADDER / REQ-HONESTY /
  REQ-NEUTRALITY index this ADR summarizes.
- [ADR-0014](adr-0014-workflow-governance.md) — the enforce-outputs / guide-judgment
  boundary this ADR extends from three invariants (L1 real guarantee) to six levels
  across a four-rung ladder.
- [ADR-0013](adr-0013-auto-adr-onboarding.md) — the Tier-2 draft → human-review →
  promotion flow this very ADR follows (it is drafted in `brain-drafts/`, not written
  to `brain/` directly).
- [ADR-0001](adr-0001-arquitectura-3-capas-harness-reemplazable.md) /
  [ADR-0002](adr-0002-memoria-git-based-dos-capas.md) — harness-replaceable
  architecture and git-based memory; no L1–L6 gate requires a specific harness, which
  preserves both.
