// governance-checks.mjs — Single source of truth for governance check contexts (S3).
//
// WORKFLOW_NAME and GOVERNANCE_JOBS are the canonical names that must stay in
// sync with the job name: fields in .github/workflows/governance.yml. Both branch
// protection (via brain:protect) and the YAML derive from this constant. A
// drift-guard unit test parses the YAML and asserts they match — fail-closed.
//
// S2-state: issue-link + diff-size. Extended in S4 to add memory-gate + decision-gate.
// When adding a job in S4: update GOVERNANCE_JOBS here AND add the job to governance.yml
// in the same commit, or the drift-guard test turns red.

/** The GitHub Actions workflow name. Used as the prefix in check contexts: "{name} / {job}". */
export const WORKFLOW_NAME = 'governance';

/**
 * Load-bearing job names (S2-state). These become the GitHub check context strings
 * that branch protection requires. Never edit without also updating governance.yml.
 *
 * @type {string[]}
 */
export const GOVERNANCE_JOBS = ['issue-link', 'diff-size'];

/**
 * Returns the required GitHub check context strings for branch protection.
 *
 * GitHub names workflow job checks as "{workflow.name} / {job.name}". Both values
 * come from the YAML name: fields. This function derives context strings from the
 * single source of truth so callers (brain:protect) and the YAML always agree.
 *
 * @returns {string[]}  e.g. ['governance / issue-link', 'governance / diff-size']
 */
export function checkContexts() {
  return GOVERNANCE_JOBS.map(job => `${WORKFLOW_NAME} / ${job}`);
}
