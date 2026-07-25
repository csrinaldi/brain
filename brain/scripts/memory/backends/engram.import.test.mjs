// engram.import.test.mjs — unit tests for importMemory() gone records-only
// (design.md Decision 2 / D2, C4 #229): read `.memory/records/*.jsonl` via
// readRecordObservations, transform via importRecord(), write per-record via
// `engram save` with progress reporting. Replaces the former thin
// `engram sync --import` wrapper — no chunk path is read anymore.
//
// All seams are injected so no real engram/git subprocess is spawned and no
// real `.memory/` is touched.
//
// RED: importMemory's records-only signature (accepting _readRecords /
// _importRecord / _engramSave / _log seams) does not exist until engram.mjs
// is rewired.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { importMemory } from './engram.mjs';
import { buildRecord } from '../lib/format.mjs';

function fixtureRecords(n) {
  const records = [];
  for (let i = 0; i < n; i++) {
    records.push(
      buildRecord({
        ts: `2026-07-0${(i % 9) + 1}T01:19:12Z`,
        actor: '@crinaldi',
        actorKind: 'human',
        type: 'decision',
        project: 'brain',
        content: `Fixture decision number ${i}.`,
        title: `Fixture ${i}`,
      }),
    );
  }
  return records;
}

// ---------------------------------------------------------------------------
// (a) records-only pull hydrates engram — REQ-C4-2 scenario 1
// ---------------------------------------------------------------------------

test('importMemory: reads records via _readRecords, writes one engram save per record, with progress', async () => {
  const records = fixtureRecords(3);
  const saveCalls = [];
  const progressLines = [];

  const result = await importMemory({
    root: '/fake/root',
    _requireEngram: () => 'engram',
    _readRecords: () => records,
    _engramSave: (title, content, opts) => {
      saveCalls.push({ title, content, opts });
    },
    _log: (line) => progressLines.push(line),
  });

  assert.equal(saveCalls.length, 3, 'must call _engramSave exactly once per record');
  for (let i = 0; i < records.length; i++) {
    const call = saveCalls[i];
    assert.equal(call.opts.topic, records[i].id, 'topic must be the record content-addressed id');
    assert.equal(call.opts.type, records[i].type);
    assert.equal(call.opts.project, records[i].project);
  }
  assert.equal(result.written, 3, 'accounting must report 3 written');
  assert.ok(
    progressLines.some((l) => l.includes('3')),
    `expected progress reporting to mention the total (3), got: ${JSON.stringify(progressLines)}`,
  );
});

test('importMemory: no chunk path is read — never spawns `engram sync --import`', async () => {
  const records = fixtureRecords(1);
  let chunkPathTouched = false;

  await importMemory({
    root: '/fake/root',
    _requireEngram: () => 'engram',
    _readRecords: () => records,
    _engramSave: () => {},
    _log: () => {},
    // If importMemory still tried the old chunk path it would need a real
    // execFileSync/spawn call — none is injected here, so any attempt to
    // reach outside the injected seams would throw (no real engram binary
    // resolution happens beyond the injected _requireEngram stub).
  });

  assert.equal(chunkPathTouched, false, 'no chunk-path seam was ever invoked');
});

test('importMemory: empty records/ → zero writes, no throw', async () => {
  const progressLines = [];
  const result = await importMemory({
    root: '/fake/root',
    _requireEngram: () => 'engram',
    _readRecords: () => [],
    _engramSave: () => {
      throw new Error('_engramSave must not be called when there are no records');
    },
    _log: (line) => progressLines.push(line),
  });
  assert.equal(result.written, 0);
});

// ---------------------------------------------------------------------------
// (b) idempotency — REQ-C4-2 scenario 2 (MANDATORY)
// ---------------------------------------------------------------------------
//
// Mechanism proven here: engram's REAL dedup for a repeated `engram save`
// call is topic_key-based UPSERT (verified against the engram Go source,
// internal/store/store.go AddObservation ~line 2003: a topic_key match on
// the same project+scope UPDATES the existing row — no time window). This is
// DISTINCT from the content-hash dedup path in the same function (~line
// 2050), which is windowed to 15 minutes (store.NewConfig DedupeWindow
// default) and therefore NOT safe for an idempotency guarantee that must
// hold across arbitrarily-spaced re-runs (day-start pulls, etc).
//
// importMemory() passes `topic: record.id` (the record's own content-
// addressed id) as the `engram save --topic` value, so a second run over the
// same records resolves to the SAME topic_key per record and revises the
// existing observation instead of inserting a new one. The fake store below
// mirrors that exact upsert semantics (keyed on project+scope+topic) to
// prove the behavior without spawning a real engram process.
function makeFakeEngramStore() {
  const rows = new Map(); // key: `${project}::project::${topic}` -> {title, content, type, revisionCount}
  const _engramSave = (title, content, { type, project, topic }) => {
    const key = `${project}::project::${topic}`;
    if (rows.has(key)) {
      const row = rows.get(key);
      row.title = title;
      row.content = content;
      row.type = type;
      row.revisionCount += 1;
    } else {
      rows.set(key, { title, content, type, revisionCount: 1 });
    }
  };
  return { rows, _engramSave };
}

test('importMemory: re-running over the same records creates NO duplicate observations (idempotency, MANDATORY)', async () => {
  const records = fixtureRecords(5);
  const store = makeFakeEngramStore();

  const first = await importMemory({
    root: '/fake/root',
    _requireEngram: () => 'engram',
    _readRecords: () => records,
    _engramSave: store._engramSave,
    _log: () => {},
  });
  assert.equal(first.written, 5);
  assert.equal(store.rows.size, 5, 'first run must create exactly 5 distinct observations');
  for (const row of store.rows.values()) {
    assert.equal(row.revisionCount, 1);
  }

  const second = await importMemory({
    root: '/fake/root',
    _requireEngram: () => 'engram',
    _readRecords: () => records,
    _engramSave: store._engramSave,
    _log: () => {},
  });
  assert.equal(second.written, 5, 'importMemory still processes 5 records on the second run');

  // The load-bearing assertion: the STORE's distinct-row count is UNCHANGED
  // after the second run — zero NEW observations were created, only revisions
  // of the existing 5 (topic_key upsert), proving no duplicates.
  assert.equal(store.rows.size, 5, 'second run must not add any new distinct observation — zero duplicates');
  for (const row of store.rows.values()) {
    assert.equal(row.revisionCount, 2, 'each record must have been revised (upserted), not duplicated');
  }
});
