// identity.mjs — REQ-H1-1: fail-closed reviewer identity gate (protocol §11).
//
// Reads `reviewer: { handle, tokenEnv }` from brain.config.json — the config
// carries the env var NAME, never the token VALUE (issue #266 comment
// 4992662021: "the token is never distributed — the pointer is"). If
// `env[tokenEnv]` is absent, brain:review refuses to run: no cold boot, no
// server call, just the missing variable name, the provider's `patSetupUrl`,
// and the setup doc path. No silent degradation (mirrors
// governance/run-check.mjs's fail-closed discipline).
//
// DI-seam pattern (design.md §3, D1): pure `evaluateIdentity` core +
// `gatherIdentity({ deps })` with `default*` deps + a thin `main(deps={})`.

import { loadBrainConfig } from '../lib/brain-config.mjs';
import { getVcs } from '../vcs/cli.mjs';

export const DEFAULT_TOKEN_ENV = 'BRAIN_REVIEWER_TOKEN';
export const DEFAULT_SETUP_DOC_PATH = 'docs/reviewer-setup.md';

// PAT scopes per provider — used only when the fail-closed path needs to
// print a working "get a token" link (github.mjs / gitlab.mjs's
// `patSetupUrl({ host, name, scopes })`).
const PROVIDER_SCOPES = { github: ['repo'], gitlab: ['api'] };

/**
 * Pure core: resolves the reviewer's identity from config + env, or reports
 * exactly why it cannot. Never touches the network itself — `patSetupUrl` is
 * pre-resolved by the caller.
 *
 * @param {{ reviewerConfig?: {handle?:string, tokenEnv?:string}, env?: object, patSetupUrl?: string|null, setupDocPath?: string }} input
 * @returns {{ ok: true, handle: string|null, token: string } | { ok: false, missingVar: string, patSetupUrl: string|null, setupDocPath: string }}
 */
export function evaluateIdentity({ reviewerConfig = {}, env = {}, patSetupUrl = null, setupDocPath = DEFAULT_SETUP_DOC_PATH } = {}) {
  const tokenEnv = reviewerConfig.tokenEnv || DEFAULT_TOKEN_ENV;
  const token = env[tokenEnv];
  if (!token) {
    return { ok: false, missingVar: tokenEnv, patSetupUrl, setupDocPath };
  }
  return { ok: true, handle: reviewerConfig.handle ?? null, token };
}

async function defaultGetPatUrl({ host }) {
  const vcs = await getVcs();
  const scopes = PROVIDER_SCOPES[vcs.PROVIDER] ?? ['repo'];
  return vcs.patSetupUrl({ host, name: 'brain-reviewer', scopes });
}

/**
 * Gathers evaluateIdentity()'s inputs from brain.config.json + process.env
 * (or from injected `deps` in tests). `getPatUrl` is called ONLY on the
 * failure path — the success path never makes a provider call.
 *
 * @param {{ deps?: { readConfig?: Function, readEnv?: Function, getPatUrl?: Function, setupDocPath?: string, host?: string } }} [opts]
 */
export async function gatherIdentity({ deps = {} } = {}) {
  const readConfig = deps.readConfig ?? (() => loadBrainConfig().reviewer ?? {});
  const readEnv = deps.readEnv ?? (() => process.env);
  const getPatUrl = deps.getPatUrl ?? defaultGetPatUrl;
  const setupDocPath = deps.setupDocPath ?? DEFAULT_SETUP_DOC_PATH;

  const reviewerConfig = readConfig() ?? {};
  const env = readEnv();
  const tokenEnv = reviewerConfig.tokenEnv || DEFAULT_TOKEN_ENV;

  if (env[tokenEnv]) {
    return evaluateIdentity({ reviewerConfig, env, setupDocPath });
  }

  const host = deps.host ?? loadBrainConfig().project?.gitHost ?? 'github.com';
  const patSetupUrl = await getPatUrl({ host });
  return evaluateIdentity({ reviewerConfig, env, patSetupUrl, setupDocPath });
}

/**
 * Runs the gate and prints the fail-closed instructions. Never throws.
 * @param {object} [deps]
 * @returns {Promise<0|1>}
 */
export async function main(deps = {}) {
  const result = await gatherIdentity({ deps });
  if (!result.ok) {
    console.error(`brain:review: refusing to run — env var "${result.missingVar}" is not set.`);
    console.error(`  Get a token: ${result.patSetupUrl}`);
    console.error(`  Setup doc: ${result.setupDocPath}`);
    return 1;
  }
  return 0;
}
