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
 * `enabled` lets a caller that already computed `laneSweepEnabled(config)`
 * (day-start.mjs step 5, to decide whether to print the progress line
 * first) pass that result through instead of this function re-deriving it
 * from `config` a second time. Callers that have not computed it get the
 * same default either way.
 *
 * @param {{ config: object, enabled?: boolean, _spawnSync?: Function }} [args]
 * @returns {{ skipped: boolean, status: number|null, outcome: object|null, unparsed: boolean }}
 */
export function runLaneSweep({ config, enabled = laneSweepEnabled(config), _spawnSync = spawnSync } = {}) {
  if (!enabled) {
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

/**
 * Pure: decides what `day-start.mjs` should render for a `runLaneSweep()`
 * result. Never calls `t()`, never touches I/O, never throws — the wiring
 * this feeds is `warn`/`ok`/nothing, nothing else (#906 cold review C5: the
 * step-5 wiring had zero behavioural coverage, so a `warn` → fatal mutant
 * was invisible; this function is the independently testable decision that
 * wiring is now required to just render, not re-derive).
 *
 * `detailKey`/`detailParams` name an i18n key for the `warn` branch's
 * `{detail}` placeholder rather than a hardcoded English string — `t()`
 * resolves it, in both catalogs, the same as every other user-facing string
 * in this file.
 *
 * @param {{ skipped: boolean, status: number|null, outcome: object|null, unparsed: boolean }} sweep
 * @returns {{ level: 'skip'|'ok'|'warn', key: string|null, params: object }}
 */
export function laneSweepLine(sweep) {
  if (sweep.skipped) {
    return { level: 'skip', key: null, params: {} };
  }
  if (sweep.unparsed) {
    return {
      level: 'warn',
      key: 'day.memory.laneSweep.warn',
      params: { detailKey: 'day.memory.laneSweep.detailUnparsed', detailParams: {} },
    };
  }
  if (sweep.status !== 0) {
    return {
      level: 'warn',
      key: 'day.memory.laneSweep.warn',
      params: {
        detailKey: 'day.memory.laneSweep.detailExitCode',
        detailParams: { status: sweep.status ?? 'unknown' },
      },
    };
  }
  if (sweep.outcome?.pushed) {
    return {
      level: 'ok',
      key: 'day.memory.laneSweep.shipped',
      params: { ref: sweep.outcome.ref ?? '', number: sweep.outcome.pr?.number ?? '?' },
    };
  }
  return { level: 'ok', key: 'day.memory.laneSweep.nothing', params: {} };
}
