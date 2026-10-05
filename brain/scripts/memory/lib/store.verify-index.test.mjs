// store.verify-index.test.mjs — verifyIndex() is the read-only twin of rebuildIndex() (#1115, ruling Q1).
//
// session:start is read-only and `.memory/index.jsonl` is tracked, so the one thing that may
// never happen on that path is a write. These tests pin the claim by SNAPSHOT, not by return value:
// the tree is byte-identical before and after.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTempTree } from '../../__fixtures__/tmp-tree.mjs';
import { buildRecord } from './format.mjs';
import { appendRecord, rebuildIndex, verifyIndex } from './store.mjs';

const BASE = { ts: '2026-07-29T12:00:00Z', actor: '@crinaldi', actorKind: 'human', type: 'decision', project: 'brain' };

function fixture(t, n = 2) {
  const root = mkdtempSync(join(tmpdir(), 'brain-verify-index-'));
  t.after(() => removeTempTree(root));
  const recordsDir = join(root, '.memory', 'records');
  const indexPath = join(root, '.memory', 'index.jsonl');
  mkdirSync(recordsDir, { recursive: true });
  for (let i = 0; i < n; i++) appendRecord(buildRecord({ ...BASE, content: `Record number ${i}.` }), { recordsDir });
  return { root, recordsDir, indexPath };
}

function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out[p] = readFileSync(p, 'utf8');
    }
  };
  walk(dir);
  return out;
}

test('a canonical index verifies as current and nothing is written', (t) => {
  const { root, recordsDir, indexPath } = fixture(t);
  rebuildIndex({ recordsDir, indexPath });
  const before = snapshot(root);
  const r = verifyIndex({ recordsDir, indexPath });
  assert.equal(r.stale, false);
  assert.equal(r.count, 2);
  assert.deepEqual(snapshot(root), before);
});

test('a drifted index verifies as stale and is NOT rewritten', (t) => {
  const { root, recordsDir, indexPath } = fixture(t);
  rebuildIndex({ recordsDir, indexPath });
  writeFileSync(indexPath, 'drifted\n', 'utf8');
  const before = snapshot(root);
  const r = verifyIndex({ recordsDir, indexPath });
  assert.equal(r.stale, true);
  assert.deepEqual(snapshot(root), before, 'the drifted file is left exactly as found');
});

test('an absent index with records present is stale, and is not created', (t) => {
  const { recordsDir, indexPath } = fixture(t);
  const r = verifyIndex({ recordsDir, indexPath });
  assert.equal(r.stale, true);
  assert.equal(existsSync(indexPath), false);
});

test('no records and no index is current, and nothing is created', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'brain-verify-empty-'));
  t.after(() => removeTempTree(root));
  const recordsDir = join(root, '.memory', 'records');
  const indexPath = join(root, '.memory', 'index.jsonl');
  const r = verifyIndex({ recordsDir, indexPath });
  assert.equal(r.stale, false);
  assert.equal(r.count, 0);
  assert.equal(existsSync(join(root, '.memory')), false);
});

test('a corrupt record still fails closed, like rebuildIndex', (t) => {
  const { recordsDir, indexPath } = fixture(t, 1);
  const f = readdirSync(recordsDir)[0];
  writeFileSync(join(recordsDir, f), 'not json\n', 'utf8');
  assert.throws(() => verifyIndex({ recordsDir, indexPath }), /corrupt record/);
});

test('a duplicate is reported, not refused', (t) => {
  const { recordsDir, indexPath } = fixture(t, 1);
  const f = readdirSync(recordsDir)[0];
  const line = readFileSync(join(recordsDir, f), 'utf8');
  writeFileSync(join(recordsDir, f), line + line, 'utf8');
  const r = verifyIndex({ recordsDir, indexPath });
  assert.equal(r.count, 1);
  assert.equal(r.duplicates.ids, 1);
});
