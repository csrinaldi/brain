// metrics-aggregate.mjs — pure per-period aggregation for brain-metrics
// (issue #324/M9). No I/O: folds already-evaluated merge descriptors (built
// by brain-metrics.mjs from lib/merge-walk.mjs's `evaluateMerge()` plus
// lead-time/detection-job evidence) into per-period rows.
//
// Design D3: `memoryPresence`/`memory-gate` is EXCLUDED from these per-period
// rows — it is repo-global at HEAD (identical for every merge in a run), so a
// per-period column would be a constant masquerading as a series. It is
// reported once, separately, as a repo-level line (brain-metrics.mjs).
//
// Design D5: `enforced = raw − size:exception − net-parity skips`, computed
// from `evaluateMerge()`'s `realResults` (raw, unconditional) vs `surviving`
// (post-exemption) — the SAME exemption decisions brain-audit itself makes,
// never a re-derived copy (Phase 7.4 regression requirement).
//
// decision-gate (adrPresence) is label-conditional (spec): only merges whose
// PR carries the `decision` label contribute to its raw/enforced counts.

import { bucketOf } from './period-bucket.mjs';

/** camelCase check name → kebab-case gate name (matches vcs/governance-checks.mjs REQUIRED_JOBS). */
export const GATE_NAMES = Object.freeze({
  diffSize: 'diff-size',
  issueLink: 'issue-link',
  adrPresence: 'decision-gate',
});

/**
 * The gates rendered as per-period raw/enforced columns. `memory-gate`
 * (memoryPresence) is deliberately absent — design D3.
 */
export const PER_PERIOD_GATES = Object.freeze(['diff-size', 'issue-link', 'decision-gate']);

/** DETECTION_JOBS names (mirrors vcs/governance-checks.mjs — never blocking, no raw/enforced split, D6). */
export const DETECTION_JOB_NAMES = Object.freeze(['phase-order', 'actor-check', 'brain-writes-reviewed']);

function median(numbers) {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** A fresh, empty row accumulator keyed by period bucket string. */
export function emptyRows() {
  return new Map();
}

function newRow(period) {
  return {
    period,
    changesMerged: 0,
    uncomputable: 0,
    leadTimes: [],
    gates: Object.fromEntries(PER_PERIOD_GATES.map((g) => [g, { raw: 0, enforced: 0 }])),
    bypass: { sizeException: 0, skipMemoryGate: 0 },
    // size:exception usage broken down by author (spec's Bypass usage
    // reporting requirement — "by gate, by author, and by period"). Keyed by
    // the label-adding actor's login; an unresolvable actor (labelEvents
    // unavailable, or no matching add event) is bucketed under "unknown" —
    // NEVER dropped, mirroring D2's "count visibly, never hide" discipline.
    bypassByAuthor: {},
    detection: Object.fromEntries(DETECTION_JOB_NAMES.map((j) => [j, { pass: 0, fail: 0 }])),
  };
}

/**
 * Fold one evaluated merge descriptor into `rows` (a Map from `emptyRows()`),
 * returning the (mutated) Map. Every merge counts toward `changesMerged`
 * regardless of kind — a resolved-skip/baseline-skip/uncomputable merge is
 * still a change that merged; it simply contributes no gate signal (brain-audit
 * itself never evaluated it, so metrics has nothing to compare — Phase 7.4).
 *
 * @param {Map<string, object>} rows
 * @param {object} m
 * @param {string} m.sha
 * @param {string} m.mergedAt        ISO merge-commit date (`%cI`).
 * @param {string[]|null} m.prLabels
 * @param {string|null} [m.exceptionAuthor]  Login of the actor who added the
 *   `size:exception` label (resolved from PR labelEvents), or `null` when
 *   unresolvable — folded into "unknown" by-author bucket, never dropped.
 * @param {number|null} m.leadTimeDays
 * @param {'evaluated'|'baseline-skip'|'resolved-skip'|'uncomputable'} m.kind
 * @param {object|null} m.evalRec    lib/merge-walk.mjs `evaluateMerge()` output, iff kind==='evaluated'.
 * @param {Record<string,'pass'|'fail'|null>|null} m.detection  DETECTION_JOBS conclusions (D6, current-state).
 * @param {'month'|'week'} m.period
 * @returns {Map<string, object>}
 */
export function foldMerge(rows, m) {
  const bucket = bucketOf(m.mergedAt, m.period);
  if (!rows.has(bucket)) rows.set(bucket, newRow(bucket));
  const row = rows.get(bucket);

  row.changesMerged += 1;
  if (m.kind === 'uncomputable') {
    row.uncomputable += 1;
    return rows;
  }

  if (typeof m.leadTimeDays === 'number') row.leadTimes.push(m.leadTimeDays);

  const prLabels = Array.isArray(m.prLabels) ? m.prLabels : [];
  if (prLabels.includes('size:exception')) {
    row.bypass.sizeException += 1;
    const author = m.exceptionAuthor ?? 'unknown';
    row.bypassByAuthor[author] = (row.bypassByAuthor[author] ?? 0) + 1;
  }
  if (prLabels.includes('skip:memory-gate')) row.bypass.skipMemoryGate += 1;

  if (m.detection) {
    for (const job of DETECTION_JOB_NAMES) {
      const conclusion = m.detection[job];
      if (conclusion === 'pass') row.detection[job].pass += 1;
      else if (conclusion === 'fail') row.detection[job].fail += 1;
      // null/undefined (uncomputable current-state read) — silently uncounted,
      // never fabricated into pass or fail (D2-style honesty for a non-blocking signal).
    }
  }

  // baseline-skip/resolved-skip merges were never run through evaluateMerge —
  // brain-audit itself skipped them wholesale, so there is no verdict to
  // aggregate (Phase 7.4: metrics must not diverge from brain-audit's own
  // resolution by inventing a result brain-audit never computed).
  if (m.kind !== 'evaluated' || !m.evalRec) return rows;

  const { realResults, surviving, kind: evalKind } = m.evalRec;
  for (const [checkName, gateName] of Object.entries(GATE_NAMES)) {
    if (gateName === 'decision-gate' && !prLabels.includes('decision')) continue;
    const rawFail = !realResults[checkName].pass;
    if (rawFail) row.gates[gateName].raw += 1;
    const enforcedFail = evalKind === 'fail' && surviving.some(([name]) => name === checkName);
    if (enforcedFail) row.gates[gateName].enforced += 1;
  }

  return rows;
}

/**
 * Finalize the accumulated rows: compute each period's median lead time
 * ("N/A" → `null`, rendered by the caller) and return a chronologically
 * sorted array (period keys sort lexicographically for both `YYYY-MM` and
 * `YYYY-Www` — zero-padding guarantees this).
 *
 * @param {Map<string, object>} rows
 * @returns {object[]}
 */
export function finalizeRows(rows) {
  return [...rows.values()]
    .map((row) => ({
      ...row,
      medianLeadTimeDays: median(row.leadTimes),
    }))
    .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
}
