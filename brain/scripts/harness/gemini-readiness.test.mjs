import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveGeminiRoute, checkGeminiReadiness } from './gemini-readiness.mjs';

const FAKE_KEY = ['gemini', 'fixture', 'key'].join('-');

test('resolveGeminiRoute: unrouted or non-gemini returns required: false', () => {
  assert.deepEqual(resolveGeminiRoute({}), {
    required: false,
    stage: 'cold-review',
    engine: null,
    model: null,
  });
  assert.deepEqual(resolveGeminiRoute({ sdd: { map: { 'cold-review': { engine: 'claude', model: 'sonnet' } } } }), {
    required: false,
    stage: 'cold-review',
    engine: 'claude',
    model: 'sonnet',
  });
});

test('resolveGeminiRoute: gemini engine returns required: true with model', () => {
  const route = resolveGeminiRoute({ sdd: { map: { 'cold-review': { engine: 'gemini', model: 'gemini-2.5-pro' } } } });
  assert.equal(route.required, true);
  assert.equal(route.engine, 'gemini');
  assert.equal(route.model, 'gemini-2.5-pro');
  assert.equal(route.identity, 'cold-review:gemini/gemini-2.5-pro');
});

test('checkGeminiReadiness: not required returns ready: true', () => {
  const result = checkGeminiReadiness({ required: false, engine: 'claude' });
  assert.equal(result.ready, true);
  assert.match(result.diagnostic, /Gemini is not required/i);
});

test('checkGeminiReadiness: missing binary returns ready: false with install hint', () => {
  const route = { required: true, engine: 'gemini', identity: 'cold-review:gemini/gemini-2.5-pro' };
  const result = checkGeminiReadiness(route, { commandExists: () => false });
  assert.equal(result.ready, false);
  assert.match(result.diagnostic, /run npm install -g @google\/gemini-cli/i);
});

test('checkGeminiReadiness: missing auth returns ready: false with auth hint', () => {
  const route = { required: true, engine: 'gemini', identity: 'cold-review:gemini/gemini-2.5-pro' };
  const result = checkGeminiReadiness(route, {
    commandExists: () => true,
    env: {},
  });
  assert.equal(result.ready, false);
  assert.match(result.diagnostic, /set GEMINI_API_KEY/i);
});

test('checkGeminiReadiness: binary and auth present returns ready: true', () => {
  const route = { required: true, engine: 'gemini', identity: 'cold-review:gemini/gemini-2.5-pro' };
  const result = checkGeminiReadiness(route, {
    commandExists: () => true,
    env: { GEMINI_API_KEY: FAKE_KEY },
  });
  assert.equal(result.ready, true);
  assert.match(result.diagnostic, /Gemini CLI is installed and authenticated/i);
});
