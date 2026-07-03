// ci-context.mjs — normalizes CI provider context into ONE shape (ADR-0016,
// REQ-CIC-1..5, openspec/changes/issue-193-ci-context-design/specs/ci-context/spec.md).
//
// detectCi() resolves which CI provider is running: 'github' | 'gitlab' | 'unknown' | 'local'
// (strict precedence, REQ-CIC-1). loadContext() returns one normalized object regardless
// of provider — every field is its value or `null` when uncomputable (REQ-CIC-2). Gates
// consume ONLY this object; this module is the sole place allowed to read pipeline
// context env vars (BASE_SHA, HEAD_SHA, PR_NUMBER, GITHUB_*, CI_MERGE_REQUEST_*, CI_PROJECT_*,
// PR_BODY) — a drift-guard test (ci-context-drift-guard.test.mjs) enforces this.
//
// Never throws: an internal failure (fetch error, malformed JSON) yields `null` on the
// affected fields only, never an exception (Decision 2 / REQ-CIC-2).

import { prView as githubPrView } from './providers/github.mjs';

/**
 * @param {{ env?: NodeJS.ProcessEnv }} [deps]
 * @returns {'github'|'gitlab'|'unknown'|'local'}
 */
export function detectCi(deps = {}) {
  const env = deps.env ?? process.env;
  if (env.GITHUB_ACTIONS === 'true') return 'github';
  if (env.GITLAB_CI === 'true') return 'gitlab';
  if (env.CI === 'true') return 'unknown';
  return 'local';
}

function emptyContext(provider) {
  return {
    provider,
    prNumber: null,
    baseSha: null,
    headSha: null,
    sourceBranch: null,
    targetBranch: null,
    labels: null,
    body: null,
    author: null,
    repo: null,
    isMergeRequest: false,
  };
}

// ── GitHub (Decision 3 — extract, don't rewrite; author is net-new via prView) ─

async function loadGithubContext(env, deps) {
  // Guard against a malformed PR_NUMBER: '' → null, 'x' → null (never NaN → prView).
  const prNumber =
    env.PR_NUMBER && Number.isInteger(Number(env.PR_NUMBER)) ? Number(env.PR_NUMBER) : null;
  const prView = deps.prView ?? githubPrView;

  let labels = null;
  let body = null;
  let author = null;
  if (prNumber != null) {
    try {
      const pr = await prView({ number: prNumber });
      labels = pr?.labels ?? null;
      body = pr?.body ?? null;
      author = pr?.author ?? null;
    } catch {
      // prView never throws by contract, but never let a defensive failure escape.
    }
  }

  // author comes from the prView API payload ONLY, never from env (ADR-0016
  // Never-do #3). The actor-check job provides PR_NUMBER (governance.yml) so prView
  // runs; absent a PR, author stays null (uncomputable).
  return {
    provider: 'github',
    prNumber,
    baseSha: env.BASE_SHA ?? null,
    headSha: env.HEAD_SHA ?? null,
    sourceBranch: env.GITHUB_HEAD_REF ?? null,
    targetBranch: env.BASE_BRANCH ?? null,
    labels,
    body,
    author,
    repo: env.GITHUB_REPOSITORY ?? null,
    isMergeRequest: env.GITHUB_EVENT_NAME === 'pull_request',
  };
}

// ── GitLab (Decision 4 — designed in A0, built here; REQ-CIC-5 single MR call) ─

/**
 * Fetches MR description + author + labels in exactly ONE GitLab API call
 * (REQ-CIC-5). Authenticated with VCS_TOKEN. Honors the standard HTTP(S)_PROXY
 * env — never a hard-coded proxy host. Never throws by construction; the
 * caller (loadGitlabContext) treats any rejection as "uncomputable" (null).
 */
async function defaultFetchMr({ env, prNumber, fetchImpl }) {
  const fetchFn = fetchImpl ?? globalThis.fetch;
  const apiBase = env.CI_API_V4_URL ?? 'https://gitlab.com/api/v4';
  const projectId = encodeURIComponent(env.CI_PROJECT_ID ?? env.CI_PROJECT_PATH ?? '');
  const url = `${apiBase}/projects/${projectId}/merge_requests/${prNumber}`;
  const token = env.VCS_TOKEN;
  const options = { headers: token ? { 'PRIVATE-TOKEN': token } : {} };

  // Proxy is read from the standard env — never hard-coded (REQ-CIC-5). The
  // ProxyAgent dispatcher is best-effort: this repo ships zero npm dependencies,
  // so when 'undici' is not installed the request proceeds unproxied rather
  // than throwing (never a fabricated failure for the common no-proxy case).
  const proxyUrl = env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy || null;
  if (proxyUrl) {
    try {
      const { ProxyAgent } = await import('undici');
      options.dispatcher = new ProxyAgent(proxyUrl);
    } catch {
      // undici unavailable — proceed unproxied.
    }
  }

  const res = await fetchFn(url, options);
  if (!res.ok) throw new Error(`GitLab MR API failed: ${res.status}`);
  const data = await res.json();
  return { description: data.description, author: data.author, labels: data.labels };
}

async function loadGitlabContext(env, deps) {
  const prNumber = env.CI_MERGE_REQUEST_IID ? Number(env.CI_MERGE_REQUEST_IID) : null;
  const fetchMr = deps.fetchMr ?? ((args) => defaultFetchMr({ ...args, fetchImpl: deps.fetchImpl }));

  let labels = null;
  let body = null;
  let author = null;
  if (prNumber != null) {
    try {
      const mr = await fetchMr({ env, prNumber });
      labels = Array.isArray(mr?.labels) ? mr.labels : null;
      body = typeof mr?.description === 'string' ? mr.description : null;
      author = mr?.author?.username ?? null;
    } catch {
      labels = null;
      body = null;
      author = null;
    }
  }

  return {
    provider: 'gitlab',
    prNumber,
    baseSha: env.CI_MERGE_REQUEST_DIFF_BASE_SHA ?? null,
    headSha: env.CI_COMMIT_SHA ?? null,
    sourceBranch: env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME ?? null,
    targetBranch: env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME ?? null,
    labels,
    body,
    author,
    repo: env.CI_PROJECT_PATH ?? null,
    isMergeRequest: prNumber != null,
  };
}

/**
 * Returns the normalized pipeline context for the current run (REQ-CIC-2).
 * Every field is its value or `null` when the provider cannot supply it.
 * `labels`/`body` are value-or-`null` too, but `[]`/`''` mean genuinely empty
 * while `null` means uncomputable (the fetch failed) — the two are always
 * distinguished (this is the one deliberate behavior change from the
 * pre-seam `prView()`, Decision 2). Never throws.
 *
 * @param {{ env?: NodeJS.ProcessEnv, provider?: string, prView?: Function, fetchMr?: Function, fetchImpl?: Function }} [deps]
 * @returns {Promise<object>}
 */
export async function loadContext(deps = {}) {
  const env = deps.env ?? process.env;
  const provider = deps.provider ?? detectCi({ env });

  try {
    if (provider === 'github') return await loadGithubContext(env, deps);
    if (provider === 'gitlab') return await loadGitlabContext(env, deps);
    return emptyContext(provider);
  } catch {
    return emptyContext(provider);
  }
}

/**
 * PR_BODY binary policy (design amendment 2): `body` is ALWAYS API-primary on
 * the normalized context — `loadContext()` never mixes in PR_BODY. This is the
 * ONLY sanctioned place a DETECTION consumer (e.g. actor-check.mjs) may fall
 * back to PR_BODY when the API body is uncomputable (`null`). A REQUIRED
 * consumer (e.g. issue-link) MUST read `ctx.body` directly and MUST NOT call
 * this — it must fail closed on `null`, never on a stale env fallback.
 *
 * A genuinely empty API body (`''`) is a real value and is returned as-is;
 * only `null`/`undefined` (uncomputable) triggers the PR_BODY fallback.
 *
 * @param {{ body?: string|null }} ctx
 * @param {{ env?: NodeJS.ProcessEnv }} [deps]
 * @returns {string|null}
 */
export function resolveDetectionBody(ctx, deps = {}) {
  const env = deps.env ?? process.env;
  const body = ctx?.body;
  if (body !== null && body !== undefined) return body;
  return env.PR_BODY ?? null;
}
