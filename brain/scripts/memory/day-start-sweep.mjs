// brain/scripts/memory/day-start-sweep.mjs — the synchronous day:start lane
// sweep (#906, design.md A7). Sibling of session-end-ship.mjs's detaching
// launcher: this one WAITS and REPORTS, with its OWN timeout — day-start.mjs's
// `run()` (used for the surrounding steps) passes none, so a hung `gh` call
// there would hang the whole day start. This module never inherits that gap.
//
// Never throws: a non-zero `ship` exit or an unparseable `--json` line comes
// back as data on the returned outcome, so the caller (day-start.mjs step 5)
// can warn without ever failing the run.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI_PATH = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

/** Pure: is the lane sweep armed? Absent or false reads as false — same rule as the launcher. */
export function laneSweepEnabled(config) {
  return config?.memory?.lane?.enabled === true;
}

/**
 * Runs `memory/cli.mjs ship --json` synchronously, with a 60s timeout this
 * module owns outright, and parses its single stdout line.
 *
 * @param {{ config: object, _spawnSync?: Function }} [args]
 * @returns {{ skipped: boolean, status: number|null, outcome: object|null, unparsed: boolean }}
 */
export function runLaneSweep({ config, _spawnSync = spawnSync } = {}) {
  if (!laneSweepEnabled(config)) {
    return { skipped: true, status: null, outcome: null, unparsed: false };
  }

  const result = _spawnSync(
    process.execPath,
    [CLI_PATH, 'ship', '--json'],
    { cwd: REPO_ROOT, encoding: 'utf8', timeout: 60_000 },
  );

  const status = result.status ?? null;
  const line = (result.stdout ?? '').trim();

  if (!line) {
    return { skipped: false, status, outcome: null, unparsed: false };
  }

  try {
    return { skipped: false, status, outcome: JSON.parse(line), unparsed: false };
  } catch {
    return { skipped: false, status, outcome: null, unparsed: true };
  }
}
