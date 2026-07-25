# Checkpoint Report — CP-A3a (Slice A3, issue #239)

> **Verdict tranche:** issued on the accumulated tree of the A3 chain (PR-1 #240 + PR-2 #241 + PR-3).
> **Scope of this checkpoint:** CP-A3a is **fixture-tested**. CP-A3b (live round-trip on the real
> self-hosted GitLab mirror) is **DEFERRED to the SCIT phase** — blocked on the human exercising the
> live mirror, same posture as CP-A2b.
> **Hand this report to the external reviewer.** Work pauses for the verdict (approve / revise / stop).

## What A3 delivered (across the 3-PR chain into `feature/v2.0.0`)

GitLab governance parity by a **second real inhabitant** of the VCS provider port — the credibility gap
PLAN §0.2 named. All new capabilities go through the `getVcs()` contract; no gate branches on which
provider/harness/actor produced the evidence (ADR-0015 Epic Invariant held).

| PR | Tranche | Delivered |
|----|---------|-----------|
| **#240** | Phase 1 | `labelEvents` verb (both providers); **closed the m3 class** — 4 CI-reachable fetches that ignored runtime provider (`labelEvents`, `actor-check` `fetchIssue`, `brain-writes-reviewed` `fetchReviews`→new `prReviews`, + finding #14 already correct) migrated to `getVcs({provider})`; generalized anti-spawn regression guard. **R3 genuinely met**: GitLab actor-check EVALUATES (self-approval → `fail`), not a permanent `warn`. |
| **#241** | Phase 2 | GitLab `prView`/`mrCreate` un-stubbed over `gitlabApiFetch` (additive `method`/`body` extension); shape parity with `github.mjs`. |
| **PR-3** | Phases 3–4 | Shared **parameterized contract suite** over `['github','gitlab']`; recorded/derived fixtures; verb-source drift-guard (all 3 sources); body-parity alignment. **This report.** |

## CP-A3a evidence (fixture-tested)

- **Cross-provider parity is REAL, not cosmetic.** `brain/scripts/vcs/providers/vcs.contract.test.mjs`
  runs ONE set of assertion bodies over both providers (single `for` loop; the only per-provider branch
  is on input-fixture field names — `body` vs `description` — never on the assertion). Both providers'
  REAL normalization code is exercised through the existing test seams (`setSpawn` for GitHub, `fetchImpl`
  for GitLab). Independently confirmed by a fresh-context adversarial review.
- **Fixtures — provenance honest and enforced.** 12 fixtures; **2 recorded** from the real GitHub API
  (`github-labelEvents-happy` = issue #239 events, `github-prView-happy` = PR #238), **10 derived**
  (all GitLab — no live mirror reachable here — plus all failure/mutating-write cases). Every fixture
  carries a `_provenance` stamp; the suite fails if any stamp is missing. Derived GitLab fixtures
  spot-checked against real GitLab API v4 field names (`iid`, `description`, `author.username`, `web_url`,
  `resource_label_events`).
- **Verb-source drift closed (all 3 sources).** `verb-contract-drift-guard.test.mjs` reconciles the
  Required-verbs table ↔ `cli.mjs` VERBS ↔ **the providers' actual function exports** (the third source,
  added after review). Proven a real detector: replaying the pre-reconciliation `VERBS` against the real
  exports flags exactly `['branchProtect','capabilities','mrCreate']`.
- **Suite + budget.** `npm test` **1196/1196** · `brain:repo:check` · `brain:nav` green. Per-PR non-test
  counted diff, all under the 400 forcing-function: **PR-1 395 · PR-2 116 · PR-3 325**. No `size:exception`
  used anywhere in this slice; the >400 forecast was corrected by the honest 3-way split, not an exception.
- **brain/core touches:** `vcs-contract.md` (verb rows) — L6 `brain-writes-reviewed` gate, expected
  PASS+warn, the established path (7th slice to touch a `brain/core/` file).

## Review trail (3 fresh-context adversarial passes, all cleared)

1. PR-1 first pass — found the **R3 BLOCKER** (`defaultFetchIssue` still on `gh`): the m3 gap was BOTH
   gather fetches, not one. Ruled: fix + audit the whole class → 4th site (`fetchReviews`) found and fixed.
2. PR-1 second pass + PR-2 pass — clean on correctness.
3. PR-3 CP-A3a pass — parity verified REAL, provenance honest, budget exact; found ONE MAJOR (drift-guard
   only reconciled 2 of 3 sources) → fixed (third check over real provider exports).

## PLAN-DEVIATIONS (all recorded, none silent)

1. **GitLab fixtures all `derived`** — no live mirror reachable in this environment; honestly stamped,
   spot-checked against API v4 docs. Folds into CP-A3b/SCIT for live validation.
2. **`mrCreate` happy-paths not recorded** (both providers) — recording a mutating write would open a real
   PR/MR as a fixture-maintenance side effect. Correct posture on mutating verbs; derived instead.
3. **`issueView` body left unaligned** — out of the Phase-3 suite scope (suite = `labelEvents`/`prView`/
   `mrCreate`). Zero current regression (verified via `selectIssueLinkBody`, which treats `null`/`''`
   identically). Tracked as an open question below.
4. **`capabilities` in VERBS but not the Required-verbs table** — a probe verb, not a base contract every
   provider implements identically; an explicit documented exception in the drift-guard.

## Open questions / deferred

- **CP-A3b (live smoke)** — round-trip on the real self-hosted GitLab mirror: DEFERRED to the SCIT phase,
  blocked on the human restoring mirror access (endpoint, CE version, corporate proxy). Same posture as CP-A2b.
- **`issueView` body-parity** — align to `null`=uncomputable / `''`=successfully-empty when the contract
  suite is next extended to `issueView`; no regression today.

## Proposed next slice

**A4 — substrate ladder awareness for GitLab** (PLAN §2 A4): self-hosted ⇒ rung 1 available via protected
branches AND `pre-receive`; `brain:governance-status` reports the GitLab rungs. Depends on nothing in this
tranche beyond the merged provider verbs.
