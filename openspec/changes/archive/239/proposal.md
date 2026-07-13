# Proposal — GitLab Provider Verbs + Provider-Agnostic labelEvents (slice A3)

> **Status:** planned · **Issue:** #239 (awaiting `status:approved`)
> **Depends on:** #231 A2 (GitLab governance pipeline + `ci-context` seam, merged into `feature/v2.0.0`).
> The GitLab CONTEXT reader (`loadGitlabContext`), the shared GitLab transport (`gitlab-api.mjs`), the
> sanctioned env reader (`ci-context.mjs#gitlabApiConfig`, `:115-122`), and the runtime-provider dispatch
> (`getVcs({ provider: ctx.provider })`, finding #14) all ALREADY EXIST from A1/A2.
> **Contract:** [spec.md](spec.md) · [design.md](design.md) · [tasks.md](tasks.md).

## Context

A2 shipped the GitLab governance pipeline but drew its boundary deliberately SHORT of provider verbs. Two
seams were left standing as documented debt:

1. **The A2 `m3` finding (recorded, not fixed).** `actor-check.mjs`'s `defaultFetchLabeledEvents`
   (`actor-check.mjs:161-175`) spawns `gh api --paginate repos/{repo}/issues/{number}/events`
   **regardless of provider**. `gatherActorCheckInputs` (`:230-250`) builds this GitHub-only wrapper
   unconditionally. On a GitLab runner there is no `gh` binary → the call throws ENOENT → `runActorCheck`
   (`:269-296`) catches it → the L5 actor-check degrades to a permanent `warn`. That degrade is SAFE (the
   job is DETECTION-only, `allow_failure: true` on both platforms — never a false block, never a
   false-pass), but it is not DETECTION: on GitLab the gate can never actually find a self-approval.

2. **The A2 stubs.** `gitlab.mjs`'s `prView` (`:79-82`) and `mrCreate` (`:221-224`) return graceful empty
   results; `issueView` (`:62-72`) was migrated to the direct GitLab API v4 in A2 (finding #12) over the
   shared `gitlabApiFetch` transport, but the other two MR verbs stayed stubs.

A3 closes both: it introduces a provider-agnostic `labelEvents` CONTRACT verb (dispatched on runtime
`ctx.provider`), extracts GitHub's inline events fetch onto that same seam (behavior-preserving), un-stubs
GitLab's `prView`/`mrCreate` over `gitlabApiFetch`, and adds the missing test infrastructure: one shared
parameterized contract suite over BOTH providers, fed by fixtures RECORDED from the real APIs by a
committed recording script. No live network in `npm test`.

## What this slice ships (CODE + fixtures + artifacts)

1. **D1 — `labelEvents` CONTRACT verb + `m3` close.** Add `labelEvents` to `cli.mjs` `VERBS`
   (`cli.mjs:19-23`) and `vcs-contract.md` (`:22-34`). BOTH providers implement it, returning a NORMALIZED
   shape (`[{ actor: { login }, action: 'add'|'remove', label, at }]` or `null` = uncomputable):
   - **GitHub** = the Events API `issues/N/events` (filter `event === 'labeled'|'unlabeled'` → `action`),
     STAYS on the `gh` CLI (Decision 2) — GitHub's inline fetch in `actor-check.mjs:161-175` is EXTRACTED
     into `github.mjs#labelEvents` behavior-preserving (re-running `actor-check.test.mjs` proves it),
     preserving the load-bearing `--paginate`.
   - **GitLab** = `GET /projects/:id/issues/:iid/resource_label_events` over `gitlabApiFetch`, normalizing
     `{ user: { username }, action, label: { name }, created_at }` → the shared shape.
   `actor-check.mjs` deletes `defaultFetchLabeledEvents` and calls the verb via `getVcs({ provider })`.
   The pure `evaluateActor` (`:65-109`) is UNCHANGED; `filterLabeledEvents` (`:157-159`) becomes a shared
   post-filter over the normalized `action` field (ONE filter, two providers).

2. **D2 — GitLab `prView`/`mrCreate` un-stubbed over `gitlabApiFetch`.** Replace the two stubs with real
   direct-API implementations threading config via the sanctioned resolver, exactly like the A2 `issueView`
   → `gitlabApiConfig()` → params precedent (`run-check.mjs:167-177`). Both return the contract's
   normalized shapes.

3. **D3 — Contract test suite.** ONE shared parameterized spec asserting the SAME contract over BOTH
   providers (parity = same assertions). Injected `fetchImpl`/exec reads fixtures — no live network.

4. **D4 — Recorded-from-real fixture provenance.** A COMMITTED recording script hits the real APIs ONCE
   (GitLab: the live mirror; GitHub: this repo) and writes raw JSON to a fixtures dir, each file stamped
   with `endpoint + date`. Non-recordable/synthetic cases are marked `DERIVED`. Recorded-vs-derived is
   ALWAYS visible (lesson #12).

## Three refinements folded into the deliverables (issue #239)

- **R1 — verb over the CONTRACT abstraction, not the ISSUE endpoint.** The verb is `labelEvents` (a
  contract concept), NOT `resourceLabelEvents` (GitLab's endpoint name leaking into the contract). GitHub
  is REFACTORED onto the SAME seam — not left inline — and carries its own parity row in the suite.
- **R2 — recorded-from-real, not hand-written.** Fixtures come from a committed recording script against
  the real APIs, each stamped `endpoint + date`; only genuinely non-recordable cases are `DERIVED`
  (synthetic). Provenance is never ambiguous.
- **R3 — DETECTION-class honesty.** On GitLab the actor-check now EVALUATES (computes the correct verdict:
  self-approval → the SAME `fail` as GitHub). The gate CLASS stays DETECTION / `allow_failure` — it
  REPORTS, it never BLOCKS. No wording in any artifact may read "blocks".

## PLAN-DEVIATION (recorded)

`PLAN-adapters-v3.md §A3` (`:145-154`, background only — "not a source of truth") lists `labelAdd/Remove`
and `protectBranch` inside A3. Those are OUT of #239's scope: `branchProtect` is ALREADY implemented on
both providers (`gitlab.mjs:127-179`, `github.mjs:45-78`), and label WRITE verbs (`labelAdd/Remove`) are
not needed by any governance gate — the gates READ label history (`labelEvents`), they do not mutate
labels. #239's four deliverables (the `labelEvents` READ verb, `prView`/`mrCreate` un-stub, the contract
suite, the fixture-recording infra) are authoritative; the PLAN's write-verb list is deferred/unneeded.

## CP-A3 is SPLIT (mirrors the A2 precedent)

- **CP-A3a (acceptance for THIS slice):** all four deliverables, ENTIRELY fixture-tested — the contract
  suite green over both providers using recorded fixtures, no live network. Hard stop, PR-as-review.
- **CP-A3b (DEFERRED to the SCIT phase):** live smoke against the real GitLab mirror (a real MR whose
  `labelEvents`/`prView`/`mrCreate` round-trip against the running server) is deferred until the SCIT
  phase restores and exercises live access — the same code-vs-execution precedent as CP-A2b.

## Out of scope

- Label WRITE verbs (`labelAdd`/`labelRemove`) and any `protectBranch` rework — not needed by the gates;
  PLAN §A3 background only (see PLAN-DEVIATION).
- Migrating GitHub's `labelEvents`/`issueView` off the `gh` CLI — GitHub Actions ships `gh`; the CLI-free
  doctrine targets CLIs that BREAK in their CI, which `gh`-in-Actions does not (Decision 2).
- The local-interactive GitLab verbs (`issueList`/`mrList`/`commitStatus`/…) that stay on `glab` — they
  are not CI-consumed (out of scope, unchanged).
- CP-A3b live smoke (deferred to the SCIT phase).

## Acceptance criteria (CP-A3a — hard stop, PR-as-review, Part of #239)

- [ ] D1: `labelEvents` is in `cli.mjs` `VERBS` and `vcs-contract.md`; both providers implement it
      returning the normalized shape (or `null`); GitHub's inline fetch is extracted behavior-preserving
      (`actor-check.test.mjs` still green with no logic change); `actor-check.mjs` calls the verb via
      `getVcs({ provider })`, `defaultFetchLabeledEvents` deleted, `evaluateActor` UNCHANGED,
      `filterLabeledEvents` a shared post-filter over normalized `action`.
- [ ] D2: `gitlab.mjs` `prView`/`mrCreate` are real direct-API implementations over `gitlabApiFetch`,
      config threaded via `gitlabApiConfig()` → params (never a direct pipeline-env read in the GATE_FILE);
      both return the contract's normalized shapes.
- [ ] D3: one shared parameterized contract suite asserts the same contract over BOTH providers; parity =
      identical assertions; injected transport, no live network.
- [ ] D4: a committed recording script writes real-API JSON to a fixtures dir stamped `endpoint + date`;
      non-recordable cases marked `DERIVED`; recorded-vs-derived always visible.
- [ ] R3: on GitLab the actor-check EVALUATES (self-approval → `fail`, same as GitHub); the job stays
      DETECTION / `allow_failure` — reports, never blocks. No artifact wording reads "blocks".
- [ ] Guardrails: CLI-free for CI-BREAKING verbs (GitLab direct-API); `gh`-on-GitHub-Actions acceptable;
      dispatch on `ctx.provider`; no direct pipeline-env read in GATE_FILES; en + es i18n for every changed
      CLI string; docs English (ADR-0009). The `vcs-contract.md` edit is a `brain/core/` L6 boundary
      (expected PASS+warn — the FIFTH such slice).
- [ ] `npm test`, `brain:repo:check`, `brain:nav` green. STOP at CP-A3a (fixture-tested; CP-A3b deferred to
      the SCIT phase).
