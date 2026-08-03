// identity.mjs — REQ-H1-1: fail-closed reviewer identity gate (protocol §11).
// Reads `reviewer: { handle, tokenEnv }` — config carries the env var NAME,
// never the token VALUE (issue #266 comment 4992662021). Absent
// `env[tokenEnv]` refuses to run before any server call: missing var,
// provider `patSetupUrl`, setup doc path. No silent degradation.
//
// Issue #413: the handle is additionally VERIFIED against the token — a
// `whoami({ token })` port read resolves who the token actually belongs to,
// and a disagreement with `reviewer.handle` refuses the run. Before this the
// handle was taken straight from config, so the §10 self-review abstention
// and the anti-loop lock both compared a CLAIMED identity: an author could
// review their own PR by pointing the token env var at their own token while
// config claimed a bot handle. A verification ERROR also refuses (§10
// "uncomputable evidence" discipline — never proceed on an unverified
// identity). An unset handle skips verification: there is nothing to compare
// against, and cli.mjs's #382 gate refuses that case with its own message.

import { loadBrainConfig } from '../lib/brain-config.mjs';
import { getVcs } from '../vcs/cli.mjs';
import { gitlabApiConfig } from '../vcs/ci-context.mjs';

export const DEFAULT_TOKEN_ENV = 'BRAIN_REVIEWER_TOKEN';
export const DEFAULT_SETUP_DOC_PATH = 'docs/reviewer-setup.md';

const PROVIDER_SCOPES = { github: ['repo'], gitlab: ['api'] }; // for the "get a token" link

/** Pure core: resolves identity from config + env, or reports exactly why it
 * cannot. Never touches the network — `patSetupUrl` is pre-resolved by the caller. */
export function evaluateIdentity({ reviewerConfig = {}, env = {}, patSetupUrl = null, setupDocPath = DEFAULT_SETUP_DOC_PATH } = {}) {
  const tokenEnv = reviewerConfig.tokenEnv || DEFAULT_TOKEN_ENV;
  const token = env[tokenEnv];
  if (!token) return { ok: false, missingVar: tokenEnv, patSetupUrl, setupDocPath };
  return { ok: true, handle: reviewerConfig.handle ?? null, token };
}

/** Pure core of the #413 check: does the token's REAL login match the
 * configured handle? Logins are case-insensitive on both providers, so the
 * comparison folds case — `CsRinaldiBot` and `csrinaldibot` are the same
 * account, and refusing on a case difference would be a false positive. */
export function evaluateVerifiedIdentity({ claimed, actual }) {
  if (!actual) return { verified: false, claimed, actual: actual ?? null };
  return String(claimed).toLowerCase() === String(actual).toLowerCase()
    ? { verified: true, actual }
    : { verified: false, claimed, actual };
}

async function defaultGetPatUrl({ host }) {
  const vcs = await getVcs();
  const scopes = PROVIDER_SCOPES[vcs.PROVIDER] ?? ['repo'];
  return vcs.patSetupUrl({ host, name: 'brain-reviewer', scopes });
}

// Default #413 verifier: the port's `whoami` scoped to the reviewer token.
// GitLab's token path runs over `gitlabApiFetch`, which needs the resolved
// apiBase/proxy — the same `gitlabApiConfig()` wiring cold-boot.mjs uses for
// `prReviews`; GitHub needs only the token (GH_TOKEN precedence).
async function defaultWhoami({ token }) {
  const vcs = await getVcs();
  if (vcs.PROVIDER === 'gitlab') {
    const { apiBase, proxyUrl } = gitlabApiConfig();
    return vcs.whoami({ token, apiBase, proxyUrl });
  }
  return vcs.whoami({ token });
}

/** Gathers evaluateIdentity()'s inputs from config + env (or injected `deps`
 * in tests). `getPatUrl` runs ONLY on the failure path; `whoami` runs ONLY
 * when a token AND a handle are both present (the #413 verification). */
export async function gatherIdentity({ deps = {} } = {}) {
  const readConfig = deps.readConfig ?? (() => loadBrainConfig().reviewer ?? {});
  const readEnv = deps.readEnv ?? (() => process.env);
  const getPatUrl = deps.getPatUrl ?? defaultGetPatUrl;
  const whoami = deps.whoami ?? defaultWhoami;
  const setupDocPath = deps.setupDocPath ?? DEFAULT_SETUP_DOC_PATH;

  const reviewerConfig = readConfig() ?? {};
  const env = readEnv();
  const tokenEnv = reviewerConfig.tokenEnv || DEFAULT_TOKEN_ENV;
  if (!env[tokenEnv]) {
    const host = deps.host ?? loadBrainConfig().project?.gitHost ?? 'github.com';
    const patSetupUrl = await getPatUrl({ host });
    return evaluateIdentity({ reviewerConfig, env, patSetupUrl, setupDocPath });
  }

  const identity = evaluateIdentity({ reviewerConfig, env, setupDocPath });

  // #413 verification — only with a handle to compare against; an unset
  // handle is cli.mjs's #382 refusal, not a verification question.
  if (!identity.handle) return identity;

  let actual;
  try {
    ({ username: actual } = await whoami({ token: identity.token }));
  } catch (err) {
    return { ok: false, verifyError: err.message, tokenEnv, setupDocPath };
  }

  const check = evaluateVerifiedIdentity({ claimed: identity.handle, actual });
  if (!check.verified) {
    return { ok: false, mismatch: { claimed: identity.handle, actual: check.actual }, tokenEnv, setupDocPath };
  }
  return { ...identity, verifiedAs: check.actual };
}

// Runs the gate and prints the fail-closed instructions. Never throws.
export async function main(deps = {}) {
  const result = await gatherIdentity({ deps });
  if (!result.ok) {
    if (result.missingVar) {
      console.error(`brain:review: refusing to run — env var "${result.missingVar}" is not set.`);
      console.error(`  Get a token: ${result.patSetupUrl}`);
      console.error(`  Setup doc: ${result.setupDocPath}`);
    } else if (result.mismatch) {
      console.error(`brain:review: refusing to run — the reviewer token belongs to "${result.mismatch.actual}", but reviewer.handle claims "${result.mismatch.claimed}".`);
      console.error('  §10 abstention and the anti-loop lock would compare a claimed identity, not a real one (issue #413).');
    } else {
      console.error(`brain:review: refusing to run — could not verify the reviewer identity against the token: ${result.verifyError}`);
      console.error('  Never proceed on an unverified identity (§10 fail-closed, issue #413).');
    }
    return 1;
  }
  return 0;
}
