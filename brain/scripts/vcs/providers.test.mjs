// providers.test.mjs — Integration tests for GitHub and GitLab provider verbs (PR2).
// Uses the exec.mjs test seam (setSpawn) to inject canned CLI output.
// Run with: npm test  (node --test, no dependencies)

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

const FIXTURES_DIR = fileURLToPath(new URL('./fixtures/', import.meta.url));

/** Loads and parses a fixture JSON file by name. */
function loadFixture(name) {
  return JSON.parse(readFileSync(`${FIXTURES_DIR}${name}`, 'utf8'));
}

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
  setSpawn(fakeSpawn({ number: 42, title: 'Test issue', labels: [{ name: 'bug' }], body: 'Fix this', user: { login: 'alice' } }));
  const result = await github.issueView({ project: 'o/r', number: 42 });
  assert.deepEqual(result, { number: 42, title: 'Test issue', labels: ['bug'], body: 'Fix this', author: 'alice' });
});

// issueView gains `author` (issue #239 A3 TASK1 — a fresh-context review
// finding): actor-check.mjs's gatherActorCheckInputs needs the issue AUTHOR
// (REQ-L5-1 compares against both the PR author and the issue author), which
// the pre-A3-TASK1 contract never exposed — the same underlying API call
// already returns it (GH `user.login`, GL `author.username`), no extra
// round-trip.
test('github.issueView author defaults to null when the underlying user field is absent', async () => {
  setSpawn(fakeSpawn({ number: 5, title: 't', labels: [], body: '' }));
  const result = await github.issueView({ project: 'o/r', number: 5 });
  assert.equal(result.author, null);
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
      return { ok: true, json: async () => ({ iid: 7, title: 'GL issue', labels: ['feat'], description: 'body text', author: { username: 'bob' } }) };
    },
  });
  assert.equal(seenUrl, 'https://gitlab.example.com/api/v4/projects/g%2Fr/issues/7');
  assert.equal(seenHeaders?.['PRIVATE-TOKEN'], 'tok-abc');
  assert.deepEqual(result, { number: 7, title: 'GL issue', labels: ['feat'], body: 'body text', author: 'bob' });
});

test('gitlab.issueView author defaults to null when the underlying author field is absent', async () => {
  const result = await gitlab.issueView({
    project: 'g/r',
    number: 9,
    fetchImpl: async () => ({ ok: true, json: async () => ({ iid: 9, title: 't', labels: [], description: '' }) }),
  });
  assert.equal(result.author, null);
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

// ── projectMergeSettings (issue #244 A4) ────────────────────────────────────────
// The project-level merge gate (only_allow_merge_if_pipeline_succeeds) has no
// protected_branches equivalent — capabilities()/branchProtect() cannot surface
// it (design Decision 2). Fixture shape pinned by fixtures/gitlab-project.json
// (derived, _provenance-stamped — REQ-A4-5).

test('gitlab.projectMergeSettings parses only_allow_merge_if_pipeline_succeeds:true from the fixture', async () => {
  const fixture = loadFixture('gitlab-project.json');
  setSpawn(fakeSpawn(fixture.data));
  const result = await gitlab.projectMergeSettings({ project: 'g/r' });
  assert.deepEqual(result, { onlyAllowMergeIfPipelineSucceeds: true });
});

test('gitlab.projectMergeSettings parses only_allow_merge_if_pipeline_succeeds:false', async () => {
  const fixture = loadFixture('gitlab-project.json');
  setSpawn(fakeSpawn({ ...fixture.data, only_allow_merge_if_pipeline_succeeds: false }));
  const result = await gitlab.projectMergeSettings({ project: 'g/r' });
  assert.deepEqual(result, { onlyAllowMergeIfPipelineSucceeds: false });
});

test('gitlab.projectMergeSettings returns {onlyAllowMergeIfPipelineSucceeds:null} on a failed glab api read (never a fabricated false)', async () => {
  setSpawn(() => ({ status: 1, stdout: '', stderr: 'GET https://gitlab.example.com/api/v4/projects/g%2Fr: 404\n{"message":"404 Not Found"}' }));
  const result = await gitlab.projectMergeSettings({ project: 'g/r' });
  assert.deepEqual(result, { onlyAllowMergeIfPipelineSucceeds: null });
});

test('gitlab.projectMergeSettings returns {onlyAllowMergeIfPipelineSucceeds:null} on unparsable JSON, never throws', async () => {
  setSpawn(() => ({ status: 0, stdout: 'not json', stderr: '' }));
  await assert.doesNotReject(async () => {
    const result = await gitlab.projectMergeSettings({ project: 'g/r' });
    assert.deepEqual(result, { onlyAllowMergeIfPipelineSucceeds: null });
  });
});

test('gitlab.projectMergeSettings returns {onlyAllowMergeIfPipelineSucceeds:null} when the glab api read succeeds but the field is absent from the response (never a fabricated false — GitLab permission-gates some project attributes)', async () => {
  // 200 OK, parseable JSON, but only_allow_merge_if_pipeline_succeeds is
  // simply missing from the payload (a real case, distinct from a read
  // failure or unparsable body) — Boolean(undefined) would fabricate `false`
  // ("readable, not configured") instead of the honest `null` (uncomputable).
  setSpawn(fakeSpawn({ id: 1, path_with_namespace: 'g/r', default_branch: 'main' }));
  const result = await gitlab.projectMergeSettings({ project: 'g/r' });
  assert.deepEqual(result, { onlyAllowMergeIfPipelineSucceeds: null });
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

// gitlab.mrCreate (issue #239 A3 Phase 2 — un-stub over the shared
// gitlabApiFetch transport, POST /projects/:id/merge_requests). Matches the
// github.mrCreate contract exactly: { url } on success, { url: null, error }
// on failure, never throws.
test('gitlab.mrCreate returns { url } on success, POSTing the normalized payload over gitlabApiFetch', async () => {
  let seenUrl;
  let seenOptions;
  const result = await gitlab.mrCreate({
    project: 'g/r',
    title: 'feat: my MR',
    body: 'Closes #10',
    head: 'feature/my-branch',
    base: 'main',
    labels: ['kind:feature', 'size:m'],
    apiBase: 'https://gitlab.example.com/api/v4',
    token: 'tok-abc',
    fetchImpl: async (url, options) => {
      seenUrl = url;
      seenOptions = options;
      return { ok: true, json: async () => ({ web_url: 'https://gitlab.example.com/g/r/-/merge_requests/42' }) };
    },
  });
  assert.equal(seenUrl, 'https://gitlab.example.com/api/v4/projects/g%2Fr/merge_requests');
  assert.equal(seenOptions.method, 'POST');
  assert.equal(seenOptions.headers['PRIVATE-TOKEN'], 'tok-abc');
  assert.deepEqual(JSON.parse(seenOptions.body), {
    source_branch: 'feature/my-branch',
    target_branch: 'main',
    title: 'feat: my MR',
    description: 'Closes #10',
    labels: 'kind:feature,size:m',
  });
  assert.deepEqual(result, { url: 'https://gitlab.example.com/g/r/-/merge_requests/42' });
});

test('gitlab.mrCreate omits the labels field when no labels are given (never sends an empty string)', async () => {
  let seenOptions;
  await gitlab.mrCreate({
    project: 'g/r',
    title: 'T',
    body: 'B',
    head: 'h',
    fetchImpl: async (url, options) => {
      seenOptions = options;
      return { ok: true, json: async () => ({ web_url: 'https://x' }) };
    },
  });
  assert.equal('labels' in JSON.parse(seenOptions.body), false);
});

test('gitlab.mrCreate base defaults to "main" when not provided', async () => {
  let sentBody;
  await gitlab.mrCreate({
    project: 'g/r',
    title: 'T',
    body: 'B',
    head: 'h',
    fetchImpl: async (url, options) => {
      sentBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ web_url: 'https://x' }) };
    },
  });
  assert.equal(sentBody.target_branch, 'main');
});

test('gitlab.mrCreate returns { url: null, error } on failure (never throws)', async () => {
  const result = await gitlab.mrCreate({
    project: 'g/r',
    title: 'T',
    body: 'B',
    head: 'h',
    fetchImpl: async () => ({ ok: false, status: 422 }),
  });
  assert.equal(result.url, null);
  assert.ok(typeof result.error === 'string' && result.error.length > 0,
    'error should be a non-empty string');
});

// ── prView ────────────────────────────────────────────────────────────────────

/**
 * Fake spawn distinguishing the two calls prView now makes: the main
 * `gh pr view --json ...` call (`args[0] === 'pr'`) and the supplementary
 * `gh api repos/{owner}/{repo}/pulls/{n} --jq .base.sha` call
 * (`args[0] === 'api'`, ADR-0022) — which returns a RAW trimmed sha string,
 * not JSON, so it cannot share `fakeSpawn`'s uniform JSON-stringify shape.
 */
function fakePrViewSpawn(mainData, baseSha) {
  return (_cmd, args) =>
    args[0] === 'pr'
      ? { status: 0, stdout: JSON.stringify(mainData), stderr: '' }
      : { status: 0, stdout: `${baseSha}\n`, stderr: '' };
}

test('github.prView returns { number, labels, body, author, headRefOid, baseRefOid } on success', async () => {
  setSpawn(fakePrViewSpawn({
    number: 42,
    labels: [{ name: 'size:exception' }, { name: 'kind:feature' }],
    body: 'Closes #10\n\nDetails here.',
    author: { login: 'alice' },
    headRefOid: 'cafef00dcafef00dcafef00dcafef00dcafef00d',
  }, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'));
  const result = await github.prView({ project: 'o/r', number: 42 });
  assert.deepEqual(result, {
    number: 42,
    labels: ['size:exception', 'kind:feature'],
    body: 'Closes #10\n\nDetails here.',
    author: 'alice',
    headRefOid: 'cafef00dcafef00dcafef00dcafef00dcafef00d',
    baseRefOid: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  });
});

test('github.prView returns { number, labels: null, body: null, author: null, headRefOid: null, baseRefOid: null } on gh failure (never throws) — REQ-CIC-2 uncomputable, not genuinely-empty', async () => {
  setSpawn(() => ({ status: 1, stdout: '', stderr: 'not found' }));
  const result = await github.prView({ project: 'o/r', number: 99 });
  assert.deepEqual(result, { number: 99, labels: null, body: null, author: null, headRefOid: null, baseRefOid: null });
});

test('github.prView returns { number, labels: null, body: null, author: null, headRefOid: null, baseRefOid: null } on malformed JSON (never throws)', async () => {
  setSpawn(() => ({ status: 0, stdout: 'not-json', stderr: '' }));
  const result = await github.prView({ project: 'o/r', number: 5 });
  assert.deepEqual(result, { number: 5, labels: null, body: null, author: null, headRefOid: null, baseRefOid: null });
});

test('github.prView headRefOid defaults to null when absent from an otherwise-successful response', async () => {
  setSpawn(fakePrViewSpawn({ number: 3, labels: [], body: 'x', author: null }, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'));
  const result = await github.prView({ project: 'o/r', number: 3 });
  assert.equal(result.headRefOid, null);
});

// baseRefOid (ADR-0022 Decision 1) — the strict supplementary `gh api
// repos/{owner}/{repo}/pulls/{n} --jq .base.sha` call.

test('github.prView baseRefOid comes from the supplementary gh api .../pulls/{n} --jq .base.sha call', async () => {
  setSpawn(fakePrViewSpawn(
    { number: 7, labels: [], body: '', author: null, headRefOid: 'cafef00dcafef00dcafef00dcafef00dcafef00d' },
    'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  ));
  const result = await github.prView({ project: 'o/r', number: 7 });
  assert.equal(result.baseRefOid, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
});

test('github.prView baseRefOid defaults to null when the supplementary call fails but the main fetch succeeded (other fields preserved)', async () => {
  setSpawn((_cmd, args) =>
    args[0] === 'pr'
      ? { status: 0, stdout: JSON.stringify({ number: 7, labels: [], body: '', author: null, headRefOid: 'cafef00dcafef00dcafef00dcafef00dcafef00d' }), stderr: '' }
      : { status: 1, stdout: '', stderr: 'not found' }
  );
  const result = await github.prView({ project: 'o/r', number: 7 });
  assert.equal(result.baseRefOid, null);
  assert.equal(result.headRefOid, 'cafef00dcafef00dcafef00dcafef00dcafef00d', 'a failed supplementary call must not blank out fields the main fetch already resolved');
  assert.equal(result.body, '', 'a failed supplementary call must not blank out fields the main fetch already resolved');
});

test('github.prView does not attempt the supplementary gh api call when the main gh pr view call fails', async () => {
  let calls = 0;
  setSpawn(() => { calls++; return { status: 1, stdout: '', stderr: 'not found' }; });
  await github.prView({ project: 'o/r', number: 99 });
  assert.equal(calls, 1, 'a main-fetch failure must short-circuit before the supplementary call — never a second spawn');
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

// gitlab.prView (issue #239 A3 Phase 2 — un-stub over the shared
// gitlabApiFetch transport, GET /projects/:id/merge_requests/:iid). Exercised
// via an injected fetchImpl (no setSpawn fixture), same discipline as
// issueView/labelEvents/prReviews — the DEFAULT path must never reach for the
// glab CLI.
test('gitlab.prView returns { number, labels, body, author, headRefOid, baseRefOid } normalized, over the shared gitlabApiFetch transport', async () => {
  let seenUrl;
  let seenHeaders;
  const result = await gitlab.prView({
    project: 'g/r',
    number: 42,
    apiBase: 'https://gitlab.example.com/api/v4',
    token: 'tok-abc',
    fetchImpl: async (url, options) => {
      seenUrl = url;
      seenHeaders = options?.headers;
      return {
        ok: true,
        json: async () => ({
          iid: 42,
          labels: ['size:exception', 'kind:feature'],
          description: 'Closes #10\n\nDetails here.',
          author: { username: 'alice' },
          sha: 'cafef00dcafef00dcafef00dcafef00dcafef00d',
          diff_refs: { base_sha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' },
        }),
      };
    },
  });
  assert.equal(seenUrl, 'https://gitlab.example.com/api/v4/projects/g%2Fr/merge_requests/42');
  assert.equal(seenHeaders?.['PRIVATE-TOKEN'], 'tok-abc');
  assert.deepEqual(result, {
    number: 42,
    labels: ['size:exception', 'kind:feature'],
    body: 'Closes #10\n\nDetails here.',
    author: 'alice',
    headRefOid: 'cafef00dcafef00dcafef00dcafef00dcafef00d',
    baseRefOid: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  });
});

test('gitlab.prView headRefOid falls back to diff_refs.head_sha when the top-level sha is absent', async () => {
  const result = await gitlab.prView({
    project: 'g/r',
    number: 42,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        iid: 42,
        labels: [],
        description: '',
        author: { username: 'alice' },
        diff_refs: { head_sha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' },
      }),
    }),
  });
  assert.equal(result.headRefOid, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
});

test('gitlab.prView headRefOid defaults to null when neither sha nor diff_refs.head_sha is present', async () => {
  const result = await gitlab.prView({
    project: 'g/r',
    number: 42,
    fetchImpl: async () => ({ ok: true, json: async () => ({ iid: 42, labels: [], description: '', author: null }) }),
  });
  assert.equal(result.headRefOid, null);
});

// baseRefOid (ADR-0022 Decision 1) — read directly off the already-fetched MR
// payload's diff_refs.base_sha, no second request (unlike GitHub).

test('gitlab.prView baseRefOid normalizes from diff_refs.base_sha', async () => {
  const result = await gitlab.prView({
    project: 'g/r',
    number: 42,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ iid: 42, labels: [], description: '', author: null, diff_refs: { base_sha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' } }),
    }),
  });
  assert.equal(result.baseRefOid, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
});

test('gitlab.prView baseRefOid defaults to null when diff_refs.base_sha is absent on an otherwise-successful fetch', async () => {
  const result = await gitlab.prView({
    project: 'g/r',
    number: 42,
    fetchImpl: async () => ({ ok: true, json: async () => ({ iid: 42, labels: [], description: '', author: null }) }),
  });
  assert.equal(result.baseRefOid, null);
});

test('gitlab.prView returns { number, labels: null, body: null, author: null, headRefOid: null, baseRefOid: null } on fetch failure (never throws) — uncomputable, not genuinely-empty', async () => {
  const result = await gitlab.prView({
    project: 'g/r',
    number: 99,
    fetchImpl: async () => ({ ok: false, status: 404 }),
  });
  assert.deepEqual(result, { number: 99, labels: null, body: null, author: null, headRefOid: null, baseRefOid: null });
});

test('gitlab.prView author defaults to null when absent from an otherwise-successful response', async () => {
  const result = await gitlab.prView({
    project: 'g/r',
    number: 3,
    fetchImpl: async () => ({ ok: true, json: async () => ({ iid: 3, labels: [], description: '' }) }),
  });
  assert.equal(result.author, null);
});

test('gitlab.prView defaults apiBase to the public GitLab API when not provided (local/non-CI callers)', async () => {
  let seenUrl;
  await gitlab.prView({
    project: 'g/r',
    number: 3,
    fetchImpl: async (url) => {
      seenUrl = url;
      return { ok: true, json: async () => ({ iid: 3, labels: [], description: '' }) };
    },
  });
  assert.match(seenUrl, /^https:\/\/gitlab\.com\/api\/v4\//);
});

test('gitlab.prView never spawns a child process (glab CLI) — proves the default path is CLI-free', async () => {
  let spawnCalled = false;
  setSpawn(() => {
    spawnCalled = true;
    return { status: 0, stdout: '{}', stderr: '' };
  });

  await gitlab.prView({
    project: 'g/r',
    number: 7,
    fetchImpl: async () => ({ ok: true, json: async () => ({ iid: 7, labels: [], description: '' }) }),
  });

  assert.equal(spawnCalled, false, 'prView must never call spawn/execFile (glab CLI) — direct API v4 fetch only');
});

// ── labelEvents (issue #239 A3, D1 — the labelEvents CONTRACT verb) ──────────
//
// GitHub: EXTRACTED from actor-check.mjs's inline defaultFetchLabeledEvents
// (m3 close), preserving --paginate. GitLab: over gitlabApiFetch
// (resource_label_events), never the glab CLI (a GATE_FILE, same discipline
// as issueView). Both normalize to { actor: { login }, action, label, at },
// ascending by `at`; a thrown fetch → null (never a fabricated []).

test('github.labelEvents normalizes labeled/unlabeled events to the shared shape, ascending by at, dropping non-label events', async () => {
  setSpawn(fakeSpawn([
    { event: 'commented', actor: { login: 'carol' }, created_at: '2024-01-01T00:00:00Z' },
    { event: 'unlabeled', label: { name: 'status:approved' }, actor: { login: 'alice' }, created_at: '2024-01-03T00:00:00Z' },
    { event: 'labeled', label: { name: 'status:approved' }, actor: { login: 'bob' }, created_at: '2024-01-02T00:00:00Z' },
  ]));
  const result = await github.labelEvents({ project: 'o/r', number: 42 });
  assert.deepEqual(result, [
    { actor: { login: 'bob' }, action: 'add', label: 'status:approved', at: '2024-01-02T00:00:00Z' },
    { actor: { login: 'alice' }, action: 'remove', label: 'status:approved', at: '2024-01-03T00:00:00Z' },
  ]);
});

test('github.labelEvents returns null (never []) when the underlying gh api call throws', async () => {
  setSpawn(() => ({ status: 1, stdout: '', stderr: 'HTTP 500: Internal Server Error' }));
  const result = await github.labelEvents({ project: 'o/r', number: 42 });
  assert.equal(result, null);
});

test('gitlab.labelEvents normalizes resource_label_events to the shared shape, ascending by at, over the shared gitlabApiFetch transport', async () => {
  let seenUrl;
  const result = await gitlab.labelEvents({
    project: 'g/r',
    number: 7,
    apiBase: 'https://gitlab.example.com/api/v4',
    token: 'tok-abc',
    fetchImpl: async (url) => {
      seenUrl = url;
      return {
        ok: true,
        json: async () => ([
          { user: { username: 'alice' }, action: 'remove', label: { name: 'status::approved' }, created_at: '2024-01-03T00:00:00Z' },
          { user: { username: 'bob' }, action: 'add', label: { name: 'status::approved' }, created_at: '2024-01-02T00:00:00Z' },
        ]),
      };
    },
  });
  assert.equal(seenUrl, 'https://gitlab.example.com/api/v4/projects/g%2Fr/issues/7/resource_label_events');
  assert.deepEqual(result, [
    { actor: { login: 'bob' }, action: 'add', label: 'status::approved', at: '2024-01-02T00:00:00Z' },
    { actor: { login: 'alice' }, action: 'remove', label: 'status::approved', at: '2024-01-03T00:00:00Z' },
  ]);
});

// FIX1 fail-open guard, MOVED with the extraction (issue #239 A3, m3 close):
// `gh api` does NOT auto-paginate. GitHub's Events API is oldest-first, so on
// an issue with more than ~30 events the most recent approved-label event
// (including a late self-applied one) lands on page 2+ and is silently
// dropped — self-approval would then wrongly PASS. Guard via source-scan
// (mirrors the neutrality source-scan style in phase-order-check.test.mjs and
// actor-check.test.mjs's pre-A3 FIX1 guard, now here alongside the code).
test('github.labelEvents source includes --paginate on the gh api events call (FIX1 fail-open guard)', async () => {
  const srcPath = fileURLToPath(new URL('./providers/github.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  const fnStart = src.indexOf('export async function labelEvents');
  assert.notEqual(fnStart, -1, 'labelEvents not found in github.mjs');
  const fnEnd = src.indexOf('\nexport async function ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);
  assert.match(fnBody, /issues\/\$\{number\}\/events/, 'sanity: events endpoint present');
  assert.match(
    fnBody,
    /--paginate/,
    'events fetch must use --paginate — otherwise a truncated page 1 can hide the newest labeled event (fail-open)'
  );
});

test('gitlab.labelEvents returns null (never []) when the underlying fetch throws', async () => {
  const result = await gitlab.labelEvents({
    project: 'g/r',
    number: 7,
    fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }),
  });
  assert.equal(result, null);
});

// ── prReviews (issue #239 A3 TASK2/4th-violation fix — the brain-writes-reviewed
// L6 gate's defaultFetchReviews was STILL gh-CLI-hardcoded, the same defect
// class as labelEvents pre-fix and finding #14). GitHub: EXTRACTED from
// brain-writes-reviewed.mjs's inline defaultFetchReviews, preserving
// --paginate. GitLab: over gitlabApiFetch's merge_requests/:iid/approvals
// endpoint (GitLab has no per-reviewer review-state history like GitHub's
// Reviews API — approvals is the closest analog: each approver normalizes to
// one { state:'APPROVED', author } entry, matching what
// evaluateBrainWritesReviewed actually consumes — only APPROVED entries are
// counted toward approvers; a genuinely empty approvals list still warns via
// the existing "no reviews at all" branch).

test('github.prReviews normalizes gh reviews to { state, author }', async () => {
  setSpawn(fakeSpawn([
    { state: 'COMMENTED', user: { login: 'carol' } },
    { state: 'APPROVED', user: { login: 'bob' } },
  ]));
  const result = await github.prReviews({ project: 'o/r', number: 144 });
  assert.deepEqual(result, [
    { state: 'COMMENTED', author: 'carol' },
    { state: 'APPROVED', author: 'bob' },
  ]);
});

test('github.prReviews returns null (never []) when the underlying gh api call throws', async () => {
  setSpawn(() => ({ status: 1, stdout: '', stderr: 'HTTP 500: Internal Server Error' }));
  const result = await github.prReviews({ project: 'o/r', number: 144 });
  assert.equal(result, null);
});

test('github.prReviews source includes --paginate on the gh api reviews call (fail-open guard, moved with the extraction)', () => {
  const srcPath = fileURLToPath(new URL('./providers/github.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  const fnStart = src.indexOf('export async function prReviews');
  assert.notEqual(fnStart, -1, 'prReviews not found in github.mjs');
  const fnEnd = src.indexOf('\nexport async function ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);
  assert.match(fnBody, /pulls\/\$\{number\}\/reviews/, 'sanity: PR reviews endpoint present');
  assert.match(fnBody, /--paginate/, 'reviews fetch must use --paginate — otherwise a truncated page 1 can hide later reviews');
});

test('gitlab.prReviews normalizes approvals.approved_by to one {state:"APPROVED", author} entry per approver, over the shared gitlabApiFetch transport', async () => {
  let seenUrl;
  const result = await gitlab.prReviews({
    project: 'g/r',
    number: 7,
    apiBase: 'https://gitlab.example.com/api/v4',
    token: 'tok-abc',
    fetchImpl: async (url) => {
      seenUrl = url;
      return { ok: true, json: async () => ({ approved_by: [{ user: { username: 'bob' } }] }) };
    },
  });
  assert.equal(seenUrl, 'https://gitlab.example.com/api/v4/projects/g%2Fr/merge_requests/7/approvals');
  assert.deepEqual(result, [{ state: 'APPROVED', author: 'bob' }]);
});

test('gitlab.prReviews returns [] (genuinely zero approvals, not uncomputable) when approved_by is empty', async () => {
  const result = await gitlab.prReviews({
    project: 'g/r',
    number: 7,
    fetchImpl: async () => ({ ok: true, json: async () => ({ approved_by: [] }) }),
  });
  assert.deepEqual(result, []);
});

test('gitlab.prReviews returns null (never []) when the underlying fetch throws', async () => {
  const result = await gitlab.prReviews({
    project: 'g/r',
    number: 7,
    fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }),
  });
  assert.equal(result, null);
});
