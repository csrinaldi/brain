// providers.test.mjs — Integration tests for GitHub and GitLab provider verbs (PR2).
// Uses the exec.mjs test seam (setSpawn) to inject canned CLI output.
// Run with: npm test  (node --test, no dependencies)

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { setSpawn } from './lib/exec.mjs';

import * as github from './providers/github.mjs';
import * as gitlab from './providers/gitlab.mjs';

afterEach(() => setSpawn(spawnSync));

/** Returns a fake spawn function that always yields the given data as JSON stdout. */
const fakeSpawn = (data, status = 0) => () => ({
  status,
  stdout: typeof data === 'string' ? data : JSON.stringify(data),
  stderr: '',
});

// ── whoami ───────────────────────────────────────────────────────────────────────

test('github.whoami returns normalized username', async () => {
  setSpawn(fakeSpawn({ login: 'testuser' }));
  const result = await github.whoami();
  assert.deepEqual(result, { username: 'testuser' });
});

test('gitlab.whoami returns normalized username', async () => {
  setSpawn(fakeSpawn({ username: 'gluser' }));
  const result = await gitlab.whoami();
  assert.deepEqual(result, { username: 'gluser' });
});

// ── issueView ────────────────────────────────────────────────────────────────────

test('github.issueView returns normalized shape', async () => {
  setSpawn(fakeSpawn({ number: 42, title: 'Test issue', labels: [{ name: 'bug' }], body: 'Fix this' }));
  const result = await github.issueView({ project: 'o/r', number: 42 });
  assert.deepEqual(result, { number: 42, title: 'Test issue', labels: ['bug'], body: 'Fix this' });
});

// gitlab.issueView (issue #231 CP-A2b live-validation finding #12): migrated
// off the `glab` CLI to a direct GitLab API v4 fetch — the node:22 CI image
// has no `glab` binary, so the REQUIRED issue-link gate's defaultFetchIssue
// crashed on an INFRA trigger. Exercised here via an injected `fetchImpl`
// (never real network in tests) — no `setSpawn` fixture at all, which is
// itself the point: the DEFAULT path must never reach for a CLI.
test('gitlab.issueView returns normalized shape (direct API v4 fetch, no glab CLI)', async () => {
  let seenUrl;
  let seenHeaders;
  const result = await gitlab.issueView({
    project: 'g/r',
    number: 7,
    apiBase: 'https://gitlab.example.com/api/v4',
    token: 'tok-abc',
    fetchImpl: async (url, options) => {
      seenUrl = url;
      seenHeaders = options?.headers;
      return { ok: true, json: async () => ({ iid: 7, title: 'GL issue', labels: ['feat'], description: 'body text' }) };
    },
  });
  assert.equal(seenUrl, 'https://gitlab.example.com/api/v4/projects/g%2Fr/issues/7');
  assert.equal(seenHeaders?.['PRIVATE-TOKEN'], 'tok-abc');
  assert.deepEqual(result, { number: 7, title: 'GL issue', labels: ['feat'], body: 'body text' });
});

test('gitlab.issueView defaults apiBase to the public GitLab API when not provided (local/non-CI callers, e.g. ticket-start.mjs)', async () => {
  let seenUrl;
  await gitlab.issueView({
    project: 'g/r',
    number: 3,
    fetchImpl: async (url) => {
      seenUrl = url;
      return { ok: true, json: async () => ({ iid: 3, title: 't', labels: [], description: '' }) };
    },
  });
  assert.match(seenUrl, /^https:\/\/gitlab\.com\/api\/v4\//);
});

// ── Testing-lesson (finding #12 — the fixtures-injected-fetchIssue gap that
// hid this): prove the DEFAULT issueView implementation is CLI-free — it
// must never spawn `glab` (or any child process) regardless of what
// transport is injected. This is the exact regression class that let #12
// through: existing run-check.test.mjs fixtures always injected fetchIssue,
// so defaultFetchIssue's real vcs.issueView() call was never exercised. ────
test('gitlab.issueView never spawns a child process (glab CLI) — proves the default path is CLI-free, not just that injected logic works', async () => {
  let spawnCalled = false;
  setSpawn((...args) => {
    spawnCalled = true;
    return { status: 0, stdout: '{}', stderr: '' };
  });

  await gitlab.issueView({
    project: 'g/r',
    number: 7,
    fetchImpl: async () => ({ ok: true, json: async () => ({ iid: 7, title: 't', labels: [], description: '' }) }),
  });

  assert.equal(spawnCalled, false, 'issueView must never call spawn/execFile (glab CLI) — direct API v4 fetch only');
});

// ── issueList ────────────────────────────────────────────────────────────────────

test('github.issueList filters pull_request entries', async () => {
  setSpawn(fakeSpawn([
    { number: 1, title: 'Issue A', labels: [{ name: 'bug' }] },
    { number: 2, title: 'PR B', labels: [], pull_request: { url: 'https://github.com/o/r/pull/2' } },
  ]));
  const result = await github.issueList({ project: 'o/r', state: 'open' });
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], { number: 1, title: 'Issue A', labels: ['bug'] });
});

test('gitlab.issueList returns normalized array', async () => {
  setSpawn(fakeSpawn([{ iid: 10, title: 'GL Issue', labels: ['backend'] }]));
  const result = await gitlab.issueList({ project: 'g/r', state: 'open' });
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], { number: 10, title: 'GL Issue', labels: ['backend'] });
});

// ── mrList ───────────────────────────────────────────────────────────────────────

test('github.mrList returns headBranch from head.ref', async () => {
  setSpawn(fakeSpawn([{ number: 1, title: 'Fix', head: { ref: 'feat/foo' } }]));
  const result = await github.mrList({ project: 'o/r', state: 'open' });
  assert.deepEqual(result, [{ number: 1, title: 'Fix', headBranch: 'feat/foo' }]);
});

test('gitlab.mrList returns headBranch from source_branch', async () => {
  setSpawn(fakeSpawn([{ iid: 1, title: 'Fix', source_branch: 'feat/bar' }]));
  const result = await gitlab.mrList({ project: 'g/r', state: 'open' });
  assert.deepEqual(result, [{ number: 1, title: 'Fix', headBranch: 'feat/bar' }]);
});

// ── commitStatus ─────────────────────────────────────────────────────────────────

test('github.commitStatus maps a completed failure → failed', async () => {
  setSpawn(fakeSpawn({ check_runs: [{ status: 'completed', conclusion: 'failure' }] }));
  const result = await github.commitStatus({ project: 'o/r', sha: 'abc' });
  assert.equal(result, 'failed');
});

test('gitlab.commitStatus maps canceled → canceled', async () => {
  setSpawn(fakeSpawn([{ status: 'canceled' }]));
  const result = await gitlab.commitStatus({ project: 'g/r', sha: 'abc' });
  assert.equal(result, 'canceled');
});

test('github.commitStatus maps a running check (status in_progress, conclusion null) → running', async () => {
  setSpawn(fakeSpawn({ check_runs: [{ status: 'in_progress', conclusion: null }] }));
  const result = await github.commitStatus({ project: 'o/r', sha: 'abc' });
  assert.equal(result, 'running');
});

test('github.commitStatus returns null when there are no checks', async () => {
  setSpawn(fakeSpawn({ check_runs: [] }));
  const result = await github.commitStatus({ project: 'o/r', sha: 'abc' });
  assert.equal(result, null);
});

// ── checkRuns (issue #203 review fix F3 — direct provider-level coverage) ────────

test('github.checkRuns maps check_runs[].name entries to an array of bare names', async () => {
  setSpawn(fakeSpawn({
    check_runs: [{ name: 'issue-link' }, { name: 'diff-size' }],
  }));
  const result = await github.checkRuns({ project: 'o/r', branch: 'main' });
  assert.deepEqual(result, ['issue-link', 'diff-size']);
});

test('github.checkRuns resolves to [] when the seam throws (never throws itself)', async () => {
  setSpawn(() => ({ status: 1, stdout: '', stderr: 'HTTP 500: Internal Server Error' }));
  const result = await github.checkRuns({ project: 'o/r', branch: 'main' });
  assert.deepEqual(result, []);
});

test('gitlab.commitStatus maps a running pipeline → running', async () => {
  setSpawn(fakeSpawn([{ status: 'running' }]));
  const result = await gitlab.commitStatus({ project: 'g/r', sha: 'abc' });
  assert.equal(result, 'running');
});

// ── repoCloneUrl ─────────────────────────────────────────────────────────────────

test('github.repoCloneUrl builds x-access-token URL', async () => {
  const result = await github.repoCloneUrl({ host: 'github.com', project: 'o/r', token: 'tok' });
  assert.equal(result, 'https://x-access-token:tok@github.com/o/r.git');
});

test('gitlab.repoCloneUrl builds oauth2 URL', async () => {
  const result = await gitlab.repoCloneUrl({ host: 'gl.example.com', project: 'g/r', token: 'tok' });
  assert.equal(result, 'https://oauth2:tok@gl.example.com/g/r.git');
});

// ── patSetupUrl ──────────────────────────────────────────────────────────────────

test('github.patSetupUrl builds settings URL', async () => {
  const result = await github.patSetupUrl({ host: 'github.com', name: 'brain', scopes: ['read:user', 'repo'] });
  assert.equal(result, 'https://github.com/settings/tokens/new?description=brain&scopes=read:user,repo');
});

test('gitlab.patSetupUrl builds settings URL', async () => {
  const result = await gitlab.patSetupUrl({ host: 'gl.example.com', name: 'brain', scopes: ['api', 'read_user'] });
  assert.equal(result, 'https://gl.example.com/-/user_settings/personal_access_tokens?name=brain&scopes=api,read_user');
});

// ── projectResolve ───────────────────────────────────────────────────────────────

test('github.projectResolve returns project slug unchanged', async () => {
  const result = await github.projectResolve({ project: 'o/r' });
  assert.equal(result, 'o/r');
});

test('gitlab.projectResolve returns the slug unchanged (identity)', async () => {
  // GitLab's API accepts the URL-encoded path everywhere, so the slug is the
  // project identifier — no numeric-id lookup, keeping it usable by repoCloneUrl.
  const result = await gitlab.projectResolve({ project: 'g/r' });
  assert.equal(result, 'g/r');
});

// ── branchProtect ─────────────────────────────────────────────────────────────

test('github.branchProtect sends PUT with strict payload and returns {enforced:true} on exit 0', async () => {
  let captured = null;
  setSpawn((cmd, args, opts) => {
    captured = { cmd, args, opts };
    return { status: 0, stdout: '{}', stderr: '' };
  });

  const checks = ['governance / issue-link', 'governance / diff-size'];
  const result = await github.branchProtect({ project: 'o/r', checks });

  assert.ok(captured, 'spawn was called');
  assert.equal(captured.cmd, 'gh');
  assert.deepEqual(captured.args, [
    'api', '-X', 'PUT',
    'repos/o/r/branches/main/protection',
    '--input', '-',
  ]);

  const payload = JSON.parse(captured.opts.input);
  assert.equal(payload.required_status_checks.strict, true);
  assert.deepEqual(
    payload.required_status_checks.checks,
    [{ context: 'governance / issue-link' }, { context: 'governance / diff-size' }]
  );
  assert.equal(payload.enforce_admins, false);
  assert.equal(payload.required_pull_request_reviews.required_approving_review_count, 1);
  assert.equal(payload.restrictions, null);
  assert.equal(payload.allow_force_pushes, false);
  assert.equal(payload.allow_deletions, false);

  assert.deepEqual(result, { enforced: true });
});

test('github.branchProtect respects custom branch and requiredReviews', async () => {
  let captured = null;
  setSpawn((cmd, args, opts) => {
    captured = { cmd, args, opts };
    return { status: 0, stdout: '{}', stderr: '' };
  });

  const result = await github.branchProtect({ project: 'o/r', branch: 'develop', checks: [], requiredReviews: 2 });

  assert.ok(captured.args.includes('repos/o/r/branches/develop/protection'));
  const payload = JSON.parse(captured.opts.input);
  assert.equal(payload.required_pull_request_reviews.required_approving_review_count, 2);
  assert.deepEqual(result, { enforced: true });
});

test('github.branchProtect returns {enforced:false,reason:"tier"} on 403 / upgrade message', async () => {
  setSpawn(() => ({
    status: 1,
    stdout: '',
    stderr: 'HTTP 403: Upgrade to GitHub Pro or make this repository public to enable this feature.',
  }));

  const result = await github.branchProtect({ project: 'o/r', checks: [] });

  assert.equal(result.enforced, false);
  assert.equal(result.reason, 'tier');
  assert.ok(typeof result.remedy === 'string' && result.remedy.length > 0, 'remedy must be non-empty');
});

test('github.branchProtect returns {enforced:false,reason:"unsupported"} on other non-zero exit', async () => {
  setSpawn(() => ({
    status: 1,
    stdout: '',
    stderr: 'HTTP 500: Internal Server Error',
  }));

  const result = await github.branchProtect({ project: 'o/r', checks: [] });

  assert.equal(result.enforced, false);
  assert.equal(result.reason, 'unsupported');
  assert.ok(result.remedy.includes('HTTP 500'), 'remedy should include the stderr text');
});

test('github.branchProtect never throws even on non-zero exit', async () => {
  setSpawn(() => ({ status: 1, stdout: '', stderr: 'some error' }));

  let threw = false;
  try {
    await github.branchProtect({ project: 'o/r', checks: [] });
  } catch (_) {
    threw = true;
  }
  assert.equal(threw, false, 'branchProtect must not throw');
});

test('gitlab.branchProtect sends POST to protected_branches with allow_force_push=false and returns {enforced:true} on exit 0', async () => {
  const calls = [];
  setSpawn((cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return { status: 0, stdout: '{}', stderr: '' };
  });

  const checks = ['ci/test', 'ci/lint'];
  const result = await gitlab.branchProtect({ project: 'g/r', branch: 'main', checks });

  // First call must be the POST to protected_branches
  assert.ok(calls.length >= 1, 'spawn was called at least once');
  const postCall = calls[0];
  assert.equal(postCall.cmd, 'glab');
  assert.ok(postCall.args.some(a => a.includes('protected_branches')), 'must POST to protected_branches endpoint');
  assert.ok(
    postCall.args.indexOf('POST') !== -1 &&
    postCall.args[postCall.args.indexOf('-X') + 1] === 'POST',
    'must use -X POST'
  );
  assert.ok(postCall.args.includes('allow_force_push=false'), 'must disable force pushes');

  assert.deepEqual(result, { enforced: true });
});

test('gitlab.branchProtect makes best-effort pipeline call when checks is non-empty', async () => {
  const calls = [];
  setSpawn((cmd, args) => {
    calls.push(args);
    return { status: 0, stdout: '{}', stderr: '' };
  });

  await gitlab.branchProtect({ project: 'g/r', checks: ['ci/test'] });

  // Second call should be the PUT to enable pipeline enforcement
  assert.ok(calls.length === 2, 'should make two spawn calls when checks is non-empty');
  assert.ok(calls[1].includes('only_allow_merge_if_pipeline_succeeds=true'), 'second call must enable pipeline requirement');
});

test('gitlab.branchProtect skips pipeline call when checks is empty', async () => {
  let callCount = 0;
  setSpawn(() => {
    callCount++;
    return { status: 0, stdout: '{}', stderr: '' };
  });

  await gitlab.branchProtect({ project: 'g/r', checks: [] });

  assert.equal(callCount, 1, 'should make only one spawn call when checks is empty');
});

test('gitlab.branchProtect returns {enforced:true} when branch is already protected (409 — idempotent)', async () => {
  setSpawn(() => ({
    status: 1,
    stdout: '',
    stderr: 'POST https://gitlab.example.com/api/v4/projects/g%2Fr/protected_branches: 409\n{"message":"Protected Branch \'main\' already exists"}',
  }));

  const result = await gitlab.branchProtect({ project: 'g/r', checks: [] });
  assert.deepEqual(result, { enforced: true });
});

test('gitlab.branchProtect returns {enforced:false,reason:"auth"} on 401', async () => {
  setSpawn(() => ({
    status: 1,
    stdout: '',
    stderr: 'POST https://gitlab.example.com/api/v4/projects/g%2Fr/protected_branches: 401\n{"message":"401 Unauthorized"}',
  }));

  const result = await gitlab.branchProtect({ project: 'g/r', checks: [] });
  assert.equal(result.enforced, false);
  assert.equal(result.reason, 'auth');
  assert.notEqual(result.reason, 'tier', 'GitLab branchProtect must never return reason:tier');
  assert.ok(typeof result.remedy === 'string' && result.remedy.length > 0, 'remedy must be non-empty');
});

test('gitlab.branchProtect returns {enforced:false,reason:"permission"} on 403 — never reason:"tier"', async () => {
  setSpawn(() => ({
    status: 1,
    stdout: '',
    stderr: 'POST https://gitlab.example.com/api/v4/projects/g%2Fr/protected_branches: 403\n{"message":"403 Forbidden"}',
  }));

  const result = await gitlab.branchProtect({ project: 'g/r', checks: [] });
  assert.equal(result.enforced, false);
  assert.equal(result.reason, 'permission');
  assert.notEqual(result.reason, 'tier', 'GitLab branchProtect must never return reason:tier');
  assert.ok(typeof result.remedy === 'string' && result.remedy.length > 0, 'remedy must be non-empty');
});

test('gitlab.branchProtect: a 403 on a slug containing "409" is NOT a false-positive success', async () => {
  // Regression: the status must be matched anchored (": 409"), not anywhere in
  // stderr — a project slug like fix-409-auth must not flip a real 403 into enforced.
  setSpawn(() => ({
    status: 1,
    stdout: '',
    stderr: 'POST https://gitlab.example.com/api/v4/projects/org%2Ffix-409-auth/protected_branches: 403\n{"message":"403 Forbidden"}',
  }));

  const result = await gitlab.branchProtect({ project: 'org/fix-409-auth', checks: [] });
  assert.equal(result.enforced, false, 'a real 403 must not be misread as already-protected');
  assert.equal(result.reason, 'permission');
});

test('gitlab.branchProtect returns {enforced:true} even when the best-effort pipeline PUT fails', async () => {
  // POST (protect) succeeds; the optional only_allow_merge_if_pipeline_succeeds
  // PUT fails — that failure must NOT flip the result.
  let call = 0;
  setSpawn(() => {
    call += 1;
    return call === 1
      ? { status: 0, stdout: '{}', stderr: '' }                                  // POST succeeds
      : { status: 1, stdout: '', stderr: 'PUT .../projects/g%2Fr: 403\n{"message":"403 Forbidden"}' }; // PUT fails
  });

  const result = await gitlab.branchProtect({ project: 'g/r', checks: ['ci/test'] });
  assert.deepEqual(result, { enforced: true });
  assert.equal(call, 2, 'both the POST and the best-effort PUT must have been attempted');
});

test('gitlab.branchProtect returns {enforced:false,reason:"unsupported"} on unexpected error', async () => {
  setSpawn(() => ({
    status: 1,
    stdout: '',
    stderr: 'POST https://gitlab.example.com/api/v4/projects/g%2Fr/protected_branches: 500\n{"message":"Internal Server Error"}',
  }));

  const result = await gitlab.branchProtect({ project: 'g/r', checks: [] });
  assert.equal(result.enforced, false);
  assert.equal(result.reason, 'unsupported');
  assert.notEqual(result.reason, 'tier', 'GitLab branchProtect must never return reason:tier');
  assert.ok(result.remedy.includes('500') || result.remedy.length > 0, 'remedy should include error detail');
});

test('gitlab.branchProtect never throws even on non-zero exit', async () => {
  setSpawn(() => ({ status: 1, stdout: '', stderr: 'some error' }));

  let threw = false;
  try {
    await gitlab.branchProtect({ project: 'g/r', checks: [] });
  } catch (_) {
    threw = true;
  }
  assert.equal(threw, false, 'branchProtect must not throw');
});

// ── capabilities ──────────────────────────────────────────────────────────────

test('github.capabilities returns {hardEnforcement:"available"} when probe succeeds (200)', async () => {
  setSpawn(() => ({ status: 0, stdout: '{"url":"..."}', stderr: '' }));
  const result = await github.capabilities({ project: 'cap/ok', branch: 'main' });
  assert.equal(result.hardEnforcement, 'available');
});

test('github.capabilities returns {hardEnforcement:"available"} on 404 (protection not yet set)', async () => {
  setSpawn(() => ({ status: 1, stdout: '', stderr: 'HTTP 404: Not Found' }));
  const result = await github.capabilities({ project: 'cap/noprot', branch: 'main' });
  assert.equal(result.hardEnforcement, 'available');
});

test('github.capabilities returns {hardEnforcement:"unavailable"} on 403', async () => {
  setSpawn(() => ({
    status: 1,
    stdout: '',
    stderr: 'HTTP 403: Upgrade to GitHub Pro to enable this feature.',
  }));
  const result = await github.capabilities({ project: 'cap/tier', branch: 'main' });
  assert.equal(result.hardEnforcement, 'unavailable');
  assert.ok(typeof result.remedy === 'string' && result.remedy.length > 0, 'remedy must be present');
});

test('github.capabilities returns {hardEnforcement:"unknown"} on unexpected error', async () => {
  setSpawn(() => ({ status: 1, stdout: '', stderr: 'HTTP 500: Internal Server Error' }));
  const result = await github.capabilities({ project: 'cap/err', branch: 'main' });
  assert.equal(result.hardEnforcement, 'unknown');
});

test('gitlab.capabilities returns {hardEnforcement:"available"} when GET protected_branches succeeds', async () => {
  setSpawn(() => ({ status: 0, stdout: '[]', stderr: '' }));
  const result = await gitlab.capabilities({ project: 'gl-cap/ok', branch: 'main' });
  assert.equal(result.hardEnforcement, 'available');
  assert.equal(result.remedy, undefined, 'no remedy when available');
});

test('gitlab.capabilities returns {hardEnforcement:"unavailable"} on 401', async () => {
  setSpawn(() => ({
    status: 1,
    stdout: '',
    stderr: 'GET https://gitlab.example.com/api/v4/projects/gl-cap%2Fauth/protected_branches: 401\n{"message":"401 Unauthorized"}',
  }));
  const result = await gitlab.capabilities({ project: 'gl-cap/auth', branch: 'main' });
  assert.equal(result.hardEnforcement, 'unavailable');
  assert.ok(typeof result.remedy === 'string' && result.remedy.length > 0, 'remedy must be present');
});

test('gitlab.capabilities returns {hardEnforcement:"unavailable"} on 403', async () => {
  setSpawn(() => ({
    status: 1,
    stdout: '',
    stderr: 'GET https://gitlab.example.com/api/v4/projects/gl-cap%2Fperm/protected_branches: 403\n{"message":"403 Forbidden"}',
  }));
  const result = await gitlab.capabilities({ project: 'gl-cap/perm', branch: 'main' });
  assert.equal(result.hardEnforcement, 'unavailable');
  assert.ok(typeof result.remedy === 'string' && result.remedy.length > 0, 'remedy must be present');
});

test('gitlab.capabilities returns {hardEnforcement:"unknown"} on unexpected error', async () => {
  setSpawn(() => ({ status: 1, stdout: '', stderr: 'HTTP 500: Internal Server Error' }));
  const result = await gitlab.capabilities({ project: 'gl-cap/err', branch: 'main' });
  assert.equal(result.hardEnforcement, 'unknown');
});

test('gitlab.capabilities caches result and does not spawn twice for the same project:branch', async () => {
  let spawnCount = 0;
  setSpawn(() => {
    spawnCount++;
    return { status: 0, stdout: '[]', stderr: '' };
  });

  const r1 = await gitlab.capabilities({ project: 'gl-cap/cache', branch: 'main' });
  const r2 = await gitlab.capabilities({ project: 'gl-cap/cache', branch: 'main' });

  assert.equal(spawnCount, 1, 'spawn should be called only once (cache hit on second call)');
  assert.strictEqual(r1, r2, 'second call returns the same cached object reference');
  assert.equal(r1.hardEnforcement, 'available');
});

// ── mrCreate ──────────────────────────────────────────────────────────────────

test('github.mrCreate returns {url} on success', async () => {
  setSpawn(() => ({
    status: 0,
    stdout: 'https://github.com/o/r/pull/42\n',
    stderr: '',
  }));
  const result = await github.mrCreate({
    project: 'o/r',
    title: 'feat: my PR',
    body: 'Closes #10',
    head: 'feature/my-branch',
    base: 'main',
    labels: ['kind:feature'],
  });
  assert.equal(result.url, 'https://github.com/o/r/pull/42');
  assert.equal(result.error, undefined);
});

test('github.mrCreate returns {url:null, error} on failure (never throws)', async () => {
  setSpawn(() => ({
    status: 1,
    stdout: '',
    stderr: 'HTTP 422: Validation failed',
  }));
  const result = await github.mrCreate({
    project: 'o/r',
    title: 'feat: bad PR',
    body: 'no issue ref',
    head: 'feature/bad',
    base: 'main',
  });
  assert.equal(result.url, null);
  assert.ok(typeof result.error === 'string' && result.error.length > 0,
    'error should be a non-empty string');
});

test('gitlab.mrCreate returns {url:null, error} stub — Phase 3', async () => {
  const result = await gitlab.mrCreate({ project: 'g/r', title: 'T', body: 'B', head: 'h' });
  assert.equal(result.url, null);
  assert.ok(typeof result.error === 'string' && result.error.includes('Phase 3'));
});

// ── prView ────────────────────────────────────────────────────────────────────

test('github.prView returns { number, labels, body, author } on success', async () => {
  setSpawn(fakeSpawn({
    number: 42,
    labels: [{ name: 'size:exception' }, { name: 'kind:feature' }],
    body: 'Closes #10\n\nDetails here.',
    author: { login: 'alice' },
  }));
  const result = await github.prView({ project: 'o/r', number: 42 });
  assert.deepEqual(result, {
    number: 42,
    labels: ['size:exception', 'kind:feature'],
    body: 'Closes #10\n\nDetails here.',
    author: 'alice',
  });
});

test('github.prView returns { number, labels: null, body: null, author: null } on gh failure (never throws) — REQ-CIC-2 uncomputable, not genuinely-empty', async () => {
  setSpawn(() => ({ status: 1, stdout: '', stderr: 'not found' }));
  const result = await github.prView({ project: 'o/r', number: 99 });
  assert.deepEqual(result, { number: 99, labels: null, body: null, author: null });
});

test('github.prView returns { number, labels: null, body: null, author: null } on malformed JSON (never throws)', async () => {
  setSpawn(() => ({ status: 0, stdout: 'not-json', stderr: '' }));
  const result = await github.prView({ project: 'o/r', number: 5 });
  assert.deepEqual(result, { number: 5, labels: null, body: null, author: null });
});

test('github.prView body defaults to "" (genuinely empty) when field absent in an otherwise-successful response', async () => {
  setSpawn(fakeSpawn({ number: 3, labels: [], body: null, author: null }));
  const result = await github.prView({ project: 'o/r', number: 3 });
  assert.equal(result.body, '');
});

test('github.prView author defaults to null when absent from an otherwise-successful response', async () => {
  setSpawn(fakeSpawn({ number: 3, labels: [], body: 'x' }));
  const result = await github.prView({ project: 'o/r', number: 3 });
  assert.equal(result.author, null);
});

test('gitlab.prView returns { number, labels: [], body: "" } stub — Phase 3', async () => {
  const result = await gitlab.prView({ project: 'g/r', number: 7 });
  assert.deepEqual(result, { number: 7, labels: [], body: '' });
});
