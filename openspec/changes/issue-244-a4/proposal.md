# Proposal — GitLab Substrate Ladder Awareness (slice A4)

> **Status:** planned · **Issue:** #244 (owner-approved with 4 refinements; human applies `status:approved`)
> **Track:** A / Slice A4 — the LAST fixture-phase slice of Track A.
> **Depends on:** #231 A2 (GitLab governance pipeline, `gitlab.mjs` transport + `capabilities()`/`branchProtect()`)
> and #239 A3 (GitLab provider verbs). Both already merged into `feature/v2.0.0`.
> **Contract:** [spec.md](spec.md) · [design.md](design.md) · [tasks.md](tasks.md).

## Context / Problem

The governance substrate ladder (`substrate.mjs`) is GitHub-wired in practice and reports rung-1 in two
dishonest ways on GitLab:

1. **The ladder is illegible for GitLab.** `realBranchProtectionProbe` (`brain-governance-status.mjs:45-63`)
   is hardcoded to `gh api …/branches/{branch}/protection` — no provider branch. GitLab has the equivalent
   endpoint already wired in `gitlab.mjs` (`capabilities()` `:322-342`, `branchProtect()` `:254-306`, both
   over `glab api …/protected_branches`), but it is not threaded into the substrate probe. On GitLab,
   rung-1 (merge protection) can never be DETECTED even when it is armed.

2. **The `selfHostedPreReceive` flag is trusted UNVERIFIED.** `evalRung1` (`substrate.mjs:97-141`)
   short-circuits at `:98-100`: `config?.vcs?.selfHostedPreReceive === true` → `active:true`
   UNCONDITIONALLY. No endpoint can report whether a server-side hook is installed on a bare repo, yet the
   report renders it as verified capability. This conflates an API-verifiable mechanism (branch protection)
   with a NON-remotely-detectable one (a pre-receive hook) under one boolean.

The pre-receive hook itself is already correct and needs NO new evaluator: `hooks/pre-receive` already runs
commit-format + ticket-ref as self-contained `sh`+`git`+`grep` (zero Node/external-tooling contract, its
header mandate), duplicating the regex from `commit-msg` BY DESIGN. `diff-size` is deliberately excluded
(MR-level semantics; see non-goals). So A4 adds NO new hook binary — "extend, not sibling" is satisfied by
augmenting `substrate.mjs` / `brain-governance-status.mjs` / the existing test harness, not by a second
hook script.

## What this slice ships (3 real deliverables)

1. **D1 — GitLab rung-1 modeled as PARALLEL SUB-GATES (`substrate.mjs`).** Split the overloaded rung-1
   boolean into two sub-gates under `rungs[1].gates`, mirroring the proven per-provider `brainWritesReviewed`
   sub-gate pattern (`substrate.mjs:149-203`):
   - `protectedBranches` — API-verifiable (`verifiable:true`), fed by a provider-branched probe.
   - `preReceive` — config-declared, `verifiable:false`, `mechanism:'pre-receive-config-declared'`.
   `evalRung1` composes `rungs[1].active = protectedBranches.active || preReceive.active` (OR — either arms
   the rung). The `selfHostedPreReceive` short-circuit is REPLACED by the `preReceive` sub-gate carrying an
   honest `verifiable:false` SIGNAL instead of masquerading as verified.

2. **D2 — Provider-branched detection + honest caveat (`brain-governance-status.mjs`).** Provider-branch
   `realBranchProtectionProbe` to dispatch on `config?.vcs?.provider` (mirroring `realBrainWritesReviewedProbe`
   `:78-111`), reusing `gitlab.mjs`'s existing `glab api …/protected_branches` read — no new ambient-env
   access, config threaded through the sanctioned path. The print layer renders the pre-receive rung as
   **"not remotely detectable; verify via install runbook"** whenever it is armed by the `preReceive`
   sub-gate — never as verified.

3. **D3 — CP-A4a bare-repo rejection fixture (reuse existing harness).** Add a fixture-tested rejection demo
   to `hooks/pre-receive.test.mjs`, REUSING its `setupFixture`/`commitAndPush` helpers (`git init --bare` →
   install hook → non-compliant push → rejected). No GitLab, no network, `GIT_AVAILABLE`-gated. Plus new
   offline fixture cases in `brain-governance-status.test.mjs` for GitLab-protected-branch-verified vs
   pre-receive-config-declared.

**Docs:** EXTEND (not duplicate) `docs/inbox/self-hosted-pre-receive.md` — the GitLab `custom_hooks/`
server-install path is already documented there as the deferred/manual SCIT step. A4 references it; it does
not recreate it.

## The honesty principle (binding — constraint 3)

Environment/remote-undetectability is reported AS SUCH, never as verified. Protected branches are
API-queryable → detectable. A pre-receive hook is NOT — no endpoint reports whether a server hook is
installed — so its rung is reported "not remotely detectable; verify via install runbook." This is the
durable lesson `[[workflow/env-limits-not-world-properties]]`: absence of a probe result is a limit of our
vantage point, NOT evidence the world lacks the property. The SIGNAL (`verifiable`/`mechanism`) lives in
`substrate.mjs` (data); the CAVEAT TEXT lives in `brain-governance-status.mjs` (presentation); the two MUST
change together or the fix is half-done.

## Non-goals (owner confirms/vetoes at review)

- **`diff-size` in the pre-receive hook** — EXCLUDED (constraint 2). `diff-size` is whole-MR delta-vs-base
  filtered by `ignoreList` globs; a pre-receive push-batch has no "MR base" concept, so a per-push budget
  would false-reject and diverge from the CI `diff-size` REQUIRED_JOB. It stays a CI/MR gate.
- **GitLab-CI job registry** — a `REQUIRED_JOBS`/`governance-checks.mjs` equivalent for GitLab CI pipelines
  is OUT of A4. A4 is ladder AWARENESS (detection honesty), NOT job orchestration. Proposed non-goal —
  flag for owner.
- **Real GitLab server hook install** — SCIT bundle. Named precondition: Gitaly `custom_hooks/` host-fs
  admin access, verified alongside endpoint + runners. NOT this slice.
- **CP-A3b / CP-A2b live smoke** — SCIT bundle, endpoint-dependent. Unchanged by A4.

## Locked design decision (rationale for design.md)

**Approach C (parallel sub-gates) + Approach B (verifiability field), combined.** Rejected the simpler
"just add a `verifiable` boolean to the existing single rung-1 result" (Approach B alone) because GitLab
has INDEPENDENT rung-1 mechanisms that can be armed separately; collapsing them keeps the illegibility.
The sub-gate table reuses proven scaffolding (`brainWritesReviewed` already does per-provider sub-gates
under rung 1), keeps `selectRung()` (`substrate.mjs:207-212`) untouched, and localizes OR-composition to
`evalRung1`'s return construction. `verifiable`/`mechanism` fields ride ON the sub-gates. Design.md owns
the exact field shape.

**RESOLVED by owner ruling (supersedes the "presence-alone" default anywhere below) — GitLab rung-1 = THREE
distinct sub-gates, reported distinctly:**
1. **`pipelineMustSucceed`** — project setting `only_allow_merge_if_pipeline_succeeds` from a NEW explicit
   `GET /projects/:id` read (~15 lines in `gitlab.mjs`; the setting lives on the project object, NOT on
   `protected_branches`). The REAL analog of GitHub `required_status_checks`. Blocks **MERGES**. LOAD-BEARING
   — this is what actually blocked MR-A in CP-A2b (the mirror's protected branches are NOT configured;
   `feature/v2.0.0` runs unprotected), so presence-alone would falsely report rung-1 absent there.
2. **`protectedBranches`** — `glab api projects/:id/protected_branches`. Blocks direct **PUSHES**.
   Complementary, NOT equivalent to `pipelineMustSucceed`.
3. **`preReceive`** — not remotely verifiable; `mechanism` documented (config-declared, runbook-verified).
Different signals → reported differently. New `GET /projects/:id` fixtures are `derived` + `_provenance`,
shapes live-verifiable by curl against the mirror (CP-A3a precedent) once the code exists — never `recorded`.

## Acceptance split (mirrors the A2/A3 CP precedent)

- **CP-A4a (acceptance for THIS slice, fixture-phase):** D1+D2+D3 fully offline — bare-repo rejection
  fixture-tested (`sh`+`git`, no GitLab), GitLab protected-branch detection + honest pre-receive caveat
  unit-tested via injected probes, `npm test` + `brain:audit`/`brain:repo:check` + `brain:nav` green. Hard
  stop, PR-as-review.
- **Track A closing (DEFERRED to SCIT):** real-MR block on a self-hosted GitLab server with the pre-receive
  hook installed via `custom_hooks/` (needs Gitaly host-fs admin) — the code-vs-live-execution precedent
  from CP-A2b/CP-A3b.

## Capabilities (contract with sdd-spec)

- **Modified:** `governance-substrate` — rung-1 gains a per-provider sub-gate table
  (`protectedBranches`/`preReceive`) with a `verifiable`/`mechanism` honesty distinction; GitLab
  branch-protection detection is wired; the pre-receive rung is reported with the non-detectability caveat.
  Delta spec: `spec.md` (REQ-A4-*).
- **New:** none — no new hook binary, no new CLI verb.

## Relates-to

ADR-0014 / ADR-0015 (governance boundary), ADR-0009 (docs English), PLAN §2 A4 (ladder awareness),
issue #244, siblings A2 #231 / A3 #239. Durable lesson `[[workflow/env-limits-not-world-properties]]`.

## Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `brain/scripts/vcs/substrate.mjs` | Modified | Rung-1 sub-gate table + `verifiable`/`mechanism`; replace `selfHostedPreReceive` short-circuit |
| `brain/scripts/brain-governance-status.mjs` | Modified | Provider-branch `realBranchProtectionProbe` (GitLab); honest pre-receive caveat in print layer |
| `brain/scripts/hooks/pre-receive.test.mjs` | Modified | CP-A4a bare-repo rejection fixture (reuse `setupFixture`/`commitAndPush`) |
| `brain/scripts/brain-governance-status.test.mjs` | Modified | Offline fixtures: GitLab verified vs pre-receive-declared |
| `docs/inbox/self-hosted-pre-receive.md` | Modified | Extend (not duplicate) the GitLab `custom_hooks/` deferred runbook reference |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| GitLab per-branch protected-branch read shape unexercised in codebase | Med | Design investigates fixture shape; reuse `capabilities()` collection read if per-branch adds no signal |
| Honesty distinction half-threaded (data fixed, presentation still says "available") | Med | Spec REQ ties BOTH files; tests assert the caveat text renders exactly when `verifiable:false` |
| GitLab has no `contexts`-equivalent → the merge-blocking signal is a separate project setting | — | RESOLVED: `only_allow_merge_if_pipeline_succeeds` is the load-bearing `pipelineMustSucceed` sub-gate (proven the MR-A blocker in CP-A2b); protected-branch presence is a distinct PUSH-blocking sub-gate, reported separately — NOT presence-alone |

## Rollback

Single feature branch `feat/issue-244-a4`, no migrations, no data changes. Revert the PR merge to restore
GitHub-only detection + the `selfHostedPreReceive` short-circuit. Sub-gate fields are additive to the rung
result shape; consumers reading `rungs[1].active` are unaffected.

## Delivery constraints

- ≤400-line diff budget. No `size:exception`. Strict TDD.
- English artifacts (ADR-0009); en+es i18n for any changed user-facing CLI string.

## Success criteria

- [ ] D1: `substrate.mjs` rung-1 exposes `gates.{protectedBranches,preReceive}`; `active` = OR of the two;
      `preReceive` carries `verifiable:false`/`mechanism`; `selfHostedPreReceive` short-circuit removed;
      `selectRung()` unchanged.
- [ ] D2: `realBranchProtectionProbe` dispatches on provider; GitLab branch reuses `glab api
      …/protected_branches` via the sanctioned config path; print layer renders the pre-receive
      non-detectability caveat exactly when armed by the `preReceive` sub-gate.
- [ ] D3: bare-repo non-compliant push is fixture-tested as REJECTED reusing `setupFixture`/`commitAndPush`;
      governance-status GitLab fixtures (verified vs declared) pass offline.
- [ ] No artifact wording reports pre-receive as "verified"; docs extend (not duplicate)
      `self-hosted-pre-receive.md`.
- [ ] `npm test`, `brain:audit`, `brain:repo:check`, `brain:nav` green. STOP at CP-A4a (real-server MR block
      deferred to SCIT).
