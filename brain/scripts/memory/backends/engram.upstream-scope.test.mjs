// engram.upstream-scope.test.mjs — issue #701: dualWriteRecords()/share() decline
// a candidate whose id is already durable at the upstream base, IN ADDITION to
// the existing own-records dedup. Seam-injected (`_upstreamRecordIds`) —
// `upstream-records.test.mjs` covers the real predicate. The ONE exception is
// the last test in this file, which uses the real predicate on purpose to pin
// the exporter's call shape; it says so where it sits.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { share, dualWriteRecords } from './engram.mjs';
import { buildRecord } from '../lib/format.mjs';

/**
 * A tmpdir that is REMOVED when the test ends — the convention
 * `upstream-records.integration.test.mjs:37-43` already follows. Without it this
 * file leaks one directory per run (cold review round 2 of #701).
 */
function tmpRoot(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

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

// ---------------------------------------------------------------------------
// The exporter's own CALL SHAPE honors memory.upstreamRef (cold review of #708)
//
// Every test above stubs `_upstreamRecordIds`, so none of them can see what
// `dualWriteRecords` actually passes it. That is the blind spot that let
// `_upstreamRecordIds({ root })` look correct while `upstreamRecordEntries`
// defaulted `config = {}` and threw the stated ref away.
//
// This one deliberately uses the REAL predicate against a real tmpdir holding a
// real `brain.config.json` — the only spawns in this file, and the only way the
// assertion is about behaviour rather than about argument shape. The tmpdir is
// not a git repo, so the stated ref cannot resolve: the point is WHICH ref the
// exporter reports it tried.
//
// It is also the ONE test here that cannot pass `env: {}`, because
// `dualWriteRecords` calls `_upstreamRecordIds({ root })` with neither `env` nor
// `config` (deliberately — `upstream-records.mjs` owns both keys), so the real
// predicate falls back to `process.env`. An exported `BRAIN_MEMORY_UPSTREAM_REF`
// — exactly the variable an operator debugging this feature would set — is
// level 1 and wins over the config, turning this red on a developer machine
// (cold review round 2 of #701). It is neutralised for the test and restored
// after, rather than widening the production signature with an `env` parameter
// that exists only for a test: the seam this file needs is already there
// (`_upstreamRecordIds`), and this test is precisely the one that must NOT use
// it.
// ---------------------------------------------------------------------------

/** Removes an env var for one test and restores it exactly, unset included. */
function withoutEnv(t, name) {
  const prior = process.env[name];
  delete process.env[name];
  t.after(() => {
    if (prior === undefined) delete process.env[name];
    else process.env[name] = prior;
  });
}

test('dualWriteRecords: a memory.upstreamRef stated at root reaches the real predicate — not overridden by a derived ref', async (t) => {
  withoutEnv(t, 'BRAIN_MEMORY_UPSTREAM_REF');
  const root = tmpRoot(t, 'brain-engram-upstream-');
  writeFileSync(join(root, 'brain.config.json'), JSON.stringify({ memory: { upstreamRef: 'origin/stated-at-root' } }));

  const rec = buildRecord({ ...baseRecordFields, content: 'config level, real predicate' });
  const result = await dualWriteRecords(root, {
    _readObservations: () => ({ observations: [{ id: 1 }] }),
    _exportObservation: () => ({ record: rec, recovered: true }),
    _appendRecord: () => {},
    _readRecordIds: () => new Set(),
    // `_upstreamRecordIds` is NOT stubbed — the real `upstreamRecordEntries` runs.
    _rebuildIndex: () => ({ count: 0, duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] } }),
    _loadConfig: () => ({}),
  });

  assert.equal(result.upstreamScope.ref, 'origin/stated-at-root',
    'the stated ref must be the one the exporter reports — origin/HEAD/origin/main here would mean the config never arrived');
  assert.equal(result.upstreamScope.stated, true);
  assert.equal(result.upstreamScope.applied, false, 'it cannot resolve in a non-repo tmpdir — and the run still writes everything');
  assert.equal(result.written, 1, 'fail-open is unchanged: an unresolvable upstream never withholds a record');
});
