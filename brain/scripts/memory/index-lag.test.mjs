// index-lag.test.mjs — unit tests for the non-mutating index/records drift
// warning (#889, design A9, spec.md "local-checks warns on index lag, never
// fails").
//
// RED: these imports fail until index-lag.mjs is created (task B2.1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildRecord } from './lib/format.mjs';
import { appendRecord, rebuildIndex } from './lib/store.mjs';
import { testTmp } from '../lib/test-tmp.mjs';
import { compareIndexToRecords, main } from './index-lag.mjs';

const base = {
  ts: '2026-07-04T12:00:00Z',
  actor: '@crinaldi',
  actorKind: 'human',
  type: 'decision',
  project: 'brain',
};

function tmpMemoryDir() {
  const root = testTmp('brain-memory-index-lag-');
  return { root, recordsDir: join(root, 'records'), indexPath: join(root, 'index.jsonl') };
}

// ── compareIndexToRecords (pure) ───────────────────────────────────────────

test('compareIndexToRecords: a committed index whose id set differs from the rebuilt set reports lagged:true with both counts', () => {
  const indexLines = [JSON.stringify({ id: 'rec-aaaaaaaaaaaaaaaa', ts: base.ts, actor: base.actor, type: base.type, project: base.project })];
  const records = [
    { id: 'rec-aaaaaaaaaaaaaaaa' },
    { id: 'rec-bbbbbbbbbbbbbbbb' },
  ];
  const result = compareIndexToRecords({ indexLines, records });
  assert.equal(result.lagged, true);
  assert.equal(result.indexed, 1);
  assert.equal(result.rebuilt, 2);
  assert.deepEqual(result.missingFromIndex, ['rec-bbbbbbbbbbbbbbbb']);
  assert.deepEqual(result.staleInIndex, []);
});

test('compareIndexToRecords: an index entry with no backing record reports staleInIndex, not missingFromIndex', () => {
  const indexLines = [
    JSON.stringify({ id: 'rec-aaaaaaaaaaaaaaaa' }),
    JSON.stringify({ id: 'rec-cccccccccccccccc' }),
  ];
  const records = [{ id: 'rec-aaaaaaaaaaaaaaaa' }];
  const result = compareIndexToRecords({ indexLines, records });
  assert.equal(result.lagged, true);
  assert.deepEqual(result.missingFromIndex, []);
  assert.deepEqual(result.staleInIndex, ['rec-cccccccccccccccc']);
});

test('compareIndexToRecords: matching id sets report lagged:false — key order and formatting never matter (ID SETS, not bytes)', () => {
  const indexLines = [
    JSON.stringify({ id: 'rec-bbbbbbbbbbbbbbbb', extra: 'field order differs' }),
    JSON.stringify({ id: 'rec-aaaaaaaaaaaaaaaa' }),
  ];
  const records = [{ id: 'rec-aaaaaaaaaaaaaaaa' }, { id: 'rec-bbbbbbbbbbbbbbbb' }];
  const result = compareIndexToRecords({ indexLines, records });
  assert.equal(result.lagged, false);
  assert.equal(result.indexed, 2);
  assert.equal(result.rebuilt, 2);
});

test('compareIndexToRecords: empty index and empty records is not lagged', () => {
  const result = compareIndexToRecords({});
  assert.equal(result.lagged, false);
  assert.equal(result.indexed, 0);
  assert.equal(result.rebuilt, 0);
});

// ── main() — the loud half ──────────────────────────────────────────────────

test('main: a lagged index prints a WARNING naming both counts and exits 0', () => {
  const { recordsDir, indexPath } = tmpMemoryDir();
  const recA = buildRecord({ ...base, content: 'A' });
  const recB = buildRecord({ ...base, content: 'B' });
  appendRecord(recA, { recordsDir });
  appendRecord(recB, { recordsDir });
  // Index only recA directly — recB is a genuine lag, never routed through
  // rebuildIndex (this fixture must not depend on the mutating path).
  writeFileSync(indexPath, JSON.stringify({ id: recA.id, ts: recA.ts, actor: recA.actor, type: recA.type, project: recA.project }) + '\n');

  const logs = [];
  const exitCode = main({ recordsDir, indexPath, log: (msg) => logs.push(msg) });

  assert.equal(exitCode, 0, 'a lag never fails the check');
  assert.equal(logs.length, 1, `expected exactly one WARNING line:\n${logs.join('\n')}`);
  assert.match(logs[0], /WARNING/);
  assert.match(logs[0], /indexed 1/);
  assert.match(logs[0], /rebuilt 2/);
});

test('main: an index in sync with records/ is silent and exits 0', () => {
  const { recordsDir, indexPath } = tmpMemoryDir();
  const rec = buildRecord({ ...base, content: 'in sync' });
  appendRecord(rec, { recordsDir });
  rebuildIndex({ recordsDir, indexPath });

  const logs = [];
  const exitCode = main({ recordsDir, indexPath, log: (msg) => logs.push(msg) });

  assert.equal(exitCode, 0);
  assert.deepEqual(logs, [], `an in-sync index must stay silent:\n${logs.join('\n')}`);
});

test('main: a missing index.jsonl reads as an empty index — warns, exits 0, never throws', () => {
  const { recordsDir, indexPath } = tmpMemoryDir();
  const rec = buildRecord({ ...base, content: 'no index yet' });
  appendRecord(rec, { recordsDir });
  assert.equal(existsSync(indexPath), false, 'the fixture never wrote an index.jsonl');

  const logs = [];
  assert.doesNotThrow(() => {
    const exitCode = main({ recordsDir, indexPath, log: (msg) => logs.push(msg) });
    assert.equal(exitCode, 0);
  });
  assert.equal(logs.length, 1, `a missing index against a non-empty records/ is a lag, and must warn:\n${logs.join('\n')}`);
  assert.match(logs[0], /indexed 0/);
});

test('main: NO FILE IS WRITTEN — index.jsonl and every record file are byte- and mtime-identical before and after', () => {
  const { recordsDir, indexPath } = tmpMemoryDir();
  const rec = buildRecord({ ...base, content: 'never touched' });
  appendRecord(rec, { recordsDir });
  rebuildIndex({ recordsDir, indexPath });

  const before = {
    index: { bytes: readFileSync(indexPath, 'utf8'), mtime: statSync(indexPath).mtimeMs },
  };

  main({ recordsDir, indexPath, log: () => {} });

  const after = {
    index: { bytes: readFileSync(indexPath, 'utf8'), mtime: statSync(indexPath).mtimeMs },
  };

  assert.equal(after.index.bytes, before.index.bytes, 'index.jsonl bytes must be untouched');
  assert.equal(after.index.mtime, before.index.mtime, 'index.jsonl mtime must be untouched — nothing rewrote it');
});
