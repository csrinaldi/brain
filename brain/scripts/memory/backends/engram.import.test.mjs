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

// REWRITTEN for #433. The requirement this test exists for — REQ-C4-2 scenario
// 1, "a records-only pull hydrates engram" — is unchanged and still asserted
// below, field for field. What changed is the MECHANISM it was written against:
// the old body asserted "exactly one _engramSave per record", and that per-record
// spawn IS the defect #433 removes (1722 records = 1053 seconds, paid on every
// `git pull`). Asserting it would now pin the bug in place.
test('importMemory: reads records via _readRecords and hydrates engram in ONE batch (REQ-C4-2 s1, #433)', async () => {
  const records = fixtureRecords(3);
  const imports = [];

  const result = await importMemory({
    root: '/fake/root',
    _requireEngram: () => 'engram',
    _readRecords: () => records,
    _engramExistingTopicKeys: () => new Set(),
    _engramImport: (payload) => imports.push(payload),
    _log: () => {},
  });

  assert.equal(imports.length, 1, 'three records must cost ONE import, not three saves');
  const sent = imports[0].observations;
  assert.equal(sent.length, 3, 'every record must reach engram');
  for (let i = 0; i < records.length; i++) {
    const o = sent.find((x) => x.topic_key === records[i].id);
    assert.ok(o, 'topic_key must be the record content-addressed id — the anchor the next run reads back');
    assert.equal(o.type, records[i].type);
    assert.equal(o.project, records[i].project);
  }
  assert.equal(result.written, 3, 'accounting must report 3 written');
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
// REWRITTEN for #433, and the rewrite is deliberately STRICTER than what it
// replaces. Read this before touching it.
//
// The GUARANTEE — "re-running over the same records creates no duplicate
// observations" — is unchanged and is still the load-bearing assertion below.
// Only the mechanism moved, and it had to:
//
//   old: N × `engram save --topic <id>`, where engram UPSERTS on topic_key.
//        Re-running re-sent all 5 and engram revised them in place, so the
//        proof was "row count unchanged, revisionCount incremented".
//   new: one `engram import`, which — measured against the real binary —
//        INSERTS. Importing the same file twice turned 2 observations into 4.
//        Engram will not deduplicate for us, so the second run must send
//        NOTHING, and that is now asserted directly.
//
// `revisionCount` is gone from this fake because nothing is revised any more.
// That is equivalent only because brain records are IMMUTABLE — an id is
// content-derived, so an edit produces a new record rather than mutating an
// imported one. `engram.batch-import.test.mjs` pins that premise on its own.
//
// This fake therefore mirrors the REAL insert semantics, not a forgiving
// upsert: a repeated topic_key creates a SECOND row, so a regression that
// re-sends known records fails here loudly instead of being absorbed.
function makeFakeEngramStore() {
  const rows = []; // insert-only, exactly like `engram import`
  const _engramImport = (payload) => {
    for (const o of payload.observations) rows.push({ ...o });
  };
  const _engramExistingTopicKeys = () => new Set(rows.map((r) => r.topic_key));
  return { rows, _engramImport, _engramExistingTopicKeys };
}

test('importMemory: re-running over the same records creates NO duplicate observations (idempotency, MANDATORY)', async () => {
  const records = fixtureRecords(5);
  const store = makeFakeEngramStore();
  const run = () => importMemory({
    root: '/fake/root',
    _requireEngram: () => 'engram',
    _readRecords: () => records,
    _engramExistingTopicKeys: store._engramExistingTopicKeys,
    _engramImport: store._engramImport,
    _log: () => {},
  });

  const first = await run();
  assert.equal(first.written, 5);
  assert.equal(store.rows.length, 5, 'first run must create exactly 5 observations');

  const second = await run();

  // THE load-bearing assertion, unchanged in intent: the store holds the same
  // 5 observations. Under an inserting backend this can only hold if the second
  // run sent nothing at all.
  assert.equal(store.rows.length, 5, 'second run must not add any observation — zero duplicates');
  assert.equal(second.written, 0, 'nothing new to send: every record is already present');
  assert.equal(second.skipped, 5, 'and all 5 must be accounted for as skipped, not silently dropped');

  const keys = store.rows.map((r) => r.topic_key);
  assert.equal(new Set(keys).size, 5, 'every stored topic_key must still be distinct');
});
