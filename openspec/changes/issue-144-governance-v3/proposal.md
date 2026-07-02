---
status: draft
issue: 144
---

# Proposal — Governance v3: harness-agnostic fail-closed loop enforcement (issue 144)

## Intent

Make brain's load-bearing workflow discipline **enforced as observable evidence in
CI / git / the VCS adapter**, not merely guided by a harness's prompts.

Today there is **no fail-closed server-side gate at all**. Branch protection on `main`
is inactive (private/free tier returns `403` on
`repos/csrinaldi/brain/branches/main/protection`), so the two existing checks
(`issue-link`, `diff-size`) *render* but nothing *requires* them — ADR-0014's "L1 real
guarantee" is inert. Worse, the actual **SDD phase discipline** (proposal → spec →
design → tasks → apply, human approval, no-agent-writes-to-`brain/`) lives **outside
this repo**, inside `gentle-ai`'s `SKILL.md` prompt files. That makes it simultaneously
**harness-locked** (a different harness has no idea) and **unenforceable** (a prompt is
skippable, and `brain/scripts/hooks/pre-push` is `--no-verify`-bypassable).

**Success looks like**: the *outcome* of the governed process — the phases happened, in
order, with the right artifacts; the approval was applied by a human; brain-core writes
were reviewed — is checked by generic scripts over git/PR evidence, wired into
`governance.yml` and `GOVERNANCE_JOBS`, working on *any* harness and reporting loudly
even before the fail-closed substrate is switched on.

## The non-negotiable principle

> Strong governance = **fail-closed gates over observable EVIDENCE**, in CI / git / the
> VCS adapter — **never** in a harness's prompts.

The corollaries, which every capability below obeys:

1. **Enforce the FIN, not the MEDIO.** Gate that the phases happened in order with
   artifacts, that approval is human, that brain-writes were reviewed — never *which
   tool* produced them. A gate that inspects evidence (file state, git-blame, PR actor)
   and not the producer is **harness-agnostic by construction**, which preserves
   `adr-0001-arquitectura-3-capas-harness-reemplazable` and
   `adr-0002-memoria-git-based-dos-capas` (`brain/core/methodology/harness-contract.md:8`
   — "another harness may replace it").
2. **Honest boundary (`brain/project/decisions/adr-0014-workflow-governance.md:49`).**
   Irreducible judgment — review *quality*, slice *quality*, recognizing an unlabeled
   decision — is **guide + audit only**. v3 does not pretend to enforce it. This is the
   line between what a machine can verify and what needs a mind; it is not a gap to
   close.
3. **Fail-closed at the highest rung the substrate allows.** Fail-closed does **not**
   have to live at the merge. It lives at whatever link the project controls
   end-to-end. Every gate is **capability-aware**: it detects the available substrate
   and enforces at the highest rung possible, degrading gracefully — never crashing,
   never lying about which guarantee is active (see the ladder in Approach). v3 does
   **not** depend on any single rung being available (see Dependencies).

## Scope — IN

The six enforcement levels from issue #144, all implemented as pure git / VCS-adapter /
CI scripts composed exactly like the existing `issue-link` / `diff-size` jobs:

- **L1 — CI runs `repo:check` + `brain:nav` + `npm test`.** Highest leverage, zero
  risk. These run today only in local hooks (`brain/scripts/hooks/pre-push:52`),
  bypassable via `--no-verify`. Move them into `governance.yml` so they run
  author-agnostically on every PR.
- **L2 — automate `brain:audit`.** The "universal teeth" (re-verifies invariants over
  merged history) runs on-demand only today. Wire it to (a) the **release/publish/tag
  path** where it **fails closed** (rung 2 — the primary enforcing guarantee for repos
  that cannot protect `main`), and (b) a **scheduled + post-merge CI** trigger where, on
  failure, it opens an auto-revert PR or blocks the tag (rung 3). Drift is caught
  continuously and attributed.
- **L3 — build the `memory-gate` + `decision-gate` jobs.** The S4 jobs promised in
  `brain/scripts/vcs/governance-checks.mjs:8` were never built. Their pure check
  functions exist and are tested; add them as jobs and to `GOVERNANCE_JOBS`
  (`:21`).
- **L4 — harness-agnostic SDD phase-order gate.** A new script (sibling to
  `brain/scripts/check-refs.mjs`), generic over `openspec/changes/**` file state +
  `git blame`. It asserts: (a) **spec.md AND design.md exist**, not just the
  `proposal.md` + `tasks.md` that `check-refs.mjs:96-112` (S-1) checks today;
  (b) **monotonic status transitions** (no backward phase jumps); (c) **no code changes
  outside `openspec/changes/**`** unless `tasks.md` has **≥1 checked item**. This is the
  highest-value and hardest level.
- **L5 — human-approval actor check.** Compare the actor who applied `status:approved`
  (via `gh api repos/{repo}/issues/{n}/events`) against the PR/issue author. Closes the
  self-approval gap flagged in the exploration (an agent could label its own issue
  `status:approved`).
- **L6 — CODEOWNERS for `brain/core` | `brain/project` + required reviews.** No
  CODEOWNERS file exists today, so Tier-2 "no agent writes to `brain/`"
  (`brain/core/methodology/agent-authorities.md:35`) has **zero** enforcement. Add
  CODEOWNERS so brain-core / brain-project edits require a human reviewer.

## Scope — OUT (non-goals)

- **Forcing `gentle-ai` (or any harness) to be used.** Impossible to verify and it would
  break harness-neutrality (ADR-0001/0002). We gate the evidence, never the tool.
- **Enforcing judgment quality** — review quality, slice quality, "sliced well vs merely
  under 400". Guide + audit only (`adr-0014-workflow-governance.md:49`).
- **Client-side / harness-specific cleverness** beyond the already-sanctioned
  `--no-verify` PreToolUse hook. No new harness-locked mechanisms.
- **L0 rung-1 activation as a prerequisite.** Turning on branch protection (requires
  GitHub Pro / public repo) or standing up a self-hosted `pre-receive` — the *top* rung
  of the substrate ladder (see Approach) — is a **separate, deliberate operator
  decision**. v3 does **not** block on it: it applies the highest rung the substrate
  already allows. (The ladder itself IS in scope; only the operator's rung-1 activation
  is out of v3's control.)

## Capabilities (what becomes true after this change)

- CI fails a PR when the SDD phases are incomplete or out of order — on any harness.
- CI fails a PR whose `status:approved` was self-applied by the author.
- brain-core / brain-project edits cannot merge without a human (CODEOWNERS) review.
- `repo:check`, `brain:nav`, and `npm test` run in CI, not only in bypassable hooks.
- `brain:audit` runs continuously (scheduled + post-merge), attributing every violation.
- `brain:audit` fails closed at the **release/tag path** (rung 2), giving even
  free-tier-private repos a real enforcing guarantee without branch protection.
- `brain:governance-status` reports the **active substrate rung** and the remedy to climb
  higher — the guarantee is never silently weaker than it looks.
- The whole set climbs to *prevention at merge* (rung 1) the moment the operator arms
  branch protection, with no code change — only the substrate.

## Approach

**Extend the existing v2 architecture — floor + additive hard gate + golden path**
(`docs/inbox/workflow-governance-layer.md:38-58`). Do not invent a parallel mechanism.

- Every new gate is a **generic Node script over git/PR data** added as a **job** in
  `.github/workflows/governance.yml` and registered in `GOVERNANCE_JOBS`
  (`brain/scripts/vcs/governance-checks.mjs:21`), composed like `issue-link` /
  `diff-size`. The drift-guard unit test that ties `GOVERNANCE_JOBS` to the YAML job
  names (`:5-6`) keeps them from diverging.
- The **phase-order checker is a sibling to `brain/scripts/check-refs.mjs`** — generic
  over file state + `git blame`, **NOT** logic embedded in any `SKILL.md`. This is the
  structural move that de-harness-locks phase discipline: it migrates the rule from an
  external prompt into an in-repo evidence check.
- Gates are **capability-aware**: they run and report as detection today; when a higher
  substrate rung is available, the same check contexts become enforcing. No dual code
  path.
- `brain:audit` remains the backstop for anything that slips a bypassed hook — it
  verifies the *outcome*, not a marker (`workflow-governance-layer.md:110`).

### Substrate degradation ladder (capability-aware) — core to v3

L0 is **not** a binary "protection on/off". brain is distributed to consumers with very
different substrates (GitHub Pro, GitHub free-tier private, self-hosted, GitLab), so v3
generalizes the pattern that `protectBranch()` already uses — return
`{enforced, reason, remedy}`, **never crash** — to **all** of governance. Every project
takes the **highest rung its substrate allows**, and fail-closed lives at whatever link
the project controls end-to-end:

| Rung | Where fail-closed lives | Guarantee | Requires |
|---|---|---|---|
| **1 — Prevention at merge** | branch protection / `pre-receive` | bad state never enters `main` | Pro/public OR self-hosted |
| **2 — Prevention at release** | the publish/deploy/tag script runs `brain:audit` and fails closed | bad state may enter `main` but is **never released** | only that the project controls its own release (always true) |
| **3 — Auto-correction** | post-merge `brain:audit` CI job on `main` that, on failure, opens an automatic revert PR (or blocks the tag) | bad state does not **persist** | only CI (free tier has it) |
| **4 — Floor: detection + loud signal** | `brain:audit` + `brain:governance-status` reporting the active rung and what's missing | nothing hidden | nothing |

Design mandates:

- **Detect the substrate and apply the highest rung**, degrading gracefully — mirroring
  `protectBranch() → {enforced, reason, remedy}`, generalized to every gate.
- **Never lie about which guarantee is active.** `brain:governance-status` reports the
  **active rung + the remedy to climb higher**. The gap is always loud, never silent.
- **Rung 2 is the primary guarantee for a large class of consumers** — including brain's
  own free-tier-private repo, which can never reach rung 1. This is why the L2/L3 work
  (automate `brain:audit`, wire it to release **and** post-merge) is **not a fallback**:
  it is what makes v3 valuable *precisely* on the substrates that cannot reach rung 1.

## Affected areas

- `.github/workflows/governance.yml` — new jobs: L1 checks, L3 `memory-gate` /
  `decision-gate`, L4 phase-order, L5 actor-check; new scheduled/post-merge trigger for
  L2.
- `brain/scripts/vcs/governance-checks.mjs` — extend `GOVERNANCE_JOBS`.
- New `brain/scripts/vcs/phase-order-check.mjs` (or similar) — the L4 checker, sibling to
  `check-refs.mjs`.
- New `CODEOWNERS` (L6) — a managed path, per ADR-0014's managed-path model (never
  `.github/**`).
- `brain/core/methodology/harness-contract.md` / `agent-authorities.md` — reference the
  now-enforced invariants (Tier-2 brain-writes are CODEOWNERS-gated).
- Possibly a new ADR (v3) or an amendment to ADR-0014 recording the six levels + the
  detection→prevention flip.

## Risks

- **A project stuck at rung 4 (detection only).** If the substrate offers neither merge
  protection (rung 1) nor a controlled release/tag path (rung 2) nor auto-correcting CI
  (rung 3), governance is **detection only** — bad state can enter and persist. This must
  be **surfaced as release-blocking-visible, never silent**: `brain:governance-status`
  reports the active rung loudly, and the "no enforcing rung available" state is itself
  release-blocking so no one mistakes a rendered check for an enforced guarantee. For
  substrates that DO control their release (nearly all), rung 2 lifts them off the floor
  — which is why wiring `brain:audit` into the release path (L2) is priority work, not a
  nicety.
- **Phase-order gate false-positives (L4).** Over-strict rules push developers to
  `--no-verify` / `size:exception`, defeating the gate — the exact failure mode the
  pre-push hook already guards against (`brain/scripts/hooks/pre-push:21-29`). The L4
  checker must have near-zero false positives before it becomes required; ship it as a
  warning/detection first, harden, then require.
- **`--no-verify` harness-lock.** The sanctioned PreToolUse block is Claude-Code-specific
  and regex-evadable. Accepted as a **bounded exception**, with `brain:audit` (L2) as the
  universal backstop that verifies the merged outcome regardless of bypass.
- **Actor-check edge cases (L5).** Bot accounts, admin overrides, and re-labeling need
  explicit handling so legitimate human approval via automation is not misread as
  self-approval.

## Rollback

Each level is an independent, additive job. Rollback = remove the job from
`governance.yml` and drop its entry from `GOVERNANCE_JOBS` (drift-guard test keeps the
pair consistent). Because gates ship as detection first, a bad gate reports noise, not a
merge lockout — until L0 is activated, no gate can deadlock `main`. If L0 is on and a
gate goes red, the logged admin override + idempotent protection-disable
(`adr-0014-workflow-governance.md:120`) restores flow. CODEOWNERS (L6) rolls back by
deleting the file.

## Dependencies

- **No blocking dependency on any single substrate rung.** v3 detects the substrate and
  applies the highest available rung (merge → release → auto-correct → detection);
  rung 2 (fail-closed at the release/tag path) needs only that the project controls its
  own release, which is always true — so v3 has a real enforcing guarantee even on
  free-tier-private repos.
- **L4 depends on the SDD artifact convention** (`openspec/changes/**` layout) already
  in place (`check-refs.mjs:96-112`).
- **L5 depends on** `gh api .../issues/{n}/events` read access (already used by
  `issue-link`; `permissions: issues: read` in `governance.yml:19`).
- **L6 depends on** the managed-path distribution mechanism (ADR-0014 /
  ADR-0006) to ship CODEOWNERS with brain.
- **Rung-1 (prevention at merge) depends on** a later, separate operator decision
  (Pro/public branch protection or self-hosted `pre-receive`). Rungs 2–4 need no such
  decision.

## Success criteria

- All six levels land as jobs/scripts, harness-agnostic, each verified by a test.
- The SDD phase-order rule exists **as an in-repo evidence check**, not in any `SKILL.md`.
- `repo:check` + `brain:nav` + `npm test` + `brain:audit` all run in CI.
- `brain:governance-status` reports the active substrate rung loudly; a project with no
  enforcing rung (detection-only) is release-blocking-visible, never silent.
- `brain:audit` is wired into the release/tag path so rung 2 (prevention at release) is a
  real guarantee on any substrate that controls its own release.
- No proposed mechanism enforces a specific harness (ADR-0001/0002 preserved).
- Zero false positives on the phase-order gate over the existing `openspec/changes/**`
  history before it is promoted to required.

## Preliminary slice plan (for the eventual chained delivery)

1. **L1 — CI runs `repo:check` + `brain:nav` + `npm test`.** Quick win, zero risk. Start
   here.
2. **L2 + L3 — wire `brain:audit` (scheduled/post-merge) and build `memory-gate` +
   `decision-gate`.** Pure functions exist; mechanical.
3. **L4 — SDD phase-order gate.** The **highest-value and riskiest** slice; ship as
   detection, harden to near-zero false positives, then make required. Depends on nothing
   but the artifact layout.
4. **L5 — human-approval actor check.** Depends on the events API already in use.
5. **L6 — CODEOWNERS + required reviews.** Depends on the managed-path mechanism.

Dependency note: L1 → (L2/L3 parallel) → L4 → L5 → L6. **L4 is the linchpin** — most
valuable, hardest, and the one that actually de-harness-locks phase discipline; give it
its own slice and its own hardening window.

## Harness-neutrality conformance (flagged per instruction)

Nothing in this proposal enforces a specific harness. Every gate inspects **evidence**
(file state, git-blame, PR actor, merged diff), never the **producer**. The phase-order
rule is explicitly **migrated out of `gentle-ai`'s `SKILL.md`** into an in-repo script,
which *strengthens* ADR-0001 (three-layer harness-replaceable) and ADR-0002 (git-based
memory) rather than eroding them. The only harness-specific element (the `--no-verify`
PreToolUse hook) is pre-existing, explicitly scoped as a bounded exception, and backed by
the harness-agnostic `brain:audit`.
