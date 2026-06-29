// audit-helpers.mjs — Pure helpers extracted from brain-audit.mjs for unit testability.
// These functions contain no I/O or side effects and can be imported safely in tests.

/**
 * Parse a PR number from a merge commit subject line.
 *
 * Tries two patterns in order:
 *   1. GitHub auto-generated merge subject: "Merge pull request #N from ..."
 *   2. Trailing parenthetical notation:     "feat: something (#N)"
 *
 * @param {string} subject  Merge commit subject line.
 * @returns {number|null}   PR number, or null if none found.
 */
export function parsePrNumber(subject) {
  if (typeof subject !== 'string') return null;
  // GitHub auto-generated merge subject
  const mpr = subject.match(/Merge pull request #(\d+)/i);
  if (mpr) return Number(mpr[1]);
  // Squash/manual notation: "feat: something (#42)"
  const mparen = subject.match(/\(#(\d+)\)\s*$/);
  if (mparen) return Number(mparen[1]);
  return null;
}

/**
 * Whether the diff-size check should be skipped because the PR carries the
 * size:exception label.
 *
 * @param {string[]} labels  Label names from the PR.
 * @returns {boolean}
 */
export function shouldSkipSize(labels) {
  return Array.isArray(labels) && labels.includes('size:exception');
}

/**
 * Select the body to run the issueLink check against.
 *
 * Merge commit bodies produced by GitHub are typically the auto-generated
 * "Merge pull request #N from branch" string, which never contains
 * Closes/Part of #N.  Those references live in the PR DESCRIPTION.
 *
 * When a PR description is available (fetched via prView), prefer it over the
 * raw commit body.  Fall back to the commit body when the PR description is
 * absent or empty (VCS unavailable, no PR number found, etc.) so the check
 * still runs best-effort.
 *
 * @param {string} prBody      PR description from prView ('' when unavailable).
 * @param {string} commitBody  Raw `git log -1 --format=%B` output.
 * @returns {string}
 */
export function selectIssueLinkBody(prBody, commitBody) {
  return (typeof prBody === 'string' && prBody.trim()) ? prBody : commitBody;
}

/**
 * Whether a commit sha is "after" (i.e. has the baseline as an ancestor).
 *
 * The `isAncestorFn` seam mirrors `git merge-base --is-ancestor <baseline> <sha>`:
 *   - returns true  → baseline IS ancestor of sha → include sha in the audit
 *   - returns false → baseline is NOT ancestor of sha → skip sha as pre-baseline
 *
 * The seam is injectable so the decision logic can be unit-tested without
 * spawning a real git process.
 *
 * @param {string} baseline   Git ref or tag marking the audit start point.
 * @param {string} sha        Merge commit sha being evaluated.
 * @param {(baseline: string, sha: string) => boolean} isAncestorFn
 * @returns {boolean}  true = sha is after baseline → include in audit
 */
export function isAfterBaseline(baseline, sha, isAncestorFn) {
  return isAncestorFn(baseline, sha);
}
