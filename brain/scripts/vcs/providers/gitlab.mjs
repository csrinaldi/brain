// gitlab.mjs — GitLab provider (glab CLI + /api/v4). Implements brain/core/methodology/vcs-contract.md.
//
// Reproduces the CURRENT behavior of the harness scripts (parity), so a revert
// leaves the GitLab flow intact. Auth uses the glab session (ensured by day:start);
// the token is only needed by the URL-building verbs, which receive it from the
// caller. All verbs return the NORMALIZED shapes from the contract. GitLab's REST
// API accepts the URL-encoded project path everywhere, so the slug is used directly.

import { run, runJson } from '../lib/exec.mjs';
import { normalizeCommitStatus, providerState, assigneeParams } from '../lib/normalize.mjs';
import { vcsToken } from '../lib/token.mjs';
import { gitlabApiFetch } from '../gitlab-api.mjs';

export const PROVIDER = 'gitlab';

const toQs = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

export async function authCheck({ host }) {
  return run('glab', ['auth', 'status', '--hostname', host]).ok;
}

export async function authLogin({ host, token } = {}) {
  const tok = token ?? vcsToken(PROVIDER);
  return run('glab', ['auth', 'login', '--hostname', host, '--git-protocol', 'https', '--stdin'], { input: tok }).ok;
}

export async function whoami() {
  const resp = runJson('glab', ['api', '/user']);
  return { username: resp.username };
}

// GitLab's API accepts the URL-encoded path everywhere, so the slug is the
// project identifier — projectResolve is the identity, like GitHub.
export async function projectResolve({ project }) {
  return project;
}

/**
 * issueView — DIRECT GitLab API v4 fetch (issue #231 CP-A2b live-validation
 * finding #12), not the `glab` CLI: this verb is CI-consumed (the REQUIRED
 * issue-link gate's defaultFetchIssue, run-check.mjs), and the node:22 CI
 * image has no `glab` binary — the CLI dependency crashed the gate on an
 * INFRA trigger. `apiBase`/`token`/`proxyUrl` are threaded in as parameters
 * from the caller (never read from the GitLab API base URL pipeline var
 * directly here — gitlab.mjs is a GATE_FILE and that read is forbidden by
 * ci-context-drift-guard.test.mjs; the sanctioned resolver is
 * ci-context.mjs's `gitlabApiConfig()`). Defaults exist so LOCAL/non-CI
 * callers (ticket-start.mjs, brain-start.mjs) keep working unchanged: public
 * gitlab.com API base, VCS_TOKEN via the existing `vcsToken()` helper (not a
 * direct env read either — token.mjs already owns that), no proxy.
 *
 * The other GitLab verbs (issueList, mrList, etc.) are NOT migrated — they
 * are local-interactive only (glab session auth), out of this scope (A3
 * territory).
 *
 * @param {{ project: string, number: number, apiBase?: string, token?: string, proxyUrl?: string|null, fetchImpl?: Function }} params
 */
export async function issueView({ project, number, apiBase, token, proxyUrl, fetchImpl } = {}) {
  const encoded = encodeURIComponent(project);
  const r = await gitlabApiFetch({
    apiBase: apiBase ?? 'https://gitlab.com/api/v4',
    token: token ?? vcsToken(PROVIDER),
    proxyUrl: proxyUrl ?? null,
    path: `projects/${encoded}/issues/${number}`,
    fetchImpl,
  });
  return { number: r.iid, title: r.title, labels: r.labels ?? [], body: r.description };
}

/**
 * prView — stub for Phase 3. Returns a graceful empty result so audit callers
 * degrade without error on GitLab repos.
 * @returns {Promise<{ number: number|null, labels: [], body: string }>}
 */
// eslint-disable-next-line no-unused-vars
export async function prView({ project, number } = {}) {
  return { number: number ?? null, labels: [], body: '' };
}

export async function issueList({ project, state = 'open', assignee } = {}) {
  let currentUser;
  if (assignee === 'me') currentUser = (await whoami()).username;
  const encoded = encodeURIComponent(project);
  const assigneePs = assigneeParams('gitlab', assignee, currentUser);
  const extra = Object.keys(assigneePs).length > 0 ? '&' + toQs(assigneePs) : '';
  const endpoint = `projects/${encoded}/issues?state=${providerState('gitlab', state)}&per_page=50${extra}`;
  const arr = runJson('glab', ['api', endpoint]);
  return arr.map(r => ({ number: r.iid, title: r.title, labels: r.labels ?? [] }));
}

export async function mrList({ project, state = 'open' } = {}) {
  const encoded = encodeURIComponent(project);
  const arr = runJson('glab', ['api', `projects/${encoded}/merge_requests?state=${providerState('gitlab', state)}&per_page=50`]);
  return arr.map(r => ({ number: r.iid, title: r.title, headBranch: r.source_branch }));
}

export async function commitStatus({ project, sha }) {
  const encoded = encodeURIComponent(project);
  const arr = runJson('glab', ['api', `projects/${encoded}/commits/${sha}/statuses?per_page=1`]);
  return normalizeCommitStatus('gitlab', arr[0]?.status);
}

export async function repoCloneUrl({ host, project, token }) {
  return `https://oauth2:${token}@${host}/${project}.git`;
}

export async function patSetupUrl({ host, name, scopes }) {
  return `https://${host}/-/user_settings/personal_access_tokens?name=${name}&scopes=${scopes.join(',')}`;
}

/**
 * Apply (or refresh) branch protection on GitLab via the protected branches API.
 * GitLab protected branches are available on all tiers for private repos — no
 * tier block exists unlike GitHub Free.
 *
 * Note: approval-count enforcement (requiredReviews) requires GitLab Premium's
 * approval rules API and is NOT enforced here. The protected branch itself is
 * the hard gate floor.
 *
 * @param {{ project: string, branch?: string, checks?: string[], requiredReviews?: number }}
 * @returns {{ enforced: boolean, reason?: string, remedy?: string }}
 */
export async function branchProtect({ project, branch = 'main', checks, requiredReviews = 1 } = {}) {
  const enc = encodeURIComponent(project);

  // Step 1: Protect the branch (the core hard gate).
  // push_access_level=0 → no direct pushes; everything must go through MRs.
  // merge_access_level=40 → Maintainers can merge.
  // allow_force_push=false → force pushes are blocked.
  const r = run('glab', [
    'api', '-X', 'POST',
    `projects/${enc}/protected_branches`,
    '-f', `name=${branch}`,
    '-f', 'push_access_level=0',
    '-f', 'merge_access_level=40',
    '-f', 'allow_force_push=false',
  ]);

  // Determine whether the branch is now protected (success OR already protected).
  // Match the HTTP status anchored with its `: ` prefix (glab prints "...: 409")
  // so a project slug that happens to contain "409" can't false-positive into
  // claiming the branch is protected when it is not.
  const alreadyProtected = r.stderr.includes(': 409') || /already protected/i.test(r.stderr);
  const isProtected = r.ok || alreadyProtected;

  if (!isProtected) {
    if (r.stderr.includes(': 401') || /unauthorized/i.test(r.stderr)) {
      return {
        enforced: false,
        reason: 'auth',
        remedy: 'authenticate: glab auth login (or set VCS_TOKEN)',
      };
    }
    if (r.stderr.includes(': 403') || /forbidden/i.test(r.stderr)) {
      return {
        enforced: false,
        reason: 'permission',
        remedy: 'requires Maintainer or Owner on the project',
      };
    }
    return {
      enforced: false,
      reason: 'unsupported',
      remedy: r.stderr.trim() || 'unknown error from glab api',
    };
  }

  // Step 2: Best-effort — require green pipelines when checks are provided.
  // Failure here does NOT flip the result; the protected branch is the floor.
  if (Array.isArray(checks) && checks.length > 0) {
    run('glab', ['api', '-X', 'PUT', `projects/${enc}`, '-f', 'only_allow_merge_if_pipeline_succeeds=true']);
  }

  return { enforced: true };
}

// Capability cache — keyed by "project:branch" to avoid cross-test interference.
const _capabilityCache = new Map();

/**
 * Probe the GitLab API to determine whether branch protection APIs are accessible
 * for the given project+branch. Caches the result per project:branch for the
 * lifetime of the Node.js process.
 *
 * GitLab protected branches are free for private repos (no tier restriction),
 * so the result is generally 'available' when auth and permissions are satisfied.
 *
 * @param {{ project?: string, branch?: string }}
 * @returns {{ hardEnforcement: 'available' | 'unavailable' | 'unknown', remedy? }}
 */
export async function capabilities({ project = '', branch = 'main' } = {}) {
  const key = `${project}:${branch}`;
  if (_capabilityCache.has(key)) return _capabilityCache.get(key);

  const enc = encodeURIComponent(project);
  const r = run('glab', ['api', `projects/${enc}/protected_branches`]);

  let result;
  if (r.ok) {
    result = { hardEnforcement: 'available' };
  } else if (r.stderr.includes(': 401') || /unauthorized/i.test(r.stderr)) {
    result = { hardEnforcement: 'unavailable', remedy: 'authenticate (glab auth login / VCS_TOKEN)' };
  } else if (r.stderr.includes(': 403') || /forbidden/i.test(r.stderr)) {
    result = { hardEnforcement: 'unavailable', remedy: 'requires Maintainer on the project' };
  } else {
    result = { hardEnforcement: 'unknown', detail: r.stderr.trim() || 'unexpected error from glab api' };
  }

  _capabilityCache.set(key, result);
  return result;
}

/**
 * Create a merge request — stub for Phase 3.
 * Returns { url: null, error: string } so callers degrade gracefully.
 */
// eslint-disable-next-line no-unused-vars
export async function mrCreate({ project, title, body, head, base, labels } = {}) {
  return { url: null, error: 'gitlab.mrCreate: not yet implemented (Phase 3)' };
}
