// github.mjs — GitHub provider (gh CLI). Implements brain/core/methodology/vcs-contract.md.
//
// All verbs return the NORMALIZED shapes from the contract (number, body,
// headBranch, username, canonical commit-status enum). Auth uses the gh session
// (ensured by day:start); the token is only needed by the URL-building verbs,
// which receive it from the caller.

import { run, runJson } from '../lib/exec.mjs';
import { normalizeCommitStatus, providerState, assigneeParams } from '../lib/normalize.mjs';
import { vcsToken } from '../lib/token.mjs';

export const PROVIDER = 'github';

const toQs = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

export async function authCheck({ host } = {}) {
  const args = host ? ['auth', 'status', '--hostname', host] : ['auth', 'status'];
  return run('gh', args).ok;
}

export async function authLogin({ host, token } = {}) {
  const tok = token ?? vcsToken(PROVIDER);
  return run('gh', ['auth', 'login', '--hostname', host || 'github.com', '--with-token'], { input: tok }).ok;
}

// `token` (optional, issue #413): resolves the identity OF THAT TOKEN rather
// than of whatever `gh` happens to be logged in as — `GH_TOKEN` takes
// precedence over gh's keyring auth, so an identity verification cannot be
// satisfied by the operator's ambient login. Without `token` the pre-#413
// behavior (current CLI user) is unchanged.
export async function whoami({ token } = {}) {
  const opts = token ? { env: { ...process.env, GH_TOKEN: token } } : {};
  const resp = runJson('gh', ['api', '/user'], opts);
  return { username: resp.login };
}

// GitHub addresses repos by the owner/repo slug directly — projectResolve is the identity.
export async function projectResolve({ project }) {
  return project;
}

export async function issueView({ project, number }) {
  const r = runJson('gh', ['api', `repos/${project}/issues/${number}`]);
  return {
    number: r.number,
    title: r.title,
    labels: (r.labels ?? []).map(l => l.name),
    body: r.body,
    // `author` (issue #239 A3 TASK1): actor-check.mjs's REQ-L5-1 compares the
    // approval actor against BOTH the PR author and the issue author — the
    // same API call already carries `user.login`, no extra round-trip.
    author: r.user?.login ?? null,
  };
}

export async function branchProtect({ project, branch = 'main', checks, requiredReviews = 1 }) {
  const payload = {
    required_status_checks: {
      strict: true,
      checks: checks.map(context => ({ context })),
    },
    enforce_admins: false,
    required_pull_request_reviews: {
      required_approving_review_count: requiredReviews,
    },
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
  };
  const r = run(
    'gh',
    ['api', '-X', 'PUT', `repos/${project}/branches/${branch}/protection`, '--input', '-'],
    { input: JSON.stringify(payload) }
  );
  if (r.ok) return { enforced: true };
  // Tier / plan limitation — GitHub free plan blocks protection on private repos
  if (r.stderr.includes('403') || /upgrade.*pro/i.test(r.stderr)) {
    return {
      enforced: false,
      reason: 'tier',
      remedy: 'GitHub Pro for private repos, or make the repo public',
    };
  }
  return {
    enforced: false,
    reason: 'unsupported',
    remedy: r.stderr.trim() || 'unknown error from gh api',
  };
}

/**
 * Optional, non-contract verb (github only — `brain:protect`'s arm-and-verify
 * step, issue #203). Returns the check-run names reported for the branch's
 * latest commit. Never throws: a fetch failure degrades to `[]`, which
 * `verifyArmedProtection` (brain-protect.mjs) treats as "unverifiable" rather
 * than a crash.
 *
 * @param {{ project: string, branch?: string }} opts
 * @returns {Promise<string[]>}
 */
export async function checkRuns({ project, branch = 'main' } = {}) {
  try {
    const resp = runJson('gh', ['api', `repos/${project}/commits/${branch}/check-runs`]);
    return (resp.check_runs ?? []).map(cr => cr.name);
  } catch {
    return [];
  }
}

// Capability cache — keyed by "project:branch" to avoid cross-test interference.
const _capabilityCache = new Map();

/**
 * Probe the GitHub API to determine whether branch protection APIs are accessible
 * for the given project+branch. Caches the result per project:branch for the
 * lifetime of the Node.js process.
 *
 * Returns: { hardEnforcement: 'available' | 'unavailable' | 'unknown', remedy?, detail? }
 */
export async function capabilities({ project = '', branch = 'main' } = {}) {
  const key = `${project}:${branch}`;
  if (_capabilityCache.has(key)) return _capabilityCache.get(key);

  const r = run('gh', ['api', `repos/${project}/branches/${branch}/protection`]);
  let result;
  if (r.ok) {
    result = { hardEnforcement: 'available' };
  } else if (r.stderr.includes('404')) {
    // No protection set yet — API is accessible, feature is available
    result = { hardEnforcement: 'available' };
  } else if (r.stderr.includes('403') || /upgrade.*pro/i.test(r.stderr)) {
    result = {
      hardEnforcement: 'unavailable',
      remedy: 'GitHub Pro for private repos, or make the repo public',
    };
  } else {
    result = { hardEnforcement: 'unknown' };
  }

  _capabilityCache.set(key, result);
  return result;
}

/**
 * Fetch a PR's metadata (number, label names, body, author, the head commit
 * sha, and the base commit sha) via `gh pr view`. Uses the current repo's
 * git remote — `project` is accepted for contract compatibility but not
 * required by the gh CLI when run from the repo root.
 *
 * `headRefOid` (ADR-0021 Decision 1) is the API's head sha for the PR — the
 * anchor a cold caller checks out **detached** at (never a branch name).
 *
 * `baseRefOid` (ADR-0022 Decision 1) is the base branch's tip sha. `gh pr
 * view --json` does NOT expose it (verified: its field set offers
 * `baseRefName`/`headRefName`/`headRefOid`, but no `baseRefOid` — `gh pr view
 * --json baseRefOid` errors "Unknown JSON field"). So it is sourced via a
 * SECOND, supplementary call: `gh api repos/{owner}/{repo}/pulls/{number}
 * --jq .base.sha` (the REST endpoint's authoritative `base.sha`; `gh` itself
 * expands the literal `{owner}/{repo}` placeholders from the current repo's
 * git remote, preserving this verb's "works from repo root, `project`
 * optional" property). The main `gh pr view --json …,headRefOid` call above
 * is left UNTOUCHED — `baseRefOid` is a strictly additive supplement: if it
 * fails, every other field from the main fetch is still returned, only
 * `baseRefOid` folds to `null`.
 *
 * Widened additively (both ADR-0021 and ADR-0022): existing callers reading
 * only `number`/`labels`/`body`/`author` are unaffected.
 *
 * Never throws: returns { number, labels: null, body: null, author: null,
 * headRefOid: null, baseRefOid: null } on ANY main-fetch failure
 * (ci-context.mjs's REQ-CIC-2 uncomputable signal) — distinct from a
 * genuinely empty `[]`/`''` on an otherwise-successful response. Callers
 * that need "no labels" vs "couldn't fetch labels" distinguished (e.g. a
 * REQUIRED gate) MUST treat `null` as uncomputable, never collapse it to a
 * fabricated empty default.
 *
 * @param {{ project?: string, number: number }} opts
 * @returns {Promise<{ number: number, labels: string[]|null, body: string|null, author: string|null, headRefOid: string|null, baseRefOid: string|null }>}
 */
export async function prView({ project, number } = {}) {
  const r = run('gh', ['pr', 'view', String(number), '--json', 'number,labels,body,author,headRefOid']);
  if (!r.ok) return { number, labels: null, body: null, author: null, headRefOid: null, baseRefOid: null };
  try {
    const data = JSON.parse(r.stdout);
    const br = run('gh', ['api', `repos/{owner}/{repo}/pulls/${number}`, '--jq', '.base.sha']);
    // `gh api --jq .base.sha` prints the literal "null" on a JSON-null base.sha —
    // normalize it to null, matching gitlab.mjs's `diff_refs?.base_sha ?? null`.
    const baseSha = br.ok ? br.stdout.trim() : '';
    const baseRefOid = baseSha && baseSha !== 'null' ? baseSha : null;
    return {
      number: data.number,
      labels: (data.labels ?? []).map(l => l.name),
      body: data.body ?? '',
      author: data.author?.login ?? null,
      headRefOid: data.headRefOid ?? null,
      baseRefOid,
    };
  } catch {
    return { number, labels: null, body: null, author: null, headRefOid: null, baseRefOid: null };
  }
}

export async function issueList({ project, state = 'open', assignee } = {}) {
  let currentUser;
  if (assignee === 'me') currentUser = (await whoami()).username;
  const assigneePs = assigneeParams('github', assignee, currentUser);
  const extra = Object.keys(assigneePs).length > 0 ? '&' + toQs(assigneePs) : '';
  const endpoint = `repos/${project}/issues?state=${providerState('github', state)}&per_page=100${extra}`;
  const arr = runJson('gh', ['api', endpoint]);
  // GitHub /issues returns both issues and PRs — filter out PRs.
  return arr
    .filter(r => !r.pull_request)
    .map(r => ({ number: r.number, title: r.title, labels: (r.labels ?? []).map(l => l.name) }));
}

export async function mrList({ project, state = 'open' } = {}) {
  const arr = runJson('gh', ['api', `repos/${project}/pulls?state=${providerState('github', state)}&per_page=100`]);
  return arr.map(r => ({ number: r.number, title: r.title, headBranch: r.head.ref }));
}

export async function commitStatus({ project, sha }) {
  const resp = runJson('gh', ['api', `repos/${project}/commits/${sha}/check-runs`]);
  const cr = resp.check_runs?.[0];
  if (!cr) return null;
  // An unfinished check has conclusion=null; its live state lives in `status`
  // (queued/in_progress). Use status until completed, then the conclusion.
  const raw = cr.status === 'completed' ? cr.conclusion : cr.status;
  return normalizeCommitStatus('github', raw);
}

/**
 * prStatusRollup — the provider-agnostic READ verb `prStatusRollup`
 * (ADR-0021 Decision 2). Returns the full status-check rollup for a PR's
 * head commit, normalized to `[{ name, status, conclusion }]` — one entry
 * per check. This is a READ: no write path exists on this verb, and it
 * carries no APPROVE/label-mutation code path (the reviewer's four
 * COMMENT-only write verbs from ADR-0020 are unaffected).
 *
 * Unlike `commitStatus` (which needs a sha as input and collapses to
 * `check_runs[0]`, a single check), `prStatusRollup` takes the PR number and
 * returns the FULL rollup via `gh pr view --json statusCheckRollup` — every
 * required check the tranche evaluator (H1-2c) re-derives cold, not a
 * collapsed single status.
 *
 * Never throws: a fetch failure, or a response with no computable rollup,
 * normalizes to `null` (uncomputable) — never a fabricated `[]`, matching
 * `prReviews`/`labelEvents`.
 *
 * @param {{ project?: string, number: number }} opts
 * @returns {Promise<Array<{ name: string, status: string|null, conclusion: string|null }>|null>}
 */
export async function prStatusRollup({ project, number } = {}) {
  let data;
  try {
    data = runJson('gh', ['pr', 'view', String(number), '--json', 'statusCheckRollup']);
  } catch {
    return null;
  }
  const rollup = data.statusCheckRollup;
  if (!Array.isArray(rollup)) return null;
  return rollup.map(c => ({
    name: c.name ?? c.context ?? null,
    status: c.status ?? c.state ?? null,
    conclusion: c.conclusion ?? null,
  }));
}

/**
 * prReviews — the provider-agnostic `prReviews` CONTRACT verb (issue #239
 * A3 TASK2/4th-violation fix, closing the L6 brain-writes-reviewed gate's
 * gh-CLI-hardcoded `defaultFetchReviews`). Wraps GitHub's Reviews API
 * (`pulls/N/reviews`), normalizing `state`/`user.login`/`body` to `{ state,
 * author, body }`. EXTRACTED from brain-writes-reviewed.mjs's inline
 * `defaultFetchReviews`, preserving the load-bearing `--paginate` VERBATIM:
 * `gh api` does not auto-paginate, and a long-lived PR with many re-review
 * cycles can exceed one page — an unpaginated fetch can silently drop the
 * one human APPROVED review that would flip a self-approval verdict.
 *
 * `body` (issue #317) is LOAD-BEARING, not cosmetic: the reviewer's
 * `brain-review/N` verdict block lives in the review body, and
 * `parse-verdict.mjs` requires a string body to recover it. Without `body`
 * on this shape, `cold-boot`'s `doctrine.priorVerdicts` is ALWAYS `[]` in
 * production — which silently kills the anti-loop lock (poster.mjs's
 * `lastVerdict` never fires, so a duplicate verdict is re-posted on every
 * rerun of the same head), the `rev >= 3 -> STOP` bound (verdict.mjs's
 * `priorRevCount` never leaves 0), the §8 prior-verdict doctrine load, and
 * board reconciliation. This is the field whose absence made all four
 * guarantees inert while their tests stayed green on injected fixtures.
 *
 * `body` follows the same uncomputable-vs-empty discipline as `prView.body`
 * (issue #239 A3 task 3.7): a review with no comment normalizes to `''`,
 * never `null`/`undefined` — `null` is reserved for "couldn't fetch", which
 * on this verb is signalled by the WHOLE result being `null`.
 *
 * Never throws: a fetch failure is caught and normalized to `null`
 * (uncomputable) — never a fabricated `[]`, so callers (the DETECTION gate)
 * can distinguish "zero reviews" from "couldn't fetch".
 *
 * @param {{ project: string, number: number }} params
 * @returns {Promise<Array<{ state: string, author: string|null, body: string }>|null>}
 */
export async function prReviews({ project, number } = {}) {
  let reviews;
  try {
    reviews = runJson('gh', ['api', '--paginate', `repos/${project}/pulls/${number}/reviews`]);
  } catch {
    return null;
  }
  return reviews.map(r => ({ state: r.state, author: r.user?.login ?? null, body: r.body ?? '' }));
}

/**
 * Create a pull request via `gh pr create`.
 * Returns { url: string } on success or { url: null, error: string } on failure.
 * Never throws.
 */
export async function mrCreate({
  project,
  title,
  body,
  head,
  base = 'main',
  labels = [],
} = {}) {
  // gh pr create resolves the repo from the git remote; project is validated
  // implicitly.  Pass title + body + branch refs explicitly.
  const args = [
    'pr', 'create',
    '--title', title,
    '--body', body,
    '--head', head,
    '--base', base,
  ];
  for (const label of labels) {
    args.push('--label', label);
  }

  const r = run('gh', args);
  if (r.ok) return { url: r.stdout.trim() };
  return { url: null, error: r.stderr.trim() || `gh pr create failed (status ${r.status})` };
}

/**
 * labelEvents — the provider-agnostic `labelEvents` CONTRACT verb (issue
 * #239 A3, D1). Wraps GitHub's Events API (`issues/N/events`), normalizing
 * `event:'labeled'|'unlabeled'` + `actor.login`/`label.name`/`created_at` to
 * the shared shape `{ actor: { login }, action: 'add'|'remove', label, at }`,
 * ascending by `at`. Non-label events (e.g. `commented`) are dropped.
 *
 * EXTRACTED from actor-check.mjs's inline `defaultFetchLabeledEvents` (the
 * A2 `m3` finding close) — preserves the load-bearing `--paginate`
 * VERBATIM: `gh api` does not auto-paginate, and the Events API is
 * oldest-first, so an unpaginated fetch silently drops page-2+ events
 * (including a late self-applied approved label), which would wrongly PASS
 * the actor-check (fail-open).
 *
 * Never throws: a fetch failure (no `gh` binary, rate limit, non-zero exit)
 * is caught and normalized to `null` (uncomputable) — never a fabricated
 * `[]`, so callers (the actor-check DETECTION gate) can distinguish "no
 * events" from "couldn't fetch".
 *
 * @param {{ project: string, number: number }} params
 * @returns {Promise<Array<{ actor: { login: string|undefined }, action: 'add'|'remove', label: string|undefined, at: string|undefined }>|null>}
 */
export async function labelEvents({ project, number } = {}) {
  let events;
  try {
    events = runJson('gh', ['api', '--paginate', `repos/${project}/issues/${number}/events`]);
  } catch {
    return null;
  }
  return events
    .filter(e => e.event === 'labeled' || e.event === 'unlabeled')
    .map(e => ({
      actor: { login: e.actor?.login },
      action: e.event === 'labeled' ? 'add' : 'remove',
      label: e.label?.name,
      at: e.created_at,
    }))
    .sort((a, b) => new Date(a.at) - new Date(b.at));
}

/**
 * prCommits — the provider-agnostic `prCommits` CONTRACT verb (issue #358
 * Q5 Phase 4, REQ-L5-1' regulated evidence: "the approver authored no
 * commit on the branch"). Wraps GitHub's PR-commits API
 * (`pulls/{n}/commits`), normalizing to `{ sha, login, at }`. The API
 * itself returns commits oldest-first (unlike `labelEvents`/`prReviews`,
 * which need an explicit sort) — the LAST entry is the branch's head
 * commit, which `actor-check.mjs`'s `lite` distinct-act evidence compares
 * the approval timestamp against (REQ-L5-1' lite evidence).
 *
 * `login` is GitHub's account-linked commit author
 * (`commit-object.author.login`) — nullable when the commit's author email
 * is not linked to any GitHub account. This is the identity
 * `regulated`'s no-commit-on-branch evidence compares the approving actor
 * against; a commit with `login: null` can never match an actor login (a
 * safe direction — it simply cannot prove that specific commit was
 * authored by the approver).
 *
 * Never throws: a fetch failure is caught and normalized to `null`
 * (uncomputable) — never a fabricated `[]` (same discipline as
 * `labelEvents`/`prReviews`).
 *
 * @param {{ project: string, number: number }} params
 * @returns {Promise<Array<{ sha: string, login: string|null, at: string|undefined }>|null>}
 */
export async function prCommits({ project, number } = {}) {
  let commits;
  try {
    commits = runJson('gh', ['api', '--paginate', `repos/${project}/pulls/${number}/commits`]);
  } catch {
    return null;
  }
  return commits.map(c => ({
    sha: c.sha,
    login: c.author?.login ?? null,
    at: c.commit?.author?.date,
  }));
}

/**
 * Posts a COMMENT-state pull request review (issue #266, REQ-266-2). `event`
 * is HARDCODED to `'COMMENT'` — no parameter, flag, or branch selects a
 * different review event (lock 2, REQ-266-3). Never throws.
 *
 * `comments` (issue #405) is an optional array of `{ path, line, body }` inline
 * anchors riding the SAME `/reviews` payload as `body`, so the review stays
 * atomic. Absent and empty are the SAME request — no inline is attempted. A
 * refused anchored payload is retried ONCE bare, and `inlineDropped` then counts
 * what was lost; it is ABSENT when nothing was, never 0. Widening this signature
 * does not widen `event`: there is no parameter for it, and a contract test
 * asserts the payload still carries `COMMENT` when a caller passes a hostile
 * `event` argument.
 *
 * @param {{ project: string, number: number, body: string, comments?: Array<{path: string, line: number, body: string}> }} opts
 * @returns {Promise<{ url: string } | { url: string, inlineDropped: number } | { url: null, error: string }>}
 */
export async function prReviewComment({ project, number, body, comments } = {}) {
  const args = ['api', '-X', 'POST', `repos/${project}/pulls/${number}/reviews`, '--input', '-'];
  const post = (payload) => run('gh', args, { input: JSON.stringify(payload) });
  const parse = (r, extra) => {
    try {
      return { url: JSON.parse(r.stdout).html_url, ...extra };
    } catch (err) {
      return { url: null, error: err.message };
    }
  };

  const inline = Array.isArray(comments) && comments.length > 0 ? comments : null;

  // `comments` rides the SAME payload as `body` and `event` — one call, so the
  // review is atomic and no second postable artifact exists for the anti-loop
  // lock to miss (ADR-0020 Amendment 1, #405 design D1/D5).
  const first = post(inline ? { body, event: 'COMMENT', comments: inline } : { body, event: 'COMMENT' });
  if (first.ok) return parse(first);

  // REQ-405-4 — the verdict is never lost to an inline failure. GitHub 422s a
  // comment targeting a line outside the diff; the summary alone would have been
  // accepted. Retry WITHOUT the anchors and report how many were dropped.
  //
  // Only reachable when anchors were sent, so a plain post failure costs no extra
  // call. The attribution is sound rather than assumed: the retry differs from
  // the first attempt in exactly one way, so if dropping the comments makes it
  // succeed, the comments were the cause.
  //
  // `inlineDropped` is ABSENT when nothing was dropped, never 0 — "none
  // requested" and "all dropped" must not be the same answer to a reader
  // (evidence-reader-empty-on-failure, applied to a poster).
  if (inline) {
    const retry = post({ body, event: 'COMMENT' });
    if (retry.ok) return parse(retry, { inlineDropped: inline.length });
  }

  return { url: null, error: first.stderr.trim() || `gh api failed (status ${first.status})` };
}

/**
 * Posts a plain issue comment — rulings on issues (issue #266, REQ-266-2).
 * Never throws.
 *
 * @param {{ project: string, number: number, body: string }} opts
 * @returns {Promise<{ url: string } | { url: null, error: string }>}
 */
export async function issueComment({ project, number, body } = {}) {
  const r = run(
    'gh',
    ['api', '-X', 'POST', `repos/${project}/issues/${number}/comments`, '--input', '-'],
    { input: JSON.stringify({ body }) },
  );
  if (!r.ok) return { url: null, error: r.stderr.trim() || `gh api failed (status ${r.status})` };
  try {
    return { url: JSON.parse(r.stdout).html_url };
  } catch (err) {
    return { url: null, error: err.message };
  }
}

/**
 * Adds labels to an issue or PR (issue #266, REQ-266-2). The CALLER enforces
 * the deny-set (REQ-266-9, monotonic label tightening) — this verb performs
 * the label API call only, no policy. Never throws.
 *
 * @param {{ project: string, number: number, labels: string[] }} opts
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function labelAdd({ project, number, labels } = {}) {
  const r = run(
    'gh',
    ['api', '-X', 'POST', `repos/${project}/issues/${number}/labels`, '--input', '-'],
    { input: JSON.stringify({ labels }) },
  );
  if (r.ok) return { ok: true };
  return { ok: false, error: r.stderr.trim() || `gh api failed (status ${r.status})` };
}

/**
 * Removes labels from an issue or PR — monotonic-tightening removals only
 * (issue #266, REQ-266-9); the caller enforces the deny-set. GitHub has no
 * bulk-remove endpoint — each label is deleted individually, stopping at the
 * first failure. Never throws.
 *
 * @param {{ project: string, number: number, labels: string[] }} opts
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function labelRemove({ project, number, labels } = {}) {
  for (const label of labels) {
    const r = run('gh', ['api', '-X', 'DELETE', `repos/${project}/issues/${number}/labels/${encodeURIComponent(label)}`]);
    if (!r.ok) return { ok: false, error: r.stderr.trim() || `gh api failed (status ${r.status})` };
  }
  return { ok: true };
}

/**
 * labelList — the provider-agnostic `labelList` verb (issue #334,
 * vcs-label-preflight spec): the remote's full declared label set, normalized
 * to bare name strings. Consumed by `labelPreflight` (vcs/label-preflight.mjs)
 * as the pre-write conformance check before `mrCreate` — a hard-error on an
 * unknown GitHub label, caught BEFORE the write rather than after (design A2).
 *
 * `--paginate` is load-bearing, same discipline as `labelEvents`/`prReviews`:
 * a repo with more labels than one page would otherwise silently drop a real
 * label and false-reject a valid ship. May throw like its sibling normalized
 * READs (`prView` fixture aside) — `labelPreflight`, not this verb, is the
 * total/never-throws policy layer (design A1).
 *
 * @param {{ project: string }} opts
 * @returns {Promise<string[]>}
 */
export async function labelList({ project } = {}) {
  const arr = runJson('gh', ['api', '--paginate', `repos/${project}/labels?per_page=100`]);
  return arr.map(l => l.name);
}

/**
 * rerunWorkflowRun — GitHub-only capability (issue #328, closing the
 * stale-GREEN re-evaluation bug). Not a base contract verb (no GitLab
 * equivalent implemented, deliberately out of scope) — callers reach it via
 * `getVcs({ provider: 'github' }).rerunWorkflowRun(...)`, module-namespace
 * access outside cli.mjs's `VERBS` dispatch (adding a GitHub-only entry there
 * would trip verb-contract-drift-guard.test.mjs's "both providers implement
 * it" check for the wrong reason).
 *
 * Finds the most recent run of `workflow` for `ref` (`gh api
 * repos/{project}/actions/runs?branch={ref}`, API-ordered newest-first;
 * client-side filtered to the target workflow's `path`) and forces a FULL
 * rerun (`POST .../actions/runs/{run_id}/rerun`) — deliberately NEVER
 * `rerun-failed-jobs`, which only reruns jobs that already failed and would
 * silently skip an already-green job stuck on stale evidence (actor-check's
 * REQ-L5-2 warn-pass on missing approval history) — the exact bug this verb
 * exists to fix (a PR merged on a verdict computed before the fact it
 * depends on existed).
 *
 * Never throws: a list-runs failure, no matching run, or a rerun-POST
 * failure all degrade to `{ ok: false, reason }`.
 *
 * @param {{ project: string, ref: string, workflow?: string }} opts
 * @returns {Promise<{ ok: true, runId: number } | { ok: false, reason: string }>}
 */
export async function rerunWorkflowRun({ project, ref, workflow = 'governance.yml' } = {}) {
  let runsResp;
  try {
    runsResp = runJson('gh', ['api', `repos/${project}/actions/runs?branch=${encodeURIComponent(ref)}&per_page=100`]);
  } catch (err) {
    return { ok: false, reason: `could not list workflow runs: ${err.message}` };
  }

  const targetPath = `.github/workflows/${workflow}`;
  const match = (runsResp.workflow_runs ?? []).find(r => r.path === targetPath);
  if (!match) {
    return { ok: false, reason: `no run of ${workflow} found for ref '${ref}'` };
  }

  const r = run('gh', ['api', '-X', 'POST', `repos/${project}/actions/runs/${match.id}/rerun`]);
  if (!r.ok) {
    return { ok: false, reason: r.stderr.trim() || `gh api failed (status ${r.status})` };
  }
  return { ok: true, runId: match.id };
}

export async function repoCloneUrl({ host, project, token }) {
  return `https://x-access-token:${token}@${host || 'github.com'}/${project}.git`;
}

export async function patSetupUrl({ host, name, scopes }) {
  return `https://github.com/settings/tokens/new?description=${name}&scopes=${scopes.join(',')}`;
}
