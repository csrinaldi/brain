// cli.reindex-duplicates.test.mjs — issue #574, the REPORTING half, end to end.
//
// The rule is only worth having if a human hears it, and the ticket's complaint
// was precisely that nobody printed anything. So this drives the real
// `cli.mjs reindex` in a child process against a fixture store (via
// BRAIN_MEMORY_TEST_ROOT, the same test-only seam save/search use) and asserts
// on STDOUT — not on a return value some caller might again forget to read.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRecord, serializeRecord } from './lib/format.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'cli.mjs');

const base = {
  ts: '2026-07-04T12:00:00Z',
  actor: '@crinaldi',
  actorKind: 'human',
  type: 'decision',
  project: 'brain',
};

function fixtureRoot(t, lines) {
  const root = mkdtempSync(join(tmpdir(), 'brain-cli-dup-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const recordsDir = join(root, '.memory', 'records');
  mkdirSync(recordsDir, { recursive: true });
  writeFileSync(join(recordsDir, '2026-07.jsonl'), lines.map((l) => l + '\n').join(''), 'utf8');
  return root;
}

function runReindex(root) {
  return spawnSync(process.execPath, [CLI, 'reindex'], {
    encoding: 'utf8',
    env: { ...process.env, BRAIN_MEMORY_TEST_ROOT: root, MEMORY_BACKEND: 'plainfiles' },
  });
}

test('memory:reindex PRINTS the duplicate accounting — the silence #574 opened on', (t) => {
  const a = buildRecord({ ...base, content: 'A' });
  const b = buildRecord({ ...base, content: 'B' });
  const root = fixtureRoot(t, [serializeRecord(a), serializeRecord(b), serializeRecord(a)]);

  const run = runReindex(root);

  assert.equal(run.status, 0, `reindex must still succeed on a duplicated store:\n${run.stderr}`);
  assert.match(run.stdout, /2 record\(s\) indexed/, 'the index count is the unique-id count');
  assert.match(run.stdout, /1 duplicate record id\(s\)/);
  assert.match(run.stdout, /1 excess physical line\(s\)/);
  assert.match(run.stdout, /3 physical line\(s\) → 2 indexed/, 'the store/index gap is stated, not left to arithmetic');
  assert.ok(run.stdout.includes(a.id), 'the duplicated id is named');
  assert.match(run.stdout, /2026-07\.jsonl:1, 2026-07\.jsonl:3/, 'both physical lines are located');
});

test('memory:reindex on a clean store prints NO duplicate report at all', (t) => {
  const a = buildRecord({ ...base, content: 'A' });
  const root = fixtureRoot(t, [serializeRecord(a)]);

  const run = runReindex(root);

  assert.equal(run.status, 0);
  assert.match(run.stdout, /1 record\(s\) indexed/);
  assert.equal(/duplicate/i.test(run.stdout), false, 'a clean store stays quiet — the report is a signal, not a banner');
});

test('memory:reindex REFUSES a divergent duplicate, exits 1, and writes no index', (t) => {
  const a = buildRecord({ ...base, content: 'A', source: 'issue #574' });
  const b = { ...a, source: 'issue #999' };
  const root = fixtureRoot(t, [serializeRecord(a), serializeRecord(b)]);

  const run = runReindex(root);

  assert.equal(run.status, 1, 'the disagreeing pair fails closed, like the tamper path');
  assert.match(run.stderr, /divergent duplicate at 2026-07\.jsonl:2/);
  assert.throws(() => readFileSync(join(root, '.memory', 'index.jsonl'), 'utf8'), /ENOENT/);
});
