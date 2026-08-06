# Design — rung 3 earns "armed" from the run ledger (#468)

`realPostMergeCiProbe` becomes a dumb reader of GitHub's workflow-run ledger returning a
structured evidence object; `evalRung3` becomes a pure total function over that evidence,
shaped exactly like rung 2 (`available, active, verifiable, mechanism, reason, remedy`).
The only two rows in the decision table that yield `active: true` are a legacy declaration
(unreachable from production wiring) and a *proven, fresh, successful* run.

## The three deferred rulings

| # | Ruling | Excluded alternative — and by what |
|---|--------|------------------------------------|
| **1. Call site** | Inline `run('gh', …)` inside `realPostMergeCiProbe` (`brain-governance-status.mjs`) | A `github.mjs` verb is excluded by **probe layering** and by **#479**. `evalRung3` passes only `{ config, env }` to its probe (`substrate.mjs:62`), unlike `evalRung1` which passes `vcs` (`substrate.mjs:401`) — a provider verb would force a `vcs` thread through the pure orchestrator, and the sanctioned alternative (dynamic import) is explicitly rejected at `brain-governance-status.mjs:54-56`. All three sibling probes already read inline (`:66`, `:75`, `:130`); a 4th instance of the *existing* seam shape is one more line for #479 to move, whereas a new probe→provider-verb coupling is a *new* seam shape #479 would have to unify separately. Testability confirms it: `brain-governance-status.test.mjs:271-294` already fixture-tests a real inline probe via `setSpawn` with the probe deliberately not overridden. |
| **2. Evidence shape** | Structured `RunLedgerEvidence` (below) + a 11-row total decision table | Verdict-in-probe is excluded by #337's D1 split (`brain-governance-status.mjs:91-99`). A `verifiable:false` "declared-but-unverified" armed on read failure is excluded by the settled product decision (semi-green reads as health). |
| **3. Run URL** | Inside `reason` text; the *evidence* keeps `htmlUrl`, the *report* gains no field | A discrete `runUrl` field is excluded by acceptance criterion **(c)** (rung 2/rung 3 same shape — rung 2 has no data field, it puts trigger detail in `reason`, `substrate.mjs:255`) and by the consumer map: the only non-test importer of `detectSubstrate` is `brain-governance-status.mjs:25`, and it string-prints (`:219`, `:224`, `:277`). A discrete field would render nowhere — the proposal's "new fields render nowhere" risk. |

**Endpoint (sub-ruling of 2).** Read `repos/{slug}/actions/workflows/governance-postmerge.yml/runs?branch={defaultBranch}&per_page=20`, not `rerunWorkflowRun`'s repo-wide `actions/runs?branch=…&per_page=100` + client-side `.path` filter (`github.mjs:553-559`). Same `{ workflow_runs: [...] }` response shape, so the fixture pattern carries over unchanged; server-side scoping is *required* because on a repo where `governance.yml` runs on every PR push, the post-merge run can fall off page 1 — which the repo-wide read would report as "zero runs", a new false-inert class.

## Evidence contract

```js
// realPostMergeCiProbe({ config, env }) → RunLedgerEvidence   (I/O only, zero interpretation)
{
  workflowPresent: boolean,     // repoFileExists(...) — fs only, gates the network call
  read: 'skipped'               // workflow file absent → no gh call made
      | 'unsupported'           // file present, config.vcs.provider !== 'github' (no ledger reader)
      | 'ok' | 'failed',        // failed = auth / no token / network / rate limit / bad JSON
  lastRun: {                    // FIRST entry with status === 'completed' (the single terminal run), else null
    id: number,
    conclusion: string,         // 'success' | 'failure' | 'cancelled' | 'timed_out' | 'startup_failure' | …
    completedAt: string,        // run.updated_at — the list endpoint returns no completed_at
    htmlUrl: string,
  } | null,
  error: string | null,         // trimmed stderr / parse message; never swallowed, never fabricated
  observedAt: number | null,    // Date.now() AT THE READ — the clock is I/O, so it enters via evidence
}
```

`observedAt` is carried, not read inside `evalRung3`, because `substrate.mjs:12-20` forbids ambient coupling in the pure orchestrator. No `observedAt` ⇒ staleness is uncomputable, never assumed fresh.

## Decision table (total — every input class mapped)

Evaluated top to bottom; the first matching row wins.

| # | Input class | available | active | verifiable | mechanism |
|---|-------------|-----------|--------|------------|-----------|
| L1 | raw `=== true` (legacy declaration) | true | **true** | false | `postmerge-ci-declared` |
| L2 | raw `=== false` (legacy declared-absent) | true | false | false | `postmerge-ci-absent` |
| L3 | raw `undefined`/`null`/non-object — probe missing or threw (`safeProbe`, `substrate.mjs:39-46`) | **false** | false | true | `postmerge-run-ledger-uncomputable` |
| E1 | `workflowPresent: false` (`read:'skipped'`) | true | false | true | `postmerge-ci-absent` |
| E2 | `read:'unsupported'` (non-GitHub provider) | **false** | false | true | `postmerge-run-ledger-unsupported` |
| E3 | `read:'failed'` (auth / no token / network / rate limit / bad JSON) | **false** | false | true | `postmerge-run-ledger-uncomputable` |
| E4 | `read:'ok'`, `lastRun: null` (zero terminal runs) | true | false | true | `postmerge-unproven` |
| E5 | `lastRun` malformed — no `conclusion`, unparseable `completedAt`, or `observedAt: null` | **false** | false | true | `postmerge-run-ledger-uncomputable` |
| E6 | `conclusion !== 'success'` | true | false | true | `postmerge-failing` |
| E7 | success, `observedAt − completedAt > 48h` | true | false | true | `postmerge-stale` |
| E8 | success, age ≤ 48h | true | **true** | true | `postmerge-run-ledger` |

Only L1 and E8 arm. L1 is unreachable in production — the real probe always returns an object (locked by a fixture test). Every uncomputable row keeps a non-empty `reason` **and** `remedy`, required by `substrate.test.mjs:28-36` (top-level `reason`/`remedy` come from `rungs[3]` at rung 4, `substrate.mjs:529`).

**Provider safety.** E1 is fs-only and E2 short-circuits before any spawn, so no `gh` process is ever spawned on a non-GitHub runner — the concern behind `no-gh-glab-spawn-regression.test.mjs`. GitLab's real-world outcome is unchanged (no `.github/workflows/` file ⇒ E1, today's inert + remedy).

**`available:false` semantics.** For rung 3 this now means *uncomputable*, adopting the ladder's own idiom from `evalPipelineMustSucceedGate`'s GitLab branch (`substrate.mjs:296-303`), which likewise pairs `available:false` with `verifiable:true`. Rule: `verifiable:false` ⟺ the evidence is a declaration (L1/L2); `verifiable:true` ⟺ the evidence is (or would be) the run ledger.

## Normalizer semantics (legacy fixtures)

`normalizePostMergeEvidence(raw)` mirrors `normalizeReleaseGateEvidence` (`substrate.mjs:101-109`) but keeps three distinguishable legacy inputs instead of two: `true` → L1, `false` → L2, anything else → L3. Splitting `undefined` from `false` is what lets a throwing probe report uncomputable while `postMergeCi: async () => false` stays confirmed-inert. All 36 existing bare-boolean call sites pass unmodified: `=> true` still arms (`substrate.test.mjs:47-57`, `:696-708`, `:710-721`), `=> false` still yields inert with reason+remedy (`:60-72`), throwing still degrades without crashing (`:649-659`).

## Staleness constant and drift guard

```js
export const POSTMERGE_STALE_MS = 48 * 60 * 60 * 1000; // 2 periods of governance-postmerge.yml's daily cron
```

Guard lives in `release-postmerge-workflows.test.mjs` (the workflow's contract-guard home, `POSTMERGE_YML` at `:139`, adjacent to the existing schedule test at `:209-213`), importing the constant from `substrate.mjs`:

1. extract the cron: `text.match(/-\s*cron:\s*'([^']+)'/)` → `'0 6 * * *'` (`governance-postmerge.yml:26`);
2. assert it is still daily-shaped: `/^\d+\s+\d+\s+\*\s+\*\s+\*$/`;
3. assert `POSTMERGE_STALE_MS === 2 * 24 * 60 * 60 * 1000`.

Any cadence edit fails the shape assertion with a message naming the constant, so the two cannot drift silently. No cron parser is introduced (zero-dependency doctrine, `substrate.mjs:111-114`).

## Data flow

    governance-postmerge.yml runs ──→ GitHub Actions run ledger (external to brain)
                                                 │  gh api .../workflows/{file}/runs
    realPostMergeCiProbe  ────────────────────────┘   (inline run(), I/O only)
       │ RunLedgerEvidence { workflowPresent, read, lastRun, error, observedAt }
       ▼
    evalRung3 (pure, offline)  ──→ { available, active, verifiable, mechanism, reason, remedy }
       │                                        │
       ▼                                        ▼
    selectRung (unchanged)              printSubstrateReport rung-3 block

## printSubstrateReport rung-3 block

Inserted after the rung-2 block (`brain-governance-status.mjs:266-281`), driven **solely** by `rungs[3].available/active/verifiable/mechanism` — no independent hardcoded branch, same discipline as rung 2. Order matters: uncomputable is checked first so it can never be swallowed by an inert render.

| Condition | Line |
|-----------|------|
| `available === false` | `post-merge CI  UNCOMPUTABLE — {reason}` + `remedy:` line (loud, REQ-HONESTY-2 — never neutral) |
| `active && verifiable === false` | `post-merge CI  armed (declared) — unverified; no run-ledger evidence` |
| `active` | `post-merge CI  armed  [last governance-postmerge run on main succeeded within 48h]` |
| `active === false` | `post-merge CI  not armed: {reason}` + `remedy:` line |

The failing/stale `reason` carries the run URL, so the operator gets the offending run from `brain:governance-status` alone.

## File changes

| File | Action | Description |
|------|--------|-------------|
| `brain/scripts/vcs/substrate.mjs` | Modify | `POSTMERGE_STALE_MS` export, `normalizePostMergeEvidence`, rewritten `evalRung3` (11-row table, `verifiable`+`mechanism` on every branch) |
| `brain/scripts/brain-governance-status.mjs` | Modify | `realPostMergeCiProbe` → ledger reader (delete `GITHUB_ACTIONS` self-arming, `:116`); rung-3 block in `printSubstrateReport` |
| `brain/scripts/vcs/fixtures/github-postmergeRuns-outage-window.json` | Create | Replay fixture — the 2026-07-24→2026-08-05 failure window, `_provenance.derived` |
| `brain/scripts/vcs/fixtures/github-postmergeRuns-{success,empty}.json` | Create | Terminal-success and zero-runs ledger pages, `_provenance.derived` |
| `brain/scripts/vcs/substrate.test.mjs` | Modify | One case per decision-table row + legacy non-regression |
| `brain/scripts/brain-governance-status.test.mjs` | Modify | Real-probe fixture cases (local `loadFixture`/`assertProvenance`, copied per `vcs.contract.test.mjs:44-61`), replay lock, rung-3 print cases |
| `brain/scripts/vcs/release-postmerge-workflows.test.mjs` | Modify | Cron ↔ `POSTMERGE_STALE_MS` drift guard |
| `.github/workflows/governance-postmerge.yml` | **Unmodified** | Acceptance criterion — this change detects, it does not repair |

## Testing strategy

| Layer | What | How |
|-------|------|-----|
| Pure | All 11 decision-table rows; totality (no unmapped input); no row but L1/E8 arms | `detectSubstrate` + injected `postMergeCi` evidence objects, `observedAt` supplied by the fixture ⇒ staleness is clock-free and deterministic |
| Pure (regression) | 36 bare-boolean call sites unchanged | Existing `substrate.test.mjs` / `brain-governance-status.test.mjs` cases run unmodified |
| Real probe | Evidence extraction: success page, failure page, empty page, `gh` non-zero (auth), malformed JSON, non-GitHub provider spawns nothing | `setSpawn` with `postMergeCi` **not** overridden — the pattern at `brain-governance-status.test.mjs:271-294`; spy asserts zero `gh` spawns under `provider:'gitlab'` |
| E2E replay (criterion a) | Outage window ⇒ rung 3 inert | `reportGovernanceStatus` + `captureLog`: output must not claim `RUNG 3` and must name the failing run. Deterministic without a clock freeze because E6 (conclusion) precedes E7 (staleness) |
| E2E (criterion b) | Read failure never arms | Every failure fixture asserts `available:false` and `active !== true` |
| Drift | Cron ↔ constant | See guard above |

Freshness (E7/E8) is asserted only at the pure layer with injected `observedAt`; real-probe fixtures own evidence extraction, never time. This avoids templated timestamps in static JSON fixtures.

## Migration / rollout

No migration. Read-only reporting change, single-commit revert (`proposal.md` §Rollback). brain's own reported rung will demote until `governance-postmerge.yml` is green — expected and called out in the PR body, exactly as #337 did.

## Open questions

None blocking. Two accepted consequences, already settled: a single transient run failure flips rung 3 red until the next run (decision 4), and a developer without `gh` auth sees UNCOMPUTABLE rather than a soft green (decision 2).
