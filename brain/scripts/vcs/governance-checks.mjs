// governance-checks.mjs — Single source of truth for governance check contexts (S3).
//
// REQUIRED_JOBS and DETECTION_JOBS are the canonical names that must stay in sync
// with the job name: fields in .github/workflows/governance.yml. GOVERNANCE_JOBS
// is their union — the full set of jobs the YAML must define. A drift-guard unit test
// parses the YAML and asserts the union matches — fail-closed.
//
// Two-tier registry (governance v3, design §7): a job can run and report
// (DETECTION_JOBS) before it is required at merge (REQUIRED_JOBS). Branch protection
// (via brain:protect / checkContexts()) requires REQUIRED_JOBS only. The
// detection→prevention flip is a one-line move from DETECTION_JOBS to REQUIRED_JOBS —
// no job code changes.
//
// When adding a job: update REQUIRED_JOBS or DETECTION_JOBS here AND add the job to
// governance.yml in the same commit, or the drift-guard test turns red.

/**
 * Load-bearing job names. These become the GitHub check context strings that branch
 * protection requires via checkContexts(). Never edit without also updating
 * governance.yml in the same commit.
 *
 * @type {string[]}
 */
export const REQUIRED_JOBS = ['issue-link', 'diff-size', 'local-checks', 'memory-gate', 'decision-gate'];

/**
 * Detection-only job names. These run and report in governance.yml but are NOT
 * required at merge — they exist to harden a check against false positives before
 * promotion. Promote a job by moving its name from DETECTION_JOBS to REQUIRED_JOBS.
 *
 * @type {string[]}
 */
export const DETECTION_JOBS = ['phase-order', 'actor-check', 'brain-writes-reviewed'];

/**
 * The full set of job names governance.yml must define — the union of REQUIRED_JOBS
 * and DETECTION_JOBS. The drift-guard test asserts the YAML job name: fields equal
 * this set.
 *
 * @type {string[]}
 */
export const GOVERNANCE_JOBS = [...REQUIRED_JOBS, ...DETECTION_JOBS];

/**
 * Returns the required GitHub check-run names for branch protection.
 *
 * GitHub Actions names a check-run after the job's OWN `name:` field ONLY — the
 * workflow name is a UI grouping label shown next to the check, never part of the
 * check-run's identity that branch protection matches against. A "{workflow.name} /
 * {job.name}" prefix here would produce a required context that no check-run can
 * ever satisfy, silently hard-blocking every PR (issue #203; caught on PR #202
 * despite all REQUIRED_JOBS reporting green). This function derives contexts from
 * REQUIRED_JOBS only — DETECTION_JOBS run and report but never block merge.
 *
 * @returns {string[]}  e.g. ['issue-link', 'diff-size', 'local-checks']
 */
export function checkContexts() {
  return [...REQUIRED_JOBS];
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
