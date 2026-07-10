// gitlab-api.test.mjs — Unit tests for the shared GitLab REST v4 fetch helper
// (issue #231 CP-A2b live-validation finding #12).
//
// gitlab-api.mjs is a PURE transport helper: given { apiBase, token, proxyUrl,
// path, fetchImpl }, it issues ONE authenticated GET and returns parsed JSON.
// It takes NO env reads of its own (drift-guard-safe by construction — it is
// not even a GATE_FILE member since it can never read a forbidden pipeline
// var) — every value it needs is threaded in as a parameter by callers that
// ARE sanctioned to read env (ci-context.mjs) or that receive it from one.
//
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { gitlabApiFetch } from './gitlab-api.mjs';

test('gitlabApiFetch: builds the URL from apiBase + path and returns parsed JSON', async () => {
  let seenUrl;
  const result = await gitlabApiFetch({
    apiBase: 'https://gitlab.example.com/api/v4',
    path: 'projects/g%2Fr/issues/7',
    fetchImpl: async (url) => {
      seenUrl = url;
      return { ok: true, json: async () => ({ iid: 7, title: 'x' }) };
    },
  });
  assert.equal(seenUrl, 'https://gitlab.example.com/api/v4/projects/g%2Fr/issues/7');
  assert.deepEqual(result, { iid: 7, title: 'x' });
});

test('gitlabApiFetch: sets the PRIVATE-TOKEN header when a token is provided', async () => {
  let seenHeaders;
  await gitlabApiFetch({
    apiBase: 'https://gitlab.com/api/v4',
    path: 'projects/1/issues/1',
    token: 'tok-abc',
    fetchImpl: async (url, options) => {
      seenHeaders = options?.headers;
      return { ok: true, json: async () => ({}) };
    },
  });
  assert.equal(seenHeaders?.['PRIVATE-TOKEN'], 'tok-abc');
});

test('gitlabApiFetch: omits the PRIVATE-TOKEN header when no token is provided (never sends "undefined")', async () => {
  let seenHeaders;
  await gitlabApiFetch({
    apiBase: 'https://gitlab.com/api/v4',
    path: 'projects/1/issues/1',
    fetchImpl: async (url, options) => {
      seenHeaders = options?.headers ?? {};
      return { ok: true, json: async () => ({}) };
    },
  });
  assert.equal('PRIVATE-TOKEN' in seenHeaders, false);
});

test('gitlabApiFetch: non-ok response throws with the status and the requested path (fail closed, no silent empty result)', async () => {
  await assert.rejects(
    gitlabApiFetch({
      apiBase: 'https://gitlab.com/api/v4',
      path: 'projects/1/issues/404',
      fetchImpl: async () => ({ ok: false, status: 404 }),
    }),
    /GitLab API failed: 404.*projects\/1\/issues\/404/,
  );
});

test('gitlabApiFetch: proxyUrl absent (falsy) never attempts to build a ProxyAgent dispatcher', async () => {
  let sawDispatcher;
  await gitlabApiFetch({
    apiBase: 'https://gitlab.com/api/v4',
    path: 'projects/1/issues/1',
    proxyUrl: null,
    fetchImpl: async (url, options) => {
      sawDispatcher = 'dispatcher' in (options ?? {});
      return { ok: true, json: async () => ({}) };
    },
  });
  assert.equal(sawDispatcher, false);
});

// ── Testing-lesson (issue #231 CP-A2b finding #12 — the fixtures-injected-
// fetchIssue gap that hid this finding): prove the SHARED transport module
// itself never imports a child-process/CLI spawning mechanism — the whole
// point of this helper existing is to replace the glab-CLI dependency, not
// just to be one more consumer of it. ──────────────────────────────────────
test('gitlab-api.mjs source never imports node:child_process or the exec.mjs spawn wrapper — it is a pure HTTP transport, no CLI fallback exists', () => {
  const src = readFileSync(fileURLToPath(new URL('./gitlab-api.mjs', import.meta.url)), 'utf8');
  assert.doesNotMatch(src, /node:child_process/, 'gitlab-api.mjs must not import node:child_process');
  assert.doesNotMatch(src, /from ['"].*lib\/exec\.mjs['"]/, 'gitlab-api.mjs must not import the run/runJson (glab CLI) wrapper');
});
