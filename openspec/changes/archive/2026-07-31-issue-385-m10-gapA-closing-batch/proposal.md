---
status: archived
issue: 385
epic: 335
artifact_store: hybrid
topic_key: sdd/issue-385-m10-phase2-rank6-batch/proposal
---

# Proposal: whoami / commitStatus / repoCloneUrl / patSetupUrl / projectResolve Contract-Parity Coverage (M10 Phase 2, final Gap-A batch)

Issue #385. Epic #335. Change folder: `openspec/changes/issue-385-m10-phase2-rank6-batch/`.

## Intent

Five VCS port verbs carry **zero** contract-parity coverage per the #336 audit: `whoami`,
`commitStatus`, `repoCloneUrl`, `patSetupUrl`, `projectResolve`. They are the last entries on the
Gap-A uncovered list after `branchProtect`, `prReviews` (#317), `mrList` (#355), `issueList`
(#362), and `authLogin`/`authCheck` (#364/#365, shipped in PR #366). Closing them retires Gap A.

Batching is justified because three of the five are pure synchronous derivations with **no
transport seam at all** — individually they are too small to warrant their own rank.

## Scope

Test-only, additive, **zero production files touched**.

### Transport verbs (fixture-driven)

`whoami` and `commitStatus` both call `runJson` on both providers — the same spawn seam
`mrList`/`issueList` use. They reuse the existing `jsonSpawnCallArgs` glue and register in
`PROVIDERS` as the *same shared function object* on both sides. No new glue.

- `whoami` — locks `{ username }`, proving the field-name divergence (GH `.login`, GL `.username`)
  is absorbed by the adapter. Scenarios: happy, failure.
- `commitStatus` — locks the canonical enum and the `null`-on-uncomputable path. Scenarios: happy,
  empty (no status ⇒ `null`), failure (rejects). Plus fixture-free divergence tests for the
  GitHub-only `status === 'completed' ? conclusion : status` two-field read and the
  first-check-wins selection asymmetry.

Roughly 10 small fixtures. Every one declares `_provenance.recorded` xor `derived` + `endpoint` +
`date`. The GitHub `whoami` happy fixture is a recording candidate (`gh api /user` is
non-mutating); all others derived.

### Pure derivations (no fixtures — deliberate deviation)

`projectResolve`, `repoCloneUrl`, `patSetupUrl` invoke no `run`/`runJson`/`fetchImpl`. Forcing the
fixture template onto them would fabricate a transport seam that does not exist. They get direct
input→output assertions inside the provider loop, taking no `...Args(fixture)` spread.

- `projectResolve` — identity passthrough on both providers; one assertion each.
- `repoCloneUrl` — credential-position guard mirroring the `authLogin` stdin precedent
  (`vcs.contract.test.mjs:738-750`), applied to string construction: the token appears exactly
  where expected, the provider-specific user literal (`x-access-token:` vs `oauth2:`) stays hidden
  from the caller, and the host-default divergence is locked.
- `patSetupUrl` — locks each provider's path/param shape and the GitHub `host`-parameter divergence.

`vcs-contract.md` rows for the five verbs amended with the divergences this suite locks.

## Out of Scope

- `authLogin`/`authCheck` — already shipped (PR #366, on `main`). Do not re-cover.
- Any production change to the five verbs. Two latent defects surface below; this slice **locks
  current behavior** and files them, it does not fix them.
- Recording live GitLab fixtures (no reachable mirror — same standing deferral as prior ranks).

## Capabilities

### New Capabilities

- `vcs-identity-derivation-contract`: normalized identity (`whoami`), commit-status enum +
  `null`-on-uncomputable (`commitStatus`), and deterministic URL/slug derivations
  (`repoCloneUrl`, `patSetupUrl`, `projectResolve`) across both providers.

### Modified Capabilities

- None.

## Approach

Extend the existing parameterized suite rather than adding a file: register the two transport verbs
in `PROVIDERS` against the existing JSON-spawn glue, and add the three pure verbs as fixture-free
assertions in the same `for (const providerName ...)` loop so parity stays structurally enforced.
Design phase owns the exact scenario table and fixture count.

## Verified Before Scoping

Read directly rather than assumed; these settle the questions raised at intake.

| Question | Finding |
|---|---|
| Does GitLab `commitStatus` crash on an empty array? | **No.** `normalize.mjs:35` opens with `if (raw == null) return null`. `arr[0]?.status` yields `undefined` ⇒ `null`. The missing local guard is safe by delegation. |
| Is `commitStatus`'s `null` path reachable only via empty results? | **Yes** — and it is *distinct* from failure. `exec.mjs:31-32`: `runJson` **throws** on non-zero exit and on bad JSON, so both transport verbs **reject**, like `mrList`/`issueList` and opposite `authCheck`. `null` and `rejects` are therefore separate scenarios, not one. |
| Any other `null` producer? | **Yes, undocumented.** `GITHUB_STATUS_MAP` maps `neutral`/`skipped` ⇒ `null`, so a *completed* GitHub check collapses into the same `null` as "no checks ran". GitLab collapses unknown values identically. Worth locking explicitly. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `repoCloneUrl` latent defect: GitLab has no host default, so a falsy `host` yields `https://oauth2:tok@undefined/x/y.git`; GitHub falls back to `github.com`. | Med | Lock current behavior, file a follow-up. Fixing is a production change, out of scope. |
| `patSetupUrl` latent defect: GitHub ignores `host` entirely (hardcodes `github.com`), breaking Enterprise Server. Neither provider URL-encodes `name`/`scopes`. | Med | Same — assert-and-file, do not fix here. |
| Test asserts a token literal, tripping secret scanners. | Low | Use an obviously synthetic placeholder; assert position/format, never a realistic token. |
| Fixture count pushes the diff past the 400-line review budget. | Med | See Delivery below. |

## Delivery

**Recommend single PR.** Estimate: ~250-280 lines in `vcs.contract.test.mjs`, ~10 fixtures at
~12 lines, ~10 lines of contract doc ≈ **380-400 changed lines** — at the budget, not comfortably
under it, so this is stated rather than waved through.

Contingency if `sdd-tasks` forecasts an overrun: split at the natural seam already present in
Scope — **PR1** the two transport verbs (`whoami`, `commitStatus`), **PR2** the three pure
derivations. Each half is independently green, reviewable, and revertable. Prefer this split over
a `size:exception`.

## Rollback

Single revert of the change commit. No production code path is touched, so revert restores current
behavior exactly.

## Success Criteria

- [ ] All five verbs green on both providers, every scenario.
- [ ] `whoami` returns exactly `{ username }`; no `login`/provider field leaks through.
- [ ] `commitStatus` returns only the canonical enum or `null`; `null` (empty) and `rejects`
      (transport failure) proven as **distinct** outcomes on both providers.
- [ ] GitHub's `completed ⇒ conclusion` two-field read and `neutral`/`skipped ⇒ null` collapse locked.
- [ ] `projectResolve` proven identity on both providers.
- [ ] `repoCloneUrl` proven to place the credential correctly and hide the user literal from the caller.
- [ ] `patSetupUrl` host-handling divergence locked per provider.
- [ ] Every new fixture passes `assertProvenance`.
- [ ] Zero production files modified; full suite green, zero regressions.
- [ ] Gap A's uncovered-verb list is empty; epic #335 Phase 2 closes.
