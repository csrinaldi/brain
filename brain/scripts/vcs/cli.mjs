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
import { runAsIdentity } from './lib/identity-context.mjs';
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
// prCommits (issue #358 Q5 Phase 4): READ-only PR/MR commit list, added to
// resolve REQ-L5-1's tiered evidence (lite's distinct-act head-commit
// timestamp; regulated's approver-authored-no-commit check) — see
// providers/github.mjs#prCommits / providers/gitlab.mjs#prCommits.
export const VERBS = [
  'authCheck', 'authLogin', 'whoami',
  'issueView', 'issueList', 'mrList', 'prView', 'mrCreate', 'labelEvents', 'prReviews',
  'commitStatus', 'repoCloneUrl', 'patSetupUrl', 'projectResolve',
  'branchProtect', 'capabilities',
  'prReviewComment', 'issueComment', 'labelAdd', 'labelRemove',
  'prStatusRollup', 'labelList', 'prCommits',
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
 *
 * `identity` (issue #501) BINDS a credential to the returned port: every verb it
 * exposes makes its server calls under that credential. Omitted, resolution is
 * exactly what it is today — gh's ambient login on GitHub, `VCS_TOKEN` on GitLab
 * — so no non-reviewer caller changes behaviour.
 *
 * Bound at the PORT rather than passed per verb, and that is the whole point.
 * GitLab already had a per-verb `token` parameter, at thirteen sites, correct;
 * the reviewer still wrote with the wrong credential because `poster.mjs` never
 * passed one. A parameter a caller may omit is a rule the caller must remember,
 * and `reviewer-protocol.md` §2 requires the opposite: "It must be impossible by
 * construction." Here there is no argument to forget — a verb obtained from a
 * bound port cannot be called unbound, and a verb ADDED tomorrow inherits the
 * binding without knowing it exists.
 *
 * `_import` is a test seam for the dynamic import, so the binding can be driven
 * with a stub provider — the binding under test lives in the wrapper here and is
 * provider-agnostic, and a test that needed a real `gh` could not drive the two
 * DIFFERENT identities the defect only shows under.
 *
 * @param {{ config?: object, env?: object, provider?: string, identity?: string|null,
 *   _import?: (url: URL) => Promise<object> }} [opts]
 * @returns {Promise<object>}
 */
export async function getVcs({ config, env, provider, identity = null, _import } = {}) {
  const cfg = config ?? loadBrainConfig();
  const name = resolveProviderName({ config: cfg, env, provider });
  // Guard the dynamic import path: provider names are simple identifiers, never
  // path fragments. Rejecting anything else prevents path traversal and yields a
  // clearer error than a generic "module not found".
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error(`vcs: invalid provider name '${name}' — must match [a-z][a-z0-9-]*.`);
  }
  let mod;
  try {
    const url = new URL(`./providers/${name}.mjs`, import.meta.url);
    mod = _import ? await _import(url) : await import(url);
  } catch (err) {
    throw new Error(
      `vcs: provider '${name}' not found at providers/${name}.mjs — ${err.message}`,
    );
  }
  if (!identity) return mod;
  return bindIdentity(mod, identity);
}

/**
 * Wraps every FUNCTION export so its call runs inside the identity context. Non
 * -function exports (`PROVIDER`) pass through unchanged.
 *
 * Wrapping is exhaustive by construction — it enumerates the module rather than a
 * list of verb names — because a hand-maintained list is the shape that failed:
 * `whoami` was the one call site that applied the credential, and it stayed the
 * only one for the whole life of #413 while nineteen others did not follow.
 *
 * @param {object} mod
 * @param {string} identity
 * @returns {object}
 */
function bindIdentity(mod, identity) {
  const bound = {};
  for (const [key, value] of Object.entries(mod)) {
    bound[key] =
      typeof value === 'function'
        ? (...args) => runAsIdentity(identity, () => value(...args))
        : value;
  }
  return bound;
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
