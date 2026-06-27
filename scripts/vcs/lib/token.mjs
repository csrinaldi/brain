// token.mjs — Read the VCS credential env var (VCS_TOKEN) from .env or process.env.
//
// Credentials live in .env (never in brain.config.json). A single generic env
// var, VCS_TOKEN, is used regardless of the active provider (ADR-0007 / issue #33).
// The provider parameter is kept in all exported signatures for source compatibility
// with callers that pass it, but it is no longer used to select a var name.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The single env var name used for VCS credentials across all providers. */
const VCS_TOKEN_KEY = 'VCS_TOKEN';

/**
 * Returns the env var name that holds the VCS token.
 * The provider argument is accepted for source compatibility but is ignored —
 * all providers use the same generic VCS_TOKEN variable.
 *
 * @param {string} _provider  (unused)
 * @returns {string}
 */
export function tokenEnvVar(_provider) {
  return VCS_TOKEN_KEY;
}

/** Reads a var from .env (falling back to process.env). */
export function readEnvVar(key, root = process.cwd()) {
  try {
    const line = readFileSync(join(root, '.env'), 'utf8')
      .split('\n')
      .find(l => l.startsWith(`${key}=`));
    if (line) return line.slice(key.length + 1).trim();
  } catch { /* no .env — fall through */ }
  return process.env[key] ?? null;
}

/** Reads the credential token for the active provider from VCS_TOKEN. */
export function vcsToken(provider, root) {
  return readEnvVar(tokenEnvVar(provider), root);
}
