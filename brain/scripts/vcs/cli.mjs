#!/usr/bin/env node
// brain/scripts/vcs/cli.mjs — vcs.provider dispatcher.
//
// Reads vcs.provider from brain.config.json (or VCS_PROVIDER env override) and
// delegates to ./providers/<provider>.mjs. Mirrors brain/scripts/memory/cli.mjs, but
// the selector is REPO-LEVEL (brain.config.json), not per-dev (.env) — see ADR-0008.
//
// Two usages:
//   - As a library:  import { getVcs } from './vcs/cli.mjs';
//                     const vcs = await getVcs(); await vcs.issueList({ ... });
//   - As a CLI (for .sh callers):
//                     node brain/scripts/vcs/cli.mjs <verb> '<json-args>'
//                     e.g. node brain/scripts/vcs/cli.mjs issue-list '{"state":"open"}'

import { pathToFileURL } from 'node:url';
import { loadBrainConfig } from '../lib/brain-config.mjs';

// The verbs every provider must implement (see vcs-contract.md).
export const VERBS = [
  'authCheck', 'authLogin', 'whoami',
  'issueView', 'issueList', 'mrList', 'prView',
  'commitStatus', 'repoCloneUrl', 'patSetupUrl', 'projectResolve',
];

/**
 * Resolves the active provider name. Pure — takes config + env explicitly so it
 * can be unit-tested. VCS_PROVIDER env wins over brain.config.json (for overrides
 * and CI), then vcs.provider from config.
 * @param {{ config?: object, env?: object }} [opts]
 * @returns {string}
 */
export function resolveProviderName({ config, env = process.env } = {}) {
  const provider = env.VCS_PROVIDER || config?.vcs?.provider;
  if (!provider) {
    throw new Error(
      'vcs: no provider configured. Set "vcs": { "provider": "github" } in ' +
      'brain.config.json (or VCS_PROVIDER in the environment). See ADR-0008.',
    );
  }
  return provider;
}

/**
 * Loads and returns the active provider module (object of verb functions).
 * @param {{ config?: object, env?: object }} [opts]
 * @returns {Promise<object>}
 */
export async function getVcs({ config, env } = {}) {
  const cfg = config ?? loadBrainConfig();
  const name = resolveProviderName({ config: cfg, env });
  // Guard the dynamic import path: provider names are simple identifiers, never
  // path fragments. Rejecting anything else prevents path traversal and yields a
  // clearer error than a generic "module not found".
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error(`vcs: invalid provider name '${name}' — must match [a-z][a-z0-9-]*.`);
  }
  try {
    return await import(new URL(`./providers/${name}.mjs`, import.meta.url));
  } catch (err) {
    throw new Error(
      `vcs: provider '${name}' not found at providers/${name}.mjs — ${err.message}`,
    );
  }
}

const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// ── CLI entry ──────────────────────────────────────────────────────────────────
const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  const verb = kebabToCamel(process.argv[2] ?? '');
  if (!verb) {
    console.error(`vcs: missing <verb>. One of: ${VERBS.join(', ')}`);
    process.exit(1);
  }
  if (!VERBS.includes(verb)) {
    console.error(`vcs: unknown verb '${process.argv[2]}'. One of: ${VERBS.join(', ')}`);
    process.exit(1);
  }
  let args = {};
  if (process.argv[3]) {
    try {
      args = JSON.parse(process.argv[3]);
    } catch (err) {
      console.error(`vcs: args must be JSON — ${err.message}`);
      process.exit(1);
    }
  }
  try {
    const vcs = await getVcs();
    const result = await vcs[verb](args);
    if (result !== undefined) process.stdout.write(JSON.stringify(result) + '\n');
    // Boolean verbs (authCheck/authLogin) map false → non-zero exit so shell
    // callers can branch on the exit code (`if node cli.mjs auth-check …`).
    if (result === false) process.exit(1);
  } catch (err) {
    console.error(`vcs: ${err.message}`);
    process.exit(1);
  }
}
