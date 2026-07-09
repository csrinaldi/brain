// run-check.mjs — thin git/IO runner wrapping governance's pure checks (design §4).
//
// Usage: node brain/scripts/governance/run-check.mjs <memory-gate|decision-gate>
//
// All decision logic lives in the already-tested pure functions
// (memoryPresence, adrPresence). This file is git/IO glue only:
//   memory-gate    → memoryPresence(readChunkObservations(cwd).concat(readRecordObservations(cwd)))
//   decision-gate  → adrPresence(git diff --name-only BASE_SHA...HEAD_SHA)
//
// TRANSITIONAL (issue #222 cutover): session_summary observations may live in
// EITHER `.memory/records/*.jsonl` (the current durable-record format) OR the
// legacy `.memory/chunks/*.jsonl.gz` (engram export transport) — both are
// unioned so the gate passes on either source during this window. Retire the
// chunks-path once it is fully decommissioned (tracked for C4/D1).
//
// CI FRAGILITY: BASE_SHA/HEAD_SHA come from the normalized ci-context seam
// (ADR-0016), never read from process.env directly here — ci-context.mjs is
// the sole module allowed to read pipeline env (a drift-guard test enforces
// this). All I/O is injectable via `deps` so tests never touch the real
// filesystem or spawn a real git process.
//
// FAIL-CLOSED: decision-gate is a REQUIRED gate. If the diff cannot be
// computed (ctx.baseSha/headSha null/uncomputable, or the git command
// throwing), defaultDiffNameOnly() THROWS rather than degrading to `[]` — an
// empty diff would otherwise read as "no architectural change" and let
// adrPresence pass silently. runCheck() catches the throw and fails the gate
// closed instead.

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { memoryPresence } from './checks/memory-presence.mjs';
import { adrPresence } from './checks/adr-presence.mjs';
import { readChunkObservations } from '../lib/chunk-reader.mjs';
import { readRecordObservations } from '../memory/lib/store.mjs';
import { loadContext } from '../vcs/ci-context.mjs';

/**
 * Default `readRecords` dep for the memory-gate (issue #222 cutover fix):
 * best-effort reads `<cwd>/.memory/records/*.jsonl` via the transitional
 * `readRecordObservations`. Never throws — see that function's contract.
 *
 * @param {string} cwd
 * @returns {Array<{type?: string, [key: string]: unknown}>}
 */
function defaultReadRecords(cwd) {
  return readRecordObservations({ recordsDir: join(cwd, '.memory', 'records') });
}

/**
 * Computes `git diff --name-only $baseSha...$headSha` from the normalized
 * ci-context (`ctx.baseSha`/`ctx.headSha`). Throws when either is null/absent
 * or the git command fails — the diff-gate must fail closed rather than
 * silently treat an uncomputable diff as an empty (harmless) one.
 *
 * @param {{ baseSha?: string|null, headSha?: string|null }} ctx
 * @returns {string[]}
 */
function defaultDiffNameOnly(ctx = {}) {
  const base = ctx.baseSha;
  const head = ctx.headSha;
  if (!base || !head) {
    throw new Error('BASE_SHA/HEAD_SHA not set — cannot compute diff');
  }
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
      encoding: 'utf8',
    });
    return out.split('\n').filter(Boolean);
  } catch (err) {
    throw new Error(`git diff failed: ${err.message}`);
  }
}

/**
 * Runs a named governance check via its pure function, computing inputs from
 * git/IO (or from injected `deps` in tests).
 *
 * @param {'memory-gate'|'decision-gate'} checkName
 * @param {{ cwd?: string, ctx?: object, readChunks?: (cwd: string) => unknown[], readRecords?: (cwd: string) => unknown[], diffNameOnly?: () => string[] }} [deps]
 * @returns {{ pass: boolean, reason?: string }}
 */
export function runCheck(checkName, deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const readChunks = deps.readChunks ?? readChunkObservations;
  const readRecords = deps.readRecords ?? defaultReadRecords;
  const ctx = deps.ctx ?? {};
  const diffNameOnly = deps.diffNameOnly ?? (() => defaultDiffNameOnly(ctx));

  if (checkName === 'memory-gate') {
    return memoryPresence(readChunks(cwd).concat(readRecords(cwd)));
  }
  if (checkName === 'decision-gate') {
    let changedFiles;
    try {
      changedFiles = diffNameOnly();
    } catch (err) {
      return {
        pass: false,
        reason: `cannot compute diff — failing closed: ${err.message}`,
      };
    }
    return adrPresence(changedFiles);
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
  const ctx = await loadContext();
  process.exit(main(process.argv[2], { ctx }));
}
