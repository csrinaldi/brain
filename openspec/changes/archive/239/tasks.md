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
- [x] 1.1 Test (RED): `github.labelEvents` normalizes an `issues/N/events` fixture — `event:'labeled'` →
      `action:'add'`, `event:'unlabeled'` → `action:'remove'`, `actor.login`/`label.name`/`created_at` →
      `{ actor:{login}, action, label, at }`, ascending by `at`; a thrown fetch → `null` (never `[]`).
- [x] 1.2 Test (RED): `gitlab.labelEvents` normalizes a `resource_label_events` fixture —
      `user.username` → `actor.login`, native `action`, `label.name` → `label`, `created_at` → `at`,
      ascending; thrown fetch → `null`.
- [x] 1.3 GREEN: add `labelEvents` to `github.mjs` — EXTRACT the inline `gh api --paginate
      issues/N/events` from `actor-check.mjs:161-175` VERBATIM (preserve the load-bearing `--paginate`),
      normalize to the shared shape. Add `labelEvents` to `gitlab.mjs` over `gitlabApiFetch`
      (`resource_label_events`), config threaded via params (LOCAL defaults like `issueView` `:62-72`; NO
      direct `CI_API_V4_URL` read — GATE_FILE).
- [x] 1.4 Test (RED): `actor-check` on `provider:'gitlab'` with a GitLab self-approval fixture →
      `evaluateActor` returns `fail` (REQ-L5-1), NOT a permanent `warn`; `labelEvents:null` or empty
      add-filtered list → `warn` (REQ-L5-2). Job stays DETECTION / `allow_failure` — REPORTS, never blocks.
- [x] 1.5 GREEN: DELETE `defaultFetchLabeledEvents`; `gatherActorCheckInputs` dispatches
      `getVcs({ provider: ctx.provider }).labelEvents(...)` with `gitlabApiConfig()` params (the
      `run-check.mjs:167-177` precedent). Make `filterLabeledEvents` a SHARED post-filter over normalized
      `action === 'add' && label === approvedLabel`. Pure `evaluateActor` (`:65-109`) UNCHANGED. Keep the
      injected-`deps.fetchLabeledEvents` bypass for tests.
- [x] 1.6 GREEN: `cli.mjs` `VERBS` (`:19-23`) gains `labelEvents`; `vcs-contract.md:22-34` gains its row
      (Decision 6 — contract concept, NOT `resourceLabelEvents`). **L6 gate.**
- [x] 1.7 BEHAVIOR-PRESERVATION proof: re-run `actor-check.test.mjs` — passes with NO assertion change
      (the extraction moved code, not behavior). Light re-point of the injected `fetchLabeledEvents` dep
      only.
- [x] 1.8 i18n (en + es) for every changed CLI string (same file-scope convention as A2 Phase 2.5 —
      `actor-check.mjs` has no `i18n/t.mjs` importer; new `reason` strings follow its English-only
      convention, no net-new i18n plumbing). `npm test` green · `repo:check` · `brain:nav`.

> **PLAN-DEVIATION (recorded — fresh-context review, same PR-1):** the m3 finding this phase inherited its
> scope from only named the labeled-events fetch as gh-CLI-hardcoded. Reality: `gatherActorCheckInputs`
> needs TWO fetches before `evaluateActor` runs — `fetchLabeledEvents` (fixed by 1.1-1.7 above) AND
> `fetchIssue` (`actor-check.mjs:193-206` pre-fix), which was STILL an unconditional `execFileSync('gh', ...)`
> call regardless of provider. A GitLab self-approval therefore still masked to a permanent `warn` after
> 1.1-1.8 shipped — R3 was NOT genuinely met. Tasks 1.9-1.11 below close this (spec.md's REQ-A3-3/R3 wording
> was already correct — only this tasks.md under-scoped the implementation). A fresh-context review of
> 1.1-1.8 additionally ran a class-closure audit (this is the 3rd instance of "CI-path fetch ignores runtime
> provider": #14 issue-link, labelEvents pre-fix, now fetchIssue) and found a 4th instance —
> `brain-writes-reviewed.mjs`'s `defaultFetchReviews` (`:140-154` pre-fix) — fixed in the same PR-1 by 1.12.
> Both fixes stay within the CP-A3a PR-1 budget (395/400 non-test counted lines).
- [x] 1.9 Test (RED): `actor-check` on `provider:'gitlab'`, exercising the REAL default path (no injected
      `deps.fetchIssue`/`deps.fetchLabeledEvents` — mock at the `getVcs`/transport layer only, per lesson
      #10/#12) — a GitLab self-approval reaches `evaluateActor` and returns `fail`; no `gh`/`glab` CLI spawn
      occurs on the GitLab path.
- [x] 1.10 GREEN: migrate `defaultFetchIssue` (`actor-check.mjs`) to dispatch `getVcs({ provider
      }).issueView(...)` threading `gitlabApiConfig()` params, mirroring `defaultFetchLabeledEvents` and the
      `run-check.mjs:167-177` precedent. Extend BOTH providers' `issueView` to also return `author` (GH
      `user.login`, GL `author.username` — same API call, no extra round-trip) since REQ-L5-1 needs the
      issue author. `vcs-contract.md`'s `issueView` row updated to include `author`. **L6 gate** (contract
      doc edit).
- [x] 1.11 Class-closure audit: exhaustive table of every spawn/fetch reachable from the 8 CI governance jobs
      (`issue-link`, `diff-size`, `local-checks`, `memory-gate`, `decision-gate`, `phase-order`,
      `actor-check`, `brain-writes-reviewed`) — status ∈ {runtime-dispatch ✓, config-only-local, VIOLATION}.
      Found a 4th VIOLATION (`brain-writes-reviewed.mjs`'s `defaultFetchReviews`) — see 1.12. Table recorded
      in the apply-progress artifact and the CP-A3a PR-1 body.
- [x] 1.12 GREEN (4th VIOLATION fix): add the `prReviews` CONTRACT verb to both providers (GH: EXTRACT the
      inline `gh api --paginate pulls/N/reviews` from `brain-writes-reviewed.mjs`'s pre-fix
      `defaultFetchReviews` VERBATIM, preserving `--paginate`; GL: over `gitlabApiFetch`'s
      `merge_requests/:iid/approvals`, normalizing `approved_by[]` to one `{state:'APPROVED', author}` entry
      per approver). Migrate `defaultFetchReviews` to dispatch `getVcs({ provider }).prReviews(...)`. `VERBS`
      + `vcs-contract.md` gain the `prReviews` row. **L6 gate.**
- [x] 1.13 Generalized regression guard (class closure, not instance): a shared test running every
      JS-invokable governance-job entrypoint (issue-link, diff-size, memory-gate, decision-gate, phase-order,
      actor-check, brain-writes-reviewed) under `provider:'gitlab'` with mocked transport, asserting zero
      `gh`/`glab` CLI spawns — PLUS a structural source-scan companion (closes a blind spot: a raw
      `execFileSync('gh', ...)` bypasses any injected `deps.getVcs` mock entirely, so the behavioral test
      alone cannot catch that regression shape). Added as `no-gh-glab-spawn-regression.test.mjs` — fits
      inside the PR-1 budget (test file, excluded from the 400-line counted diff per `governance.ignoreList`).
      Structural scan quote-class hardened to also catch template-literal spawns (`` `gh` ``), per fresh-review
      MINOR. RESIDUAL GAP (accepted): an indirect binding (`const bin='gh'; execFileSync(bin, ...)`) still slips
      past a source-scan — a regex cannot close it without an AST. Follow-up: promote the scan to an AST/lint
      rule ONLY if a real `gh`/`glab` regression of that indirect shape is ever observed (no speculative n=1).
- [x] 1.14 `npm test` green (0 failures, 1169 tests) · `repo:check` · `brain:nav`. Final non-test counted
      diff: 395/400.

## Phase 2: GitLab `prView`/`mrCreate` un-stub over `gitlabApiFetch` (RED → GREEN)
> **TASK BOUNDARY — brain/core touch:** task 2.5 flips the `prView`/`mrCreate` GitLab status rows in
> `vcs-contract.md` (`:65-73`), engaging the L6 gate again — expected PASS+warn, same established path.
- [x] 2.1 Test (RED): `gitlab.prView({ project, number, apiBase, token, proxyUrl, fetchImpl })` normalizes
      a `GET /projects/:id/merge_requests/:iid` fixture → `{ number, labels, body, author }` (GL
      `iid`/`description`/`source_branch` hidden); a failed fetch → `null` fields (uncomputable, never a
      fabricated empty); never throws.
- [x] 2.2 Test (RED): `gitlab.mrCreate({ project, title, body, head, base, labels })` → `{ url }` on a
      successful `POST /projects/:id/merge_requests`; `{ url: null, error }` on failure; never throws
      (matches `github.mjs:197-221`).
- [x] 2.3 GREEN: replace the `prView` stub (`gitlab.mjs:79-82`) and `mrCreate` stub (`:221-224`) with real
      implementations over `gitlabApiFetch`. Config threaded via params (`gitlabApiConfig()` at the caller
      → params), LOCAL defaults like `issueView`. NO direct pipeline-env read in the GATE_FILE (drift-guard
      stays green). Also extended `gitlab-api.mjs`'s `gitlabApiFetch` with optional `method`/`body` (defaults
      to `GET`, backward-compatible) so `mrCreate`'s `POST` reuses the SAME shared transport — never a
      second hand-rolled fetch.
- [x] 2.4 i18n (en + es) for any changed CLI string; docs English. N/A this phase: `gitlab.mjs`/`gitlab-api.mjs`
      have no `i18n/t.mjs` importer (same precedent as PR-1 task 1.8); the only new string surface is the
      internal `err.message` propagated from `gitlabApiFetch`'s existing thrown error, not a new CLI-facing
      string. No console output was added.
- [x] 2.5 GREEN: flip `vcs-contract.md`'s Phase-3 status rows (`:65-73`) — GitLab `prView`/`mrCreate`
      "stub" → "implemented (A3 — issue #239)". **L6 gate.**
- [x] 2.6 `npm test` green (1178/1178) · `repo:check` · `brain:nav`.

## Phase 3: shared parameterized contract suite + recorded-from-real fixtures (RED → GREEN)
> Depends on Phases 1–2 (the suite can only assert verbs that exist). This is the CP-A3a-verdict tranche.
- [x] 3.1 Confirm the fixtures dir + naming convention (design Open Question 2): proposed
      `brain/scripts/vcs/fixtures/` with `<provider>-<verb>-<case>.json` and an in-file
      `_provenance: { endpoint, date, recorded|derived }` stamp.
- [x] 3.2 Create `brain/scripts/vcs/fixtures/record-fixtures.mjs` — a COMMITTED script that hits the real
      APIs ONCE (GitLab: the live mirror; GitHub: this repo), writing raw JSON stamped `endpoint + date`.
      Documents which endpoints it hits; re-runnable to refresh without editing the suite. NOT run by
      `npm test`.
- [x] 3.3 Record the real fixtures (`labelEvents`, `prView`, `mrCreate` happy paths) via the script; author
      the non-recordable edge cases (forced-failure, fabricated self-approval) marked `DERIVED`.
      Recorded-vs-derived ALWAYS visible (lesson #12).
- [x] 3.4 Test (RED → GREEN): create the shared parameterized contract suite
      (`brain/scripts/vcs/providers/vcs.contract.test.mjs`) over `['github','gitlab']` asserting the SAME
      contract (normalized shapes, `null`-on-uncomputable, ascending ordering, never-throws) for
      `labelEvents`/`prView`/`mrCreate`, via an injected fixture-reading transport. Parity = identical
      assertions. NO live network in `npm test`.
- [x] 3.5 `npm test` green (0 failures) · `repo:check` · `brain:nav`.
- [x] 3.6 Verb-definition reconciliation (deferred from PR-2 per Decision 6 — the complete pass, verified by
      the contract suite): add `prView`/`mrCreate` rows to the "Required verbs" table (`vcs-contract.md:22-36`)
      and add the missing entries (`mrCreate`/`branchProtect`/`capabilities`) to `cli.mjs`'s `VERBS` array —
      reconcile ALL THREE sources (required-verbs table, Phase-3 status table, `VERBS`) in one pass. No
      drift-guard covers these today; consider adding one so the three sources can't diverge again.

      **Fresh-context review addendum (same PR-3):** the first drift-guard version only cross-checked the doc
      table against `VERBS` — a verb both providers implement but omitted from BOTH would pass silently
      forever (proven: it would have caught `branchProtect` but NOT `mrCreate`). Added a THIRD check
      (`sharedFunctionExports` in `verb-contract-drift-guard.test.mjs`) computing the intersection of both
      providers' actual function exports and asserting each is in `VERBS` or the new `SHARED_NON_VERB_EXPORTS`
      allowlist (empty today — reserved for future legitimately-shared non-verb exports). RED→GREEN proven via
      a temporarily-broken stub AND a fake-provider injection test. Also fixed `vcs-contract.md:61`'s stale
      "13 verbs" prose → 15 (the true row count after this task's table additions).
- [x] 3.7 Empty-body representation parity (deferred from PR-2 NIT): decide the canonical empty/uncomputable
      value for normalized `body` across providers — GitHub uses `?? ''` on success, GitLab `prView`/`issueView`
      use `?? null` (established convention). The contract suite is where this is asserted, so decide it HERE
      and align both providers so `null` means uncomputable (fetch failure) and `''` means successfully-empty.

## Phase 4: baseline + CP-A3a assembly
- [x] 4.1 `npm test` green over the full accumulated tree · `brain:repo:check` · `brain:nav`.
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
- **Follow-up (fresh-review MINOR, PR-3):** align `gitlab.mjs#issueView`'s `body` to the same null-vs-`''`
  rule `prView` now has (`null` = uncomputable, `''` = successfully-empty) when the shared contract suite is
  next extended to cover `issueView` — `issueView` is out of the Phase-3 contract-suite scope
  (`labelEvents`/`prView`/`mrCreate` only), so this was deliberately NOT changed here. Verified ZERO current
  regression: the only real caller, `selectIssueLinkBody` in `brain/scripts/lib/audit-helpers.mjs:52-54`,
  treats `null` and `''` identically today. Tracked so the asymmetry isn't forgotten, not urgent.

## Out of scope
- Label WRITE verbs (`labelAdd`/`labelRemove`) + `protectBranch` rework (PLAN §A3 background; not needed by
  the gates — see PLAN-DEVIATION) · migrating GitHub `labelEvents`/`issueView` off `gh` (Actions ships it —
  Decision 2) · the local-interactive `glab` verbs (`issueList`/`mrList`/`commitStatus`/…) · CP-A3b live
  smoke (deferred to the SCIT phase).
