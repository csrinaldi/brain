# Tasks — rung 3 earns "armed" from the run ledger (#468)

Source: `specs/governance-v3/spec.md` (REQ-R3-1..9), `design.md`.
Ordering follows the design's data flow: pure evaluator first (offline,
zero-dependency, fastest feedback), then the real I/O probe, then the render
layer, then the historical replay lock, then the drift guard, then a full
regression pass. Each task is one work-unit commit — tests and fixtures ride
with the behavior they prove, per `work-unit-commits`.

## Dependency shape

```
Task 1 (pure evaluator, foundation)
   │
   ├──> Task 2 (real probe + ledger fixtures)  ─┐
   ├──> Task 3 (printSubstrateReport block)      │  parallel-safe after Task 1
   └──> Task 5 (drift guard)                     │  (Task 2 and Task 3 both
                                                  │   touch brain-governance-
                                                  │   status.mjs but different
                                                  │   functions — sequence as
                                                  │   commits, not literal
                                                  │   concurrent edits)
   Task 2 ──> Task 4 (outage-window replay lock)
   all ──> Task 6 (full regression pass)
```

Only Task 1 is a hard blocking prerequisite for everything else. Task 5
(drift guard) has no dependency on Task 2/3 and can be done any time after
Task 1. Task 4 requires Task 2 (needs the real probe wired to exercise the
replay fixture end-to-end).

---

## Task 1 — Pure `evalRung3`: normalizer, staleness constant, 11-row decision table

- [x] **REQ-R3-1, REQ-R3-2, REQ-R3-3, REQ-R3-4, REQ-R3-5, REQ-R3-6, REQ-R3-7**

Replace the current 2-line boolean-coercion `evalRung3` (`substrate.mjs:61-72`)
with the design's total, offline, pure evaluator.

Target files:
- `brain/scripts/vcs/substrate.mjs` (modify)
  - Export `POSTMERGE_STALE_MS = 48 * 60 * 60 * 1000` (design "Staleness
    constant and drift guard"). Must be a named export — Task 5's drift-guard
    test imports it.
  - Add `normalizePostMergeEvidence(raw)`: **three-way** normalizer —
    `true` → L1 (legacy declared-armed), `false` → L2 (legacy
    declared-absent), **anything else** → L3 (uncomputable: `undefined`,
    `null`, a throwing/missing probe via `safeProbe`, or a real evidence
    object). Implementation trap: do NOT let `undefined` collapse into the
    `false` branch — that's what silently degrades a throwing probe into a
    confirmed-inert instead of uncomputable. `undefined` and `false` must
    take different code paths.
  - Rewrite `evalRung3({ config, env, probes })` as the 11-row total table
    (design "Decision table", rows L1/L2/L3/E1..E8), evaluated top to bottom,
    first match wins. Every branch returns all six fields:
    `{ available, active, verifiable, mechanism, reason, remedy }` (REQ-R3-6).
    Implementation trap: `evalRung3` must NOT call `Date.now()` — staleness
    (row E7 vs E8) compares `evidence.observedAt - lastRun.completedAt`
    against `POSTMERGE_STALE_MS`, and `observedAt` arrives via the probe's
    evidence object, never read ambiently (design "Evidence contract" +
    `substrate.mjs:12-20` pure-orchestrator rule).
  - Row E5 (malformed `lastRun`: missing `conclusion`, unparseable
    `completedAt`, or `observedAt: null`) must map to `available: false`,
    same as E2/E3/L3 — never silently treated as a fresh success.
- `brain/scripts/vcs/substrate.test.mjs` (modify, same commit — tests ride
  with the code they prove)
  - One case per decision-table row (L1, L2, L3, E1–E8) asserting the full
    6-field shape.
  - Regression: the existing ~36 bare-boolean `postMergeCi` fixtures across
    `substrate.test.mjs` / `brain-governance-status.test.mjs` (see grep at
    `brain-governance-status.test.mjs:71,91,111,...`) must keep passing
    **unmodified** — `=> true` still arms via L1, `=> false` still yields
    inert via L2 with non-empty `reason`+`remedy`, a throwing probe still
    degrades via L3 without crashing.
  - Totality check: assert only L1 and E8 ever produce `active: true`.

Verification: `node --test brain/scripts/vcs/substrate.test.mjs` — all new
row cases green, all pre-existing cases green unmodified, zero diff needed
in the ~36 legacy fixture call sites.

---

## Task 2 — Real probe: run-ledger reader (`realPostMergeCiProbe`)

- [x] **REQ-R3-1, REQ-R3-2, REQ-R3-4, REQ-R3-5**

Depends on: Task 1 (evidence shape must exist before the probe can be
verified against it).

Target files:
- `brain/scripts/brain-governance-status.mjs` (modify)
  - Delete the self-referential `env?.GITHUB_ACTIONS === 'true'` early-return
    (`:116`) — that route is the second lie identified in the proposal
    (armed unconditionally from inside CI, including from inside the broken
    workflow's own run).
  - Rewrite `realPostMergeCiProbe({ config, env })` to:
    1. `workflowPresent = repoFileExists('.github/workflows/governance-postmerge.yml')`
       — fs-only, gates the network call (`read: 'skipped'` if absent, no
       `gh` spawn).
    2. If `config?.vcs?.provider !== 'github'` → `read: 'unsupported'`, no
       spawn (GitLab has no ledger reader wired; keeps today's inert +
       remedy behavior for GitLab, per design "Provider safety").
    3. Otherwise call the **workflow-scoped** endpoint — implementation trap,
       must NOT reuse `rerunWorkflowRun`'s repo-wide pattern:
       `gh api repos/{slug}/actions/workflows/governance-postmerge.yml/runs?branch={defaultBranch}&per_page=20`
       (NOT `actions/runs?branch=...&per_page=100` + client-side `.path`
       filter — the repo-wide read can miss the post-merge run past page 1
       on a repo where `governance.yml` fires on every PR push, producing a
       false "zero runs").
    4. On `gh` failure (non-zero exit, malformed JSON) → `read: 'failed'`,
       `error` carries trimmed stderr/parse message, never swallowed.
    5. On success, find the FIRST entry with `status === 'completed'` →
       `lastRun: { id, conclusion, completedAt: run.updated_at, htmlUrl }`,
       or `null` if none found.
    6. Implementation trap — inject the clock as evidence, not ambiently:
       set `observedAt: Date.now()` in the returned object AT THE READ. This
       is the only place `Date.now()` may appear for this feature; `evalRung3`
       (Task 1) must never call it directly.
    7. Return the full `RunLedgerEvidence` shape from design's "Evidence
       contract" block.
- `brain/scripts/vcs/fixtures/github-postmergeRuns-success.json` (create)
  — terminal-success ledger page, `_provenance.derived: true`, following the
  `github-rerunWorkflowRun-happy.json` fixture pattern (endpoint noted in
  `_provenance`, trimmed to consumed fields).
- `brain/scripts/vcs/fixtures/github-postmergeRuns-empty.json` (create)
  — zero-runs ledger page (`{ "workflow_runs": [] }`), same provenance
  pattern.
- `brain/scripts/brain-governance-status.test.mjs` (modify, same commit)
  - Real-probe fixture cases via `setSpawn` with `postMergeCi` **not**
    overridden (mirrors the existing pattern at
    `brain-governance-status.test.mjs:271-294`): success page → `read: 'ok'`
    with a well-formed `lastRun`; empty page → `read: 'ok'`, `lastRun: null`;
    non-zero `gh` exit (auth failure) → `read: 'failed'`; malformed JSON →
    `read: 'failed'`.
  - Provider-scoping case: `config.vcs.provider: 'gitlab'` → `read:
    'unsupported'`, and assert **zero** `gh` spawns (extend or add a case
    alongside `brain/scripts/vcs/no-gh-glab-spawn-regression.test.mjs`'s
    existing spy pattern).

Verification: `node --test brain/scripts/brain-governance-status.test.mjs`
(new real-probe cases green) + `node --test brain/scripts/vcs/no-gh-glab-spawn-regression.test.mjs`
(zero `gh` spawns under `provider: 'gitlab'`).

---

## Task 3 — `printSubstrateReport` rung-3 breakdown block

- [x] **REQ-R3-8**

Depends on: Task 1 (the block reads `rungs[3].available/active/verifiable/mechanism`,
which only exists once Task 1 lands). Independent of Task 2 — the block is
driven by the already-computed `substrate.rungs[3]` object, not by calling
the probe directly, so it can be written and tested with injected `probes`
overrides before the real probe exists.

Target files:
- `brain/scripts/brain-governance-status.mjs` (modify)
  - Insert a rung-3 block into `printSubstrateReport` after the existing
    rung-2 block (`:266-281`), mirroring the rung-1/rung-2 discipline: driven
    **solely** by `rungs[3].*` fields, no independent hardcoded branch.
    Order matters — check `available === false` (uncomputable) FIRST so it
    can never be swallowed by an inert render (design table):
    1. `available === false` → `post-merge CI  UNCOMPUTABLE — {reason}` +
       `remedy:` line (loud, REQ-HONESTY-2 — never neutral).
    2. `active && verifiable === false` → `post-merge CI  armed (declared) —
       unverified; no run-ledger evidence`.
    3. `active` → `post-merge CI  armed  [last governance-postmerge run on
       main succeeded within 48h]`.
    4. `active === false` (remaining case) → `post-merge CI  not armed:
       {reason}` + `remedy:` line.
- `brain/scripts/brain-governance-status.test.mjs` (modify, same commit)
  - One `printSubstrateReport`/`reportGovernanceStatus` capture-log case per
    branch above, using injected `probes.postMergeCi` evidence objects (no
    real probe needed).

Verification: `node --test brain/scripts/brain-governance-status.test.mjs`
— rung-3 print cases green, and confirm no existing rung-1/rung-2 print case
regresses (no computed rung-3 signal renders nowhere — the proposal's named
risk).

---

## Task 4 — Outage-window replay fixture + E2E lock

- [x] **REQ-R3-9**

Depends on: Task 2 (exercises the real probe + real `evalRung3` end to end).

Target files:
- `brain/scripts/vcs/fixtures/github-postmergeRuns-outage-window.json`
  (create) — built from the real `governance-postmerge.yml` run-ledger data
  for 2026-07-24 → 2026-08-05 (the actual 12-day continuous-failure window
  named in the proposal), trimmed to the fields the probe consumes, with
  `_provenance.derived: true` and a note naming the source window —
  following the `github-rerunWorkflowRun-*.json` fixture pattern exactly
  (hand-authored/derived, documented endpoint, provenance block explaining
  what the fixture proves).
- `brain/scripts/brain-governance-status.test.mjs` (modify, same commit)
  - Replay-lock test: `reportGovernanceStatus` + `captureLog`, `setSpawn`
    returning the outage-window fixture, `postMergeCi` **not** overridden
    (exercises the real probe + real `evalRung3`). Assert the output does
    NOT claim `RUNG 3` armed and names the failing run's URL. Deterministic
    without a clock freeze because row E6 (conclusion !== success) precedes
    row E7 (staleness) in the decision table — the outage window fails on
    conclusion, not on age, so no `observedAt` fixture-clock trick is needed.

Verification: `node --test brain/scripts/brain-governance-status.test.mjs`
— replay-lock case green; this is acceptance criterion (a) from the
proposal, made executable.

---

## Task 5 — Drift guard: cron ↔ `POSTMERGE_STALE_MS`

- [x] **REQ-R3-3**

Depends on: Task 1 (needs `POSTMERGE_STALE_MS` exported from `substrate.mjs`).
Independent of Task 2/3/4 — touches a different test file entirely.

Target files:
- `brain/scripts/vcs/release-postmerge-workflows.test.mjs` (modify)
  — add a guard test adjacent to the existing schedule test (`:209-213`),
  using the file's existing `POSTMERGE_YML` constant (`:139`):
  1. Extract the cron: `text.match(/-\s*cron:\s*'([^']+)'/)`.
  2. Assert it is still daily-shaped: `/^\d+\s+\d+\s+\*\s+\*\s+\*$/`.
  3. Import `POSTMERGE_STALE_MS` from `substrate.mjs` and assert
     `POSTMERGE_STALE_MS === 2 * 24 * 60 * 60 * 1000`.
  No cron parser — zero-dependency doctrine (`substrate.mjs:111-114`).

Verification: `node --test brain/scripts/vcs/release-postmerge-workflows.test.mjs`
— new guard test green today; manually confirm it fails if the cron literal
in `governance-postmerge.yml`'s `schedule:` block is edited without updating
`POSTMERGE_STALE_MS` (this is REQ-R3-3's explicit drift-guard scenario —
worth a throwaway local check before merge, not a permanent test).

---

## Task 6 — Full regression pass

- [ ] **All REQ-R3-\*** (closing verification)

Depends on: Tasks 1–5 complete.

Target files: none (verification-only task).

Steps:
- `npm test` — full suite green, including all pre-existing rung-1/rung-2
  cases untouched by this change.
- Confirm `.github/workflows/governance-postmerge.yml` is unmodified (git
  diff empty for that path) — acceptance criterion, this change detects, it
  does not repair.
- Confirm zero `gh`/`glab` spawns under non-GitHub `provider` config beyond
  what already existed pre-change.
- Re-read the proposal's three acceptance criteria (a) replay lock,
  (b) fail-closed read, (c) shape parity — confirm each maps to a passing
  test from Tasks 1–4 (a→Task 4, b→Task 1 rows E2/E3/E5/L3 + Task 2 fixture
  cases, c→Task 1's 6-field shape on every branch).

Verification: `npm test` exits 0; manual diff check on the workflow file.

---

## Review Workload Forecast

| File | Change type | Counts toward budget? | Est. lines (add+del) |
|------|-------------|------------------------|----------------------|
| `brain/scripts/vcs/substrate.mjs` | modify | yes | ~140 |
| `brain/scripts/brain-governance-status.mjs` | modify | yes | ~55 |
| `brain/scripts/vcs/fixtures/github-postmergeRuns-{success,empty,outage-window}.json` | create ×3 | yes | ~90 |
| `brain/scripts/vcs/substrate.test.mjs` | modify | **no** — `**/*.test.mjs` in `governance.ignoreList` | — |
| `brain/scripts/brain-governance-status.test.mjs` | modify | **no** — ignoreList | — |
| `brain/scripts/vcs/release-postmerge-workflows.test.mjs` | modify | **no** — ignoreList | — |
| `openspec/changes/issue-468-rung3-efficacy-probe/**` | already exists | **no** — `openspec/changes/**` in ignoreList | — |

Estimated counted changed lines: **~285** (substrate.mjs ~140 + brain-governance-status.mjs
~55 + 3 new fixtures ~90). All three governance test files are modified but
excluded from the budget by `brain.config.json`'s `governance.ignoreList`
(`**/*.test.mjs`).

- Estimated changed lines (budget-counted): **~285**
- 400-line budget risk: **Low**
- 1000-line budget risk (lite tier, `governance-tiers.mjs` `diffBudget: 1000`): **Low**
- Chained PRs recommended: **No**
- Decision needed before apply: **No**
