# Tasks: Issue #606 — the rollup reports its cause

## Constraint that bounds every task below

**The verdict does not move.** `evaluateTranche` returns `REVISE` on uncomputable
evidence today and MUST still return `REVISE` on uncomputable evidence after every task
in this file. This buys a legible refusal, not a different one. Any task whose result
makes a previously-refusing case pass (or previously-passing case now unexpectedly fail
for a different reason) is wrong — stop and re-read design.md §5.2 / M10 before
continuing.

## Review Workload Forecast

| Field | Value |
|---|---|
| Production surface (counts toward gate; `**/*.test.mjs` and `openspec/**` are on `governance.ignoreList`) | new `brain/scripts/vcs/lib/uncomputable-cause.mjs` (~150-180 lines) + `github.mjs` `prStatusRollup` (~15-25 changed) + `gitlab.mjs` `prStatusRollup` (~25-40 changed) + `tranche.mjs` guard/renderer (~25-35 changed) + `vcs-contract.md:35` row (~5-10 changed) |
| Estimated production-line total | ~250-300 lines |
| 400-line budget risk | Low on production surface alone. The real review load is the test surface (corpus tables, three-layer M3/M3b tests, mutation-plan-driven tests, contract test revision for both providers) — several hundred additional lines a human still reads even though governance's gate does not count them. |
| Chained PRs recommended | **No.** Design ruling 5 and §4.1 require the shared module, both providers, and the renderer to land atomically: `prStatusRollup` is already a shared contract verb, so a one-provider PR would not trip `verb-contract-drift-guard.test.mjs` (it only checks the export name exists on both sides, not that they agree) and would leave the two providers silently answering the same verb differently between merges — exactly the M6 failure mode the design names. Splitting the module from its only two call sites also produces a dead-code PR with no test that exercises it end-to-end. |
| Suggested split | Single PR. If reviewer load is a real concern, the only defensible internal seam is "module + tests" reviewed first as a sub-thread before "provider adoption + tranche render + contract test revision" — but both still merge in one PR/commit sequence, not two PRs. |
| Delivery strategy | Per orchestrator's cached `delivery_strategy` (defer to session cache); this forecast supports `exception-ok`/single-PR without a split, since production lines are well under 400 and the design forbids splitting the coupled surface. |
| Decision needed before apply | No — the design already resolved the "split vs atomic" question (§4.1, ruling 5). Apply should not re-litigate it. |

## Spec requirement map

Each task below cites the spec.md requirement heading it satisfies, verbatim, so apply
and verify can trace back without re-deriving intent.

## Phase 1 — the pure module (no provider or evaluator touches it yet)

- [x] 1.1 Create `brain/scripts/vcs/lib/uncomputable-cause.mjs`. Zero imports. Exports
      exactly: frozen `UNCOMPUTABLE_REASONS` (7 values: `rate-limited`,
      `unauthenticated`, `not-found`, `network`, `binary-missing`,
      `malformed-response`, `unclassified` — design §1.1-1.2), `uncomputable({detail,
      reason = null})` factory (design §1.3 — `detail` computed first and
      independently; `reason` derived from `detail` via the classifier only when not
      explicitly passed; `NO_TEXT_REPORTED` fallback constant for empty/undefined/null
      detail; `Object.freeze` on the returned object), `isUncomputable(value)` predicate
      (design §1.4 — `isUncomputable(null) === false`, load-bearing), and
      `classifyUncomputableCause(text)` (design §2).
      — Spec: "`prStatusRollup` never returns bare `null`" (shape); "the provider's
      verbatim words always reach `detail`"; "the cause classifier is conservative,
      ordered, and defaults to `unclassified`".
      — Sequential: everything downstream imports this file.

- [x] 1.2 Implement `classifyUncomputableCause` with the exact rule order from design
      §2.2: (1) `BINARY_MISSING_RE` first — "gh: command not found" also contains "not
      found", so binary-missing must win over not-found; (2) `RATE_LIMITED_RE` (or
      `httpStatusOf(text) === 429`) BEFORE unauthenticated — GitHub answers a rate
      limit with HTTP 403, and an auth rule run first would misdiagnose every GitHub
      rate limit as an auth problem (the three-token-rotation incident
      `identity.mjs:52-70` already records); (3) `UNAUTHENTICATED_RE` (or `code ===
      401 || code === 403`); (4) `NOT_FOUND_RE` (or `code === 404`); (5) `NETWORK_RE`
      (or `code !== null && code >= 500`); default `UNCLASSIFIED`.
      — Spec: "the cause classifier is conservative, ordered, and defaults to
      `unclassified`", scenario "recognized causes are matched in a defined,
      documented order".
      — Sequential, after 1.1.

- [x] 1.3 Gate every numeric rule behind `httpStatusOf(text)`
      (`/(?:\bHTTP\b|\bstatus\b|API failed:)\s*\(?(\d{3})\)?/i`, design §2.1) — never a
      bare `\b\d{3}\b` match. **This is the verified bare-`429` trap**: `runJson`
      builds messages as `` `${cmd} ${args.join(' ')} failed (status ${r.status}):
      ${r.stderr}` ``, so `gh pr view 429 --json statusCheckRollup failed (status 1):
      <unrelated stderr>` contains the literal substring `429` from the PR number, not
      from any status code. An ungated `/\b429\b/` rule classifies that PR-429 failure
      as `rate-limited`, which is wrong on an input the repo's own fixtures already
      produce.
      — Spec: same as 1.2, plus is the structural fix M9's test proves.
      — Sequential, after 1.2. Do not mark this task done without 1.5's M9 negative
      row passing.

- [x] 1.4 Write `brain/scripts/vcs/lib/uncomputable-cause.test.mjs`. Imports nothing but
      the module under test — no `gh`, no `setSpawn`, no fixtures (design §2, opening
      paragraph).
      — Sequential, after 1.1-1.3.

- [x] 1.5 **Corpus provenance is an acceptance condition, not a footnote.** Every row in
      the pinned corpus table MUST be sourced from real `gh`/`glab` output actually
      observed, or from an existing pinned message already in this repo. A row nobody
      has observed is a claim this design does not license (design §10, risk 3). Known
      real sources to pull from directly, verified in this session:
      - `brain/scripts/review/identity.test.mjs:296-304` supplies three real pinned
        messages: `'gh: Maximum number of login attempts exceeded. Please try again
        later. (HTTP 403)'`, `'gh: API rate limit exceeded (HTTP 403)'`, `'GitLab API
        failed: 429 (/user) rate limit'`.
      - `brain/scripts/vcs/gitlab-api.mjs:65` (confirmed path — **not**
        `vcs/lib/gitlab-api.mjs`) is the sole source of every `GitLab API failed: <status>
        (<path>)` shape; any GitLab corpus row must match this exact template.
      - Any `gh`/`glab` spelling not already pinned somewhere in-repo must be captured
        by actually running the failing command locally (rate-limited, unauthenticated,
        not-found, network-down, binary-missing) and pasting the literal stderr — not
        invented from memory of what `gh` "usually says."
      Include the required negative row (M9): a message that legitimately contains the
      digits `429` as a PR NUMBER, not a status code, e.g. `gh pr view 429 --json
      statusCheckRollup failed (status 1): fixture: simulated failure` → must classify
      `unclassified`, never `rate-limited`.
      — Spec: "the recognized-cause corpus is pinned by test"; "an unmatched message
      never falls back to any label but `unclassified`".
      — Sequential, after 1.4. **Do not proceed to Phase 2 with an unverified corpus
      row.**

- [x] 1.6 Ordering test (design §6.2, `identity.test.mjs:316-321` pattern): a message
      carrying both rate-limit language and an HTTP 401/403 marker must classify
      `rate-limited`, not `unauthenticated`. A message carrying both binary-missing
      text ("command not found") and "not found" language must classify
      `binary-missing`, not `not-found`.
      — Spec: "recognized causes are matched in a defined, documented order".
      — Can run in parallel with 1.5 (independent test cases in the same file).

- [x] 1.7 Shape invariant tests (design §6.4): `Object.isFrozen`; exactly three keys;
      empty/`undefined`/`null` detail → `NO_TEXT_REPORTED`, never `''`;
      `isUncomputable(null) === false`; `isUncomputable({name, status, conclusion:
      null}) === false` (the GitLab success-entry-shape non-collision from design
      §1.5); classifier codomain ⊆ `UNCOMPUTABLE_REASONS`; no enum value matches
      `/ok|success|clean|none|empty/i` over a 200-string fuzz set (design §2.4).
      — Spec: "`prStatusRollup` never returns bare `null`"; "the cause classifier is
      conservative...".
      — Can run in parallel with 1.5/1.6.

- [x] 1.8 Source guard test (design §6.6): scan both provider source files and assert
      neither contains the literal string `uncomputable: true` — the shape has exactly
      one constructor, `uncomputable()` in this module. This is what enforces "providers
      never write a reason literal and never construct the object" from the design's
      answer to Q1, not a convention.
      — Spec: implicit in "both providers implement the identical contract" (drift
      prevention).
      — Can run in parallel with 1.5-1.7, but functionally depends on nothing yet
      existing in the providers (it asserts absence).

## Phase 2 — both providers adopt the shape (one PR-internal unit, not splittable)

- [x] 2.1 `brain/scripts/vcs/providers/github.mjs:470-484` — bind the `catch` (currently
      `catch { return null; }` at line 474) to `catch (err) { return uncomputable({
      detail: err.message }); }`. Replace `if (!Array.isArray(rollup)) return null;`
      (line 478) with the `MALFORMED_RESPONSE` explicit-reason call from design §4.3.
      Update the JSDoc at lines 463-469 (currently claims "normalizes to `null`
      (uncomputable)") to describe the new return shape.
      — Spec: "`prStatusRollup` never returns bare `null`", scenarios "fetch throws"
      and "fetch succeeds but the rollup field is not an array".
      — Depends on Phase 1. Must land together with 2.2 (see forecast: a one-provider
      adoption does not trip the drift guard, per design §4.1 point 1 — the M6
      mutation this repo's tests must catch).

- [x] 2.2 `brain/scripts/vcs/providers/gitlab.mjs:337-363` — three edits: bind the
      `catch` (line 360-361, currently `catch { return null; }`) the same way; replace
      `if (!sha) return null;` (line 350) with the `MALFORMED_RESPONSE` call naming the
      missing `sha`/`diff_refs.head_sha`; replace `if (!Array.isArray(statuses)) return
      null;` (line 358) with the `MALFORMED_RESPONSE` call naming the non-array
      statuses payload. Update the JSDoc at lines 328-336 the same way as 2.1.
      — Spec: same as 2.1, plus scenario "GitLab — MR head sha cannot be resolved".
      — Depends on Phase 1. Must land with 2.1 (same reasoning).

- [x] 2.3 Confirm both providers' success arms are untouched byte-for-byte (design §4.3,
      last line: "ruling 1's whole economy"). Diff review, not a new test: the `.map`
      call in `github.mjs` and `gitlab.mjs`'s `statuses.map` must show zero changes.
      — Depends on 2.1, 2.2.

## Phase 3 — provider contract test revision (both providers, table-driven)

- [x] 3.1 Revise `brain/scripts/vcs/providers/vcs.contract.test.mjs:1231-1234` — the
      ONE assertion ruling 1 revises. Currently `assert.equal(result, null, 'an
      uncomputable prStatusRollup fetch must return null, never []')`. Replace with the
      shape assertions from design §3.2(c): `Array.isArray(result) === false`,
      `result !== null`, `result.uncomputable === true`, `Object.isFrozen(result)`,
      `UNCOMPUTABLE_REASON_VALUES.includes(result.reason)`, `result.detail.length > 0`,
      and `result.detail.includes(FAILURE_TEXT[providerName])`. This test runs once per
      entry in `ROLLUP_PROVIDERS` — confirm it executes for BOTH `github` and `gitlab`,
      not just the one edited first.
      — Spec: "the shared contract test table covers both providers", scenario "the
      shared contract test table covers both providers"; also satisfies design §3.2(c)
      — this IS the "through both real providers" default-arm test for free (github's
      fixture message matches no rule → `unclassified`; gitlab's `{ok:false,
      status:500}` fixture → `network`). Do not assert a shared `reason` value across
      providers here — the two fixtures legitimately classify differently; assert shape
      and verbatim words only.
      — Depends on Phase 2 (both providers must already return the new shape).

- [x] 3.2 **M6 — the table-driven adoption test, its own explicit task.** Confirm (by
      temporarily reverting `gitlab.mjs`'s catch to `return null` and re-running 3.1's
      test, then reverting the revert) that the `ROLLUP_PROVIDERS` loop goes red for
      `gitlab` specifically while staying green for `github`, and vice versa (mirror
      mutation M6b on `github.mjs`). This proves the table-driven loop is a real
      detector of a one-provider adoption, not a GitHub test wearing a GitLab label —
      `verb-contract-drift-guard.test.mjs` CANNOT catch this on its own, because
      `prStatusRollup` is already a shared function export and the guard only checks
      the export name exists on both sides (design §4.1 point 1). Do this as a
      throwaway local verification during apply, not a permanent test — the permanent
      test is 3.1 itself; this task's output is confidence that 3.1 actually detects
      single-provider drift.
      — Spec: "both providers implement the identical contract" — "A one-provider fix
      is not acceptable... a divergence here would either trip that guard or — worse —
      pass it while leaving one provider silently behind the other."
      — Depends on 3.1.

## Phase 4 — `tranche.mjs` renders the cause without changing the verdict

- [x] 4.1 Add `import { isUncomputable } from '../../vcs/lib/uncomputable-cause.mjs';`
      to `brain/scripts/review/evaluators/tranche.mjs`. Import the predicate only,
      never the classifier (design §5.1 closing note — the evaluator stays
      provider-agnostic).
      — Depends on Phase 1.

- [x] 4.2 Add the `rollupUncomputableCondition(rollup)` helper above `evaluateTranche`
      (design §5.1): if `!isUncomputable(rollup)` return the literal string `'evidence
      uncomputable'` UNCHANGED (this is what keeps a bare `null` from one of the 13
      still-unmigrated readers producing the exact same string as today — no
      parenthetical invented for a cause that was never named); otherwise return
      `` `evidence uncomputable: required gate rollup (${rollup.reason}) — ${rollup.detail}` ``.
      `detail` is interpolated WHOLE and last — no truncation (design §5.5, D9).
      — Spec: "`evaluateTranche` names the cause without changing its verdict".
      — Sequential, after 4.1.

- [x] 4.3 Update `tranche.mjs:133-143`'s guard branch to call
      `rollupUncomputableCondition(requiredGates)` in place of the hardcoded
      `'evidence uncomputable'` literal at `conditions: [...]`. The guard condition
      itself — `if (!Array.isArray(requiredGates))` — is UNCHANGED. Do not touch it;
      switching to a truthiness check here is M5a, the mutation this phase's tests must
      catch, not a refactor to perform.
      — Spec: "`evaluateTranche` names the cause without changing its verdict",
      scenario "before/after — bare uncomputable string is replaced with a named
      cause".
      — Sequential, after 4.2.

- [x] 4.4 **M3b — the through-the-evaluator rot test, its own explicit task, not
      optional.** Add the test from design §3.2(b) to `tranche.test.mjs`: feed
      `evaluateTranche` a `requiredGates` object with `reason: 'unclassified'` and a
      real corpus message as `detail`, assert `conclusion === 'REVISE'` AND
      `conditions.some(c => c.includes(message))`. This is the ONLY test that catches
      the mutation that deletes `` — ${rollup.detail} `` from `tranche.mjs`'s condition
      template while leaving `(${rollup.reason})` intact: that mutation leaves the
      classifier perfect and the factory's `detail` field intact, and STILL robs the
      operator of the words, because the loss happens in the renderer, not the
      classifier or the factory. A design tested only at the factory (Phase 1's tests)
      survives M3b silently. Do not consider Phase 4 done until this test exists and
      you have manually confirmed (by temporarily applying the M3b mutation) that it
      goes red.
      — Spec: "the provider's verbatim words always reach `detail`", scenario "a rotted
      or unrecognized classifier still surfaces the words (the collapse case)".
      — Depends on 4.1-4.3.

- [x] 4.5 Add the explicit-no-throw test for M5a (design §7): `requiredGates` as a
      truthy non-array object must not fall through to `.map` and throw — assert
      `conclusion === 'REVISE'` and no exception, confirming the guard stays
      `Array.isArray`, never `!requiredGates`.
      — Spec: "`evaluateTranche` names the cause without changing its verdict",
      scenario "`requiredGates` is a plain array — unaffected" (its inverse).
      — Can run alongside 4.4.

- [x] 4.6 Confirm `tranche.test.mjs:53-58`'s existing assertion
      (`result.conditions.includes('evidence uncomputable')` for a bare `null` input)
      stays green WITHOUT being edited. This untouched assertion is the cheapest
      available evidence the verdict did not move (design §5.2, table row 3).
      — Sequential, after 4.3. If this assertion requires editing to pass, something in
      4.2/4.3 is wrong — stop and re-read design §5.2 before changing the test.

## Phase 5 — `brain-metrics.mjs` no-regression guarantee

- [x] 5.1 Add a test asserting `detectionConclusion(uncomputable({detail: 'x'}),
      'memory-gate') === null` in `brain/scripts/brain-metrics.test.mjs` (note: file
      lives at `brain/scripts/brain-metrics.mjs`, not under `review/` — confirmed in
      this session), identical to its answer for `rollup === null` before this change.
      `detectionConclusion` itself (`brain-metrics.mjs:178-191`) is NOT modified — this
      is a guarantee test, not a code change.
      — Spec: "`brain-metrics.mjs`'s `detectionConclusion` is a no-regression
      guarantee".
      — Depends on Phase 1 (needs `uncomputable()` to construct the test fixture).

## Phase 6 — the truthiness audit (a task, not an assumption)

- [x] 6.1 Grep every call site of `prStatusRollup` across the repo (`vcs/cli.mjs`,
      `review/evaluators/tranche.mjs`, `brain-metrics.mjs`, and any script under
      `brain/scripts/` that calls `vcs.prStatusRollup` or `getVcs().prStatusRollup`)
      for `if (!rollup)`, `rollup === null`, `!requiredGates`, or any other truthiness
      check on the return value. The proposal names exactly two known production
      consumers (`tranche.mjs:270`→`evaluateTranche:133`, `brain-metrics.mjs:487`→
      `detectionConclusion:179`) and asserts both already use `Array.isArray` — but
      this task is the grep that CONFIRMS it, not a restatement of the assumption. Any
      additional call site found (e.g. in a CLI dispatcher or a script not yet
      inventoried) gets its own line item here before this task is marked done.
      — Spec: implicit risk mitigation (design §10, risk 1: "A truthiness check
      elsewhere now sees a truthy object").
      — Can run any time after Phase 1 exists conceptually; does not block Phase 2-5,
      but MUST complete before Phase 8's verification sign-off.

## Phase 7 — doc and contract

- [x] 7.1 Update `brain/core/methodology/vcs-contract.md:35` (confirmed line number)
      — the `prStatusRollup` row. Signature becomes `Promise<Array<{ name, status,
      conclusion }> | { uncomputable: true, reason, detail }>`. Closing sentence
      changes from "`null` = uncomputable (fetch failed), never a fabricated `[]`" to
      state: the failure arm is a frozen `{uncomputable, reason, detail}` built by
      `vcs/lib/uncomputable-cause.mjs`; `reason` is one of the enum values and is
      advisory; `detail` carries the provider's own words on every path, matched or
      not; `[]` remains reserved for a successfully-fetched empty rollup; consumers
      guard with `Array.isArray`, never truthiness; this is the declared destination
      for the filed 13 (design §8, §10 risk 3 mitigation).
      — Spec: implicit in "both providers implement the identical contract" (contract
      doc must describe the actual contract).
      — Column 1 stays `` `prStatusRollup` `` — do not touch the backtick-quoted name,
      `requiredVerbsFromDoc`'s parser depends on it (design §4.1 closing note).

## Phase 8 — mutation verification pass (design §7, all 13 IDs)

- [x] 8.1 Run each mutation M1, M2, M3, M3b, M4, M5a, M5b, M6, M6b, M7, M8, M9, M10, M11
      from design.md §7 by hand (temporarily apply the source mutation, run the named
      test, confirm red, revert). Do not close this phase until every one of the 13
      rows is confirmed red by its named test. Pay special attention to:
      - M3 vs M3b: M3 is "detail dropped at the factory" (three layers must go red);
        M3b is "detail dropped at the renderer" (only 4.4's through-evaluator test
        catches it — confirmed in Phase 4).
      - M6 vs M6b: one-provider revert, each direction (confirmed in Phase 3).
      - M9: bare-digit false positive (confirmed in Phase 1).
      - M10: the constraint itself — `tranche.mjs`'s uncomputable arm returns
        `'APPROVE'` — must be caught by the UNTOUCHED `tranche.test.mjs:53-58`
        assertion plus 4.4 and the spec's "never APPROVE" scenarios. If M10 does not go
        red, stop everything — the constraint at the top of this file has been
        violated.
      — Depends on Phases 1-5 being complete.

## Phase 9 — the follow-up ticket for the 13 remaining sites (filed, never fixed here)

- [ ] 9.1 File a new GitHub issue listing every remaining cause-discarding site by
      file:line, exactly as measured in proposal.md: `github.mjs:204 :309 :402 :524
      :587 :630` and `gitlab.mjs:230 :307 :360 :393 :493 :554 :672 :1010`.
      `github.mjs:309` (`checkRuns`) MUST be named specifically and prioritized first
      in the issue body — it degrades to a fabricated `[]` on failure rather than an
      unnamed `null`, the anti-pattern in its purest form and a worse case than this
      issue's own starting point (proposal.md ruling 5; spec.md "the 13 remaining
      cause-discarding sites are filed, not fixed here").
      — The agent filing this issue MAY open it. **The agent MUST NOT apply
      `status:approved` or any equivalent approval label to it, this change, or any
      derived artifact.** Filing is not approving.
      — Depends on nothing structurally, but do this AFTER Phase 8 so the issue can
      reference the merged commit/PR that established the pattern the 13 sites should
      follow.

- [x] 9.2 Confirm (diff review) that none of the 13 filed sites' source is modified by
      this change — only `prStatusRollup` on both providers, the new
      `vcs/lib/uncomputable-cause.mjs`, and `tranche.mjs`'s rendering of the cause are
      touched. This is spec.md's explicit scenario "this change does not silently
      touch any of the 13 filed sites."
      — Depends on Phase 2, 4.

## Phase 10 — final verification

- [x] 10.1 Run the full test suite (`npm test` or repo equivalent). All new/extended
      suites green, no regressions in `tranche.test.mjs`, `vcs.contract.test.mjs`,
      `brain-metrics.test.mjs`, `verb-contract-drift-guard.test.mjs`.
- [x] 10.2 Confirm the four success-criteria checkboxes from proposal.md are each
      demonstrably true by a specific test: rate-limited rollup names its cause and
      quotes `gh`'s words (Phase 1 corpus + Phase 4.4); an unrecognized failure still
      quotes verbatim, labelled `unclassified` (1.5's M9-adjacent invented-message
      test + 4.4); no classifier outcome makes an uncomputable rollup read as clean —
      `evaluateTranche` still returns `REVISE` (8.1's M10 check); a genuinely
      check-less PR still yields `[]`, distinct from every failure (3.1's
      `Array.isArray(result) === false` assertion pair with the existing happy-path
      test at `vcs.contract.test.mjs:1220`); the 13 remaining sites are filed with
      line numbers, `checkRuns:309` first (Phase 9.1).
