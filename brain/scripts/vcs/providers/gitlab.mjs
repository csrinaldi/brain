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
 * `headRefOid` (ADR-0021 Decision 1) — the API's head sha for the MR, the
 * anchor a cold caller checks out **detached** at — normalizes from the
 * payload's top-level `sha`, falling back to `diff_refs.head_sha` (both
 * carry the same value on GitLab's MR response). Widened additively:
 * existing callers reading only `number`/`labels`/`body`/`author` are
 * unaffected.
 *
 * `baseRefOid` (ADR-0022 Decision 1) — the base branch's tip sha, normalized
 * from the payload's `diff_refs.base_sha` (the mirror of how `headRefOid`
 * uses `diff_refs.head_sha`). Unlike GitHub, no second request is needed —
 * the already-fetched MR payload carries it. Widened additively, same
 * discipline as `headRefOid`.
 *
 * `{ apiBase, token, proxyUrl }` are threaded in as PARAMETERS from the
 * caller (`gitlabApiConfig()`), never read from pipeline env directly here —
 * this file is a GATE_FILE (drift-guard forbids it). Defaults exist so
 * LOCAL/non-CI callers keep working unchanged: public gitlab.com API base,
 * `vcsToken()`, no proxy.
 *
 * Never throws: a fetch failure is caught and normalized to
 * `{ number, labels: null, body: null, author: null, headRefOid: null,
 * baseRefOid: null }` (uncomputable) — never a fabricated empty `[]`/`''`,
 * matching the `github.prView` contract.
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
 * @returns {Promise<{ number: number, labels: string[]|null, body: string|null, author: string|null, headRefOid: string|null, baseRefOid: string|null }>}
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
      headRefOid: r.sha ?? r.diff_refs?.head_sha ?? null,
      baseRefOid: r.diff_refs?.base_sha ?? null,
    };
  } catch {
    return { number, labels: null, body: null, author: null, headRefOid: null, baseRefOid: null };
  }
}

/**
 * prStatusRollup — the provider-agnostic READ verb `prStatusRollup`
 * (ADR-0021 Decision 2). Returns the full status-check rollup for an MR's
 * head commit, normalized to `[{ name, status, conclusion }]` — one entry
 * per check. This is a READ: no write path exists on this verb.
 *
 * GitLab has no single "checks rollup" endpoint like GitHub's — this
 * resolves the MR's head sha (the same `sha`/`diff_refs.head_sha` fallback
 * as `prView`), then reads `GET projects/:id/repository/commits/:sha/statuses`
 * (the same endpoint `commitStatus` reads, but the FULL list rather than
 * `[0]`). GitLab's commit-status model has no separate "conclusion" field
 * distinct from its terminal `status` (success/failed/canceled/etc.) — each
 * entry normalizes to `conclusion: null`, satisfying the shared SHAPE (the
 * contract both providers must meet) without fabricating a field GitLab
 * doesn't have.
 *
 * `{ apiBase, token, proxyUrl }` are threaded in as PARAMETERS from the
 * caller, same discipline as `prView` — this file is a GATE_FILE and never
 * reads pipeline env directly. Never throws: a fetch failure, or an
 * unresolvable head sha, normalizes to `null` (uncomputable) — never a
 * fabricated `[]`.
 *
 * @param {{ project: string, number: number, apiBase?: string, token?: string, proxyUrl?: string|null, fetchImpl?: Function }} params
 * @returns {Promise<Array<{ name: string, status: string|null, conclusion: null }>|null>}
 */
export async function prStatusRollup({ project, number, apiBase, token, proxyUrl, fetchImpl } = {}) {
  const encoded = encodeURIComponent(project);
  const base = apiBase ?? 'https://gitlab.com/api/v4';
  const tok = token ?? vcsToken(PROVIDER);
  try {
    const mr = await gitlabApiFetch({
      apiBase: base,
      token: tok,
      proxyUrl: proxyUrl ?? null,
      path: `projects/${encoded}/merge_requests/${number}`,
      fetchImpl,
    });
    const sha = mr.sha ?? mr.diff_refs?.head_sha ?? null;
    if (!sha) return null;
    const statuses = await gitlabApiFetch({
      apiBase: base,
      token: tok,
      proxyUrl: proxyUrl ?? null,
      path: `projects/${encoded}/repository/commits/${sha}/statuses`,
      fetchImpl,
    });
    if (!Array.isArray(statuses)) return null;
    return statuses.map(s => ({ name: s.name ?? null, status: s.status ?? null, conclusion: null }));
  } catch {
    return null;
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
 * A3 TASK2/4th-violation fix; verdict-thread half added by issue #317) over
 * TWO GitLab endpoints, both via the shared `gitlabApiFetch` transport:
 *
 *   1. `GET /projects/:id/merge_requests/:iid/notes` — the MR discussion
 *      thread. This is where the reviewer's `brain-review/N` verdict blocks
 *      actually LIVE (poster.mjs posts them as MR notes), so it is the only
 *      endpoint that can carry a parseable `body`. Each non-system note
 *      normalizes to `{ state: 'COMMENTED', author, body }`.
 *   2. `GET /projects/:id/merge_requests/:iid/approvals` — the approval
 *      roster. GitLab has no per-reviewer review-STATE history like GitHub's
 *      Reviews API, so each entry in `approved_by` normalizes to one
 *      `{ state: 'APPROVED', author, body: '' }` entry.
 *
 * WHY BOTH (issue #317): this one verb feeds two unrelated consumers with
 * disjoint needs, and before #317 it served only the second.
 *   - The L6 `brain-writes-reviewed` gate reads ONLY `state === 'APPROVED'`
 *     + `author`. Approvals is its source; notes must never satisfy it.
 *   - The reviewer's verdict thread (`cold-boot`'s `doctrine.priorVerdicts`,
 *     `board`'s reconciliation) reads ONLY `body`, through `parseVerdict`.
 *     Approvals carries no body at all, so on GitLab the verdict thread was
 *     STRUCTURALLY INVISIBLE — `priorVerdicts` was always `[]`, and with it
 *     the anti-loop lock, the `rev >= 3 -> STOP` bound, the §8 doctrine load
 *     and board reconciliation were all inert in production.
 *
 * SECURITY BOUNDARY (do not "simplify" this): notes normalize to
 * `'COMMENTED'`, NEVER `'APPROVED'`. Mapping a mere MR comment to APPROVED
 * would let anyone clear the L6 self-approval gate by typing a comment.
 *
 * ORDERING is load-bearing: `sort=asc&order_by=created_at` makes notes
 * oldest-first, matching GitHub's Reviews API, because `poster.mjs` and
 * `board.mjs` both take the LAST parsed verdict as the current one. GitLab's
 * notes endpoint defaults to newest-first, which would invert that.
 *
 * PAGINATION is load-bearing for the same reason `--paginate` is on the
 * GitHub side, and more sharply: with `sort=asc`, page 1 holds the OLDEST
 * notes, so an unpaginated fetch drops the LATEST verdict — precisely the
 * fail-open the anti-loop lock exists to prevent. Fetched page-by-page
 * (`per_page=100`, stop on a short page), the same termination condition
 * `labelList` uses, because `gitlabApiFetch` returns only the parsed body
 * and cannot follow a `Link` header.
 *
 * FAILURE IS ALL-OR-NOTHING: if EITHER fetch fails the whole result is
 * `null` (uncomputable). Returning notes-only on an approvals failure would
 * hand L6 an empty approver set that looks like a genuine "nobody approved"
 * — a fail-OPEN on the security gate. `null` is what its callers already
 * treat as "couldn't compute".
 *
 * `{ apiBase, token, proxyUrl }` are threaded in as PARAMETERS from the
 * caller (`gitlabApiConfig()`), exactly like `issueView`/`labelEvents` —
 * this file is a GATE_FILE and never reads pipeline env directly. Never
 * throws: a fetch failure is caught and normalized to `null` (uncomputable)
 * — never a fabricated `[]`.
 *
 * @param {{ project: string, number: number, apiBase?: string, token?: string, proxyUrl?: string|null, fetchImpl?: Function }} params
 * @returns {Promise<Array<{ state: 'COMMENTED'|'APPROVED', author: string|null, body: string }>|null>}
 */
export async function prReviews({ project, number, apiBase, token, proxyUrl, fetchImpl } = {}) {
  const encoded = encodeURIComponent(project);
  const base = apiBase ?? 'https://gitlab.com/api/v4';
  const tok = token ?? vcsToken(PROVIDER);
  const perPage = 100;

  let notes;
  let approvals;
  try {
    notes = [];
    for (let page = 1; ; page += 1) {
      const arr = await gitlabApiFetch({
        apiBase: base,
        token: tok,
        proxyUrl: proxyUrl ?? null,
        path: `projects/${encoded}/merge_requests/${number}/notes?order_by=created_at&sort=asc&per_page=${perPage}&page=${page}`,
        fetchImpl,
      });
      if (!Array.isArray(arr)) return null;
      notes.push(...arr);
      if (arr.length < perPage) break;
    }
    approvals = await gitlabApiFetch({
      apiBase: base,
      token: tok,
      proxyUrl: proxyUrl ?? null,
      path: `projects/${encoded}/merge_requests/${number}/approvals`,
      fetchImpl,
    });
  } catch {
    return null;
  }

  // System notes ("changed title from ...", "assigned to @x") are GitLab's own
  // activity records, never reviewer speech — they can never carry a verdict
  // block, so they are dropped rather than passed through as noise.
  const commented = notes
    .filter(n => n?.system !== true)
    .map(n => ({ state: 'COMMENTED', author: n?.author?.username ?? null, body: n?.body ?? '' }));

  const approved = (approvals?.approved_by ?? []).map(a => ({
    state: 'APPROVED',
    author: a.user?.username ?? null,
    body: '',
  }));

  // Approvals are appended AFTER the chronological notes rather than
  // interleaved: the approvals endpoint exposes no per-approver timestamp, so
  // any interleaving would be fabricated. Safe for the "last verdict wins"
  // readers because an approval's `body` is `''`, which `parseVerdict`
  // rejects — an approval can never displace the latest real verdict.
  return [...commented, ...approved];
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

/**
 * labelList — the provider-agnostic `labelList` verb (issue #334,
 * vcs-label-preflight spec): the remote's full declared label set, normalized
 * to bare name strings. Consumed by `labelPreflight` as the pre-write
 * conformance check — GitLab's MR-create payload otherwise SILENTLY CREATES
 * an unknown label, polluting the project taxonomy (design A2); a pre-flight
 * catches that BEFORE the write.
 *
 * `gitlabApiFetch` returns only the parsed JSON body (no response headers),
 * so pagination cannot follow GitLab's `Link` header the way `gh api
 * --paginate` does — instead this fetches page-by-page (`per_page=100`) and
 * stops once a page comes back short (fewer than `per_page` entries), the
 * standard REST-pagination termination condition. Load-bearing, same as
 * GitHub's `--paginate`: a repo with >100 labels must not silently drop a
 * real label and false-reject a valid ship.
 *
 * `{ apiBase, token, proxyUrl }` are threaded in as PARAMETERS from the
 * caller, same discipline as every other verb in this GATE_FILE. May throw
 * like its sibling normalized READs — `labelPreflight`, not this verb, is
 * the total/never-throws policy layer (design A1).
 *
 * @param {{ project: string, apiBase?: string, token?: string, proxyUrl?: string|null, fetchImpl?: Function }} opts
 * @returns {Promise<string[]>}
 */
export async function labelList({ project, apiBase, token, proxyUrl, fetchImpl } = {}) {
  const encoded = encodeURIComponent(project);
  const base = apiBase ?? 'https://gitlab.com/api/v4';
  const tok = token ?? vcsToken(PROVIDER);
  const perPage = 100;
  const names = [];
  let page = 1;
  for (;;) {
    const arr = await gitlabApiFetch({
      apiBase: base,
      token: tok,
      proxyUrl: proxyUrl ?? null,
      path: `projects/${encoded}/labels?per_page=${perPage}&page=${page}`,
      fetchImpl,
    });
    for (const l of arr) names.push(l.name);
    if (arr.length < perPage) break;
    page += 1;
  }
  return names;
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
