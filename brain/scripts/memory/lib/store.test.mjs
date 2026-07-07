// store.test.mjs — unit tests for the thin I/O layer over .memory/records/ +
// .memory/index.json (REQ-MF-3, REQ-MF-4, and the degenerate-state contract).
//
// RED: these imports fail until store.mjs is created (task C1a.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildRecord } from './format.mjs';
import { appendRecord, rebuildIndex } from './store.mjs';

function tmpMemoryDir() {
  const root = mkdtempSync(join(tmpdir(), 'brain-memory-store-'));
  return { root, recordsDir: join(root, 'records'), indexPath: join(root, 'index.json') };
}

const base = {
  ts: '2026-07-04T12:00:00Z',
  actor: '@crinaldi',
  actorKind: 'human',
  type: 'decision',
  project: 'brain',
};

// ── appendRecord ──────────────────────────────────────────────────────────────

test('appendRecord: writes exactly one physical JSONL line to the month file', () => {
  const { recordsDir } = tmpMemoryDir();
  const rec = buildRecord({ ...base, content: 'first record' });
  const { file, filename } = appendRecord(rec, { recordsDir });
  assert.equal(filename, '2026-07.jsonl');
  const raw = readFileSync(file, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), rec);
});

test('appendRecord: a second append to the same month appends a second line (append-only)', () => {
  const { recordsDir } = tmpMemoryDir();
  const recA = buildRecord({ ...base, content: 'A' });
  const recB = buildRecord({ ...base, content: 'B' });
  const { file } = appendRecord(recA, { recordsDir });
  appendRecord(recB, { recordsDir });
  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 2);
});

test('appendRecord: rejects an invalid record (fails closed, does not write)', () => {
  const { recordsDir } = tmpMemoryDir();
  const bad = { ...buildRecord({ ...base, content: 'x' }), type: 'manual' };
  assert.throws(() => appendRecord(bad, { recordsDir }));
  assert.equal(existsSync(recordsDir), false);
});

// ── rebuildIndex — degenerate states (2b) ────────────────────────────────────

test('rebuildIndex: absent records/ → empty index, no throw (exit-0 contract)', () => {
  const { recordsDir, indexPath } = tmpMemoryDir();
  const { count } = rebuildIndex({ recordsDir, indexPath });
  assert.equal(count, 0);
  assert.equal(readFileSync(indexPath, 'utf8'), '');
});

test('rebuildIndex: empty records/ (no .jsonl files) → empty index', () => {
  const { recordsDir, indexPath } = tmpMemoryDir();
  mkdirSync(recordsDir, { recursive: true });
  const { count } = rebuildIndex({ recordsDir, indexPath });
  assert.equal(count, 0);
});

test('rebuildIndex: does not touch a legacy .memory/chunks/*.jsonl.gz sibling', () => {
  const { root, recordsDir, indexPath } = tmpMemoryDir();
  const chunksDir = join(root, 'chunks');
  mkdirSync(chunksDir, { recursive: true });
  const chunkFile = join(chunksDir, 'legacy.jsonl.gz');
  writeFileSync(chunkFile, 'not touched');
  rebuildIndex({ recordsDir, indexPath });
  assert.equal(readFileSync(chunkFile, 'utf8'), 'not touched');
});

test('rebuildIndex: a corrupt line fails closed with file + line number in the error', () => {
  const { recordsDir, indexPath } = tmpMemoryDir();
  mkdirSync(recordsDir, { recursive: true });
  writeFileSync(join(recordsDir, '2026-07.jsonl'), '{"valid":"json but not a record"}\n{not valid json\n');
  assert.throws(() => rebuildIndex({ recordsDir, indexPath }), /2026-07\.jsonl:1/);
});

test('rebuildIndex: an invalid (schema-violating) record fails closed with file + line number', () => {
  const { recordsDir, indexPath } = tmpMemoryDir();
  mkdirSync(recordsDir, { recursive: true });
  const bad = { ...buildRecord({ ...base, content: 'x' }), type: 'manual' };
  writeFileSync(join(recordsDir, '2026-07.jsonl'), JSON.stringify(bad) + '\n');
  assert.throws(() => rebuildIndex({ recordsDir, indexPath }), /2026-07\.jsonl:1/);
});

// ── rebuildIndex — normal + property behavior (REQ-MF-4, R1) ─────────────────

test('rebuildIndex: indexes appended records, one entry per id, sorted', () => {
  const { recordsDir, indexPath } = tmpMemoryDir();
  const recA = buildRecord({ ...base, content: 'A' });
  const recB = buildRecord({ ...base, content: 'B' });
  appendRecord(recA, { recordsDir });
  appendRecord(recB, { recordsDir });
  const { count } = rebuildIndex({ recordsDir, indexPath });
  assert.equal(count, 2);
  const lines = readFileSync(indexPath, 'utf8').split('\n').filter(Boolean);
  const ids = lines.map((l) => JSON.parse(l).id);
  assert.deepEqual(ids, [...ids].sort());
});

test('rebuildIndex: a duplicate physical line (same id) collapses to one index entry', () => {
  const { recordsDir, indexPath } = tmpMemoryDir();
  const rec = buildRecord({ ...base, content: 'same' });
  appendRecord(rec, { recordsDir });
  appendRecord(rec, { recordsDir }); // union-merge duplicate simulation
  const { count } = rebuildIndex({ recordsDir, indexPath });
  assert.equal(count, 1);
});

test('rebuildIndex: property — delete index, reindex, byte-identical to the original', () => {
  const { recordsDir, indexPath } = tmpMemoryDir();
  appendRecord(buildRecord({ ...base, content: 'A' }), { recordsDir });
  appendRecord(buildRecord({ ...base, content: 'B' }), { recordsDir });
  appendRecord(buildRecord({ ...base, ts: '2026-06-01T00:00:00Z', content: 'C' }), { recordsDir });
  rebuildIndex({ recordsDir, indexPath });
  const before = readFileSync(indexPath, 'utf8');
  rmSync(indexPath);
  rebuildIndex({ recordsDir, indexPath });
  const after = readFileSync(indexPath, 'utf8');
  assert.equal(after, before);
});
