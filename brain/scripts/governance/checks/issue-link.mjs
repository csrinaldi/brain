// issue-link.mjs — check for a GitHub-style issue reference in a commit message or PR body.
//
// Accepts two reference patterns (case-insensitive):
//   • Closing reference:  Closes|Fixes|Resolves #N   — used by integration PRs to main
//   • Chain reference:    Part of #N                  — used by slice PRs in a chained-PR flow
//
// Returns { pass: boolean, reason?: string }.

// Closing keywords per GitHub documentation (case-insensitive).
const CLOSING_RE = /\b(closes|fixes|resolves)\s+#\d+/i;
// Chained-PR partial reference: "Part of #N".
const CHAIN_RE = /\bpart\s+of\s+#\d+/i;

/**
 * @param {string} body  Commit message or PR description.
 * @returns {{ pass: boolean, reason?: string }}
 */
export function issueLink(body) {
  if (typeof body === 'string' && (CLOSING_RE.test(body) || CHAIN_RE.test(body))) {
    return { pass: true };
  }
  return {
    pass: false,
    reason: 'no issue reference found — body must contain Closes|Fixes|Resolves #N or Part of #N',
  };
}
