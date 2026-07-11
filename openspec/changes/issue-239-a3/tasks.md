# Tasks — GitLab Provider Verbs + Provider-Agnostic labelEvents (A3, #239)

> `labelEvents` contract verb + `m3` close + `prView`/`mrCreate` un-stub + shared contract suite +
> recorded-from-real fixtures. Strict TDD (RED → GREEN) for every code task. Pure `evaluateActor` stays
> UNCHANGED (ADR-0016 boundary). Reuse `gitlabApiFetch`/`gitlabApiConfig`/`getVcs({ provider })` — never
> rebuild them. Guardrails: CLI-free for CI-BREAKING verbs (GitLab direct-API), `gh`-on-GitHub-Actions
> acceptable; dispatch on `ctx.provider`; NO direct pipeline-env read in GATE_FILES; en + es i18n for every
> changed CLI string; docs English (ADR-0009).
> Acceptance = CP-A3a (fixture-tested, hard stop, PR-as-review, Part of #239). CP-A3b (live smoke) DEFERRED
> to the SCIT phase.

## Review Workload Forecast
| Field | Value |
|-------|-------|
| Estimated changed lines | ~560–780 (labelEvents ×2 providers + actor-check refactor/delete + prView/mrCreate un-stub + shared contract suite + recording script + recorded/DERIVED JSON fixtures) |
| Decision needed before apply | **Yes** — exceeds the 400 budget; SPLIT into a sequential chain (below) |
| Chained PRs recommended | **Yes** |
| 400-line budget risk | **High** (the contract suite + the recorded JSON fixtures are the primary drivers; JSON fixtures alone can run 150–250 counted lines) |
| Delivery | 3 SEQUENTIAL chained PRs into `feature/v2.0.0` (see Chain plan) |

## Chain plan (budget split — mirrors the A2 precedent)

The four deliverables have a LINEAR dependency (the contract suite + fixtures can only assert verbs that
exist), so the honest forecast (>400) is corrected by SPLITTING, not `size:exception` — the #216 exception
precedent was mandated ATOMICITY; here the dependency is a natural chain and the 400 budget is a planning
forcing-function. This is ONE slice, ONE design, ONE checkpoint — delivered in 3 tranches by budget. **NOT**
a C2-style re-split into new issues. All three PRs are `Part of #239`; NO new issues.

| PR | Tranche | Focus for its express review |
|----|---------|------------------------------|
| **PR-1** | Phase 1 (+ planning) | `labelEvents` verb (both providers) + `m3` close + `actor-check` refactor; behavior-preservation proof (`actor-check.test.mjs` unchanged) |
| **PR-2** | Phase 2 | GitLab `prView`/`mrCreate` un-stub over `gitlabApiFetch`; contract-doc status rows flipped |
| **PR-3** | Phases 3–4 | shared parameterized contract suite + recorded-from-real fixture infra (recorded vs `DERIVED`) |

**Sequential, NOT stacked:** PR-1 merges → PR-2 opens off the updated `feature/v2.0.0` → merges → PR-3.
Each targets `feature/v2.0.0` and stays under 400 counted. **The CP-A3a VERDICT is issued on PR-3**, read
against the full accumulated tree — the parity story (both providers ↔ shared suite ↔ recorded fixtures)
verified whole.

## Phase 1: `labelEvents` verb + `m3` close + actor-check refactor (RED → GREEN)
> **TASK BOUNDARY — brain/core touch:** task 1.6 edits `brain/core/methodology/vcs-contract.md`, engaging
> the L6 `brain-writes-reviewed` gate (human review of the merge, distinct from author). Expected PASS+warn
> — the FIFTH slice to touch a `brain/core/` file (after #215 C1b, #223 C2b-1, #229 C4, #231 A2). The
> established path; do not be surprised by the gate.
- [ ] 1.1 Test (RED): `github.labelEvents` normalizes an `issues/N/events` fixture — `event:'labeled'` →
      `action:'add'`, `event:'unlabeled'` → `action:'remove'`, `actor.login`/`label.name`/`created_at` →
      `{ actor:{login}, action, label, at }`, ascending by `at`; a thrown fetch → `null` (never `[]`).
- [ ] 1.2 Test (RED): `gitlab.labelEvents` normalizes a `resource_label_events` fixture —
      `user.username` → `actor.login`, native `action`, `label.name` → `label`, `created_at` → `at`,
      ascending; thrown fetch → `null`.
- [ ] 1.3 GREEN: add `labelEvents` to `github.mjs` — EXTRACT the inline `gh api --paginate
      issues/N/events` from `actor-check.mjs:161-175` VERBATIM (preserve the load-bearing `--paginate`),
      normalize to the shared shape. Add `labelEvents` to `gitlab.mjs` over `gitlabApiFetch`
      (`resource_label_events`), config threaded via params (LOCAL defaults like `issueView` `:62-72`; NO
      direct `CI_API_V4_URL` read — GATE_FILE).
- [ ] 1.4 Test (RED): `actor-check` on `provider:'gitlab'` with a GitLab self-approval fixture →
      `evaluateActor` returns `fail` (REQ-L5-1), NOT a permanent `warn`; `labelEvents:null` or empty
      add-filtered list → `warn` (REQ-L5-2). Job stays DETECTION / `allow_failure` — REPORTS, never blocks.
- [ ] 1.5 GREEN: DELETE `defaultFetchLabeledEvents`; `gatherActorCheckInputs` dispatches
      `getVcs({ provider: ctx.provider }).labelEvents(...)` with `gitlabApiConfig()` params (the
      `run-check.mjs:167-177` precedent). Make `filterLabeledEvents` a SHARED post-filter over normalized
      `action === 'add' && label === approvedLabel`. Pure `evaluateActor` (`:65-109`) UNCHANGED. Keep the
      injected-`deps.fetchLabeledEvents` bypass for tests.
- [ ] 1.6 GREEN: `cli.mjs` `VERBS` (`:19-23`) gains `labelEvents`; `vcs-contract.md:22-34` gains its row
      (Decision 6 — contract concept, NOT `resourceLabelEvents`). **L6 gate.**
- [ ] 1.7 BEHAVIOR-PRESERVATION proof: re-run `actor-check.test.mjs` — passes with NO assertion change
      (the extraction moved code, not behavior). Light re-point of the injected `fetchLabeledEvents` dep
      only.
- [ ] 1.8 i18n (en + es) for every changed CLI string (same file-scope convention as A2 Phase 2.5 —
      `actor-check.mjs` has no `i18n/t.mjs` importer; new `reason` strings follow its English-only
      convention, no net-new i18n plumbing). `npm test` green · `repo:check` · `brain:nav`.

## Phase 2: GitLab `prView`/`mrCreate` un-stub over `gitlabApiFetch` (RED → GREEN)
> **TASK BOUNDARY — brain/core touch:** task 2.5 flips the `prView`/`mrCreate` GitLab status rows in
> `vcs-contract.md` (`:65-73`), engaging the L6 gate again — expected PASS+warn, same established path.
- [ ] 2.1 Test (RED): `gitlab.prView({ project, number, apiBase, token, proxyUrl, fetchImpl })` normalizes
      a `GET /projects/:id/merge_requests/:iid` fixture → `{ number, labels, body, author }` (GL
      `iid`/`description`/`source_branch` hidden); a failed fetch → `null` fields (uncomputable, never a
      fabricated empty); never throws.
- [ ] 2.2 Test (RED): `gitlab.mrCreate({ project, title, body, head, base, labels })` → `{ url }` on a
      successful `POST /projects/:id/merge_requests`; `{ url: null, error }` on failure; never throws
      (matches `github.mjs:197-221`).
- [ ] 2.3 GREEN: replace the `prView` stub (`gitlab.mjs:79-82`) and `mrCreate` stub (`:221-224`) with real
      implementations over `gitlabApiFetch`. Config threaded via params (`gitlabApiConfig()` at the caller
      → params), LOCAL defaults like `issueView`. NO direct pipeline-env read in the GATE_FILE (drift-guard
      stays green).
- [ ] 2.4 i18n (en + es) for any changed CLI string; docs English.
- [ ] 2.5 GREEN: flip `vcs-contract.md`'s Phase-3 status rows (`:65-73`) — GitLab `prView`/`mrCreate`
      "stub" → "implemented (A3 — issue #239)". **L6 gate.**
- [ ] 2.6 `npm test` green · `repo:check` · `brain:nav`.

## Phase 3: shared parameterized contract suite + recorded-from-real fixtures (RED → GREEN)
> Depends on Phases 1–2 (the suite can only assert verbs that exist). This is the CP-A3a-verdict tranche.
- [ ] 3.1 Confirm the fixtures dir + naming convention (design Open Question 2): proposed
      `brain/scripts/vcs/fixtures/` with `<provider>-<verb>-<case>.json` and an in-file
      `_provenance: { endpoint, date, recorded|derived }` stamp.
- [ ] 3.2 Create `brain/scripts/vcs/fixtures/record-fixtures.mjs` — a COMMITTED script that hits the real
      APIs ONCE (GitLab: the live mirror; GitHub: this repo), writing raw JSON stamped `endpoint + date`.
      Documents which endpoints it hits; re-runnable to refresh without editing the suite. NOT run by
      `npm test`.
- [ ] 3.3 Record the real fixtures (`labelEvents`, `prView`, `mrCreate` happy paths) via the script; author
      the non-recordable edge cases (forced-failure, fabricated self-approval) marked `DERIVED`.
      Recorded-vs-derived ALWAYS visible (lesson #12).
- [ ] 3.4 Test (RED → GREEN): create the shared parameterized contract suite
      (`brain/scripts/vcs/providers/vcs.contract.test.mjs`) over `['github','gitlab']` asserting the SAME
      contract (normalized shapes, `null`-on-uncomputable, ascending ordering, never-throws) for
      `labelEvents`/`prView`/`mrCreate`, via an injected fixture-reading transport. Parity = identical
      assertions. NO live network in `npm test`.
- [ ] 3.5 `npm test` green (0 failures) · `repo:check` · `brain:nav`.

## Phase 4: baseline + CP-A3a assembly
- [ ] 4.1 `npm test` green over the full accumulated tree · `brain:repo:check` · `brain:nav`.
- [ ] 4.2 `memory:share` run before push. No `decision` label unless a new promoted decision arises.
      DEFERRED — orchestrator handles the CP-A3a push per this apply run's instructions.
- [ ] 4.3 STOP at CP-A3a (fixture-tested; live smoke is CP-A3b, DEFERRED to the SCIT phase). Declare in the
      PR-3 body that CP-A3a is fixture-only (recorded-from-real + `DERIVED`) and CP-A3b (live round-trip on
      the real GitLab mirror) is deferred to the SCIT phase. DEFERRED — orchestrator assembles the CP-A3a PR.

## Open questions
- **CP-A3b live-smoke endpoint:** deferred to the SCIT phase — blocked on the human exercising the live
  GitLab mirror; not decidable here (same posture as CP-A2b).
- **Fixtures dir + naming:** confirm `brain/scripts/vcs/fixtures/` + `_provenance` stamp in task 3.1 before
  committing the recording script.

## Out of scope
- Label WRITE verbs (`labelAdd`/`labelRemove`) + `protectBranch` rework (PLAN §A3 background; not needed by
  the gates — see PLAN-DEVIATION) · migrating GitHub `labelEvents`/`issueView` off `gh` (Actions ships it —
  Decision 2) · the local-interactive `glab` verbs (`issueList`/`mrList`/`commitStatus`/…) · CP-A3b live
  smoke (deferred to the SCIT phase).
