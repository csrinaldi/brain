// format.test.mjs — unit tests for the durable memory record format (REQ-MF-1, REQ-MF-2, REQ-MF-5).
//
// Pure-function contract: no FS, no engram, no child processes (brain/scripts/memory/lib/store.mjs
// owns the I/O side; see store.test.mjs for reindex/append behavior).
//
// RED: these imports fail until format.mjs is created (task C1a.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  RECORD_TYPES,
  canonicalJson,
  computeRecordId,
  buildRecord,
  validateRecord,
  serializeRecord,
  parseRecordLine,
  buildIndexEntry,
  serializeIndex,
} from './format.mjs';

// ── canonicalJson (RFC 8785 JCS) ──────────────────────────────────────────────

test('canonicalJson: sorts keys regardless of insertion order', () => {
  const a = canonicalJson({ b: 1, a: 2 });
  const b = canonicalJson({ a: 2, b: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":2,"b":1}');
});

test('canonicalJson: whitespace-variant objects canonicalize identically', () => {
  const a = canonicalJson(JSON.parse('{"a":1,"b":2}'));
  const b = canonicalJson(JSON.parse('{ "b" : 2 , "a" : 1 }'));
  assert.equal(a, b);
});

// ── computeRecordId (content hash, REQ-MF-2) ─────────────────────────────────

const base = {
  type: 'decision',
  actor: '@crinaldi',
  actorKind: 'human',
  ts: '2026-07-04T12:00:00Z',
  project: 'brain',
  content: 'We chose union merge.',
};

test('computeRecordId: identical semantic fields hash identically across differing source', () => {
  const idA = computeRecordId({ ...base, source: 'issue #201' });
  const idB = computeRecordId({ ...base, source: 'PR #204 (differs)' });
  assert.equal(idA, idB);
  assert.match(idA, /^rec-[0-9a-f]{16}$/);
});

test('computeRecordId: a changed semantic field changes the id', () => {
  const idA = computeRecordId(base);
  const idB = computeRecordId({ ...base, content: 'Different content.' });
  assert.notEqual(idA, idB);
});

test('computeRecordId: absent optional (issue) vs another absent optional hash the same', () => {
  const idA = computeRecordId({ ...base });
  const idB = computeRecordId({ ...base });
  assert.equal(idA, idB);
});

// ── buildRecord (R2 title fold, R3 absent optionals omitted) ─────────────────

test('buildRecord: R2 folds a non-empty title into content BEFORE hashing', () => {
  const withTitle = buildRecord({ ...base, title: 'Union merge chosen' });
  const withoutTitle = buildRecord({ ...base, content: '**Union merge chosen**\n\nWe chose union merge.' });
  assert.equal(withTitle.content, '**Union merge chosen**\n\nWe chose union merge.');
  // Folding is deterministic — feeding the already-folded content directly yields the same id.
  assert.equal(withTitle.id, withoutTitle.id);
});

test('buildRecord: an empty title leaves content unchanged', () => {
  const rec = buildRecord({ ...base, title: '' });
  assert.equal(rec.content, base.content);
});

test('buildRecord: R3 absent issue/supersedes/source are OMITTED from the record, never null', () => {
  const rec = buildRecord({ ...base });
  assert.equal('issue' in rec, false);
  assert.equal('supersedes' in rec, false);
  assert.equal('source' in rec, false);
});

test('buildRecord: present optionals are carried through', () => {
  const rec = buildRecord({ ...base, issue: 205, source: 'issue #205' });
  assert.equal(rec.issue, 205);
  assert.equal(rec.source, 'issue #205');
});

// ── validateRecord (REQ-MF-1, REQ-MF-5 partial) ───────────────────────────────

test('validateRecord: accepts a well-formed record', () => {
  const rec = buildRecord({ ...base });
  const { valid, errors } = validateRecord(rec);
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test('validateRecord: rejects a missing required field', () => {
  const rec = buildRecord({ ...base });
  delete rec.project;
  const { valid, errors } = validateRecord(rec);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('project')));
});

test('validateRecord: rejects a non-enum type', () => {
  const rec = { ...buildRecord({ ...base }), type: 'manual' };
  const { valid, errors } = validateRecord(rec);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('type')));
});

test('validateRecord: rejects a naive (non-UTC) ts', () => {
  const rec = { ...buildRecord({ ...base }), ts: '2026-07-04 12:00:00' };
  const { valid, errors } = validateRecord(rec);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('ts')));
});

test('validateRecord: rejects an invalid actorKind', () => {
  const rec = { ...buildRecord({ ...base }), actorKind: 'robot' };
  const { valid, errors } = validateRecord(rec);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('actorKind')));
});

test('validateRecord: rejects a null optional field (R3)', () => {
  const rec = { ...buildRecord({ ...base }), issue: null };
  const { valid, errors } = validateRecord(rec);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('issue')));
});

test('validateRecord: flags an email-shaped actor (REQ-MF-5 partial heuristic)', () => {
  const rec = { ...buildRecord({ ...base }), actor: 'someone@example.com' };
  const { valid, errors } = validateRecord(rec);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('actor')));
});

test('RECORD_TYPES exports the seven-member enum', () => {
  assert.deepEqual(RECORD_TYPES, [
    'decision', 'architecture', 'pattern', 'bugfix', 'config', 'discovery', 'session_summary',
  ]);
});

// ── serializeRecord / parseRecordLine (one physical JSONL line) ──────────────

test('serializeRecord: multi-line content is escaped into one physical line', () => {
  const rec = buildRecord({ ...base, content: 'line one\nline two\nline three' });
  const line = serializeRecord(rec);
  assert.equal(/[\n\r]/.test(line), false);
  assert.equal(JSON.parse(line).content, 'line one\nline two\nline three');
});

test('parseRecordLine: round-trips a serialized record', () => {
  const rec = buildRecord({ ...base });
  const line = serializeRecord(rec);
  const parsed = parseRecordLine(line);
  assert.deepEqual(parsed, rec);
});

test('parseRecordLine: fails closed (throws) on invalid JSON', () => {
  assert.throws(() => parseRecordLine('{not valid json'));
});

test('parseRecordLine: fails closed (throws) on a schema violation', () => {
  assert.throws(() => parseRecordLine(JSON.stringify({ ...buildRecord({ ...base }), type: 'manual' })));
});

// ── buildIndexEntry / serializeIndex (REQ-MF-4, R1) ──────────────────────────

test('buildIndexEntry: carries id/ts/actor/type/project/file, omits absent optionals', () => {
  const rec = buildRecord({ ...base });
  const entry = buildIndexEntry(rec, '2026-07.jsonl');
  assert.equal(entry.id, rec.id);
  assert.equal(entry.file, '2026-07.jsonl');
  assert.equal('issue' in entry, false);
});

test('buildIndexEntry: carries issue/supersedes when present', () => {
  const rec = buildRecord({ ...base, issue: 205 });
  const entry = buildIndexEntry(rec, '2026-07.jsonl');
  assert.equal(entry.issue, 205);
});

test('serializeIndex: one entry per physical line, sorted by id', () => {
  const recA = buildRecord({ ...base, content: 'A' });
  const recB = buildRecord({ ...base, content: 'B' });
  const entries = new Map([
    [recB.id, buildIndexEntry(recB, 'f.jsonl')],
    [recA.id, buildIndexEntry(recA, 'f.jsonl')],
  ]);
  const serialized = serializeIndex(entries);
  const lines = serialized.split('\n').filter(Boolean);
  assert.equal(lines.length, 2);
  const ids = lines.map((l) => JSON.parse(l).id);
  assert.deepEqual(ids, [...ids].sort());
});

test('serializeIndex: empty map serializes to empty string', () => {
  assert.equal(serializeIndex(new Map()), '');
});
