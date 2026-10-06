import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkReadiness } from './gemini.readiness.mjs';

const FAKE_KEY = ['gemini', 'fixture', 'key'].join('-');

test('checkReadiness: missing binary returns ready: false with install hint', () => {
  const route = { required: true, engine: 'gemini', identity: 'cold-review:gemini/gemini-3.1-pro-high' };
  const result = checkReadiness(route, { commandExists: () => false });
  assert.equal(result.ready, false);
  assert.match(result.diagnostic, /neither agy.*nor gemini/i);
});

test('checkReadiness: missing auth when only gemini CLI is installed returns ready: false with hint', () => {
  const route = { required: true, engine: 'gemini', identity: 'cold-review:gemini/gemini-3.1-pro-high' };
  const result = checkReadiness(route, {
    commandExists: (bin) => bin === 'gemini',
    env: {},
  });
  assert.equal(result.ready, false);
  assert.match(result.diagnostic, /set GEMINI_API_KEY/i);
});

test('checkReadiness: agy binary present returns ready: true for Google AI Pro subscription', () => {
  const route = { required: true, engine: 'gemini', identity: 'cold-review:gemini/gemini-3.1-pro-high' };
  const result = checkReadiness(route, {
    commandExists: (bin) => bin === 'agy',
    env: {},
    agyAuthCheck: () => true,
  });
  assert.equal(result.ready, true);
  assert.match(result.diagnostic, /agy \(Google AI Pro subscription\)/i);
});

test('checkReadiness: gemini CLI and API key present returns ready: true', () => {
  const route = { required: true, engine: 'gemini', identity: 'cold-review:gemini/gemini-2.5-pro' };
  const result = checkReadiness(route, {
    commandExists: (bin) => bin === 'gemini',
    env: { GEMINI_API_KEY: FAKE_KEY },
  });
  assert.equal(result.ready, true);
  assert.match(result.diagnostic, /gemini \(API key\)/i);
});

test('checkReadiness: gemini CLI and GOOGLE_APPLICATION_CREDENTIALS present returns ready: true with ADC diagnostic', () => {
  const route = { required: true, engine: 'gemini', identity: 'cold-review:gemini/gemini-2.5-pro' };
  const result = checkReadiness(route, {
    commandExists: (bin) => bin === 'gemini',
    env: { GOOGLE_APPLICATION_CREDENTIALS: '/path/to/creds.json' },
  });
  assert.equal(result.ready, true);
  assert.match(result.diagnostic, /gemini \(ADC\)/i);
});
