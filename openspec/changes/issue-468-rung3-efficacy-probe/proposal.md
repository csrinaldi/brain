# Proposal — rung 3 must earn "armed" from run evidence, not from a file on disk (#468)

**Issue**: #468 · **Base**: `main` @ `d2fdf13` · **Branch**: `feat/issue-468-featgovernance-rung-3-reports-armed-on-f`
**Precedent**: #337 (same fix, applied to rung 2)

Rung 3 claims the guarantee "bad state does not persist." Today it attests to that
guarantee by checking whether a YAML file exists. Between **2026-07-24 and 2026-08-05**
the post-merge workflow failed continuously while `brain:governance-status` kept
reporting rung 3 armed. Twelve days of outage, zero signal. This change replaces the
presence probe with an efficacy probe that reads the GitHub Actions run ledger, and
makes every unreadable state report as uncomputable rather than as health.

## Problem

`evalRung3` (`brain/scripts/vcs/substrate.mjs:61-72`) coerces one probe to a boolean
and returns `active: true` on truthy. The real probe
(`brain/scripts/brain-governance-status.mjs:114-118`) is two lines:

```js
async function realPostMergeCiProbe({ config, env }) {
  if (env?.GITHUB_ACTIONS === 'true') return true;
  return repoFileExists('.github/workflows/governance-postmerge.yml');
}
```

That yields **two independent routes to a false "armed"**, and the 12-day outage
travelled both:

| # | Route | Why it lies |
|---|-------|-------------|
| 1 | **File presence** | The file existed the entire time the workflow was failing. Presence attests to authorship, never to efficacy. |
| 2 | **Self-referential CI arming** | `GITHUB_ACTIONS === 'true'` reports armed *unconditionally from inside CI* — including from inside a run of the very workflow that is broken. The probe is not independent of the thing it watches. |

Neither signal is independent of the watched mechanism. This is the same defect #337
fixed for rung 2 (release gate), on a different axis: rung 2's lie was about
*trigger timing*, rung 3's lie is about *run history*.

A second, structural gap: rung 3's return shape is a strict subset of rung 2's. It
carries `{ available, active, reason, remedy }` and lacks the `verifiable` and
`mechanism` fields #337 introduced, so the two rungs cannot be rendered or reasoned
about uniformly.

**Doctrine violated**: ADR-0015 REQ-HONESTY-1/2 (never render a weaker state as
passing or neutral) and the `evidence-reader-empty-on-failure` anti-pattern (a reader
must never turn a failed read into a confident verdict).

## Approach

Read the run ledger, interpret it purely, and refuse to guess.

1. **Evidence source — approach A.** Fetch the last terminal run of
   `governance-postmerge.yml` via `gh api .../actions/runs`, extending the idiom
   already proven by `rerunWorkflowRun` (`brain/scripts/vcs/providers/github.mjs:550-569`)
   rather than the `gh run list` porcelain the issue mentions illustratively. GitHub
   Actions' own run ledger is a system outside brain's code — the workflow cannot lie
   about its own run history the way file presence trivially can.
   *(Rejected: cursor-ref freshness. `refs/governance/audit-cursor` legitimately stays
   pinned on correctly-functioning halts, so it cannot distinguish "broken" from
   "working exactly as designed, blocked on a real finding" — a new false-inert class.)*
2. **Mirror the #337 shape.** Raw-evidence probe / pure-interpretation split: the probe
   is a dumb I/O wrapper returning an evidence object; all classification lives in the
   pure, offline-testable `evalRung3`. Add `verifiable` and `mechanism` to every return
   branch so rung 2 and rung 3 report through one shape.
3. **Backward compatibility via the D4 normalizer.** Reuse
   `normalizeReleaseGateEvidence`'s pattern: a bare `true`/`false` from a legacy probe
   normalizes to a declared-only, `verifiable: false` signal so the existing test
   fixtures keep passing unmodified.
4. **Uncomputable uses the ladder's own vocabulary.** `available: false` — the idiom
   `evalPipelineMustSucceedGate`'s GitLab branch already uses (`substrate.mjs:296-303`).
   No new field, no import of `exit-codes.mjs`'s repo-wide enum.

### Settled behavior — do not reopen

Maintainer decisions from the proposal question round (2026-08-06). Guiding principle:
**when in doubt, annoy rather than lie.**

| Fork | Decision | Rationale |
|------|----------|-----------|
| Staleness threshold | Hardcoded ~48h (2 daily cron periods) + a drift-guard test tied to the workflow's `schedule:` block | Zero-dependency repo; cron parsing rejected. The test closes the drift risk. |
| Read failure / no API access | Full uncomputable (`available: false`), **never** a false or softened armed | A declared-but-unverified semi-green reads as health. Rejected. |
| Zero runs yet | Strict inactive, `mechanism: 'postmerge-unproven'` | Armed is earned by execution evidence, not by authorship. Transient red on fresh repos accepted. |
| Observation window | Single last terminal run; failure → inert immediately, with the run URL | The 12-day outage began with ONE unexamined failure. N-consecutive windows rejected. |

## Scope

### In scope

- `evalRung3` (`brain/scripts/vcs/substrate.mjs:61-72`) — efficacy interpretation, plus
  `verifiable` and `mechanism` on every branch.
- `realPostMergeCiProbe` (`brain/scripts/brain-governance-status.mjs:114-118`) — return
  structured run evidence; delete the self-referential `GITHUB_ACTIONS` arming.
- The `gh api actions/runs` read for `governance-postmerge.yml`'s last terminal run.
- A bare-boolean normalizer preserving the existing probe injection contract.
- A rung-3 breakdown block in `printSubstrateReport`
  (`brain/scripts/brain-governance-status.mjs:208-284`), which today has none.
- The 48h staleness constant and its drift-guard test against the workflow's `schedule:`.
- Tests: pure evaluator cases, `setSpawn` fixture cases for the real probe, and the
  replay fixture for the 2026-07-24→2026-08-05 window.

### Out of scope

| Excluded | Owner |
|----------|-------|
| Unifying provider auth across governance probes | **#479** — this change picks one call-site pattern consistent with the file it lands in; it does not fix the seam. |
| Migrating the window/uncomputable handling into `alarm.mjs` | **#482** — explicitly deferred there. |
| A GitLab equivalent (pipeline schedule run history) | Follows `rerunWorkflowRun`'s documented GitHub-only, non-contract precedent; GitLab keeps today's behavior, stated explicitly rather than silently absent. |
| Fixing `governance-postmerge.yml` itself | This change detects; it does not repair. |
| Adding a rung, or changing `selectRung`'s "highest armed wins" | ADR-0015 ladder shape is unchanged. |

## Acceptance criteria

- [ ] **(a) Replay lock.** A fixture built from the real 2026-07-24→2026-08-05 failure
      window, fed through the real probe and `evalRung3`, reports rung 3 **inactive**.
- [ ] **(b) Fail-closed read.** Any read failure (auth, network, rate limit, malformed
      JSON) yields `available: false` — uncomputable, and **never** `active: true`.
- [ ] **(c) Shape parity.** Rung 2 and rung 3 report through the same shape, including
      `verifiable` and `mechanism`.
- [ ] Zero runs yet → inactive with `mechanism: 'postmerge-unproven'`.
- [ ] Existing bare-boolean probe fixtures pass unmodified.
- [ ] `npm test` green; `governance-postmerge.yml` unmodified.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Test churn — 36 `postMergeCi` references across `substrate.test.mjs` and `brain-governance-status.test.mjs` inject bare booleans | High | The D4 normalizer is a design requirement, not an option. Fixtures must pass unmodified. |
| `printSubstrateReport` has no rung-3 branch — new fields render nowhere | High | A rung-3 breakdown block is in scope, mirroring rung 1/rung 2. |
| Staleness constant drifts from the workflow's `schedule:` | Med | Drift-guard test is in scope, in the spirit of `release-postmerge-workflows.test.mjs`. |
| Flake sensitivity — a single transient failure flips rung 3 red until the next run | Med | Accepted by decision 4. The asymmetry is deliberate: a spurious red is cheap, a spurious green cost 12 days. |
| #479 interaction — a third inline `gh` call site widens the seam #479 must later close | Med | Design picks one pattern explicitly and notes it so #479 does not inherit a surprise. |
| brain's own reported rung may demote | High | Expected and desired, exactly as in #337. Call it out in the PR body. |

## Deferred to design

1. **Call-site placement**: inline `run('gh', [...])` in `brain-governance-status.mjs`
   (matches today's rung-1/rung-2 GitHub probes) vs. a new GitHub-only, non-contract
   `github.mjs` verb (matches `rerunWorkflowRun`). Both are defensible; the choice must
   be stated, not drifted into, and must be legible to #479.
2. **Exact evidence-object shape** returned by the probe, and how the workflow-absent
   short-circuit composes with it without a needless network call.
3. Whether the run URL rides in `reason` or as a discrete evidence field.

## Rollback

Single-commit revert. The probe is read-only reporting — no data, config, workflow, or
CI mutation. Reverting restores presence-based `active: true`.

## Next step

`sdd-spec` and `sdd-design` (parallelizable). Design owns the three deferred items above.
