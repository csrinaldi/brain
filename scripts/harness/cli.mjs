#!/usr/bin/env node
// scripts/harness/cli.mjs — SDD_HARNESS dispatcher.
//
// Usage: node scripts/harness/cli.mjs <op>
//   op: init
//
// Reads SDD_HARNESS from the environment or .env (default: gentle-ai).
// Imports the corresponding backend from ./backends/<harness>.mjs and
// dispatches the requested operation.
//
// Mirrors scripts/memory/cli.mjs exactly (ADR-0012).
// See also: ADR-0005 (original inline binding), ADR-0012 (this refactor).

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

// ---------------------------------------------------------------------------
// Read SDD_HARNESS: env var > .env file > default 'gentle-ai'
// ---------------------------------------------------------------------------
function readEnvFile(root = repoRoot) {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return {};
  const vars = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return vars;
}

/**
 * Resolves the active harness name.
 * Pure — takes env + envVars explicitly so it can be unit-tested without side effects.
 * SDD_HARNESS env var wins over .env file value; default is 'gentle-ai'.
 *
 * @param {{ env?: object, envVars?: object }} [opts]
 * @returns {string}
 */
export function resolveHarness({ env = process.env, envVars = {} } = {}) {
  return env.SDD_HARNESS ?? envVars.SDD_HARNESS ?? 'gentle-ai';
}

// ---------------------------------------------------------------------------
// Valid ops
// ---------------------------------------------------------------------------
export const VALID_OPS = ['init'];

// Normalize hyphenated op to camelCase function name.
// e.g. 'feature-checkpoint' → 'featureCheckpoint'
const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// ---------------------------------------------------------------------------
// Backend loader (injectable seam for testing)
// ---------------------------------------------------------------------------
async function defaultBackendLoader(harness) {
  const url = new URL(`./backends/${harness}.mjs`, import.meta.url);
  try {
    return await import(url);
  } catch (err) {
    throw new Error(
      `harness/cli: backend '${harness}' not found at ${url.pathname} — ${err.message}`,
    );
  }
}

/**
 * Dispatch an op to the resolved harness backend.
 *
 * @param {string} harness       The harness name (e.g. 'gentle-ai').
 * @param {string} op            The operation to run (e.g. 'init').
 * @param {string[]} [args]      Extra positional args forwarded to the backend function.
 * @param {{ backendLoader?: (harness: string) => Promise<object> }} [opts]
 *   Injectable backend factory — defaults to a real ESM dynamic import.
 *   Tests pass in a fake loader to avoid touching real backends.
 * @returns {Promise<void>}
 * @throws {Error} if the op is unknown, the backend is not found, or the
 *   backend does not implement the requested op.
 */
export async function dispatch(harness, op, args = [], { backendLoader = defaultBackendLoader } = {}) {
  if (!VALID_OPS.includes(op)) {
    throw new Error(
      `harness/cli: unknown op '${op}'. Valid ops: ${VALID_OPS.join(', ')}`,
    );
  }

  const fn = kebabToCamel(op);
  const backend = await backendLoader(harness);

  if (typeof backend[fn] !== 'function') {
    throw new Error(
      `harness/cli: backend '${harness}' does not implement op '${op}'`,
    );
  }

  await backend[fn](...args);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  const envVars = readEnvFile();
  const harness = resolveHarness({ env: process.env, envVars });

  const op = process.argv[2];
  if (!op) {
    console.error(`harness/cli: missing <op>. Valid ops: ${VALID_OPS.join(', ')}`);
    process.exit(1);
  }

  if (!VALID_OPS.includes(op)) {
    console.error(`harness/cli: unknown op '${op}'. Valid ops: ${VALID_OPS.join(', ')}`);
    process.exit(1);
  }

  try {
    await dispatch(harness, op, process.argv.slice(3));
  } catch (err) {
    console.error(`harness/cli: ${harness}.${op}() failed — ${err.message}`);
    process.exit(1);
  }
}
