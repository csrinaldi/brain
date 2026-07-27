// memory-coverage.mjs — repo-level memory-records coverage snapshot for
// brain-metrics (issue #324/M9). A SINGLE snapshot, never a per-period time
// series (spec "Memory-record coverage" requirement) — the `issue` field's
// adoption is a repo-wide fact, not something that varies merge-to-merge.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { readRecordObservations } from '../memory/lib/store.mjs';

/** Whether a record's `issue` field is populated (non-nullish, non-empty-string). */
function isTagged(record) {
  const issue = record?.issue;
  return issue !== undefined && issue !== null && issue !== '';
}

/**
 * Compute the repo-level memory-records coverage snapshot.
 *
 * `readRecordObservations()` returns `[]` both when `.memory/records/` is
 * absent AND when it is present-but-empty — those are semantically distinct
 * (E2: "unavailable" vs. a genuinely empty adoption), so this checks
 * `existsSync` separately to report the honest caveat.
 *
 * @param {string} cwd
 * @returns {{ available: boolean, total: number, tagged: number, coveragePct: number }}
 */
export function computeMemoryCoverage(cwd) {
  const recordsDir = join(cwd, '.memory', 'records');
  const available = existsSync(recordsDir);
  const records = available ? readRecordObservations({ recordsDir }) : [];
  const total = records.length;
  const tagged = records.filter(isTagged).length;
  const coveragePct = total === 0 ? 0 : Math.round((tagged / total) * 1000) / 10;
  return { available, total, tagged, coveragePct };
}
