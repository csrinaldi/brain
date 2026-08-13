// engram.duplicates.test.mjs — issue #574 on the engram backend: the rule has
// to hold on `share()` AND on `pull()`, not just where the index happens to be
// rebuilt today.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { share, dualWriteRecords, pullMemory, buildImportPayload } from './engram.mjs';
import { buildRecord } from '../lib/format.mjs';

const baseRecordFields = {
  ts: '2026-07-04T12:00:00Z', actor: '@crinaldi', actorKind: 'human', type: 'decision', project: 'brain',
};

// ── share ────────────────────────────────────────────────────────────────────

test('share: RETURNS the accounting — it used to return undefined, so nothing it measured could be printed', async () => {
  const recA = buildRecord({ ...baseRecordFields, content: 'A' });
  const duplicates = { ids: 3, lines: 7, divergent: 0, groups: [{ id: 'rec-a', occurrences: ['2026-07.jsonl:4', '2026-07.jsonl:8'] }] };

  const result = await share({
    root: '/fake/root',
    _requireEngram: () => 'engram',
    _export: () => {},
    _resolveDir: () => null,
    _changedChunkFiles: () => [],
    _readObservations: () => ({ observations: [{ id: 1 }] }),
    _exportObservation: () => ({ record: recA, recovered: true }),
    _appendRecord: () => {},
    _rebuildIndex: () => ({ count: 2038, duplicates }),
    _loadConfig: () => ({}),
  });

  assert.ok(result, 'share must hand its accounting back to cli.mjs');
  assert.deepEqual(result.duplicates, duplicates);
  assert.equal(result.indexCount, 2038);
  // Same regression, same cause: the #541 `unprovenanced` line in cli.mjs reads
  // `result.unprovenanced`, and on this backend there was never a result.
  assert.equal(typeof result.unprovenanced, 'number');
});

test('dualWriteRecords: a steady-state run with nothing new STILL reindexes, so a merged-in duplicate is still seen', async () => {
  const recA = buildRecord({ ...baseRecordFields, content: 'A' });
  const duplicates = { ids: 1, lines: 1, divergent: 0, groups: [{ id: recA.id, occurrences: ['2026-07.jsonl:1', '2026-07.jsonl:5'] }] };
  let reindexCalled = false;

  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [{ id: 1 }] }),
    _exportObservation: () => ({ record: recA, recovered: true }),
    _appendRecord: () => { throw new Error('nothing new — appendRecord must not run'); },
    _readRecordIds: () => new Set([recA.id]),   // already in records/ from a prior run
    _rebuildIndex: () => { reindexCalled = true; return { count: 1, duplicates }; },
    _loadConfig: () => ({}),
  });

  assert.equal(result.written, 0);
  assert.equal(result.deduped, 1, 'the candidate was already present — that is this run\'s dedup');
  assert.equal(reindexCalled, true, 'the store is still read: a git pull may have merged duplicates in since');
  assert.deepEqual(result.duplicates, duplicates, 'and the union-merge residual is reported');
});

// ── pull ─────────────────────────────────────────────────────────────────────

test('pullMemory: reindexes BETWEEN git pull and hydration, and reports what the merge duplicated', async () => {
  const order = [];
  const duplicates = { ids: 1, lines: 1, divergent: 0, groups: [{ id: 'rec-a', occurrences: ['2026-07.jsonl:2', '2026-07.jsonl:9'] }] };

  const result = await pullMemory({
    root: '/fake/root',
    _isManifestDirty: () => false,
    _restoreManifest: () => { throw new Error('not dirty — must not restore'); },
    _gitPull: () => { order.push('gitPull'); },
    _rebuildIndex: (opts) => {
      order.push('rebuildIndex');
      assert.equal(opts.recordsDir, '/fake/root/.memory/records');
      assert.equal(opts.indexPath, '/fake/root/.memory/index.jsonl');
      return { count: 4, duplicates };
    },
    _import: () => { order.push('import'); },
  });

  assert.deepEqual(order, ['gitPull', 'rebuildIndex', 'import']);
  assert.equal(result.indexCount, 4);
  assert.deepEqual(result.duplicates, duplicates);
});

test('pullMemory: a store the merge left unindexable REFUSES before engram is hydrated from it', async () => {
  let imported = false;

  await assert.rejects(
    () =>
      pullMemory({
        root: '/fake/root',
        _isManifestDirty: () => false,
        _gitPull: () => {},
        _rebuildIndex: () => { throw new Error("rebuildIndex: divergent duplicate at 2026-07.jsonl:9 — id 'rec-a' …"); },
        _import: () => { imported = true; },
      }),
    /divergent duplicate/,
  );

  assert.equal(imported, false, 'hydration must not run on a store the rule refuses — ordering is the guarantee');
});

// ── import ───────────────────────────────────────────────────────────────────

test('buildImportPayload: a repeated id in one batch is sent ONCE — `engram import` INSERTS, so this is permanent damage', () => {
  const rec = (id) => ({ id, ts: '2026-07-04T12:00:00Z', actor: '@crinaldi', actorKind: 'agent', type: 'decision', project: 'brain', content: 'x' });

  const { payload, written, skipped } = buildImportPayload({
    records: [rec('rec-aaa'), rec('rec-bbb'), rec('rec-aaa')],
    existingTopicKeys: new Set(),
    startedAt: '2026-07-04 12:00:00',
  });

  assert.equal(written, 2);
  assert.equal(skipped, 1);
  assert.deepEqual(payload.observations.map((o) => o.topic_key), ['rec-aaa', 'rec-bbb']);
});
