# VCS Contract Coverage Audit — M10 Phase 1 (issue #336)

**Measurement basis:** commit `dc9a85e40411a68df9ca448a4e4738d5d2b96264` (main,
merge of PR #343 "feat(ship): derive PR label from issue type (M10 Phase 0)"),
read on **2026-07-26**. This audit is a snapshot, not a maintained register
(design D2) — it goes stale the moment a Phase 2 slice lands a test. At this
SHA, `prReviews` is **not yet present** in `vcs.contract.test.mjs` despite a
same-day commit message elsewhere claiming otherwise on a different branch —
the exact reason the SHA pin is load-bearing rather than decorative.

## Coverage summary

| Category | Count | Verbs |
|---|---|---|
| ✅ Contract-parity suite (`vcs.contract.test.mjs`) | 10 | issueView, mrCreate, prView, labelEvents (fixture-based); prStatusRollup, prReviewComment, issueComment, labelAdd, labelRemove, labelList (inline-mock, documented) |
| ⚠️ Provider-specific only (`providers.test.mjs`, no cross-provider parity) | 9 | whoami, issueList, mrList, prReviews, commitStatus, repoCloneUrl, patSetupUrl, projectResolve, branchProtect |
| ❌ Zero coverage anywhere | 2 | authCheck, authLogin |
| Non-contract extras (documented exceptions, `providers.test.mjs` only) | 3 | capabilities, checkRuns, projectMergeSettings |
| **Total rows** | **24** | 21 contract verbs (`vcs-contract.md`) + 3 extras |

Fixture provenance, of the 10 contract-parity verbs: 4 are fixture-backed
(`issueView`, `mrCreate`, `prView`, `labelEvents` — 3 `recorded:true` on the
GitHub happy path, everything else `derived:true`); 6 are inline-mock-backed
within the SAME suite file, no fixture loaded at all (`prStatusRollup`,
`prReviewComment`, `issueComment`, `labelAdd`, `labelRemove`, `labelList`).
This 4-vs-6 split is the finding that forced design D1's separate
coverage/provenance columns — "✅ contract-parity" alone would have hidden
that 6 of the 10 "covered" verbs have no fixture-provenance guarantee at all.

## Main table — 21 contract verbs (`vcs-contract.md` Required verbs)

| Verb | Contract-parity | Provenance | Consumers | Blast radius | Phase-2 |
|---|---|---|---|---|---|
| `authCheck` | ❌ zero | none | `tracker-board.mjs` (auth gate before board fetch), `project-status.mjs` (dashboard), `day-start.mjs` (day-start auth check) | read, no REQUIRED gate, 3 dashboard/local consumers | rank 5 |
| `authLogin` | ❌ zero | none | `day-start.mjs` (interactive login, token via stdin) | write (session), no REQUIRED gate, local/interactive only | rank 5 |
| `whoami` | ⚠️ partial (`providers.test.mjs` inline) | none | `tracker-board.mjs`, `day-start.mjs` | read, no gate, 2 consumers | rank 6 |
| `issueView` | ✅ parity suite (fixture-based) | recorded (GH) / derived (GL) | `brain-ship.mjs`, `brain-start.mjs`, `ticket-start.mjs`, `governance/run-check.mjs` (**REQUIRED gate**: issue-link/decision-gate), `vcs/actor-check.mjs` (**REQUIRED gate**: self-approval R3) | REQUIRED-gate consumer, 5 call sites | not candidate (#334 Gap-A already closed) |
| `issueList` | ⚠️ partial (`providers.test.mjs` inline) | none | `tracker-board.mjs`, `project-status.mjs` | read, no gate, narrower fan-out than mrList | rank 4 |
| `mrList` | ⚠️ partial (`providers.test.mjs` inline) | none | `brain-next.mjs`, `review/board.mjs`, `review/queue.mjs`, `project-status.mjs` | read, no gate, **widest read fan-out** (4 consumers incl. board + cold-boot-adjacent queue) | rank 3 |
| `mrCreate` | ✅ parity suite (fixture-based) | derived (GH) / derived (GL) | `brain-ship.mjs` | mutating write, single write consumer, already parity-tested | not candidate |
| `prView` | ✅ parity suite (fixture-based) | recorded (GH) / derived (GL) | `brain-audit.mjs`, `review/board.mjs`, `review/queue.mjs`, `review/cold-boot.mjs`, `review/poster.mjs` | read, 5 consumers, already parity-tested | not candidate |
| `prStatusRollup` | ✅ parity suite (inline-mock) | inline (no fixture file; documented — two chained GL calls don't fit the single-fixture glue) | `review/evaluators/tranche.mjs` | READ-only (asserted by source-scan test), 1 consumer | not candidate |
| `labelEvents` | ✅ parity suite (fixture-based) | recorded (GH) / derived (GL) | `vcs/actor-check.mjs` (**REQUIRED gate**: self-approval R3) | REQUIRED-gate consumer, already parity-tested | not candidate |
| `prReviews` | ⚠️ partial — `providers.test.mjs` inline mocks only, **absent from the contract-parity suite** | none | `review/board.mjs`, `review/cold-boot.mjs`, `vcs/brain-writes-reviewed.mjs` (**REQUIRED gate**: L6 self-approval) | **REQUIRED-gate consumer with zero cross-provider parity assertion** — exact sibling of the pre-#334 `issueView` Gap-A | **rank 1** |
| `commitStatus` | ⚠️ partial (`providers.test.mjs` inline) | none | `day-start.mjs` | read, 1 consumer, deterministic single-shape | rank 6 |
| `repoCloneUrl` | ⚠️ partial (`providers.test.mjs` inline) | none | `ticket-start.mjs`, `day-start.mjs` | read, 2 consumers, deterministic string build | rank 6 |
| `patSetupUrl` | ⚠️ partial (`providers.test.mjs` inline) | none | `review/identity.mjs` | read, 1 consumer, deterministic URL build | rank 6 |
| `projectResolve` | ⚠️ partial (`providers.test.mjs` inline) | none | none outside CLI dispatch (`vcs/cli.mjs` VERBS) — identity function, extension point only | read, zero script consumers | rank 6 |
| `branchProtect` | ⚠️ partial (`providers.test.mjs` inline, 15 test cases) | none | `brain-protect.mjs` | **mutating write**, GH/GL diverge on tier semantics (GH Free private repos return `reason:'tier'`; GL never does) and `requiredReviews` enforcement (GL Premium-gated), failure is silent per-provider | **rank 2** |
| `prReviewComment` | ✅ parity suite (inline-mock) | inline (no fixture file) | `review/poster.mjs` (non-`ruling` verdicts) | mutating write, hardcoded `event:'COMMENT'` (REQ-266-3 lock), already parity-tested | not candidate |
| `issueComment` | ✅ parity suite (inline-mock) | inline (no fixture file) | `review/poster.mjs` (`mode==='ruling'`) | mutating write, already parity-tested | not candidate |
| `labelAdd` | ✅ parity suite (inline-mock) | inline (no fixture file) | `review/deny-set.mjs` | mutating write, deny-set enforced by caller not verb, already parity-tested | not candidate |
| `labelRemove` | ✅ parity suite (inline-mock) | inline (no fixture file) | `review/deny-set.mjs` | mutating write, monotonic-tightening only, already parity-tested | not candidate |
| `labelList` | ✅ parity suite (inline-mock, documented rationale) | inline (no fixture file) | `brain-ship.mjs` via `vcs/label-preflight.mjs` | read (preflight gate before `mrCreate`), already parity-tested | not candidate |

## Extras table — 3 documented non-contract verbs

These are intentionally **absent** from `vcs-contract.md`'s Required Verbs
table (the drift guard's `DOCUMENTED_BUT_NOT_REQUIRED`/shared-export logic
treats them as deliberate exceptions, not drift) but are exported,
CLI-callable, and exercised only in `providers.test.mjs`.

| Verb | Contract-parity | Provenance | Consumers | Blast radius | Phase-2 |
|---|---|---|---|---|---|
| `capabilities` | ⚠️ partial (`providers.test.mjs` inline, 10 cases, GH+GL) | none | `brain-governance-status.mjs` | read probe, documented exception, 1 consumer | not candidate |
| `checkRuns` | ⚠️ partial (`providers.test.mjs` inline, GH-only) | none | `brain-protect.mjs` (`verifyAfterArm`, tolerates absence on providers without the verb) | read, GH-only capability-probe helper, 1 consumer | not candidate |
| `projectMergeSettings` | ⚠️ partial (`providers.test.mjs`, GL-only) | derived (`gitlab-project.json`, real fixture file, but loaded outside the parity suite) | `brain-governance-status.mjs` | read, GL-only (no GH `protected_branches` equivalent — design Decision 2), 1 consumer | not candidate |

## Phase-2 gap ranking (design D3 rule)

Ranking rule, in order, ties fall to the next criterion: **(1) REQUIRED-gate
consumer → (2) mutating write → (3) provider-divergent normalization → (4)
call-site fan-out.** Consequence-of-wrongness is the axis, not raw coverage
count — a partially-covered verb feeding a gate outranks an uncovered verb
feeding nothing.

1. **`prReviews`** — feeds `brain-writes-reviewed.mjs`'s L6 self-approval
   REQUIRED gate with a cross-provider shape that is asserted only in
   `providers.test.mjs` inline mocks, never in the contract-parity suite.
   Exact sibling of the pre-#334 `issueView` Gap-A. Criterion 1 fires.
2. **`branchProtect`** — the sole mutating write in the gap set; GitHub and
   GitLab diverge on tier gating and required-review enforcement, and a
   silent divergence here fails closed with no test catching it. Criterion 2
   fires (criterion 1 does not — no REQUIRED gate consumes it).
3. **`mrList`** — widest read fan-out among the gap set (board, queue,
   cold-boot-adjacent, `brain-next`, dashboard); `merge_requests`/
   `source_branch` → `headBranch` normalization is exactly the drift class
   the contract exists to catch. Criteria 3+4 fire.
4. **`issueList`** — same read class as `mrList`, narrower fan-out
   (dashboard-only, no gate). Criterion 4 alone fires.
5. **`authLogin`, `authCheck`** — zero assertions anywhere, and `authLogin`
   handles a token via stdin, but both are local/interactive-only with no CI
   gate downstream. Ranked below 4 despite zero coverage: severity tracks
   consequence, not coverage count.
6. **`whoami`, `commitStatus`, `repoCloneUrl`, `patSetupUrl`, `projectResolve`**
   — marginal, deterministic single-shape reads; no ranking criterion fires
   for any of them.

No Phase-2 PR count is committed here — ranking stops at priority order
(proposal open question 3, resolved in design D3). Slicing into reviewable
PRs is `sdd-tasks`' job under the 400-line budget guard, done per Phase-2
change.

## Methodology

Two test layers exist and are never conflated:

- **`providers/vcs.contract.test.mjs`** — the cross-provider PARITY suite.
  One assertion set, parameterized over `['github','gitlab']`, asserting only
  what `vcs-contract.md` promises (normalized shapes, `null`-on-uncomputable,
  ascending ordering, never-throws). This is "✅ contract-parity" in the
  table above.
- **`providers.test.mjs`** — per-provider inline mocks with no parity or
  provenance guarantee. A verb tested only here is "⚠️ partial," never
  "covered" — that distinction is the whole point of this audit, and is
  exactly the failure mode #317 hid before its dedicated contract suite
  landed.

Fixture provenance matters as a THIRD, orthogonal axis (design D1): a
"covered" verb whose fixture is `derived` (hand-authored from documented API
shape, never validated against the real endpoint) can still assert the wrong
shape — the mechanism behind #334's original Gap-A. `_provenance.recorded` /
`_provenance.derived` on each `fixtures/*.json` file makes this explicit and
machine-checkable (`assertProvenance()` in the parity suite fails any fixture
missing or ambiguous on this flag).

Sources read, no new tooling: `vcs-contract.md`'s Required Verbs table (21
rows), `providers/vcs.contract.test.mjs` (describes 10 verbs via
per-provider loops + a few one-off blocks for `baseRefOid`/lock-2 checks),
`providers.test.mjs` (grepped for `<provider>.<verb>(` call patterns), all 17
`fixtures/*.json` files' `_provenance` blocks, and `verb-contract-drift-guard.
test.mjs` (confirms 21 is the correct Required-Verbs count and that
`capabilities` is the one deliberate non-required exception). Consumers were
found by grepping the whole `brain/scripts/` tree for `.<verb>(` call sites,
excluding the provider modules and test files themselves.

## Fixture debt

- **All `gitlab-*.json` fixtures (9 of 17 files) are `derived:true` — no
  live GitLab mirror has ever validated them** (deferred to CP-A3b/SCIT per
  the suite's own header comment). This is the single largest fixture-debt
  item: every GitLab-side contract-parity assertion (`issueView`, `prView`,
  `labelEvents`, `mrCreate`) rests on a hand-authored belief about the GitLab
  API shape, not a recorded response.
- Only 3 fixtures are `recorded:true`, all GitHub happy-paths:
  `github-issueView-happy.json`, `github-labelEvents-happy.json`,
  `github-prView-happy.json`. Every GitHub failure/mutating-write fixture
  (`github-*-failure.json`, `github-mrCreate-happy.json`) is `derived` too —
  forced-failure and write cases cannot be recorded from a real API.
  `gitlab-project.json` (backing `projectMergeSettings`) is likewise derived.
- Derived-fixture assumptions can be wrong in ways a passing test cannot
  detect — e.g. `mrCreate`'s GitLab label-acceptance behavior is asserted
  against a hand-authored shape, not a confirmed live response. "Covered +
  derived" is a distinct, weaker state than "covered + recorded," and this
  audit keeps them in separate columns for exactly that reason (design D1).
- 6 of the 10 contract-parity verbs (`prStatusRollup`, `prReviewComment`,
  `issueComment`, `labelAdd`, `labelRemove`, `labelList`) have **no fixture
  file at all** — they pass the parity suite on inline mocks, with a
  documented rationale each (chained GL calls, simple write shapes). This is
  not automatically debt (the suite's own comments justify each one), but it
  means "✅ contract-parity" does not imply "fixture-verified" for 6 of 21
  verbs.

## Risks

- **Staleness**: this table describes one commit. The measurement-basis
  pin (header) is the mitigation — without it the table is unfalsifiable,
  which is exactly how the prior register
  (`docs/inbox/seam-contract-coverage-roadmap.md` §3) went stale while still
  being cited.
- **Derived-fixture assumptions may not survive provider API evolution**:
  every `gitlab-*.json` fixture and 3 of the 4 `github-*.json` fixture pairs
  encode a belief about the API shape as of the fixture's `_provenance.date`,
  not a live-verified contract. A provider-side API change would not be
  caught until the next live interaction fails.
- **Ranking is judgement, not measurement**: the D3 rule is published above
  precisely so Phase 2 can contest the reasoning rather than re-derive it
  from scratch or guess at priority.
- **Scoped placement**: this file lives in the change folder only (design
  D2), not `docs/`. Promotion criterion (stated, not deferred): only if
  Phase 2 lands ≥2 slices AND the table is still consulted afterward.

## Out of scope (unchanged from proposal)

No test, fixture, or spec was written or modified. No `vcs-contract.md`,
provider, or drift-guard change. No live GitLab validation performed. No
fixture remediation or recorded-promotion. No Phase-2 PR count committed.
Detection only — every remedy is Phase 2's to choose.
