// engram.upstream-scope.test.mjs — issue #701: dualWriteRecords()/share() decline
// a candidate whose id is already durable at the upstream base, IN ADDITION to
// the existing own-records dedup. Seam-injected (`_upstreamRecordIds`) — no test
// spawns git; `upstream-records.test.mjs` covers the real predicate.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { share, dualWriteRecords } from './engram.mjs';
import { buildRecord } from '../lib/format.mjs';

const baseRecordFields = {
  ts: '2026-07-04T12:00:00Z', actor: '@crinaldi', actorKind: 'human', type: 'decision', project: 'brain',
};

// ---------------------------------------------------------------------------
// spec.md scenarios (task 2.8)
// ---------------------------------------------------------------------------

test('dualWriteRecords: a record already on origin/main is deduped as dedupedUpstream (spec Req 1, scenario 1)', async () => {
  const rec = buildRecord({ ...baseRecordFields, content: 'already upstream' });
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [{ id: 1 }] }),
    _exportObservation: () => ({ record: rec, recovered: true }),
    _appendRecord: () => { throw new Error('must not append an upstream-present record'); },
    _readRecordIds: () => new Set(), // absent from the worktree's own records/
    _upstreamRecordIds: () => ({ ok: true, ref: 'origin/main', stated: false, byId: new Map([[rec.id, 'deadbeef']]), byPath: new Map(), unnamed: [] }),
    _rebuildIndex: () => ({ count: 0, duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] } }),
    _loadConfig: () => ({}),
  });

  assert.equal(result.written, 0);
  assert.equal(result.deduped, 1, 'deduped is the TOTAL of every decline reason');
  assert.equal(result.dedupedUpstream, 1);
});

test('dualWriteRecords: existing own-worktree dedup still applies, unchanged (spec Req 1, scenario 2)', async () => {
  const rec = buildRecord({ ...baseRecordFields, content: 'own worktree dup' });
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [{ id: 1 }] }),
    _exportObservation: () => ({ record: rec, recovered: true }),
    _appendRecord: () => { throw new Error('must not append an own-worktree duplicate'); },
    _readRecordIds: () => new Set([rec.id]), // already present locally
    _upstreamRecordIds: () => ({ ok: true, ref: 'origin/main', stated: false, byId: new Map(), byPath: new Map(), unnamed: [] }),
    _rebuildIndex: () => ({ count: 0, duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] } }),
    _loadConfig: () => ({}),
  });

  assert.equal(result.written, 0);
  assert.equal(result.deduped, 1);
  assert.equal(result.dedupedUpstream, 0, 'the own-worktree reason must not inflate the upstream bucket');
});

test('dualWriteRecords: a genuinely new record (absent from both own records/ and origin/main) is still written (spec Req 1, scenario 3 — the issue=545 case)', async () => {
  const rec = buildRecord({ ...baseRecordFields, content: 'brand new', issue: 545 });
  let appended = false;
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [{ id: 1 }] }),
    _exportObservation: () => ({ record: rec, recovered: true }),
    _appendRecord: () => { appended = true; },
    _readRecordIds: () => new Set(),
    _upstreamRecordIds: () => ({ ok: true, ref: 'origin/main', stated: false, byId: new Map(), byPath: new Map(), unnamed: [] }),
    _rebuildIndex: () => ({ count: 1, duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] } }),
    _loadConfig: () => ({}),
  });

  assert.equal(appended, true);
  assert.equal(result.written, 1);
  assert.equal(result.deduped, 0);
});

// ---------------------------------------------------------------------------
// Task 2.7 — the DELIBERATE fallback test, not the incidental /fake/root pass
// ---------------------------------------------------------------------------

test('dualWriteRecords: upstream lookup unavailable → writes EVERY candidate AND reports applied:false with a reason (design Decision 3)', async () => {
  const recA = buildRecord({ ...baseRecordFields, content: 'A' });
  const recB = buildRecord({ ...baseRecordFields, content: 'B' });
  const appendedIds = [];

  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [{ id: 1 }, { id: 2 }] }),
    _exportObservation: (obs) => ({ record: obs.id === 1 ? recA : recB, recovered: true }),
    _appendRecord: (record) => { appendedIds.push(record.id); },
    _readRecordIds: () => new Set(),
    _upstreamRecordIds: () => ({ ok: false, ref: 'origin/main', stated: false, reason: 'no remote' }),
    _rebuildIndex: () => ({ count: 2, duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] } }),
    _loadConfig: () => ({}),
  });

  assert.deepEqual(appendedIds.sort(), [recA.id, recB.id].sort(), 'both candidates written — the pre-#701 behaviour');
  assert.equal(result.written, 2);
  assert.equal(result.deduped, 0);
  assert.equal(result.dedupedUpstream, 0);
  assert.equal(result.upstreamScope.applied, false);
  assert.ok(result.upstreamScope.reason && result.upstreamScope.reason.length > 0, 'the reason must be non-empty');
  assert.equal(result.upstreamScope.ref, 'origin/main');
});

test('dualWriteRecords: upstream lookup available with a partial-scope file → reports unnamed count', async () => {
  const rec = buildRecord({ ...baseRecordFields, content: 'C' });
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [{ id: 1 }] }),
    _exportObservation: () => ({ record: rec, recovered: true }),
    _appendRecord: () => {},
    _readRecordIds: () => new Set(),
    _upstreamRecordIds: () => ({
      ok: true, ref: 'origin/main', stated: false,
      byId: new Map(), byPath: new Map(),
      unnamed: ['.memory/records/2026-07.jsonl'],
    }),
    _rebuildIndex: () => ({ count: 1, duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] } }),
    _loadConfig: () => ({}),
  });

  assert.equal(result.upstreamScope.applied, true);
  assert.equal(result.upstreamScope.unnamed, 1);
});

test('dualWriteRecords: zero candidates never calls the upstream seam — no git spawn on a steady-state share with nothing to export', async () => {
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [] }),
    _upstreamRecordIds: () => { throw new Error('must not be called when there are no candidates'); },
    _loadConfig: () => ({}),
  });
  assert.equal(result.written, 0);
  assert.equal(result.dedupedUpstream, 0);
});

// ---------------------------------------------------------------------------
// Task 2.9 — share() threads _upstreamRecordIds into its dualWriteRecords() call
// ---------------------------------------------------------------------------

test('share: threads _upstreamRecordIds through to dualWriteRecords — the seam share cannot pass is the seam end-to-end never reaches', async () => {
  const rec = buildRecord({ ...baseRecordFields, content: 'threaded' });
  let upstreamSeamCalled = false;

  const result = await share({
    root: '/fake/root',
    _requireEngram: () => 'engram',
    _export: () => {},
    _resolveDir: () => null,
    _changedChunkFiles: () => [],
    _readObservations: () => ({ observations: [{ id: 1 }] }),
    _exportObservation: () => ({ record: rec, recovered: true }),
    _appendRecord: () => { throw new Error('must not append — the seam must have declined it'); },
    _readRecordIds: () => new Set(),
    _upstreamRecordIds: () => {
      upstreamSeamCalled = true;
      return { ok: true, ref: 'origin/main', stated: false, byId: new Map([[rec.id, 'oid']]), byPath: new Map(), unnamed: [] };
    },
    _rebuildIndex: () => ({ count: 0, duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] } }),
    _loadConfig: () => ({}),
  });

  assert.equal(upstreamSeamCalled, true, 'share() must thread its own _upstreamRecordIds seam into dualWriteRecords()');
  assert.equal(result.written, 0);
  assert.equal(result.dedupedUpstream, 1);
});
