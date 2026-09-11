// engram.hydrate.test.mjs — unit tests for backends/engram.mjs#hydrate (#874,
// split A, R3/R4/D1/D2/D9). Every seam (`_engramSave`, `_guard`, `_probe`,
// `_readRecords`, `_importRecord`) is injected — no real engram binary, no
// real filesystem read of a real store, and no real #820 guard file, so
// `npm test` never touches this repo's `.memory/` or a real engram store.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hydrate } from './engram.mjs';
import { importRecord } from '../lib/engram-import.mjs';

const CLEAN_RECORD = {
  id: 'rec-0123456789abcdef',
  ts: '2026-09-10T09:00:00Z',
  actor: '@test',
  actorKind: 'human',
  type: 'discovery',
  project: 'brain',
  content: 'a clean record body',
};

function heldGuard() {
  let released = false;
  return {
    guard: { held: true, release: () => { released = true; } },
    wasReleased: () => released,
  };
}

// ── one _engramSave call, topic === recordId, payload byte-equal to importRecord(record) ──

test('hydrate: calls _engramSave exactly once, topic === recordId, payload matches importRecord(record)', async () => {
  const calls = [];
  const { guard } = heldGuard();
  const result = await hydrate(
    { root: '/tmp/unused', recordId: CLEAN_RECORD.id, record: CLEAN_RECORD },
    {
      _probe: () => ({ available: true }),
      _guard: () => guard,
      _engramSave: (title, content, opts) => { calls.push({ title, content, opts }); },
    },
  );
  assert.equal(result.written, 1);
  assert.equal(result.skipped, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].opts.topic, CLEAN_RECORD.id);
  const expected = importRecord(CLEAN_RECORD);
  assert.equal(calls[0].title, expected.title);
  assert.equal(calls[0].content, expected.content);
  assert.equal(calls[0].opts.type, expected.type);
  assert.equal(calls[0].opts.project, expected.project);
  assert.equal(calls[0].opts.scope, expected.scope);
});

// ── idempotence (R6): two hydrations of one record against a topic-keyed fake
// store leave one row ──

test('hydrate: idempotent — two hydrations of the same record leave exactly one row in a topic-keyed fake store', async () => {
  const store = new Map(); // topic_key -> observation, mirrors engram's real upsert-by-topic
  const fakeEngramSave = (title, content, opts) => {
    store.set(opts.topic, { title, content, ...opts });
  };

  for (let i = 0; i < 2; i++) {
    const { guard } = heldGuard();
    // eslint-disable-next-line no-await-in-loop
    await hydrate(
      { root: '/tmp/unused', recordId: CLEAN_RECORD.id, record: CLEAN_RECORD },
      { _probe: () => ({ available: true }), _guard: () => guard, _engramSave: fakeEngramSave },
    );
  }
  assert.equal(store.size, 1, 'a topic-keyed store must hold exactly one row per record id, no matter how many times it is hydrated');
});

// ── binary absent ⇒ deferred + stderr, no throw ─────────────────────────────

test('hydrate: binary absent ⇒ {deferred:true}, a stderr notice, and no throw', async () => {
  const { guard } = heldGuard();
  const warnings = [];
  let engramSaveCalled = false;
  const result = await hydrate(
    { root: '/tmp/unused', recordId: CLEAN_RECORD.id, record: CLEAN_RECORD },
    {
      _probe: () => ({ available: false }),
      _guard: () => guard,
      _engramSave: () => { engramSaveCalled = true; },
      _warn: (msg) => warnings.push(msg),
    },
  );
  assert.equal(result.written, 0);
  assert.equal(result.deferred, true);
  assert.equal(engramSaveCalled, false, 'the guard must never even be needed — _engramSave must never be called');
  assert.equal(warnings.length, 1);
});

// ── _engramSave throws ⇒ deferred with the reason, no throw ─────────────────

test('hydrate: _engramSave throws ⇒ {deferred:true, reason} and no throw propagates', async () => {
  const { guard, wasReleased } = heldGuard();
  const result = await hydrate(
    { root: '/tmp/unused', recordId: CLEAN_RECORD.id, record: CLEAN_RECORD },
    {
      _probe: () => ({ available: true }),
      _guard: () => guard,
      _engramSave: () => { throw new Error('engram: pragma "PRAGMA journal_mode = WAL": unable to open database file'); },
      _warn: () => {},
    },
  );
  assert.equal(result.written, 0);
  assert.equal(result.deferred, true);
  assert.ok(result.reason && result.reason.length > 0);
  assert.equal(wasReleased(), true, 'the guard must be released even when _engramSave throws');
});

// ── guard contended ⇒ {deferred:true, contended:true}, _engramSave never called ──

test('hydrate: guard contended ⇒ {deferred:true, contended:true}, _engramSave never called, never waits', async () => {
  let engramSaveCalled = false;
  const result = await hydrate(
    { root: '/tmp/unused', recordId: CLEAN_RECORD.id, record: CLEAN_RECORD },
    {
      _probe: () => ({ available: true }),
      _guard: () => ({ held: false, owner: { pid: 4242, ageMs: 5000 } }),
      _engramSave: () => { engramSaveCalled = true; },
      _warn: () => {},
    },
  );
  assert.equal(result.written, 0);
  assert.equal(result.deferred, true);
  assert.equal(result.contended, true);
  assert.equal(engramSaveCalled, false);
});

// ── unknown recordId with no record passed ⇒ throws (D4, a caller mistake, never deferred) ──

test('hydrate: an unknown recordId with no record passed THROWS (D4) — never deferred', async () => {
  await assert.rejects(() =>
    hydrate(
      { root: '/tmp/unused', recordId: 'rec-ffffffffffffffff' },
      {
        _probe: () => ({ available: true }),
        _guard: () => heldGuard().guard,
        _readRecords: () => ({ records: [CLEAN_RECORD], duplicates: {} }),
      },
    ),
  );
});

// ── fresh-review F2 (#924): a title/content starting with `-` cannot be
// spawned safely as an `engram save` argv token — `engram save --help` shows
// no `--` escape (measured), so a leading `-` would be parsed as an option
// instead of a positional. `hydrate` must refuse to spawn rather than hand
// engram an argv it will misparse. The proper fix (an escape in the engram
// CLI itself) is upstream — nothing to file in this repo. ─────────────────

test('hydrate: a record whose title starts with "-" is deferred with reason "engram-argv-unsafe" — _engramSave is never called', async () => {
  const dashRecord = { ...CLEAN_RECORD, content: '**-x**\n\na title that starts with a dash' };
  const { guard } = heldGuard();
  let engramSaveCalled = false;
  const result = await hydrate(
    { root: '/tmp/unused', recordId: dashRecord.id, record: dashRecord },
    {
      _probe: () => ({ available: true }),
      _guard: () => guard,
      _engramSave: () => { engramSaveCalled = true; },
      _warn: () => {},
    },
  );
  assert.equal(engramSaveCalled, false, 'a leading "-" in the title must never reach the engram CLI spawn');
  assert.equal(result.written, 0);
  assert.equal(result.deferred, true);
  assert.equal(result.reason, 'engram-argv-unsafe');
});
