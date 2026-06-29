// adr-presence.mjs — check ADR file + brain/HOME.md are consistently updated.
// If neither is present the PR has no ADR requirement → pass (no false-positive).
// Returns { pass: boolean, reason?: string }.

const ADR_RE = /^brain\/project\/decisions\/adr-\d+-.+\.md$/;
const HOME = 'brain/HOME.md';

/**
 * @param {string[]} changedFiles  Paths from `git diff --name-only`.
 * @returns {{ pass: boolean, reason?: string }}
 */
export function adrPresence(changedFiles) {
  const files = Array.isArray(changedFiles) ? changedFiles : [];
  const hasAdr = files.some(f => ADR_RE.test(f));
  const hasHome = files.includes(HOME);
  if (!hasAdr && !hasHome) return { pass: true };
  if (hasAdr && hasHome) return { pass: true };
  if (hasAdr) return { pass: false, reason: 'ADR file added but brain/HOME.md was not updated' };
  return { pass: false, reason: 'brain/HOME.md changed but no ADR file found — missing decision doc?' };
}
