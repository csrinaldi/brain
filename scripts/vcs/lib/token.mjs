// token.mjs — Map the active VCS provider to its credential env var and read it.
//
// Credentials live in .env (never in brain.config.json). Each provider uses a
// different env var; this is the single place that mapping lives, so adding a
// provider means adding one entry here.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ENV_BY_PROVIDER = {
  github: 'GITHUB_TOKEN',
  gitlab: 'GITLAB_TOKEN',
};

/** @param {string} provider @returns {string|null} the env var name, or null. */
export function tokenEnvVar(provider) {
  return ENV_BY_PROVIDER[provider] ?? null;
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

/** Reads the credential token for the active provider. */
export function vcsToken(provider, root) {
  const key = tokenEnvVar(provider);
  return key ? readEnvVar(key, root) : null;
}
