// memory-presence.mjs — check that at least one .memory/chunks/ file is in the diff.
// Returns { pass: boolean, reason?: string }.

const CHUNK_PREFIX = '.memory/chunks/';

/**
 * @param {string[]} changedFiles  Paths from `git diff --name-only`.
 * @returns {{ pass: boolean, reason?: string }}
 */
export function memoryPresence(changedFiles) {
  const files = Array.isArray(changedFiles) ? changedFiles : [];
  if (files.some(f => f.startsWith(CHUNK_PREFIX))) return { pass: true };
  return {
    pass: false,
    reason: 'no .memory/chunks/ file found — run brain:save or memory:share before closing',
  };
}
