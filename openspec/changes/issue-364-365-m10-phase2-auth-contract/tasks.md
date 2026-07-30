---
status: draft
issue: 364, 365
epic: 335
artifact_store: hybrid
topic_key: sdd/m10-phase2-auth-contract/tasks
---

# Tasks — `authLogin` / `authCheck` Contract-Parity Coverage (M10 Phase 2, Ranks 5–6, Issues #364/#365)

> **STRICT TDD MODE IS ACTIVE**: RED → GREEN pairs using `node:test` + `assert/strict`.
> **Corrected premise** (design.md, verified against `vcs-contract.md` rows 24–25 and both
> provider implementations): both verbs are `-> boolean`, never `-> object`, and never throw.
> Do not implement the task brief's originally-assumed `{ username, email, apiBase }` /
> `{ username }` shapes — that would require a production-code change, out of scope here.
> **Branch point**: `main` at `1b484a7` (`issueList`, rank-4, #363, latest merged rank).

## Phase 1 — Fixture Evidence (`fixtures/`)
- [x] **1.1** Record `github-authCheck-happy.json` from a real, non-mutating `gh auth status`
  invocation in this environment — capture the real exit status (0) and stdout/stderr verbatim,
  stamp `_provenance.recorded: true`. No `record-fixtures.mjs` case needed (a one-off manual
  capture is sufficient and honest for a two-state boolean fixture; document the exact command run
  in the fixture's `_provenance.note`).
- [x] **1.2** Hand-author `github-authCheck-failure.json` (`_provenance.derived` — forcing a real
  failure would require logging out of the live session used in 1.1, an unacceptable side effect),
  `gitlab-authCheck-{happy,failure}.json` (`_provenance.derived` — no live `glab` session
  reachable), each with a realistic `status`/`stdout`/`stderr` combination.
- [x] **1.3** Hand-author all four `{github,gitlab}-authLogin-{happy,failure}.json`
  (`_provenance.derived` on all four — `authLogin` is a MUTATING verb on both providers, same
  precedent as `github-mrCreate-happy.json` being derived rather than recorded).
- [x] **1.4 GATE** — Confirm all eight fixtures pass `assertProvenance` (exactly one of
  `recorded`/`derived`, plus `endpoint` and `date`) before wiring them into the suite.

## Phase 2 — Core Contract Tests (`vcs.contract.test.mjs`) — RED
- [x] **2.1 RED** — Add `rawStatusCallArgs(fixture)` glue: `setSpawn(() => ({ status:
  fixture.status, stdout: fixture.stdout ?? '', stderr: fixture.stderr ?? '' }))`, returning `{}`
  (no extra call-site params needed, matching `jsonSpawnCallArgs`'s shape).
- [x] **2.2 RED** — Add `authCheck` happy/failure tests inside the parity loop: `assert.equal(result,
  true)` / `assert.equal(result, false)` (exact boolean, not truthy/falsy), plus an
  `assert.doesNotReject` on the failure case documenting the never-throws divergence from
  `mrList`/`issueList`.
- [x] **2.3 RED** — Add `authLogin` happy/failure tests, same shape, called with `{ host:
  'github.com', token: 'test-token', ...rawStatusCallArgs(fixture) }`.
- [x] **2.4 RED** — Add the `authCheck` host-omission divergence test (no fixture): capture
  `_spawn`'s received `args` via an inline stub per provider, call with `host` omitted, assert
  GitHub's captured args exclude `'--hostname'` and GitLab's include it.
- [x] **2.5 RED** — Add the `authLogin` host-default divergence test (no fixture): same capture
  pattern, assert GitHub's captured args contain `'github.com'` and GitLab's contain the literal
  `undefined` value at the `--hostname` position.
- [x] **2.6 RED** — Add the `authLogin` token-via-stdin parity test (no fixture, both providers in
  one block): capture `_spawn`'s received `opts`, assert `opts.input === token` and assert the
  token string does not appear anywhere in the captured `args` array.

## Phase 3 — Transport Glue Registration (`vcs.contract.test.mjs`) — GREEN
- [x] **3.1 GREEN** — Register `authCheck: rawStatusCallArgs` and `authLogin: rawStatusCallArgs`
  under both `PROVIDERS.github` and `PROVIDERS.gitlab`, and add both to the loop's destructuring
  block alongside the existing entries.
- [x] **3.2 GATE** — The Phase 2 fixture-driven tests now pass (8 assertions: happy/failure × 2
  verbs × 2 providers); confirm no existing registration (`mrList`, `issueList`, `prView`,
  `labelEvents`, `prStatusRollup`, `issueView`) broke.

## Phase 4 — Verification & Documentation
- [x] **4.1** Amend `vcs-contract.md` rows 24–25 (`authCheck`/`authLogin`): document the
  host-argument-building divergence (GitHub conditionally omits/defaults `--hostname`, GitLab
  never does) and the stdin-token-delivery guarantee on both providers. Do NOT change the already
  correct `-> boolean` shape statement.
- [x] **4.2 GATE** — `npm test` on the full suite: 11 new tests green (8 fixture-driven + 3
  divergence/parity), zero regressions across the existing 2043 (current `main` HEAD, post-#363);
  confirm the diff lands within the ~140-line estimate and the 400-line review budget (no
  chained-PR split needed).
