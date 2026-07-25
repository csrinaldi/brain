// identity.test.mjs — Unit tests for the REQ-H1-1 fail-closed identity gate
// (design.md §3). No test spawns a real gh/glab process — the failure path
// injects a fake `getPatUrl`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateIdentity, gatherIdentity, main, DEFAULT_TOKEN_ENV } from './identity.mjs';

// ── Pure core — evaluateIdentity ────────────────────────────────────────────

test('evaluateIdentity: absent token → fail-closed with missing var + patSetupUrl + setup doc', () => {
  const result = evaluateIdentity({
    reviewerConfig: { handle: 'brain-reviewer', tokenEnv: 'BRAIN_REVIEWER_TOKEN' },
    env: {},
    patSetupUrl: 'https://github.com/settings/tokens/new?description=brain-reviewer',
    setupDocPath: 'docs/reviewer-setup.md',
  });
  assert.equal(result.ok, false);
  assert.equal(result.missingVar, 'BRAIN_REVIEWER_TOKEN');
  assert.match(result.patSetupUrl, /github\.com/);
  assert.equal(result.setupDocPath, 'docs/reviewer-setup.md');
});

test('evaluateIdentity: defaults tokenEnv to BRAIN_REVIEWER_TOKEN when config omits it', () => {
  const result = evaluateIdentity({ reviewerConfig: {}, env: {} });
  assert.equal(result.missingVar, DEFAULT_TOKEN_ENV);
});

test('evaluateIdentity: present token → ok with handle + token, never invents a value', () => {
  const result = evaluateIdentity({
    reviewerConfig: { handle: 'brain-reviewer', tokenEnv: 'BRAIN_REVIEWER_TOKEN' },
    env: { BRAIN_REVIEWER_TOKEN: 'shh' },
  });
  assert.deepEqual(result, { ok: true, handle: 'brain-reviewer', token: 'shh' });
});

// ── gatherIdentity (DI seam) ─────────────────────────────────────────────────

test('gatherIdentity: absent env var refuses to run — no server call besides the PAT URL builder', async () => {
  let getPatUrlCalls = 0;
  const result = await gatherIdentity({
    deps: {
      readConfig: () => ({ handle: 'brain-reviewer', tokenEnv: 'BRAIN_REVIEWER_TOKEN' }),
      readEnv: () => ({}),
      getPatUrl: async () => { getPatUrlCalls++; return 'https://example.test/pat'; },
      setupDocPath: 'docs/reviewer-setup.md',
      host: 'github.com',
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.missingVar, 'BRAIN_REVIEWER_TOKEN');
  assert.equal(result.patSetupUrl, 'https://example.test/pat');
  assert.equal(getPatUrlCalls, 1);
});

test('gatherIdentity: present env var resolves ok and never calls getPatUrl', async () => {
  let getPatUrlCalls = 0;
  const result = await gatherIdentity({
    deps: {
      readConfig: () => ({ handle: 'brain-reviewer', tokenEnv: 'BRAIN_REVIEWER_TOKEN' }),
      readEnv: () => ({ BRAIN_REVIEWER_TOKEN: 'shh' }),
      getPatUrl: async () => { getPatUrlCalls++; return 'unused'; },
    },
  });
  assert.deepEqual(result, { ok: true, handle: 'brain-reviewer', token: 'shh' });
  assert.equal(getPatUrlCalls, 0);
});

// ── main ─────────────────────────────────────────────────────────────────────

test('main: non-zero exit code with fail-closed message on missing token', async () => {
  const code = await main({
    readConfig: () => ({ tokenEnv: 'BRAIN_REVIEWER_TOKEN' }),
    readEnv: () => ({}),
    getPatUrl: async () => 'https://example.test/pat',
  });
  assert.equal(code, 1);
});

test('main: exit code 0 when the token is present', async () => {
  const code = await main({
    readConfig: () => ({ handle: 'brain-reviewer', tokenEnv: 'BRAIN_REVIEWER_TOKEN' }),
    readEnv: () => ({ BRAIN_REVIEWER_TOKEN: 'shh' }),
  });
  assert.equal(code, 0);
});
