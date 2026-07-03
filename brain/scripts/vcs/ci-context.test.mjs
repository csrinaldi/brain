// ci-context.test.mjs — Unit tests for the CI context normalization seam
// (ADR-0016, REQ-CIC-1..5, openspec/changes/issue-193-ci-context-design/specs/ci-context/spec.md).
// Run with: npm test (node --test).
//
// All tests use an injectable `env` (and, for GitLab, an injectable `fetchImpl`/`fetchMr`)
// — no test spawns a real `gh`/`glab` process or touches the real network (same
// CI-fragility discipline as actor-check.test.mjs / run-check.test.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { detectCi, loadContext, resolveDetectionBody } from './ci-context.mjs';

// ── REQ-CIC-1: detectCi() provider resolution ─────────────────────────────────

test('detectCi: GITHUB_ACTIONS=true → github', () => {
  assert.equal(detectCi({ env: { GITHUB_ACTIONS: 'true' } }), 'github');
});

test('detectCi: GITLAB_CI=true, no GITHUB_ACTIONS → gitlab', () => {
  assert.equal(detectCi({ env: { GITLAB_CI: 'true' } }), 'gitlab');
});

test('detectCi: no GITHUB_ACTIONS/GITLAB_CI marker → local (not unknown)', () => {
  assert.equal(detectCi({ env: {} }), 'local');
});

test('detectCi: CI=true with neither GITHUB_ACTIONS nor GITLAB_CI → unknown (not local)', () => {
  assert.equal(detectCi({ env: { CI: 'true' } }), 'unknown');
});

test('detectCi: strict precedence — GITHUB_ACTIONS wins even if GITLAB_CI is also set', () => {
  assert.equal(detectCi({ env: { GITHUB_ACTIONS: 'true', GITLAB_CI: 'true' } }), 'github');
});

test('detectCi: falls back to process.env when no deps.env injected', () => {
  const result = detectCi();
  assert.ok(['github', 'gitlab', 'unknown', 'local'].includes(result));
});

// ── REQ-CIC-2: loadContext() normalized field guarantees — GitHub ─────────────

test('loadContext: GitHub context is normalized (no PR — push event)', async () => {
  const ctx = await loadContext({
    env: {
      GITHUB_ACTIONS: 'true',
      BASE_SHA: 'aaa',
      HEAD_SHA: 'bbb',
      GITHUB_REPOSITORY: 'org/repo',
    },
  });
  assert.equal(ctx.provider, 'github');
  assert.equal(ctx.prNumber, null);
  assert.equal(ctx.baseSha, 'aaa');
  assert.equal(ctx.headSha, 'bbb');
  assert.equal(ctx.repo, 'org/repo');
  assert.equal(ctx.isMergeRequest, false);
  assert.equal(ctx.labels, null);
  assert.equal(ctx.body, null);
  assert.equal(ctx.author, null);
});

test('loadContext: GitHub PR context fetches labels/body/author via prView (single call)', async () => {
  let calls = 0;
  const ctx = await loadContext({
    env: {
      GITHUB_ACTIONS: 'true',
      PR_NUMBER: '193',
      BASE_SHA: 'aaa',
      HEAD_SHA: 'bbb',
      GITHUB_HEAD_REF: 'feat/x',
      BASE_BRANCH: 'main',
      GITHUB_REPOSITORY: 'org/repo',
      GITHUB_EVENT_NAME: 'pull_request',
    },
    prView: async ({ number }) => {
      calls += 1;
      return { number, labels: ['size:exception'], body: 'Closes #10', author: 'alice' };
    },
  });
  assert.equal(ctx.provider, 'github');
  assert.equal(ctx.prNumber, 193);
  assert.equal(ctx.baseSha, 'aaa');
  assert.equal(ctx.headSha, 'bbb');
  assert.equal(ctx.sourceBranch, 'feat/x');
  assert.equal(ctx.targetBranch, 'main');
  assert.deepEqual(ctx.labels, ['size:exception']);
  assert.equal(ctx.body, 'Closes #10');
  assert.equal(ctx.author, 'alice');
  assert.equal(ctx.repo, 'org/repo');
  assert.equal(ctx.isMergeRequest, true);
  assert.equal(calls, 1, 'labels + body + author must come from ONE prView call');
});

test('loadContext: GitHub author does NOT fall back to PR_AUTHOR env (ADR-0016 Never-do #3) — API-only', async () => {
  // CP-A1 Rev 2: author comes from the prView API, NEVER from env. The actor-check
  // job now provides PR_NUMBER (governance.yml) so prView runs; when PR_NUMBER is
  // absent, author is null (uncomputable) — never the env PR_AUTHOR (the ADR-0016
  // Never-do #3 the earlier PR_AUTHOR fallback violated).
  const ctx = await loadContext({
    env: { GITHUB_ACTIONS: 'true', PR_AUTHOR: 'alice', BASE_BRANCH: 'main' },
  });
  assert.equal(ctx.prNumber, null);
  assert.equal(ctx.author, null, 'author must NOT come from PR_AUTHOR env (Never-do #3)');
});

test('loadContext: non-numeric PR_NUMBER is treated as no PR (null), never a NaN passed to prView', async () => {
  let called = false;
  const ctx = await loadContext({
    env: { GITHUB_ACTIONS: 'true', PR_NUMBER: 'not-a-number' },
    prView: async () => { called = true; return { labels: [], body: '', author: 'x' }; },
  });
  assert.equal(ctx.prNumber, null);
  assert.equal(called, false, 'prView must not be called with a NaN number');
});

test('loadContext: missing BASE_SHA/HEAD_SHA yields null, never throws', async () => {
  const ctx = await loadContext({ env: { GITHUB_ACTIONS: 'true' } });
  assert.equal(ctx.baseSha, null);
  assert.equal(ctx.headSha, null);
});

test('loadContext: uncomputable labels/body/author (prView fetch failure) are null, not []/""', async () => {
  const ctx = await loadContext({
    env: { GITHUB_ACTIONS: 'true', PR_NUMBER: '5' },
    prView: async () => ({ number: 5, labels: null, body: null, author: null }),
  });
  assert.equal(ctx.labels, null);
  assert.equal(ctx.body, null);
  assert.equal(ctx.author, null);
});

test('loadContext: genuinely-empty labels/body are []/"", distinct from uncomputable null', async () => {
  const ctx = await loadContext({
    env: { GITHUB_ACTIONS: 'true', PR_NUMBER: '5' },
    prView: async () => ({ number: 5, labels: [], body: '', author: 'bob' }),
  });
  assert.deepEqual(ctx.labels, []);
  assert.equal(ctx.body, '');
});

test('loadContext: author comes from the API payload, never from an env var (PR_AUTHOR ignored)', async () => {
  const ctx = await loadContext({
    env: { GITHUB_ACTIONS: 'true', PR_NUMBER: '5', PR_AUTHOR: 'stale-trigger-user' },
    prView: async () => ({ number: 5, labels: [], body: '', author: 'real-pr-author' }),
  });
  assert.equal(ctx.author, 'real-pr-author');
});

test('loadContext: never throws even when prView throws internally', async () => {
  await assert.doesNotReject(async () => {
    const ctx = await loadContext({
      env: { GITHUB_ACTIONS: 'true', PR_NUMBER: '5' },
      prView: async () => { throw new Error('gh api rate limited'); },
    });
    assert.equal(ctx.labels, null);
    assert.equal(ctx.body, null);
    assert.equal(ctx.author, null);
  });
});

// ── REQ-CIC-2: loadContext() — GitLab (same shape, mapped fields) ─────────────

test('loadContext: GitLab context is normalized to the identical field set as GitHub', async () => {
  const ctx = await loadContext({
    env: {
      GITLAB_CI: 'true',
      CI_MERGE_REQUEST_IID: '42',
      CI_MERGE_REQUEST_DIFF_BASE_SHA: 'ccc',
      CI_COMMIT_SHA: 'ddd',
      CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: 'feat/y',
      CI_MERGE_REQUEST_TARGET_BRANCH_NAME: 'main',
      CI_PROJECT_PATH: 'group/project',
    },
    fetchMr: async () => ({ description: 'Part of #7', author: { username: 'carol' }, labels: ['kind:bug'] }),
  });
  assert.equal(ctx.provider, 'gitlab');
  assert.equal(ctx.prNumber, 42);
  assert.equal(ctx.baseSha, 'ccc');
  assert.equal(ctx.headSha, 'ddd');
  assert.equal(ctx.sourceBranch, 'feat/y');
  assert.equal(ctx.targetBranch, 'main');
  assert.equal(ctx.repo, 'group/project');
  assert.equal(ctx.isMergeRequest, true);
  assert.deepEqual(ctx.labels, ['kind:bug']);
  assert.equal(ctx.body, 'Part of #7');
  assert.equal(ctx.author, 'carol');
  assert.deepEqual(
    Object.keys(ctx).sort(),
    ['author', 'baseSha', 'body', 'headSha', 'isMergeRequest', 'labels', 'prNumber', 'provider', 'repo', 'sourceBranch', 'targetBranch'].sort(),
  );
});

test('loadContext: GitLab with no CI_MERGE_REQUEST_IID → not a merge request, no MR fetch attempted', async () => {
  let called = false;
  const ctx = await loadContext({
    env: { GITLAB_CI: 'true', CI_COMMIT_SHA: 'ddd' },
    fetchMr: async () => { called = true; return {}; },
  });
  assert.equal(ctx.isMergeRequest, false);
  assert.equal(ctx.prNumber, null);
  assert.equal(ctx.labels, null);
  assert.equal(called, false);
});

// ── REQ-CIC-5: GitLab MR API — one call, VCS_TOKEN auth, proxy from env ───────

test('REQ-CIC-5: exactly one MR API call yields body + author + labels together', async () => {
  let calls = 0;
  const ctx = await loadContext({
    env: { GITLAB_CI: 'true', CI_MERGE_REQUEST_IID: '9' },
    fetchMr: async () => {
      calls += 1;
      return { description: 'x', author: { username: 'dave' }, labels: [] };
    },
  });
  assert.equal(calls, 1);
  assert.equal(ctx.author, 'dave');
});

test('REQ-CIC-5: MR fetch is authenticated with VCS_TOKEN (default fetchMr, stubbed transport)', async () => {
  let seenAuth;
  let seenUrl;
  const ctx = await loadContext({
    env: {
      GITLAB_CI: 'true',
      CI_MERGE_REQUEST_IID: '9',
      CI_PROJECT_ID: '123',
      VCS_TOKEN: 'tok-abc',
    },
    fetchImpl: async (url, options) => {
      seenUrl = url;
      seenAuth = options?.headers?.['PRIVATE-TOKEN'];
      return { ok: true, json: async () => ({ description: '', author: { username: 'x' }, labels: [] }) };
    },
  });
  assert.match(seenUrl, /merge_requests\/9/);
  assert.equal(seenAuth, 'tok-abc');
  assert.equal(ctx.author, 'x');
});

test('REQ-CIC-5: proxy is read from standard env (HTTPS_PROXY), never a hard-coded literal in source', () => {
  const srcPath = fileURLToPath(new URL('./ci-context.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  assert.match(src, /HTTPS_PROXY|HTTP_PROXY/, 'must read the standard proxy env vars');
  assert.equal(/https?:\/\/[a-z0-9.-]+:\d+/i.test(src.replace(/gitlab\.com/gi, '')), false,
    'must not hard-code a proxy host literal in source');
});

test('REQ-CIC-5: MR API call failure yields body/labels/author null (never throws, no stale fallback)', async () => {
  const ctx = await loadContext({
    env: {
      GITLAB_CI: 'true',
      CI_MERGE_REQUEST_IID: '9',
      CI_MERGE_REQUEST_LABELS: 'stale:from-pipeline-creation',
    },
    fetchImpl: async () => { throw new Error('network unreachable'); },
  });
  assert.equal(ctx.body, null);
  assert.equal(ctx.labels, null);
  assert.equal(ctx.author, null);
});

// ── PR_BODY binary policy (design amendment 2) ────────────────────────────────
//
// `body` on the normalized context is ALWAYS API-primary — loadContext() never
// mixes in PR_BODY. `resolveDetectionBody()` is the ONLY sanctioned place a
// DETECTION consumer may fall back to PR_BODY when the API body is uncomputable;
// a REQUIRED consumer must read `ctx.body` directly and never call it.

test('PR_BODY policy: loadContext() never falls back to PR_BODY even when set (body stays null on API failure)', async () => {
  const ctx = await loadContext({
    env: { GITHUB_ACTIONS: 'true', PR_NUMBER: '5', PR_BODY: 'Closes #99' },
    prView: async () => ({ number: 5, labels: null, body: null, author: null }),
  });
  assert.equal(ctx.body, null, 'a REQUIRED consumer reading ctx.body directly must see null (fail closed), never PR_BODY');
});

test('resolveDetectionBody: ctx.body uncomputable (null) → falls back to env.PR_BODY (DETECTION consumer only)', () => {
  const ctx = { body: null };
  const result = resolveDetectionBody(ctx, { env: { PR_BODY: 'Closes #99' } });
  assert.equal(result, 'Closes #99');
});

test('resolveDetectionBody: ctx.body genuinely empty ("") is used as-is, not treated as uncomputable', () => {
  const ctx = { body: '' };
  const result = resolveDetectionBody(ctx, { env: { PR_BODY: 'Closes #99' } });
  assert.equal(result, '', 'a genuinely empty API body is a real value — PR_BODY must not override it');
});

test('resolveDetectionBody: ctx.body present (API succeeded) → API value wins over PR_BODY', () => {
  const ctx = { body: 'Closes #10' };
  const result = resolveDetectionBody(ctx, { env: { PR_BODY: 'Part of #99' } });
  assert.equal(result, 'Closes #10');
});

test('resolveDetectionBody: no PR_BODY and no API body → null (never throws, never fabricates)', () => {
  const ctx = { body: null };
  const result = resolveDetectionBody(ctx, { env: {} });
  assert.equal(result, null);
});
