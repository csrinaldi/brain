// issue-link.mjs — check for a GitHub-style issue reference in a commit message or PR body.
// Accepts: Closes|Fixes|Resolves #N (case-insensitive).
// Returns { pass: boolean, reason?: string }.

const ISSUE_RE = /\b(closes|fixes|resolves)\s+#\d+/i;

/**
 * @param {string} body  Commit message or PR description.
 * @returns {{ pass: boolean, reason?: string }}
 */
export function issueLink(body) {
  if (typeof body === 'string' && ISSUE_RE.test(body)) return { pass: true };
  return {
    pass: false,
    reason: 'no issue reference found — body must contain Closes|Fixes|Resolves #N',
  };
}
