// store.duplicates.test.mjs — issue #574. The duplicate-line RULE:
//
//   a repeated `id` whose lines AGREE    → deduplicated AND reported
//   a repeated `id` whose lines DISAGREE → refused, naming both lines
//
// The tamper path (a line whose bytes do not hash to its id) has been refused
// since #214 and has its own tests in store.test.mjs. These pin the OTHER
// failure mode, which used to be answered by silence.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildRecord, serializeRecord } from './format.mjs';
import { rebuildIndex, readRecords, readRecordObservations } from './store.mjs';

const base = {
  ts: '2026-07-04T12:00:00Z',
  actor: '@crinaldi',
  actorKind: 'human',
  type: 'decision',
  project: 'brain',
};

function fixture(t, lines, filename = '2026-07.jsonl') {
  const root = mkdtempSync(join(tmpdir(), 'brain-memory-dup-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const recordsDir = join(root, 'records');
  mkdirSync(recordsDir, { recursive: true });
  writeFileSync(join(recordsDir, filename), lines.map((l) => l + '\n').join(''), 'utf8');
  return { root, recordsDir, indexPath: join(root, 'index.jsonl'), recordsFile: join(recordsDir, filename) };
}

// ── the reported half ────────────────────────────────────────────────────────

test('rebuildIndex: a clean store reports zero duplicates (the accounting is always present)', (t) => {
  const a = buildRecord({ ...base, content: 'A' });
  const b = buildRecord({ ...base, content: 'B' });
  const { recordsDir, indexPath } = fixture(t, [serializeRecord(a), serializeRecord(b)]);

  const { count, duplicates } = rebuildIndex({ recordsDir, indexPath });

  assert.equal(count, 2);
  assert.deepEqual(duplicates, { ids: 0, lines: 0, groups: [] });
});

test('rebuildIndex: an identical repeated line is COLLAPSED, not refused — the index stays one entry per id', (t) => {
  const a = buildRecord({ ...base, content: 'A' });
  const b = buildRecord({ ...base, content: 'B' });
  const { recordsDir, indexPath } = fixture(t, [serializeRecord(a), serializeRecord(b), serializeRecord(a)]);

  const { count } = rebuildIndex({ recordsDir, indexPath });

  assert.equal(count, 2, 'the repeated id contributes one index entry');
  const indexed = readFileSync(indexPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id);
  assert.deepEqual([...indexed].sort(), [a.id, b.id].sort());
});

test('rebuildIndex: the collapse is REPORTED — ids, excess lines, and every location', (t) => {
  const a = buildRecord({ ...base, content: 'A' });
  const b = buildRecord({ ...base, content: 'B' });
  const { recordsDir, indexPath } = fixture(t, [
    serializeRecord(a), serializeRecord(b), serializeRecord(a), serializeRecord(a),
  ]);

  const { count, duplicates } = rebuildIndex({ recordsDir, indexPath });

  assert.equal(count, 2);
  assert.equal(duplicates.ids, 1, 'one id repeats');
  assert.equal(duplicates.lines, 2, 'the store is 2 physical lines longer than the index');
  assert.deepEqual(duplicates.groups, [
    { id: a.id, occurrences: ['2026-07.jsonl:1', '2026-07.jsonl:3', '2026-07.jsonl:4'] },
  ]);
});

test('rebuildIndex: duplicates are counted ACROSS month files, with each location named', (t) => {
  const a = buildRecord({ ...base, content: 'A' });
  const { root, recordsDir, indexPath } = fixture(t, [serializeRecord(a)], '2026-06.jsonl');
  writeFileSync(join(recordsDir, '2026-07.jsonl'), serializeRecord(a) + '\n', 'utf8');
  assert.ok(root);

  const { count, duplicates } = rebuildIndex({ recordsDir, indexPath });

  assert.equal(count, 1);
  assert.equal(duplicates.lines, 1);
  assert.deepEqual(duplicates.groups[0].occurrences, ['2026-06.jsonl:1', '2026-07.jsonl:1']);
});

test('rebuildIndex: duplicate reporting survives blank lines — line numbers are PHYSICAL, 1-based', (t) => {
  const a = buildRecord({ ...base, content: 'A' });
  const { recordsDir, indexPath } = fixture(t, [serializeRecord(a), '', serializeRecord(a)]);

  const { duplicates } = rebuildIndex({ recordsDir, indexPath });

  assert.deepEqual(duplicates.groups[0].occurrences, ['2026-07.jsonl:1', '2026-07.jsonl:3']);
});

test('rebuildIndex: key order is not divergence — the same record serialized differently is ONE record', (t) => {
  const a = buildRecord({ ...base, content: 'A', source: 'issue #574' });
  const reordered = JSON.stringify(
    Object.fromEntries(Object.entries(a).reverse()),
  );
  const { recordsDir, indexPath } = fixture(t, [serializeRecord(a), reordered]);

  const { count, duplicates } = rebuildIndex({ recordsDir, indexPath });

  assert.equal(count, 1);
  assert.equal(duplicates.lines, 1, 'collapsed and counted, never refused — the bytes differ, the record does not');
});

// ── the refused half ─────────────────────────────────────────────────────────

test('rebuildIndex: two lines sharing an id but DISAGREEING are REFUSED — `source` is not hashed', (t) => {
  // Both lines pass the id-integrity check on their own: `source` is excluded
  // from the hash (format.mjs#computeRecordId), so this is reachable with no
  // tampering at all — and the old Map-keyed collapse resolved it last-wins.
  const a = buildRecord({ ...base, content: 'A', source: 'issue #574' });
  const b = { ...a, source: 'issue #999' };
  const { recordsDir, indexPath } = fixture(t, [serializeRecord(a), serializeRecord(b)]);

  assert.throws(
    () => rebuildIndex({ recordsDir, indexPath }),
    (err) => {
      assert.match(err.message, /divergent duplicate at 2026-07\.jsonl:2/, 'names the offending line');
      assert.match(err.message, /already read at 2026-07\.jsonl:1/, 'names the line it disagrees with');
      assert.match(err.message, new RegExp(a.id), 'names the id');
      return true;
    },
  );
});

test('rebuildIndex: a divergent duplicate fails CLOSED — same posture as the tamper path', (t) => {
  const a = buildRecord({ ...base, content: 'A', source: 'issue #574' });
  const b = { ...a, source: 'issue #999' };
  const { recordsDir, indexPath } = fixture(t, [serializeRecord(a), serializeRecord(b)]);

  assert.throws(() => rebuildIndex({ recordsDir, indexPath }));
  assert.throws(
    () => readFileSync(indexPath, 'utf8'),
    /ENOENT/,
    'no index is written from a store the rule refuses',
  );
});

test('rebuildIndex: an unknown extra key on one of two same-id lines is divergence too', (t) => {
  const a = buildRecord({ ...base, content: 'A' });
  const b = { ...a, note: 'hand-edited' };
  const { recordsDir, indexPath } = fixture(t, [serializeRecord(a), serializeRecord(b)]);

  assert.throws(() => rebuildIndex({ recordsDir, indexPath }), /divergent duplicate/);
});

// ── the reader half (the hydration path) ─────────────────────────────────────

test('readRecords: an identical repeat is collapsed and reported — one record, accounting intact', (t) => {
  const a = buildRecord({ ...base, content: 'A' });
  const b = buildRecord({ ...base, content: 'B' });
  const { recordsDir } = fixture(t, [serializeRecord(a), serializeRecord(b), serializeRecord(a)]);

  const { records, duplicates } = readRecords({ recordsDir });

  assert.deepEqual(records.map((r) => r.id), [a.id, b.id]);
  assert.equal(duplicates.ids, 1);
  assert.equal(duplicates.lines, 1);
});

test('readRecords: a DIVERGENT duplicate keeps the first line and never throws (fail-open reader contract)', (t) => {
  // Deliberately unlike rebuildIndex: this reader is documented best-effort and
  // feeds the memory-gate and engram hydration. rebuildIndex remains the
  // fail-closed gate and refuses the very same pair on its next run.
  const a = buildRecord({ ...base, content: 'A', source: 'first' });
  const b = { ...a, source: 'second' };
  const { recordsDir, indexPath } = fixture(t, [serializeRecord(a), serializeRecord(b)]);

  const { records, duplicates } = readRecords({ recordsDir });

  assert.equal(records.length, 1);
  assert.equal(records[0].source, 'first');
  assert.equal(duplicates.lines, 1);
  assert.throws(() => rebuildIndex({ recordsDir, indexPath }), /divergent duplicate/);
});

test('readRecords: a corrupt line is still skipped, and an id-less line still passes through', (t) => {
  const a = buildRecord({ ...base, content: 'A' });
  const { recordsDir } = fixture(t, [serializeRecord(a), '{not json', JSON.stringify({ type: 'decision' })]);

  const { records } = readRecords({ recordsDir });

  assert.equal(records.length, 2, 'the corrupt line is skipped; the id-less one is not silently dropped');
});

test('readRecords: absent records/ → empty result, no throw', () => {
  const { records, duplicates } = readRecords({ recordsDir: join(tmpdir(), 'brain-memory-dup-absent-xyz') });
  assert.deepEqual(records, []);
  assert.deepEqual(duplicates, { ids: 0, lines: 0, groups: [] });
});

test('readRecordObservations: the legacy array reader is now deduped by id (it wraps readRecords)', (t) => {
  const a = buildRecord({ ...base, content: 'A' });
  const { recordsDir } = fixture(t, [serializeRecord(a), serializeRecord(a)]);

  assert.equal(readRecordObservations({ recordsDir }).length, 1);
});
