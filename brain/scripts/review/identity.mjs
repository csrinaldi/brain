// identity.mjs — REQ-H1-1: fail-closed reviewer identity gate (protocol §11).
// Reads `reviewer: { handle, tokenEnv }` — config carries the env var NAME,
// never the token VALUE (issue #266 comment 4992662021). Absent
// `env[tokenEnv]` refuses to run before any server call: missing var,
// provider `patSetupUrl`, setup doc path. No silent degradation.

import { loadBrainConfig } from '../lib/brain-config.mjs';
import { getVcs } from '../vcs/cli.mjs';

export const DEFAULT_TOKEN_ENV = 'BRAIN_REVIEWER_TOKEN';
export const DEFAULT_SETUP_DOC_PATH = 'docs/reviewer-setup.md';

// PAT scopes per provider, used only to print a "get a token" link
// (github.mjs / gitlab.mjs's `patSetupUrl({ host, name, scopes })`).
const PROVIDER_SCOPES = { github: ['repo'], gitlab: ['api'] };

/** Pure core: resolves identity from config + env, or reports exactly why it
 * cannot. Never touches the network — `patSetupUrl` is pre-resolved by the caller. */
export function evaluateIdentity({ reviewerConfig = {}, env = {}, patSetupUrl = null, setupDocPath = DEFAULT_SETUP_DOC_PATH } = {}) {
  const tokenEnv = reviewerConfig.tokenEnv || DEFAULT_TOKEN_ENV;
  const token = env[tokenEnv];
  if (!token) return { ok: false, missingVar: tokenEnv, patSetupUrl, setupDocPath };
  return { ok: true, handle: reviewerConfig.handle ?? null, token };
}

async function defaultGetPatUrl({ host }) {
  const vcs = await getVcs();
  const scopes = PROVIDER_SCOPES[vcs.PROVIDER] ?? ['repo'];
  return vcs.patSetupUrl({ host, name: 'brain-reviewer', scopes });
}

/** Gathers evaluateIdentity()'s inputs from config + env (or injected `deps`
 * in tests). `getPatUrl` runs ONLY on the failure path. */
export async function gatherIdentity({ deps = {} } = {}) {
  const readConfig = deps.readConfig ?? (() => loadBrainConfig().reviewer ?? {});
  const readEnv = deps.readEnv ?? (() => process.env);
  const getPatUrl = deps.getPatUrl ?? defaultGetPatUrl;
  const setupDocPath = deps.setupDocPath ?? DEFAULT_SETUP_DOC_PATH;

  const reviewerConfig = readConfig() ?? {};
  const env = readEnv();
  const tokenEnv = reviewerConfig.tokenEnv || DEFAULT_TOKEN_ENV;
  if (env[tokenEnv]) return evaluateIdentity({ reviewerConfig, env, setupDocPath });

  const host = deps.host ?? loadBrainConfig().project?.gitHost ?? 'github.com';
  const patSetupUrl = await getPatUrl({ host });
  return evaluateIdentity({ reviewerConfig, env, patSetupUrl, setupDocPath });
}

/** Runs the gate and prints the fail-closed instructions. Never throws. */
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
