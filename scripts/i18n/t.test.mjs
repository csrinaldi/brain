// scripts/i18n/t.test.mjs — Unit tests for the i18n resolver.
// Run with: node --test scripts/i18n/t.test.mjs
// No external dependencies — uses Node built-in node:test.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { translate, t } from './t.mjs';
import en from './en.mjs';

// ── translate() — pure function ───────────────────────────────────────────────
// translate(key, params, activeCat, fallbackCat) is the pure core.
// t() is an async thin wrapper that supplies the real catalogs.

test('translate: key in active catalog returns that locale value', () => {
  const cat = { 'common.none': '(ninguno)' };
  assert.equal(translate('common.none', {}, cat, en), '(ninguno)');
});

test('translate: key missing in active catalog falls back to English per-key', () => {
  // Simulates a partial es.mjs that lacks 'tracker.yourTickets'.
  const partialCat = { 'common.none': '(ninguno)' };
  assert.equal(translate('tracker.yourTickets', {}, partialCat, en), 'Your tickets');
});

test('translate: unknown locale (empty active catalog) falls back to English for all keys', () => {
  // When an unknown locale fails to import, catalog() returns {}.
  // Every key must then resolve from en.mjs.
  const unknownLocaleCat = {};
  assert.equal(translate('tracker.yourTickets', {}, unknownLocaleCat, en), 'Your tickets');
  assert.equal(translate('common.none', {}, unknownLocaleCat, en), '(none)');
});

test('translate: key missing in both catalogs returns the key string', () => {
  const cat = {};
  assert.equal(translate('nonexistent.key', {}, cat, en), 'nonexistent.key');
});

test('translate: {placeholder} interpolation replaces all named slots', () => {
  const cat = {};
  const result = translate('day.auth.ok', { user: 'alice', provider: 'github' }, cat, en);
  assert.equal(result, 'Authenticated as @alice (github).');
});

test('translate: unknown placeholder slot left as {slot} when param not supplied', () => {
  const cat = {};
  const result = translate('day.auth.ok', {}, cat, en);
  assert.equal(result, 'Authenticated as @{user} ({provider}).');
});

test('translate: partial params — known slot replaced, unknown slot kept', () => {
  const cat = {};
  const result = translate('day.auth.ok', { user: 'bob' }, cat, en);
  assert.equal(result, 'Authenticated as @bob ({provider}).');
});

// ── t() — async end-to-end (uses actual brain.config.json: docs.language=en) ──

test('t: known English key returns the English value', async () => {
  const result = await t('common.none');
  assert.equal(result, '(none)');
});

test('t: completely unknown key returns the key string itself', async () => {
  const result = await t('totally.unknown.key');
  assert.equal(result, 'totally.unknown.key');
});

test('t: placeholder interpolation works end-to-end', async () => {
  const result = await t('day.auth.ok', { user: 'tester', provider: 'gitlab' });
  assert.equal(result, 'Authenticated as @tester (gitlab).');
});
