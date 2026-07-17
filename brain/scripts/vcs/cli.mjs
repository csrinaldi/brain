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

// The verbs every provider must implement (see vcs-contract.md). Reconciled
// against the "Required verbs" table + provider exports (issue #239 A3 task
// 3.6, design Decision 6) — `mrCreate`/`branchProtect`/`capabilities` were
// implemented by both providers but missing from this array.
// prReviewComment / issueComment / labelAdd / labelRemove (issue #266,
// REQ-266-2): four COMMENT-only write verbs. prReviewComment hardcodes
// event: 'COMMENT' on both providers — no APPROVE code path exists (lock 2,
// REQ-266-3).
// prStatusRollup (ADR-0021 Decision 2): READ-only status-check rollup — no
// write path, no APPROVE path, no label mutation.
export const VERBS = [
  'authCheck', 'authLogin', 'whoami',
  'issueView', 'issueList', 'mrList', 'prView', 'mrCreate', 'labelEvents', 'prReviews',
  'commitStatus', 'repoCloneUrl', 'patSetupUrl', 'projectResolve',
  'branchProtect', 'capabilities',
  'prReviewComment', 'issueComment', 'labelAdd', 'labelRemove',
  'prStatusRollup',
];

/**
 * Resolves the active provider name. Pure — takes config + env explicitly so it
 * can be unit-tested. VCS_PROVIDER env wins over brain.config.json (for overrides
 * and CI), then vcs.provider from config.
 * @param {{ config?: object, env?: object }} [opts]
 * @returns {string}
 */
export function resolveProviderName({ config, env = process.env, provider } = {}) {
  // Precedence: an explicit `provider` (the RUNTIME-detected platform, e.g.
  // ci-context's ctx.provider — finding #14) wins over VCS_PROVIDER env, which
  // wins over config.vcs.provider. A CI job on GitLab must dispatch to the
  // gitlab provider even when this repo's own config says github.
  const resolved = provider || env.VCS_PROVIDER || config?.vcs?.provider;
  if (!resolved) {
    throw new Error(
      'vcs: no provider configured. Set "vcs": { "provider": "github" } in ' +
      'brain.config.json (or VCS_PROVIDER in the environment). See ADR-0008.',
    );
  }
  return resolved;
}

/**
 * Loads and returns the active provider module (object of verb functions).
 * @param {{ config?: object, env?: object }} [opts]
 * @returns {Promise<object>}
 */
export async function getVcs({ config, env, provider } = {}) {
  const cfg = config ?? loadBrainConfig();
  const name = resolveProviderName({ config: cfg, env, provider });
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
