// run-check.mjs — thin git/IO runner wrapping governance's pure checks (design §4).
//
// Usage: node brain/scripts/governance/run-check.mjs <memory-gate|decision-gate>
//
// All decision logic lives in the already-tested pure functions
// (memoryPresence, adrPresence). This file is git/IO glue only:
//   memory-gate    → memoryPresence(readChunkObservations(cwd))
//   decision-gate  → adrPresence(git diff --name-only BASE_SHA...HEAD_SHA)
//
// CI FRAGILITY: BASE_SHA/HEAD_SHA come from the workflow env (design §4), never
// from process.cwd() git state directly — keeps this safe under CI's detached
// HEAD checkout. All I/O is injectable via `deps` so tests never touch the
// real filesystem or spawn a real git process.

import { execFileSync } from 'node:child_process';

import { memoryPresence } from './checks/memory-presence.mjs';
import { adrPresence } from './checks/adr-presence.mjs';
import { readChunkObservations } from '../lib/chunk-reader.mjs';

/**
 * Computes `git diff --name-only $BASE_SHA...$HEAD_SHA` from the workflow env.
 * Returns an empty list (never throws) when BASE_SHA/HEAD_SHA are absent —
 * callers running outside the decision-gate job simply get no diff.
 *
 * @returns {string[]}
 */
function defaultDiffNameOnly() {
  const base = process.env.BASE_SHA;
  const head = process.env.HEAD_SHA;
  if (!base || !head) return [];
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
      encoding: 'utf8',
    });
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Runs a named governance check via its pure function, computing inputs from
 * git/IO (or from injected `deps` in tests).
 *
 * @param {'memory-gate'|'decision-gate'} checkName
 * @param {{ cwd?: string, readChunks?: (cwd: string) => unknown[], diffNameOnly?: () => string[] }} [deps]
 * @returns {{ pass: boolean, reason?: string }}
 */
export function runCheck(checkName, deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const readChunks = deps.readChunks ?? readChunkObservations;
  const diffNameOnly = deps.diffNameOnly ?? defaultDiffNameOnly;

  if (checkName === 'memory-gate') {
    return memoryPresence(readChunks(cwd));
  }
  if (checkName === 'decision-gate') {
    return adrPresence(diffNameOnly());
  }
  throw new Error(`run-check.mjs: unknown check "${checkName}"`);
}

/**
 * Runs the named check, prints the reason (if any), and returns the process
 * exit code — kept separate from `process.exit()` itself so it stays testable.
 *
 * @param {string} checkName
 * @param {object} [deps]
 * @returns {0|1}
 */
export function main(checkName, deps = {}) {
  const result = runCheck(checkName, deps);
  if (result.reason) console.log(result.reason);
  return result.pass ? 0 : 1;
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv[2]));
}
