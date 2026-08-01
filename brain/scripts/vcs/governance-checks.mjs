// governance-checks.mjs — Single source of truth for governance check contexts (S3).
//
// GOVERNANCE_JOBS is the tier-independent full job set that must stay in sync with
// the job name: fields in .github/workflows/governance.yml — every job runs and
// reports at every tier (REQ-TIER-3); only its EXIT POLICY and branch-protection
// membership vary by tier. A drift-guard unit test parses the YAML and asserts the
// set matches — fail-closed.
//
// Two-tier registry (governance v3, design §7), now DERIVED from the tier matrix
// (issue #358 Q5, REQ-TIER-9) instead of two hand-maintained literals:
// `requiredJobs(tier)` (governance-tiers.mjs) replaces the old REQUIRED_JOBS
// constant, and `checkContexts(tier)` derives branch-protection's required-context
// list from the SAME resolution — neither surface may carry an independent copy of
// the matrix (REQ-TIER-9).
//
// REQUIRED_JOBS/DETECTION_JOBS stay exported as backward-compatible aliases,
// computed from requiredJobs('standard') (the default, pre-tier-equivalent tier —
// REQ-TIER-10) so every existing importer (review/evaluators/*, their tests, the
// drift-guard tests below) keeps seeing exactly today's shipped split. New code
// should call requiredJobs(tier)/checkContexts(tier) directly; migrating the
// remaining literal-array importers to the tier-aware call is a tracked follow-up,
// out of scope for #358 phases 1-3.
//
// When adding a job: add a GATE_MATRIX row (governance-tiers.mjs) AND add the job to
// governance.yml in the same commit, or the drift-guard test turns red.

import { requiredJobs } from './governance-tiers.mjs';

/**
 * The full set of job names governance.yml must define — tier-independent
 * (REQ-TIER-3: every job runs at every tier; only its exit policy varies). The
 * drift-guard test asserts the YAML job name: fields equal this set, in this
 * exact order (REQUIRED-today jobs first, then DETECTION-today jobs — mirrors
 * governance.yml's job ordering).
 *
 * @type {string[]}
 */
export const GOVERNANCE_JOBS = [
  'issue-link',
  'diff-size',
  'local-checks',
  'memory-gate',
  'decision-gate',
  'phase-order',
  'actor-check',
  'brain-writes-reviewed',
];

/**
 * Deprecated backward-compatible alias for `requiredJobs('standard')`
 * (governance-tiers.mjs). 'standard' is the default, pre-tier-equivalent
 * doctrine (REQ-TIER-10), so this reproduces exactly what REQUIRED_JOBS was
 * before tiering landed. Prefer `requiredJobs(tier)` in new code.
 *
 * @type {string[]}
 */
export const REQUIRED_JOBS = requiredJobs('standard');

/**
 * Deprecated backward-compatible alias — the GOVERNANCE_JOBS not in
 * REQUIRED_JOBS at the default 'standard' tier. Prefer resolving policy via
 * `resolveGatePolicy(gate, tier)` (governance-tiers.mjs) in new code.
 *
 * @type {string[]}
 */
export const DETECTION_JOBS = GOVERNANCE_JOBS.filter(job => !REQUIRED_JOBS.includes(job));

/**
 * Returns the required GitHub check-run names for branch protection at a tier
 * (REQ-TIER-9 — the SAME resolution `run-check.mjs`'s exit-policy mapping
 * uses, via `governance-tiers.mjs#requiredJobs`).
 *
 * GitHub Actions names a check-run after the job's OWN `name:` field ONLY — the
 * workflow name is a UI grouping label shown next to the check, never part of the
 * check-run's identity that branch protection matches against. A "{workflow.name} /
 * {job.name}" prefix here would produce a required context that no check-run can
 * ever satisfy, silently hard-blocking every PR (issue #203; caught on PR #202
 * despite all REQUIRED_JOBS reporting green). This function derives contexts from
 * requiredJobs(tier) only — the rest of GOVERNANCE_JOBS run and report but never
 * block merge at this tier.
 *
 * @param {'lite'|'standard'|'regulated'} [tier='standard']
 * @returns {string[]}  e.g. ['issue-link', 'diff-size', 'local-checks']
 */
export function checkContexts(tier = 'standard') {
  return [...requiredJobs(tier)];
}

/**
 * Classifies a branch's actual check-run names against the required contexts for
 * the `brain:protect` arm-and-verify step (issue #203, deliverable 3). Warns,
 * never fails: a freshly protected branch legitimately has zero check-runs before
 * its first PR runs, so zero runs collapses to a single "unverifiable" result
 * rather than one warning per required context (which would be noise, not signal).
 *
 * @param {string[]} requiredContexts   e.g. checkContexts()
 * @param {string[]} existingCheckRunNames  check-run names found on the branch's latest commit
 * @returns {{ unverifiable: boolean, missing: string[] }}
 */
export function diffArmedChecks(requiredContexts, existingCheckRunNames) {
  if (existingCheckRunNames.length === 0) {
    return { unverifiable: true, missing: [] };
  }
  return {
    unverifiable: false,
    missing: requiredContexts.filter(context => !existingCheckRunNames.includes(context)),
  };
}
