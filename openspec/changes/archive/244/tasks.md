# Tasks — GitLab Substrate Ladder Awareness (A4, #244)

> Rung-1 splits into three honestly-reported GitLab sub-gates (`pipelineMustSucceed` load-bearing,
> `protectedBranches` complementary, `preReceive` non-remotely-verifiable), replacing the
> `selfHostedPreReceive` short-circuit (`substrate.mjs:98-100`) and the `gh`-hardcoded rung-1 probe
> (`brain-governance-status.mjs:45-63`). Strict TDD (RED → GREEN) for every code task. `selectRung()`
> (`:207-212`) stays UNTOUCHED; `detectSubstrate` stays a pure orchestrator (no fs/git/network inside
> `substrate.mjs`); provider-branching lives inside the evaluator, never leaking to `selectRung`.
> **Behavior-preservation is load-bearing**: existing GitHub rung-1 tests (`substrate.test.mjs`, no
> `provider` passed) MUST stay green with ZERO assertion changes. `diff-size` stays OUT of the
> pre-receive hook (Decision 4, recorded rationale — no task reopens this). `gitlab.mjs` is a GATE_FILE:
> no `CI_*`/pipeline-env read, `{apiBase, token, proxyUrl}` arrive as parameters exactly like
> `issueView`. The GitLab protected-branch probe uses the **per-branch** read
> (`protected_branches/:name`, 200/404/403), NOT `capabilities()` (owner-endorsed, memory #565 —
> `capabilities()` false-positives on an empty collection).
> Acceptance = CP-A4a (fixture-tested, hard stop, PR-as-review, Part of #244). Real self-hosted-GitLab
> server-hook install + live-MR block (CP-A3b/CP-A2b-style live smoke) is DEFERRED to the SCIT phase.

## Review Workload Forecast
| Field | Value |
|-------|-------|
| Estimated changed lines | ~145 non-test counted (design budget plan, confirmed below) |
| Decision needed before apply | No — well under the 400 budget |
| Chained PRs recommended | No |
| 400-line budget risk | Low |
| Delivery | Single PR into `feature/v2.0.0`, `Part of #244` |

**Confirmed estimate** (ignoreList excludes `**/*.test.mjs`, `.memory/**`, `openspec/changes/**`,
lockfiles → all test files and `design.md`/`spec.md`/`tasks.md` are UNCOUNTED):

| Counted file | Est. lines |
|--------------|-----------:|
| `brain/scripts/vcs/substrate.mjs` (3 evaluators + `evalRung1` restructure − removed short-circuit) | ~55 |
| `brain/scripts/vcs/providers/gitlab.mjs` (`projectMergeSettings` + doc comment) | ~25 |
| `brain/scripts/brain-governance-status.mjs` (probe branch + render + remove static line 191) | ~40 |
| `brain/scripts/vcs/fixtures/gitlab-project.json` (new, `derived` + `_provenance`) | ~10 |
| `docs/inbox/self-hosted-pre-receive.md` (extend, no duplication) | ~15 |
| **Total** | **~145** |

Single feature branch `feat/issue-244-a4`, additive rung fields only, no migrations — a revert restores
GitHub-only detection. No `size:exception` needed, no chain/split.

## Phase 1: `gitlab.mjs` — `projectMergeSettings` project-level merge-gate read (RED → GREEN)
> Covers REQ-A4-3, REQ-A4-5 (Decision 2, Decision 5's fixture provenance).
- [x] 1.1 Create `brain/scripts/vcs/fixtures/gitlab-project.json` — a `derived` fixture (NOT `recorded`,
      no live-recording pass exists for this endpoint yet) pinning the raw `GET /projects/:id` shape,
      specifically the `only_allow_merge_if_pipeline_succeeds` field name, stamped
      `_provenance: { endpoint: 'GET /projects/:id', date, provenance: 'derived', note: 'live-verifiable
      via curl against the mirror once exercised' }` (CP-A3a precedent for the `derived` stamp).
- [x] 1.2 Test (RED): `gitlab.mjs#projectMergeSettings({ project })` — success path parses the fixture's
      `only_allow_merge_if_pipeline_succeeds` (both `true` and `false`) into
      `{ onlyAllowMergeIfPipelineSucceeds: boolean }`; a failed/non-ok `glab api` read (mocked) returns
      `{ onlyAllowMergeIfPipelineSucceeds: null }` (uncomputable, never a fabricated `false`); an
      unparsable response also degrades to `null`, never throws.
- [x] 1.3 GREEN: add `projectMergeSettings({ project })` to `gitlab.mjs`, sibling of `capabilities()` —
      `run('glab', ['api', 'projects/${enc}'])`, parse-and-normalize per the design snippet. No new
      `capabilities()` return-shape change (Decision 2's rejected alternative — do NOT widen
      `capabilities()`). `npm test` green for this file's suite.
- [x] 1.4 Confirm `ci-context-drift-guard.test.mjs` stays green with no modification — `gitlab.mjs` reads
      no `CI_*`/pipeline env directly; `{apiBase, token, proxyUrl}` are not needed by this read (it uses
      the `glab` CLI session like `capabilities()`/`branchProtect()`, not `gitlabApiFetch`).

## Phase 2: `substrate.mjs` — three sub-gate evaluators + OR-composition (RED → GREEN)
> Covers REQ-A4-1 (D1). Replaces the `:98-100` short-circuit. `selectRung()` untouched.
- [x] 2.1 Test (RED) — CP-A2b mirror scenario: GitLab probe `{ pipelineMustSucceed: true }`, no protected
      branches (`protectedBranches` probe status `404`) → `gates.pipelineMustSucceed.active === true`,
      `gates.protectedBranches.active === false`, `rungs[1].active === true` via `pipelineMustSucceed`
      alone (spec REQ-A4-1 scenario 1 — presence-alone would have wrongly reported rung-1 absent here).
- [x] 2.2 Test (RED): GitLab probe `{ pipelineMustSucceed: false }`, no protected branches, no
      `selfHostedPreReceive` → `rungs[1].active === false`, remedy points at arming either mechanism
      (spec REQ-A4-1 scenario 2).
- [x] 2.3 Test (RED): `config.vcs.selfHostedPreReceive: true`, no API-verifiable gate armed → `evalRung1`
      does NOT unconditionally return `active:true`; `gates.preReceive.active === true` with
      `verifiable === false`, and `rungs[1].active === true` via that sub-gate specifically — assert the
      short-circuit is gone (spec REQ-A4-1 scenario 3; this is the case the existing test at
      `substrate.test.mjs:167-172` already exercises with `status:403` — its assertions must NOT change,
      see Phase 3).
- [x] 2.4 Test (RED): `protectedBranches` armed (GitLab per-branch status `200`), `pipelineMustSucceed`
      false, no `preReceive` → `gates.protectedBranches.active === true`, `rungs[1].active === true`.
- [x] 2.5 GREEN: implement `evalPipelineMustSucceedGate({ provider, status, hasOurContexts, result })`,
      `evalProtectedBranchesGate({ provider, status })`, `evalPreReceiveGate({ config })` per the design
      snippets verbatim (mechanism strings: see Open Questions — `preReceive`'s exact string needs
      confirmation before this task is DONE). `provider === 'gitlab'` branches read
      `result.pipelineMustSucceed` / per-branch `status`; the `else` (github/unset) branch reproduces
      TODAY'S contexts-based logic byte-for-byte (the existing `200/404/403`/unknown ladder).
- [x] 2.6 GREEN: rewrite `evalRung1`'s return to build `gates = { pipelineMustSucceed, protectedBranches,
      preReceive }`, `active = OR(three)`; on not-armed, surface `gates.pipelineMustSucceed` as `primary`
      exactly as the design snippet shows (`available: active || primary.available` — preserves the
      `403`-without-`preReceive` `available:false` case). Remove the `:98-100` short-circuit entirely.
- [x] 2.7 GREEN: `detectSubstrate` changes the ONE line per design — `rungs[1].gates.brainWritesReviewed =
      await evalBrainWritesReviewedGate(...)` becomes a mutate-add onto the `gates` object `evalRung1`
      now returns (not an overwrite). `selectRung()` (`:207-212`) is NOT touched — verify by diff, not
      just by not editing it (a fresh look, since this is the constraint most likely to regress silently).

## Phase 3: Behavior-preservation proof (no assertion changes)
> Covers REQ-A4-1's load-bearing constraint. This is a PROOF task, not new coverage — do it right after
> Phase 2 GREEN, before moving on.
- [x] 3.1 Re-run the existing no-`provider` rung-1 cases in `substrate.test.mjs` (currently ~`:111-178`
      and the throwing-probe cases ~`:312-421`) and confirm EVERY assertion holds with ZERO text changes:
      `{200,OUR}` → rung 1, `reason:null`, `remedy:null`; `{200,other}` → `rung !== 1`; `{404}` →
      `available:true`, `active:false`, reason matches `/unset|not configured|not armed/`; `{403}` →
      `available:false`; `{selfHostedPreReceive:true}` + `{403}` → rung 1, `enforced:true` (short-circuit
      removed, `preReceive` sub-gate takes over — the assertion text itself does not change, only which
      code path produces it). A throwing `branchProtection` probe still degrades rung 1 to inactive,
      never crashes.
- [x] 3.2 If any assertion required editing to stay green, STOP and treat that as a design violation —
      the fix belongs in the evaluator's `else` branch (Phase 2.5), not in the test.

## Phase 4: `brain-governance-status.mjs` — provider-dispatched probe + honesty rendering (RED → GREEN)
> Covers REQ-A4-2, REQ-A4-3 (D2, D3). The honesty contract: `substrate.mjs` owns the SIGNAL,
> `brain-governance-status.mjs` owns the CAVEAT TEXT — both change together or the fix is incomplete.
- [x] 4.1 Test (RED): `realBranchProtectionProbe` GitHub branch is UNCHANGED (regression guard — same
      `gh api …/branches/:branch/protection` read, same `{status, contexts}` shape, no
      `pipelineMustSucceed` field added on this branch).
- [x] 4.2 Test (RED): `realBranchProtectionProbe` with `config.vcs.provider === 'gitlab'` — mocked
      per-branch `glab api projects/:id/protected_branches/:branch` (`200`/`404`/`403` via `run` mock,
      no live network) PLUS a mocked `projectMergeSettings` (via `providerModule` injection) — asserts
      the normalized return `{ status, contexts: [], pipelineMustSucceed }`. Assert NO direct
      `process.env` read inside `gitlab.mjs` for this path (parameterized dispatch only).
- [x] 4.3 Test (RED): `GET /projects/:id` unreachable/failing (mocked `projectMergeSettings` throwing or
      returning `null`) → `gates.pipelineMustSucceed.available === false` with a remedy; the report
      completes without throwing (spec REQ-A4-3 scenario 2).
- [x] 4.4 GREEN: implement the provider-branch in `realBranchProtectionProbe` per the design snippet —
      dynamic `import('./vcs/providers/gitlab.mjs')` (or use the injected `providerModule` in tests),
      per-branch read status mapping (`ok→200`, `stderr includes ': 404'→404`, `': 401'|': 403'→403`),
      then `gl.projectMergeSettings({ project })`, normalize to
      `{ status, contexts: [], pipelineMustSucceed: onlyAllowMergeIfPipelineSucceeds === true }`.
- [x] 4.5 Test (RED): `printSubstrateReport` — for each of the three rung-1 sub-gates that is `active`:
      `verifiable === true` renders a DETECTED line (merge gate / push gate); `verifiable === false`
      renders the exact caveat text and the string `"verified"` NEVER appears anywhere near
      `"pre-receive"` in the output (spec REQ-A4-2 scenario 1). An API-verified gate being active does
      NOT also render the pre-receive caveat (spec REQ-A4-2 scenario 2).
- [x] 4.6 GREEN: `printSubstrateReport` gains the rung-1 sub-gate breakdown, driven SOLELY by
      `gates.*.verifiable`/`gates.*.active` — never a hardcoded independent branch. REMOVE the
      unconditional static line 191 (`'  pre-receive available  [bypass-proof self-hosted hard gate …]'`)
      from the universal block — pre-receive is a rung-1 mechanism, armed only when config-declared, not
      a universal line.
- [x] 4.7 Lock the exact rendered copy (Open Question — see below) before marking this phase DONE:
      merge-gate line, push-gate line, and the pre-receive caveat line (design proposes
      `  pre-receive    armed (config-declared) — not remotely detectable; verify via install runbook
      (npm run brain:protect-server)`). English-only, diagnostic CLI report lines — no i18n plumbing
      needed (matches `printSubstrateReport`'s existing English-only convention; consistent with A3
      Phase 2's precedent for non-i18n-importing files).

## Phase 5: Offline governance-status fixtures — 4 injected-probe cases (RED → GREEN)
> Covers REQ-A4-2, REQ-A4-5 (Decision 5's table). All four via the existing seam — injected
> `probes.branchProtection` override + fake `providerModule`, `config: { vcs: { provider: 'gitlab' } }`.
> No live `glab`/network call in `npm test`.
- [x] 5.1 Case `pipelineMustSucceed`-armed: `{ status: 404, contexts: [], pipelineMustSucceed: true }` →
      RUNG 1; merge gate armed; push gate inactive; NO pre-receive caveat.
- [x] 5.2 Case `protectedBranches`-armed: `{ status: 200, contexts: [], pipelineMustSucceed: false }` →
      RUNG 1; push gate armed; merge gate inactive.
- [x] 5.3 Case `preReceive`-declared-only: `{ status: 404, contexts: [], pipelineMustSucceed: false }` +
      `config.vcs.selfHostedPreReceive: true` → RUNG 1; pre-receive caveat renders (`verifiable:false`);
      output never contains "verified" adjacent to "pre-receive".
- [x] 5.4 Case none armed: `{ status: 404, contexts: [], pipelineMustSucceed: false }`, no
      `selfHostedPreReceive` → rung falls below 1; no false arming.
- [x] 5.5 `npm test` green for `brain-governance-status.test.mjs` and `substrate.test.mjs`.

## Phase 6: CP-A4a bare-repo push rejection — append variant (RED → GREEN)
> Covers REQ-A4-4 (D3, Decision 5). Reuses `setupFixture`/`commitAndPush` UNCHANGED. Provider-agnostic
> pure git-server mechanics — no GitLab, no network, `GIT_AVAILABLE`-gated like the existing cases.
- [x] 6.1 Add an `appendAndPush(cloneDir, file, message)` helper beside `commitAndPush` in
      `hooks/pre-receive.test.mjs` — appends to an EXISTING tracked file (vs. `commitAndPush`'s new-file
      creation) and pushes with the given message.
- [x] 6.2 Test (RED → GREEN): first push a COMPLIANT commit that creates a tracked file
      (`commitAndPush`), then `appendAndPush` with a NON-COMPLIANT message (bad format / missing ticket
      ref) → push REJECTED (non-zero exit), output mentions `pre-receive`, bare repo's ref is NOT
      updated past the first compliant commit (spec REQ-A4-4 scenario 1).
- [x] 6.3 Test (RED → GREEN): same fixture, `appendAndPush` with a COMPLIANT message (valid Conventional
      Commit + ticket ref) → push succeeds, bare repo's ref reflects the new commit (spec REQ-A4-4
      scenario 2).
- [x] 6.4 `npm test` green for `hooks/pre-receive.test.mjs`; confirm both new cases remain
      `{ skip: !GIT_AVAILABLE }`-gated like the existing four.

## Phase 7: Docs — extend `docs/inbox/self-hosted-pre-receive.md` (Decision 6)
- [x] 7.1 Add a short subsection cross-referencing the EXISTING GitLab `custom_hooks/` manual-install
      section (`:55-76`, unchanged) from the ladder-awareness angle: how `brain:governance-status` now
      reports the pre-receive rung as "armed (config-declared) — not remotely detectable" (use the FINAL
      locked copy from Phase 4.7, not a re-derived string), and that the runbook is how you VERIFY what
      the ladder cannot probe. No duplication of the install steps.

## Phase 8: Baseline + CP-A4a assembly
- [x] 8.1 `npm test` green over the full accumulated tree (0 failures).
- [x] 8.2 `brain:repo:check` green.
- [x] 8.3 `brain:nav` green.
- [x] 8.4 `brain:audit` green.
- [ ] 8.5 `memory:share` run before push. No `decision` label unless a new promoted decision arises
      beyond what's already recorded (memory #565, #567-569).
- [x] 8.6 STOP at CP-A4a. Declare in the PR body that CP-A4a is fixture-only (offline, provider-branched
      unit coverage + the bare-repo append-rejection e2e); real self-hosted-GitLab `custom_hooks/`
      server-hook install and live-MR block are DEFERRED to the SCIT phase (Track A closing, per spec.md
      "Acceptance split").

## Open questions (implementation choices left open by spec/design — resolve before/during apply)
- **`preReceive`'s exact `mechanism` string — spec/design DISAGREE, must be reconciled before Phase 2.5
  is DONE.** `spec.md` REQ-A4-2 states the sub-gate MUST carry
  `mechanism:'pre-receive-config-declared'`. `design.md`'s locked field shape (Decision 1) instead shows
  `mechanism: 'config-declared; verify via install runbook'`, and design's own "Open questions for
  tasks.md" footnote calls that second string "ruling-mandated verbatim" — but the ruling text captured
  in memory #565 does not quote either string exactly, so this cannot be resolved from the artifacts
  alone. Spec is the acceptance-testable, normative document — **default to
  `mechanism:'pre-receive-config-declared'` per REQ-A4-2** unless the owner confirms otherwise at review;
  either way, the value must be a single locked constant referenced by BOTH the RED test (2.3) and the
  caveat-rendering test (4.5) so they can't silently diverge.
- **`pipelineMustSucceed`/`protectedBranches` `mechanism` string values** (`'branch-merge-gate-api'` /
  `'protected-branch-api'`) — proposed by design, not spec-mandated; confirm at review (task 2.5) or
  accept as proposed since no REQ pins them.
- **Exact rendered CLI copy** (merge-gate / push-gate / pre-receive-caveat lines, task 4.7) — design
  proposes wording but explicitly leaves it as an open question for tasks/apply to lock. English-only
  (ADR-0009, diagnostic report convention) — no i18n needed.
- **Per-branch read vs `capabilities()` reuse — RESOLVED, not open.** Owner-endorsed in memory #565: use
  the per-branch `protected_branches/:name` read (200/404/403), not `capabilities()`. Recorded here only
  so a reviewer doesn't reopen it as a "why not reuse `capabilities()`" question.

## Out of scope (unchanged from spec.md's Non-goals)
- `diff-size` inside the pre-receive hook (Decision 4, rationale recorded, not reopened).
- A GitLab-CI job registry (`REQUIRED_JOBS` equivalent) — detection honesty, not job orchestration.
- Real server-side hook install on self-hosted GitLab (`custom_hooks/`, Gitaly host-fs admin) — SCIT.
- CP-A3b / CP-A2b live smoke — unchanged by A4, deferred to SCIT.
