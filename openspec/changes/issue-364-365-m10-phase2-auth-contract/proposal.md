---
status: draft
issue: 364, 365
epic: 335
artifact_store: hybrid
topic_key: sdd/m10-phase2-auth-contract/proposal
---

# Proposal: authLogin / authCheck Contract-Parity Coverage (M10 Phase 2, Ranks 5-6)

Issues #364 (`authLogin`, rank 5) and #365 (`authCheck`, rank 6). Epic #335. Change folder:
`openspec/changes/issue-364-365-m10-phase2-auth-contract/`.

## Intent

`authLogin`/`authCheck` are local/interactive-only verbs (no CI caller — the human-invoked
`tracker-board.mjs`, `day-start.mjs`, `project-status.mjs` are the only callers) but remain
uncovered per the #336 audit: zero contract-parity coverage and zero per-provider unit coverage
exist for either today. Ranks 5-6, the last two Gap-A verbs after `branchProtect` (rank 2),
`prReviews` (rank 2, sequenced separately), `mrList` (rank 3), and `issueList` (rank 4).

**Verified before scoping**: the originating task brief assumed object return shapes
(`authLogin -> { username, email, apiBase }`, `authCheck -> { username }`). Checked against
`vcs-contract.md` rows 24-25 and both provider implementations (`github.mjs:20-28`,
`gitlab.mjs:22-29`) — both verbs call the raw `run()` wrapper (never `runJson`) and return a plain
**boolean**, never throwing. This proposal targets the real, documented contract; see `design.md`
for the full verification trail.

## Scope

In scope — test-only, additive, zero production files touched:

- `authCheck`/`authLogin` contract blocks in `vcs.contract.test.mjs`, parameterized over both
  providers, registered in the existing `PROVIDERS` table via a new `rawStatusCallArgs` glue
  (neither verb produces a JSON body — `run()`, not `runJson()`).
- Two fixture scenarios per provider per verb (happy = `true`, failure = `false`) — a boolean has
  no third "empty" state, a deliberate deviation from the `happy/empty/failure` template every
  prior rank used (see design.md D2).
- Three standalone divergence/parity tests (no fixture): `authCheck` host-argument-omission
  divergence, `authLogin` host-default divergence, `authLogin` token-via-stdin credential-leak
  guard on both providers.
- Eight fixtures: `github-authCheck-{happy,failure}.json` (happy **recorded** from a real,
  non-mutating `gh auth status`), all six others **derived**.
- `vcs-contract.md` rows 24-25 amended with the host-argument divergence and stdin-delivery detail.

Estimate: roughly 140 lines in the test file plus eight small fixtures. Comfortably inside one
reviewable PR (233 counted lines).

Out of scope: any change to either verb's boolean return shape or never-throws behavior; recording
a live `authLogin` invocation (mutating, refused by design, same as `mrCreate`).

## Approach

See `design.md` for the full architecture decisions (D1-D4): new raw-status transport glue instead
of the JSON-based `jsonSpawnCallArgs`; two fixture scenarios instead of three; fixture provenance
split between `authCheck` (GitHub recorded) and `authLogin` (fully derived, mutating verb); and
argument-capture-based divergence tests for the real per-provider host-handling asymmetry.

## Success Criteria

- `authCheck`/`authLogin` contract blocks green on both providers, all scenarios.
- Boolean shape locked exactly (`assert.equal(result, true|false)`, never merely truthy/falsy).
- Both verbs proven to never reject/throw, the opposite divergence from `mrList`/`issueList`.
- Host-argument-building divergence locked per provider for both verbs.
- Token-via-stdin delivery proven on both providers, with an explicit argv-absence assertion.
- GitHub `authCheck` happy fixture carries `_provenance.recorded`; all fixtures pass
  `assertProvenance`.
- Zero production files modified; full suite passes with zero regressions.
- The #336 Gap A uncovered-verb list no longer contains `authCheck`/`authLogin`.

## Risks & Rollback

Test-only and additive, so the change carries no runtime risk.

Locking a corrected premise, not the brief's assumption. The brief's assumed object shapes are
provably wrong (verified against three independent sources in design.md); implementing them would
require production changes out of scope for this test-only slice, and would break `cli.mjs`'s
boolean-exit-code convention and every existing local caller. This proposal documents the
correction explicitly so a reviewer does not mistake the deviation for scope creep.

Rollback: single revert of the change commit. No production code path is touched, so revert
restores current behavior exactly.
