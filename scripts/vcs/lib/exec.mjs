// exec.mjs — Thin wrapper around spawnSync with an injectable test seam.
//
// Use `setSpawn` in tests to inject a fake that returns canned output without
// hitting the real CLI. Reset to `spawnSync` in afterEach.

import { spawnSync } from 'node:child_process';

let _spawn = spawnSync;

/** Replace the spawn implementation — used only in tests. */
export function setSpawn(fn) { _spawn = fn; }

/**
 * Runs a command synchronously and returns a normalized result object.
 * @param {string} cmd
 * @param {string[]} args
 * @param {object} opts  Passed through to spawnSync (e.g. `{ input: token }`).
 * @returns {{ ok: boolean, stdout: string, stderr: string, status: number|null }}
 */
export function run(cmd, args = [], opts = {}) {
  const r = _spawn(cmd, args, { encoding: 'utf8', ...opts });
  return { ok: r.status === 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status };
}

/**
 * Like `run`, but parses stdout as JSON. Throws on non-zero exit or bad JSON.
 * @returns {any}
 */
export function runJson(cmd, args = [], opts = {}) {
  const r = run(cmd, args, opts);
  if (!r.ok) throw new Error(`${cmd} ${args.join(' ')} failed (status ${r.status}): ${r.stderr}`);
  try { return JSON.parse(r.stdout); } catch (e) { throw new Error(`${cmd}: invalid JSON — ${e.message}`); }
}
