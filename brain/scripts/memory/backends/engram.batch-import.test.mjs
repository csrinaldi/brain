// engram.batch-import.test.mjs — issue #433.
//
// The import loop called `engram save` once per record: 1722 records × one
// execFileSync each = 1053 seconds, measured. That cost is paid by
// session-start.mjs (step 2) AND by the post-merge hook on every single
// `git pull`, both synchronously and both with the output suppressed.
//
// The fix is a BATCH path: read what engram already holds (one `engram export`,
// measured at 0.67s for 2248 observations), skip the records already there, and
// write the rest with ONE `engram import`. Two process spawns instead of N.
//
// ── The invariant this rests on, stated because it is load-bearing ──────────
//
// The old loop UPSERTED: `engram save --topic <record.id>` revised an existing
// observation when the record's content changed. The batch path SKIPS anything
// already present, which is only equivalent because **brain records are
// immutable** — a record id is content-derived (`rec-<hash>`), so changed
// content produces a NEW record rather than mutating an existing one.
//
// If that ever stops being true, this path starts silently ignoring updates.
// `records are immutable` below is the test that fails first if it does.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildImportPayload, importMemory } from './engram.mjs';
import { buildRecord } from '../lib/format.mjs';

function rec(id, extra = {}) {
  return {
    id,
    ts: '2026-08-04T12:00:00Z',
    actor: '@t',
    actorKind: 'human',
    type: 'discovery',
    project: 'brain',
    content: `body of ${id}`,
    ...extra,
  };
}

// ── buildImportPayload — the delta ───────────────────────────────────────────

test('buildImportPayload: a record already in engram is SKIPPED, not re-sent', () => {
  const { payload, written, skipped } = buildImportPayload({
    records: [rec('rec-aaa'), rec('rec-bbb')],
    existingTopicKeys: new Set(['rec-aaa']),
    startedAt: '2026-08-04 12:00:00',
  });

  assert.equal(written, 1);
  assert.equal(skipped, 1);
  assert.deepEqual(payload.observations.map((o) => o.topic_key), ['rec-bbb']);
});

test('buildImportPayload: with nothing new there is no payload to send', () => {
  const { payload, written, skipped } = buildImportPayload({
    records: [rec('rec-aaa')],
    existingTopicKeys: new Set(['rec-aaa']),
    startedAt: '2026-08-04 12:00:00',
  });

  assert.equal(written, 0);
  assert.equal(skipped, 1);
  assert.equal(payload, null, 'nothing to import must produce no payload at all — not an empty one to spawn for');
});

// The record id IS the topic key. That is the whole idempotency anchor: it is
// what lets the next run recognise this record as already present.
test('buildImportPayload: every observation carries topic_key = record.id', () => {
  const { payload } = buildImportPayload({
    records: [rec('rec-aaa'), rec('rec-bbb')],
    existingTopicKeys: new Set(),
    startedAt: '2026-08-04 12:00:00',
  });

  assert.deepEqual(payload.observations.map((o) => o.topic_key).sort(), ['rec-aaa', 'rec-bbb']);
});

// Measured against the real binary: an observation whose session row is absent
// fails with `FOREIGN KEY constraint failed`. A `session_id: null` fails the
// same way. The session row is what establishes the project, so the payload has
// to carry one — this is not decoration.
test('buildImportPayload: a synthetic session row exists for each project present', () => {
  const { payload } = buildImportPayload({
    records: [rec('rec-aaa', { project: 'brain' }), rec('rec-bbb', { project: 'other' })],
    existingTopicKeys: new Set(),
    startedAt: '2026-08-04 12:00:00',
  });

  assert.deepEqual(payload.sessions.map((s) => s.project).sort(), ['brain', 'other']);
  for (const o of payload.observations) {
    const s = payload.sessions.find((x) => x.id === o.session_id);
    assert.ok(s, `observation for ${o.topic_key} references a session that is not in the payload`);
    assert.equal(s.project, o.project, 'an observation must hang off ITS OWN project session');
  }
});

test('buildImportPayload: the payload is in the shape engram import accepts', () => {
  const { payload } = buildImportPayload({
    records: [rec('rec-aaa')],
    existingTopicKeys: new Set(),
    startedAt: '2026-08-04 12:00:00',
  });

  assert.deepEqual(Object.keys(payload).sort(), ['exported_at', 'observations', 'prompts', 'sessions', 'version']);
  const o = payload.observations[0];
  for (const k of ['title', 'content', 'type', 'project', 'scope', 'topic_key', 'session_id']) {
    assert.ok(k in o, `observation is missing required field "${k}"`);
  }
});

// ── The invariant ────────────────────────────────────────────────────────────

// Not a behavioural test of the batch path — a guard on the PREMISE that makes
// skip-if-exists equivalent to the upsert it replaces. buildRecord derives the
// id from the content, so two different bodies can never share an id, and an
// edit therefore produces a new record instead of mutating one already imported.
test('records are immutable: a content change yields a DIFFERENT record id', () => {
  const common = { type: 'discovery', project: 'brain', actor: '@t', actorKind: 'human', ts: '2026-08-04T12:00:00Z' };
  const a = buildRecord({ ...common, content: 'one' });
  const b = buildRecord({ ...common, content: 'two' });

  assert.notEqual(a.id, b.id,
    'skip-if-exists is only equivalent to an upsert while record ids are content-derived — ' +
    'if this fails, the batch import is silently dropping updates');
});

// ── importMemory — the cost that made #433 ───────────────────────────────────

test('importMemory: ONE import call, not one save per record (#433)', async () => {
  const records = Array.from({ length: 50 }, (_, i) => rec(`rec-${i}`));
  const imports = [];
  let saves = 0;

  const res = await importMemory({
    root: '/tmp/nonexistent',
    _requireEngram: () => 'engram',
    _readRecords: () => records,
    _engramExistingTopicKeys: () => new Set(),
    _engramImport: (payload) => { imports.push(payload); },
    _engramSave: () => { saves += 1; },
    _log: () => {},
  });

  assert.equal(res.written, 50);
  assert.equal(imports.length, 1, `50 records must cost ONE import; got ${imports.length}`);
  assert.equal(saves, 0, 'the per-record save path must be gone entirely — it is the whole defect');
});

test('importMemory: a second run over the same records sends NOTHING (#433 + idempotency)', async () => {
  const records = [rec('rec-aaa'), rec('rec-bbb')];
  let store = new Set();
  const imports = [];

  const run = () => importMemory({
    root: '/tmp/nonexistent',
    _requireEngram: () => 'engram',
    _readRecords: () => records,
    _engramExistingTopicKeys: () => new Set(store),
    _engramImport: (payload) => {
      imports.push(payload);
      for (const o of payload.observations) store.add(o.topic_key);
    },
    _log: () => {},
  });

  const first = await run();
  const second = await run();

  assert.equal(first.written, 2);
  assert.equal(second.written, 0, 're-running must send nothing — engram import DUPLICATES, it does not upsert');
  assert.equal(imports.length, 1, 'the second run must not spawn an import at all');
});

test('importMemory: empty records/ → zero writes, no import spawned, no throw', async () => {
  const imports = [];
  const res = await importMemory({
    root: '/tmp/nonexistent',
    _requireEngram: () => 'engram',
    _readRecords: () => [],
    _engramExistingTopicKeys: () => new Set(),
    _engramImport: (p) => imports.push(p),
    _log: () => {},
  });

  assert.equal(res.written, 0);
  assert.equal(imports.length, 0);
});

// Reading what engram already holds is the delta's only input. It runs before
// anything is written, over a store that may be empty, locked, or from another
// engram version — so a failure there must degrade to "import everything"
// rather than abort the hydration a `git pull` is waiting on.
test('importMemory: an unreadable engram state degrades to a full import, never a throw', async () => {
  const imports = [];
  const res = await importMemory({
    root: '/tmp/nonexistent',
    _requireEngram: () => 'engram',
    _readRecords: () => [rec('rec-aaa')],
    _engramExistingTopicKeys: () => { throw new Error('engram export blew up'); },
    _engramImport: (p) => imports.push(p),
    _log: () => {},
  });

  assert.equal(res.written, 1);
  assert.equal(imports.length, 1);
});
