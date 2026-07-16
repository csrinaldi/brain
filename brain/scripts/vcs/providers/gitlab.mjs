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
  return {
    number: r.iid,
    title: r.title,
    labels: r.labels ?? [],
    body: r.description,
    // `author` (issue #239 A3 TASK1): actor-check.mjs's REQ-L5-1 compares the
    // approval actor against BOTH the PR author and the issue author — the
    // same API call already carries `author.username`, no extra round-trip.
    author: r.author?.username ?? null,
  };
}

/**
 * prView — DIRECT GitLab API v4 fetch (issue #239 A3 Phase 2, un-stubbing
 * REQ-A3-4) over `GET /projects/:id/merge_requests/:iid`, via the shared
 * `gitlabApiFetch` transport — the same discipline as `issueView`. Normalizes
 * `iid`/`description`/`author.username` to `number`/`body`/`author`.
 *
 * `{ apiBase, token, proxyUrl }` are threaded in as PARAMETERS from the
 * caller (`gitlabApiConfig()`), never read from pipeline env directly here —
 * this file is a GATE_FILE (drift-guard forbids it). Defaults exist so
 * LOCAL/non-CI callers keep working unchanged: public gitlab.com API base,
 * `vcsToken()`, no proxy.
 *
 * Never throws: a fetch failure is caught and normalized to
 * `{ number, labels: null, body: null, author: null }` (uncomputable) —
 * never a fabricated empty `[]`/`''`, matching the `github.prView` contract.
 *
 * Body-parity (issue #239 A3 Phase 3 task 3.7): `null` means uncomputable
 * (the fetch itself failed — the `catch` branch below); `''` means the fetch
 * SUCCEEDED and the underlying `description` was genuinely empty. `?? ''` on
 * the success path aligns this with `github.mjs#prView`, which already
 * normalized this way — pre-A3-Phase-3 this branch returned bare
 * `r.description` (`null`/`undefined` when GitLab omits it), indistinguishable
 * from the failure case above.
 *
 * @param {{ project: string, number: number, apiBase?: string, token?: string, proxyUrl?: string|null, fetchImpl?: Function }} params
 * @returns {Promise<{ number: number, labels: string[]|null, body: string|null, author: string|null }>}
 */
export async function prView({ project, number, apiBase, token, proxyUrl, fetchImpl } = {}) {
  const encoded = encodeURIComponent(project);
  try {
    const r = await gitlabApiFetch({
      apiBase: apiBase ?? 'https://gitlab.com/api/v4',
      token: token ?? vcsToken(PROVIDER),
      proxyUrl: proxyUrl ?? null,
      path: `projects/${encoded}/merge_requests/${number}`,
      fetchImpl,
    });
    return {
      number: r.iid,
      labels: r.labels ?? [],
      body: r.description ?? '',
      author: r.author?.username ?? null,
    };
  } catch {
    return { number, labels: null, body: null, author: null };
  }
}

/**
 * labelEvents — the provider-agnostic `labelEvents` CONTRACT verb (issue
 * #239 A3, D1) over GitLab's resource-label-events API (`GET
 * /projects/:id/issues/:iid/resource_label_events`), via the shared
 * `gitlabApiFetch` transport (never a second hand-rolled fetch). Normalizes
 * `user.username` → `actor.login`, native `action` (`'add'|'remove'`) passes
 * through, `label.name` → `label`, `created_at` → `at`; ascending by `at`.
 *
 * `{ apiBase, token, proxyUrl }` are threaded in as PARAMETERS from the
 * caller (`gitlabApiConfig()`), exactly like `issueView` — this file is a
 * GATE_FILE and never reads pipeline env directly. Never throws: a fetch
 * failure is caught and normalized to `null` (uncomputable) — never a
 * fabricated `[]`.
 *
 * @param {{ project: string, number: number, apiBase?: string, token?: string, proxyUrl?: string|null, fetchImpl?: Function }} params
 * @returns {Promise<Array<{ actor: { login: string }, action: 'add'|'remove', label: string, at: string }>|null>}
 */
export async function labelEvents({ project, number, apiBase, token, proxyUrl, fetchImpl } = {}) {
  const encoded = encodeURIComponent(project);
  let events;
  try {
    events = await gitlabApiFetch({
      apiBase: apiBase ?? 'https://gitlab.com/api/v4',
      token: token ?? vcsToken(PROVIDER),
      proxyUrl: proxyUrl ?? null,
      path: `projects/${encoded}/issues/${number}/resource_label_events`,
      fetchImpl,
    });
  } catch {
    return null;
  }
  return events
    .map(e => ({
      actor: { login: e.user?.username },
      action: e.action,
      label: e.label?.name,
      at: e.created_at,
    }))
    .sort((a, b) => new Date(a.at) - new Date(b.at));
}

/**
 * prReviews — the provider-agnostic `prReviews` CONTRACT verb (issue #239
 * A3 TASK2/4th-violation fix) over GitLab's approvals API (`GET
 * /projects/:id/merge_requests/:iid/approvals`), via the shared
 * `gitlabApiFetch` transport. GitLab has no per-reviewer review-STATE
 * history like GitHub's Reviews API (COMMENTED/CHANGES_REQUESTED/APPROVED)
 * — approvals is the closest analog, so each entry in `approved_by`
 * normalizes to one `{ state: 'APPROVED', author }` entry, matching exactly
 * what `evaluateBrainWritesReviewed` consumes (only `state === 'APPROVED'`
 * counts toward approvers; a genuinely empty `approved_by` list still warns
 * via the pure evaluator's existing "no reviews at all" branch — the same
 * DETECTION outcome, not a fabricated distinction).
 *
 * `{ apiBase, token, proxyUrl }` are threaded in as PARAMETERS from the
 * caller (`gitlabApiConfig()`), exactly like `issueView`/`labelEvents` —
 * this file is a GATE_FILE and never reads pipeline env directly. Never
 * throws: a fetch failure is caught and normalized to `null` (uncomputable)
 * — never a fabricated `[]`.
 *
 * @param {{ project: string, number: number, apiBase?: string, token?: string, proxyUrl?: string|null, fetchImpl?: Function }} params
 * @returns {Promise<Array<{ state: 'APPROVED', author: string }>|null>}
 */
export async function prReviews({ project, number, apiBase, token, proxyUrl, fetchImpl } = {}) {
  const encoded = encodeURIComponent(project);
  let data;
  try {
    data = await gitlabApiFetch({
      apiBase: apiBase ?? 'https://gitlab.com/api/v4',
      token: token ?? vcsToken(PROVIDER),
      proxyUrl: proxyUrl ?? null,
      path: `projects/${encoded}/merge_requests/${number}/approvals`,
      fetchImpl,
    });
  } catch {
    return null;
  }
  return (data.approved_by ?? []).map(a => ({ state: 'APPROVED', author: a.user?.username ?? null }));
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

/**
 * Posts a COMMENT-state merge request review (issue #266, REQ-266-2).
 * GitLab's notes API has no review-event concept (APPROVE/COMMENT/REQUEST
 * CHANGES) — a plain note is posted, which structurally cannot become an
 * approval either (lock 2, REQ-266-3: no such code path exists on this
 * provider). The API response carries no `web_url`, so the display url is
 * derived from `apiBase` (stripping the trailing `/api/v4`). Never throws.
 *
 * @param {{ project: string, number: number, body: string, apiBase?: string, token?: string, proxyUrl?: string|null, fetchImpl?: Function }} params
 * @returns {Promise<{ url: string } | { url: null, error: string }>}
 */
export async function prReviewComment({ project, number, body, apiBase, token, proxyUrl, fetchImpl } = {}) {
  const base = apiBase ?? 'https://gitlab.com/api/v4';
  const encoded = encodeURIComponent(project);
  try {
    const r = await gitlabApiFetch({
      apiBase: base,
      token: token ?? vcsToken(PROVIDER),
      proxyUrl: proxyUrl ?? null,
      path: `projects/${encoded}/merge_requests/${number}/notes`,
      method: 'POST',
      body: { body },
      fetchImpl,
    });
    return { url: `${base.replace(/\/api\/v4\/?$/, '')}/${project}/-/merge_requests/${number}#note_${r.id}` };
  } catch (err) {
    return { url: null, error: err.message };
  }
}

/**
 * Posts a plain issue comment — rulings on issues (issue #266, REQ-266-2).
 * Never throws.
 *
 * @param {{ project: string, number: number, body: string, apiBase?: string, token?: string, proxyUrl?: string|null, fetchImpl?: Function }} params
 * @returns {Promise<{ url: string } | { url: null, error: string }>}
 */
export async function issueComment({ project, number, body, apiBase, token, proxyUrl, fetchImpl } = {}) {
  const base = apiBase ?? 'https://gitlab.com/api/v4';
  const encoded = encodeURIComponent(project);
  try {
    const r = await gitlabApiFetch({
      apiBase: base,
      token: token ?? vcsToken(PROVIDER),
      proxyUrl: proxyUrl ?? null,
      path: `projects/${encoded}/issues/${number}/notes`,
      method: 'POST',
      body: { body },
      fetchImpl,
    });
    return { url: `${base.replace(/\/api\/v4\/?$/, '')}/${project}/-/issues/${number}#note_${r.id}` };
  } catch (err) {
    return { url: null, error: err.message };
  }
}

/**
 * Adds labels to an issue (issue #266, REQ-266-2). Targets the issues
 * endpoint, matching `labelEvents`' issues-only precedent on this provider.
 * The CALLER enforces the deny-set (REQ-266-9, monotonic label tightening) —
 * this verb performs the label API call only, no policy. Never throws.
 *
 * @param {{ project: string, number: number, labels: string[], apiBase?: string, token?: string, proxyUrl?: string|null, fetchImpl?: Function }} params
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function labelAdd({ project, number, labels, apiBase, token, proxyUrl, fetchImpl } = {}) {
  const encoded = encodeURIComponent(project);
  try {
    await gitlabApiFetch({
      apiBase: apiBase ?? 'https://gitlab.com/api/v4',
      token: token ?? vcsToken(PROVIDER),
      proxyUrl: proxyUrl ?? null,
      path: `projects/${encoded}/issues/${number}`,
      method: 'PUT',
      body: { add_labels: labels.join(',') },
      fetchImpl,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Removes labels from an issue — monotonic-tightening removals only (issue
 * #266, REQ-266-9); the caller enforces the deny-set. Never throws.
 *
 * @param {{ project: string, number: number, labels: string[], apiBase?: string, token?: string, proxyUrl?: string|null, fetchImpl?: Function }} params
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function labelRemove({ project, number, labels, apiBase, token, proxyUrl, fetchImpl } = {}) {
  const encoded = encodeURIComponent(project);
  try {
    await gitlabApiFetch({
      apiBase: apiBase ?? 'https://gitlab.com/api/v4',
      token: token ?? vcsToken(PROVIDER),
      proxyUrl: proxyUrl ?? null,
      path: `projects/${encoded}/issues/${number}`,
      method: 'PUT',
      body: { remove_labels: labels.join(',') },
      fetchImpl,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
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
 * projectMergeSettings — the project-level merge gate with no protected-branch
 * equivalent (issue #244 A4, Decision 2). only_allow_merge_if_pipeline_succeeds
 * is GitLab's analog of GitHub required_status_checks and the load-bearing
 * signal that actually blocks MRs (CP-A2b). Uses the glab session like
 * capabilities()/branchProtect() — no pipeline-env read (GATE_FILE). `null` =
 * uncomputable (read failed or unparsable), NEVER a fabricated `false`.
 *
 * @param {{ project?: string }}
 * @returns {Promise<{ onlyAllowMergeIfPipelineSucceeds: boolean|null }>}
 */
export async function projectMergeSettings({ project = '' } = {}) {
  const enc = encodeURIComponent(project);
  const r = run('glab', ['api', `projects/${enc}`]);
  if (!r.ok) return { onlyAllowMergeIfPipelineSucceeds: null };
  try {
    const v = JSON.parse(r.stdout).only_allow_merge_if_pipeline_succeeds;
    // A 200 + parseable body does NOT guarantee the field is present — GitLab
    // permission-gates some project attributes, so a missing field is a real,
    // distinct case from "read failed"/"unparsable". `Boolean(undefined)`
    // would fabricate `false` ("readable, not configured"); only a genuine
    // boolean in the payload counts as computed — anything else is `null`
    // (uncomputable), never a fabricated `false`.
    return { onlyAllowMergeIfPipelineSucceeds: typeof v === 'boolean' ? v : null };
  } catch {
    return { onlyAllowMergeIfPipelineSucceeds: null };
  }
}

/**
 * mrCreate — un-stubbed (issue #239 A3 Phase 2, REQ-A3-4) over
 * `POST /projects/:id/merge_requests`, via the shared `gitlabApiFetch`
 * transport (never a second hand-rolled fetch). `labels` normalizes to
 * GitLab's comma-separated string, omitted entirely when empty (never a
 * fabricated empty-string label). `{ apiBase, token, proxyUrl }` threaded in
 * as PARAMETERS, same discipline as `prView`/`issueView` — this file is a
 * GATE_FILE and never reads pipeline env directly.
 *
 * Never throws: matches the `github.mrCreate` contract exactly — `{ url }`
 * on success, `{ url: null, error }` on failure.
 *
 * @param {{ project: string, title: string, body: string, head: string, base?: string, labels?: string[], apiBase?: string, token?: string, proxyUrl?: string|null, fetchImpl?: Function }} params
 * @returns {Promise<{ url: string } | { url: null, error: string }>}
 */
export async function mrCreate({
  project,
  title,
  body,
  head,
  base = 'main',
  labels = [],
  apiBase,
  token,
  proxyUrl,
  fetchImpl,
} = {}) {
  const encoded = encodeURIComponent(project);
  const payload = {
    source_branch: head,
    target_branch: base,
    title,
    description: body,
  };
  if (labels.length > 0) payload.labels = labels.join(',');

  try {
    const r = await gitlabApiFetch({
      apiBase: apiBase ?? 'https://gitlab.com/api/v4',
      token: token ?? vcsToken(PROVIDER),
      proxyUrl: proxyUrl ?? null,
      path: `projects/${encoded}/merge_requests`,
      method: 'POST',
      body: payload,
      fetchImpl,
    });
    return { url: r.web_url };
  } catch (err) {
    return { url: null, error: err.message };
  }
}
