// identity.test.mjs — Unit tests for the REQ-H1-1 fail-closed identity gate
// (design.md §3). No test spawns a real gh/glab process — the failure path
// injects a fake `getPatUrl`, the #413 verification path a fake `whoami`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateIdentity, evaluateVerifiedIdentity, gatherIdentity, main, DEFAULT_TOKEN_ENV } from './identity.mjs';

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

// ── Pure core — evaluateVerifiedIdentity (#413) ─────────────────────────────

test('evaluateVerifiedIdentity: exact match verifies', () => {
  assert.deepEqual(
    evaluateVerifiedIdentity({ claimed: 'brain-reviewer', actual: 'brain-reviewer' }),
    { verified: true, actual: 'brain-reviewer' },
  );
});

test('evaluateVerifiedIdentity: case-different login is the SAME account — verifies (#413)', () => {
  // Logins are case-insensitive on both providers; refusing on case would be
  // a false positive that blocks a correctly-configured reviewer.
  assert.equal(evaluateVerifiedIdentity({ claimed: 'CsRinaldiBot', actual: 'csrinaldibot' }).verified, true);
});

test('evaluateVerifiedIdentity: different login refuses, reporting both identities', () => {
  const result = evaluateVerifiedIdentity({ claimed: 'csrinaldibot', actual: 'csrinaldi' });
  assert.deepEqual(result, { verified: false, claimed: 'csrinaldibot', actual: 'csrinaldi' });
});

test('evaluateVerifiedIdentity: an empty/absent actual never verifies', () => {
  assert.equal(evaluateVerifiedIdentity({ claimed: 'x', actual: '' }).verified, false);
  assert.equal(evaluateVerifiedIdentity({ claimed: 'x', actual: undefined }).verified, false);
});

// ── gatherIdentity (DI seam) ─────────────────────────────────────────────────

test('gatherIdentity: absent env var refuses to run — no server call besides the PAT URL builder', async () => {
  let getPatUrlCalls = 0;
  let whoamiCalls = 0;
  const result = await gatherIdentity({
    deps: {
      readConfig: () => ({ handle: 'brain-reviewer', tokenEnv: 'BRAIN_REVIEWER_TOKEN' }),
      readEnv: () => ({}),
      getPatUrl: async () => { getPatUrlCalls++; return 'https://example.test/pat'; },
      whoami: async () => { whoamiCalls++; return { username: 'brain-reviewer' }; },
      setupDocPath: 'docs/reviewer-setup.md',
      host: 'github.com',
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.missingVar, 'BRAIN_REVIEWER_TOKEN');
  assert.equal(result.patSetupUrl, 'https://example.test/pat');
  assert.equal(getPatUrlCalls, 1);
  assert.equal(whoamiCalls, 0, 'no token → nothing to verify — whoami must not run');
});

test('gatherIdentity: token + matching handle verifies and resolves ok, never calls getPatUrl (#413)', async () => {
  let getPatUrlCalls = 0;
  let whoamiToken = null;
  const result = await gatherIdentity({
    deps: {
      readConfig: () => ({ handle: 'brain-reviewer', tokenEnv: 'BRAIN_REVIEWER_TOKEN' }),
      readEnv: () => ({ BRAIN_REVIEWER_TOKEN: 'shh' }),
      getPatUrl: async () => { getPatUrlCalls++; return 'unused'; },
      whoami: async ({ token }) => { whoamiToken = token; return { username: 'brain-reviewer' }; },
    },
  });
  assert.deepEqual(result, { ok: true, handle: 'brain-reviewer', token: 'shh', verifiedAs: 'brain-reviewer' });
  assert.equal(whoamiToken, 'shh', 'whoami must be scoped to the REVIEWER token, not ambient auth');
  assert.equal(getPatUrlCalls, 0);
});

test('gatherIdentity: token whose real login disagrees with the handle refuses (#413)', async () => {
  const result = await gatherIdentity({
    deps: {
      readConfig: () => ({ handle: 'csrinaldibot', tokenEnv: 'BRAIN_REVIEWER_TOKEN' }),
      readEnv: () => ({ BRAIN_REVIEWER_TOKEN: 'shh' }), // the author's own token
      whoami: async () => ({ username: 'csrinaldi' }),
    },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.mismatch, { claimed: 'csrinaldibot', actual: 'csrinaldi' });
});

test('gatherIdentity: whoami rejection refuses with the underlying error (#413)', async () => {
  const result = await gatherIdentity({
    deps: {
      readConfig: () => ({ handle: 'brain-reviewer', tokenEnv: 'BRAIN_REVIEWER_TOKEN' }),
      readEnv: () => ({ BRAIN_REVIEWER_TOKEN: 'shh' }),
      whoami: async () => { throw new Error('api unreachable'); },
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.verifyError, 'api unreachable');
});

test('gatherIdentity: unset handle skips verification — that case is cli.mjs\'s #382 refusal', async () => {
  let whoamiCalls = 0;
  const result = await gatherIdentity({
    deps: {
      readConfig: () => ({ tokenEnv: 'BRAIN_REVIEWER_TOKEN' }), // handle unset
      readEnv: () => ({ BRAIN_REVIEWER_TOKEN: 'shh' }),
      whoami: async () => { whoamiCalls++; return { username: 'whoever' }; },
    },
  });
  assert.deepEqual(result, { ok: true, handle: null, token: 'shh' });
  assert.equal(whoamiCalls, 0, 'nothing to compare against — verification must not run');
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

test('main: exit code 0 when the token is present and verifies (#413)', async () => {
  const code = await main({
    readConfig: () => ({ handle: 'brain-reviewer', tokenEnv: 'BRAIN_REVIEWER_TOKEN' }),
    readEnv: () => ({ BRAIN_REVIEWER_TOKEN: 'shh' }),
    whoami: async () => ({ username: 'brain-reviewer' }),
  });
  assert.equal(code, 0);
});

test('main: exit code 1 on an identity mismatch (#413)', async () => {
  const code = await main({
    readConfig: () => ({ handle: 'csrinaldibot', tokenEnv: 'BRAIN_REVIEWER_TOKEN' }),
    readEnv: () => ({ BRAIN_REVIEWER_TOKEN: 'shh' }),
    whoami: async () => ({ username: 'csrinaldi' }),
  });
  assert.equal(code, 1);
});
