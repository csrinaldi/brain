// governance-checks.mjs — Single source of truth for governance check contexts (S3).
//
// WORKFLOW_NAME, REQUIRED_JOBS, and DETECTION_JOBS are the canonical names that must
// stay in sync with the job name: fields in .github/workflows/governance.yml. GOVERNANCE_JOBS
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

/** The GitHub Actions workflow name. Used as the prefix in check contexts: "{name} / {job}". */
export const WORKFLOW_NAME = 'governance';

/**
 * Load-bearing job names. These become the GitHub check context strings that branch
 * protection requires via checkContexts(). Never edit without also updating
 * governance.yml in the same commit.
 *
 * @type {string[]}
 */
export const REQUIRED_JOBS = ['issue-link', 'diff-size', 'local-checks'];

/**
 * Detection-only job names. These run and report in governance.yml but are NOT
 * required at merge — they exist to harden a check against false positives before
 * promotion. Promote a job by moving its name from DETECTION_JOBS to REQUIRED_JOBS.
 *
 * @type {string[]}
 */
export const DETECTION_JOBS = [];

/**
 * The full set of job names governance.yml must define — the union of REQUIRED_JOBS
 * and DETECTION_JOBS. The drift-guard test asserts the YAML job name: fields equal
 * this set.
 *
 * @type {string[]}
 */
export const GOVERNANCE_JOBS = [...REQUIRED_JOBS, ...DETECTION_JOBS];

/**
 * Returns the required GitHub check context strings for branch protection.
 *
 * GitHub names workflow job checks as "{workflow.name} / {job.name}". Both values
 * come from the YAML name: fields. This function derives context strings from
 * REQUIRED_JOBS only — DETECTION_JOBS run and report but never block merge.
 *
 * @returns {string[]}  e.g. ['governance / issue-link', 'governance / diff-size', 'governance / local-checks']
 */
export function checkContexts() {
  return REQUIRED_JOBS.map(job => `${WORKFLOW_NAME} / ${job}`);
}
