// parse-failures.test.mjs — the ONE tested `[FAIL-SHA]` parser (REQ-D2-5).
//
// Re-derived greenfield for PR3 (never cherry-picked from the archive/scrap
// branch — cherry-picking would import that branch's `github-actions[bot]`
// mis-authorship; design §0). Proves the parser is platform-agnostic and
// independently testable outside any CI runner.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFailingShas } from './parse-failures.mjs';

const SCRIPT = fileURLToPath(new URL('./parse-failures.mjs', import.meta.url));
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

test('parseFailingShas: extracts full 40-hex shas from [FAIL-SHA] lines', () => {
  const text = [
    '[PASS] 1234567 some merge',
    `[FAIL-SHA] ${A}`,
    '[FAIL] 89abcde another — diffSize: too big',
    `[FAIL-SHA] ${B}`,
  ].join('\n');
  assert.deepEqual(parseFailingShas(text), [A, B]);
});

test('parseFailingShas: order-preserving and deduped via Set', () => {
  const text = [`[FAIL-SHA] ${A}`, `[FAIL-SHA] ${B}`, `[FAIL-SHA] ${A}`].join('\n');
  assert.deepEqual(parseFailingShas(text), [A, B]);
});

test('parseFailingShas: ignores malformed / sha7 / non-hex lines, never throws', () => {
  const text = [
    '[FAIL-SHA] deadbeef',                 // sha7 — too short
    '[FAIL-SHA] ' + 'g'.repeat(40),        // non-hex
    '[FAIL-SHA]',                          // no sha
    'FAIL-SHA ' + A,                       // no bracket prefix
    `  [FAIL-SHA] ${A}`,                   // leading whitespace — not anchored
  ].join('\n');
  assert.deepEqual(parseFailingShas(text), []);
});

test('parseFailingShas: null / undefined / empty input yields empty list', () => {
  assert.deepEqual(parseFailingShas(undefined), []);
  assert.deepEqual(parseFailingShas(null), []);
  assert.deepEqual(parseFailingShas(''), []);
});

test('parse-failures CLI: reads stdin, prints deduped full-sha list one per line', () => {
  const stdin = [`[FAIL-SHA] ${A}`, '[PASS] 1234567 x', `[FAIL-SHA] ${A}`, `[FAIL-SHA] ${B}`].join('\n');
  // stdin is a file descriptor, not the `input` option: a piped stdin never sees EOF in the cold
  // reviewer's sandbox, and the CLI reads to EOF (#1221).
  const dir = mkdtempSync(join(tmpdir(), 'brain-1221-failsha-'));
  const fd = openSync(join(dir, 'stdin'), 'w+');
  writeSync(fd, stdin);
  closeSync(fd);
  const inFd = openSync(join(dir, 'stdin'), 'r');
  const r = spawnSync('node', [SCRIPT], { stdio: [inFd, 'pipe', 'pipe'], encoding: 'utf8' });
  closeSync(inFd);
  rmSync(dir, { recursive: true, force: true });
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\n${r.stderr}`);
  assert.equal(r.stdout, `${A}\n${B}\n`);
});
