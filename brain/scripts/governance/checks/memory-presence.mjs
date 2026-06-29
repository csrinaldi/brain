// memory-presence.mjs — check that committed .memory/chunks/ contains a session_summary observation.
// Returns { pass: boolean, reason?: string }.
//
// This is an existence check decoupled from the merge diff: brain-audit reads the
// working-tree .memory/chunks/*.jsonl.gz once (before the merge loop) and passes the
// collected observations to this function.  The check is therefore the same for every
// merge in a run — it verifies that the repo has AT LEAST ONE session summary captured.

/**
 * Verify that at least one session_summary observation exists in the committed
 * .memory/chunks/ directory.
 *
 * BRITTLE EXTERNAL DEPENDENCY: the shape of `observations` items is determined by
 * engram's export format (.memory/chunks/*.jsonl.gz).  Each item is expected to have
 * at least `{ id, type, title, content, ... }`.  If engram changes its schema,
 * this check may silently pass or fail unexpectedly.
 *
 * @param {Array<{type: string, [key: string]: unknown}>} observations
 *   Parsed observation objects extracted from committed .memory/chunks/*.jsonl.gz files
 *   by brain-audit before the merge loop.  A non-array is treated as empty (→ fail).
 * @returns {{ pass: boolean, reason?: string }}
 */
export function memoryPresence(observations) {
  const obs = Array.isArray(observations) ? observations : [];
  if (obs.some(o => o?.type === 'session_summary')) return { pass: true };
  return {
    pass: false,
    reason: 'no session_summary observation found in committed .memory/ — capture a session summary (mem_session_summary / brain:save) before closing',
  };
}
