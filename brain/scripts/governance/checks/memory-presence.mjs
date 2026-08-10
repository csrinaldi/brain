// memory-presence.mjs — check that committed .memory/ contains a session_summary record.
// Returns { pass: boolean, reason?: string }.
//
// This is an existence check decoupled from the merge diff: brain-audit reads the
// working-tree records once (before the merge loop, via `readRecordObservations`) and
// passes the collected observations to this function.  The check is therefore the same
// for every merge in a run — it verifies that the repo has AT LEAST ONE session summary
// captured, EVER.
//
// SCOPE, stated because its name and its position invite a stronger reading (issue #519).
// This does NOT verify that the change under review captured anything. `.memory/` held
// 205 session summaries while going six days without a single new record, and this gate
// was green on every PR in that window — correctly, by the definition above. The PR
// template's "Memory materialized before closing" is a per-change promise; this check is
// repo-scoped, and the two are not the same statement.
//
// Whether the gate SHOULD be able to tell is an open ruling on #519, deliberately not
// pre-empted here. What is closed is the silence: `brain:session:start` now reports the
// newest record's age, so a memory layer that stops being written says so.
//
// The path in this header used to read `.memory/chunks/*.jsonl.gz`. That directory no
// longer exists — the C4 migration (#247) moved the durable layer to `.memory/records/`
// and the reader followed; only this comment did not.

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
