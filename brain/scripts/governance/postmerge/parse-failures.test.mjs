// parse-failures.test.mjs — the [FAIL-SHA] parser (REQ-D2-5, design §8).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseFailingShas } from './parse-failures.mjs';

const SCRIPT = fileURLToPath(new URL('./parse-failures.mjs', import.meta.url));
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

test('parseFailingShas — extracts full 40-hex shas from [FAIL-SHA] lines, order-preserving', () => {
  const text = [
    '[PASS] abc1234 some merge',
    `[FAIL-SHA] ${SHA_A}`,
    '[FAIL] def5678 other merge — issueLink: missing',
    `[FAIL-SHA] ${SHA_B}`,
  ].join('\n');
  assert.deepEqual(parseFailingShas(text), [SHA_A, SHA_B]);
});

test('parseFailingShas — dedupes repeated shas via a Set, keeping first-seen order', () => {
  const text = [`[FAIL-SHA] ${SHA_B}`, `[FAIL-SHA] ${SHA_A}`, `[FAIL-SHA] ${SHA_B}`].join('\n');
  assert.deepEqual(parseFailingShas(text), [SHA_B, SHA_A]);
});

test('parseFailingShas — ignores malformed/short (sha7) and non-hex lines', () => {
  const text = [
    '[FAIL-SHA] abc1234', // sha7, too short — ignored
    '[FAIL-SHA] not-a-sha-at-all-but-forty-chars-long-xxxxx',
    `some prose mentioning [FAIL-SHA] ${SHA_A} mid-line`, // not anchored — ignored
    `[FAIL-SHA] ${SHA_A}`, // the only well-formed line
  ].join('\n');
  assert.deepEqual(parseFailingShas(text), [SHA_A]);
});

test('parseFailingShas — empty/undefined input yields an empty array, never throws', () => {
  assert.deepEqual(parseFailingShas(''), []);
  assert.deepEqual(parseFailingShas(undefined), []);
});

test('CLI mode — reads stdin, prints the deduped full-sha list one per line', () => {
  const input = [`[FAIL-SHA] ${SHA_A}`, `[FAIL-SHA] ${SHA_B}`, `[FAIL-SHA] ${SHA_A}`].join('\n');
  const r = spawnSync('node', [SCRIPT], { input, encoding: 'utf8' });
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\nstderr: ${r.stderr}`);
  assert.deepEqual(r.stdout.trim().split('\n'), [SHA_A, SHA_B]);
});
