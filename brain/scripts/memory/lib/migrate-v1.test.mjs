// migrate-v1.test.mjs — unit tests for the memory:migrate-v1 dry-run report
// (issue #217, C2a scope: dry-run + histograms only; the persisting real run
// is C2b — see design.md).
//
// RED: these imports fail until migrate-v1.mjs is created.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { collectChunkObservations, buildMigrationReport } from './migrate-v1.mjs';

const baseObs = (overrides = {}) => ({
  id: 1,
  sync_id: 'obs-aaaa1111',
  session_id: 's1',
  type: 'discovery',
  title: 'A title',
  content: 'No provenance prose here.',
  project: 'brain',
  scope: 'project',
  topic_key: 'sdd/x/y',
  revision_count: 1,
  duplicate_count: 0,
  last_seen_at: '2026-07-02 11:45:38',
  created_at: '2026-07-01 01:19:12',
  updated_at: '2026-07-02 11:45:38',
  ...overrides,
});

// ── collectChunkObservations ─────────────────────────────────────────────────

function tmpChunksDir() {
  const root = mkdtempSync(join(tmpdir(), 'brain-migrate-v1-'));
  const chunksDir = join(root, 'chunks');
  mkdirSync(chunksDir, { recursive: true });
  return chunksDir;
}

test('collectChunkObservations: absent chunksDir → empty observations, no throw', () => {
  const { observations, unparseable } = collectChunkObservations(join(tmpdir(), 'does-not-exist-xyz'));
  assert.deepEqual(observations, []);
  assert.deepEqual(unparseable, []);
});

test('collectChunkObservations: decompresses a real gzip chunk and flattens observations[]', () => {
  const chunksDir = tmpChunksDir();
  const payload = { sessions: [], observations: [baseObs(), baseObs({ id: 2, sync_id: 'obs-bbbb2222' })], prompts: [] };
  writeFileSync(join(chunksDir, 'chunk1.jsonl.gz'), gzipSync(Buffer.from(JSON.stringify(payload))));
  const { observations, unparseable } = collectChunkObservations(chunksDir);
  assert.equal(observations.length, 2);
  assert.deepEqual(unparseable, []);
});

test('collectChunkObservations: a corrupt/non-gzip chunk is recorded as unparseable, not thrown', () => {
  const chunksDir = tmpChunksDir();
  writeFileSync(join(chunksDir, 'bad.jsonl.gz'), 'not actually gzip');
  const { observations, unparseable } = collectChunkObservations(chunksDir);
  assert.deepEqual(observations, []);
  assert.deepEqual(unparseable, ['bad.jsonl.gz']);
});

test('collectChunkObservations: a valid-JSON chunk with no observations array is emptyObservations, not unparseable (MAJOR-2)', () => {
  // A chunk that parses fine as JSON but lacks an `observations` array is NOT
  // corruption — it is a legitimate sessions/prompts-only chunk shape.
  const chunksDir = tmpChunksDir();
  writeFileSync(join(chunksDir, 'noobs.jsonl.gz'), gzipSync(Buffer.from(JSON.stringify({ sessions: [] }))));
  const { unparseable, emptyObservations } = collectChunkObservations(chunksDir);
  assert.deepEqual(unparseable, []);
  assert.deepEqual(emptyObservations, ['noobs.jsonl.gz']);
});

// ── MAJOR-2: legit `observations: null` chunks are NOT corruption ───────────
// Verified against real data: 4 real chunks are valid gzip+JSON with
// `sessions` populated and `observations: null` — legitimate sessions/prompts
// -only chunks, not gunzip/JSON-parse failures. These must land in a
// dedicated `emptyObservations` bucket, never conflated with `unparseable`.

test('collectChunkObservations: a valid gzip+JSON chunk with observations:null (sessions populated) lands in emptyObservations, not unparseable', () => {
  const chunksDir = tmpChunksDir();
  const payload = { sessions: [{ id: 's1' }], observations: null, prompts: [] };
  writeFileSync(join(chunksDir, 'sessions-only.jsonl.gz'), gzipSync(Buffer.from(JSON.stringify(payload))));
  const { observations, unparseable, emptyObservations } = collectChunkObservations(chunksDir);
  assert.deepEqual(observations, []);
  assert.deepEqual(unparseable, [], 'a legit sessions-only chunk must never be flagged unparseable');
  assert.deepEqual(emptyObservations, ['sessions-only.jsonl.gz']);
});

test('collectChunkObservations: genuinely corrupt gzip bytes still land in unparseable, never emptyObservations', () => {
  const chunksDir = tmpChunksDir();
  writeFileSync(join(chunksDir, 'corrupt.jsonl.gz'), 'not actually gzip');
  const { unparseable, emptyObservations } = collectChunkObservations(chunksDir);
  assert.deepEqual(unparseable, ['corrupt.jsonl.gz']);
  assert.deepEqual(emptyObservations, []);
});

test('collectChunkObservations: observations:undefined or a non-array also lands in emptyObservations, not unparseable', () => {
  const chunksDir = tmpChunksDir();
  writeFileSync(join(chunksDir, 'undefobs.jsonl.gz'), gzipSync(Buffer.from(JSON.stringify({ sessions: [] }))));
  writeFileSync(join(chunksDir, 'stringobs.jsonl.gz'), gzipSync(Buffer.from(JSON.stringify({ sessions: [], observations: 'nope' }))));
  const { unparseable, emptyObservations } = collectChunkObservations(chunksDir);
  assert.deepEqual(unparseable, []);
  assert.deepEqual(emptyObservations, ['stringobs.jsonl.gz', 'undefobs.jsonl.gz']);
});

// ── buildMigrationReport ──────────────────────────────────────────────────

test('buildMigrationReport: empty input → all-zero report', () => {
  const report = buildMigrationReport([]);
  assert.equal(report.recordCount, 0);
  assert.equal(report.skippedPersonal, 0);
  assert.deepEqual(report.rejected, []);
  assert.deepEqual(report.typesHistogram, {});
  assert.deepEqual(report.provenanceHistogram, { recovered: 0, fallback: 0 });
});

test('buildMigrationReport: current-store shape — 0 recovered / N fallback (proves recovery ran)', () => {
  const observations = [baseObs(), baseObs({ id: 2, sync_id: 'obs-2', type: 'architecture' })];
  const report = buildMigrationReport(observations);
  assert.equal(report.recordCount, 2);
  assert.equal(report.provenanceHistogram.recovered, 0);
  assert.equal(report.provenanceHistogram.fallback, 2);
});

test('buildMigrationReport: recovers §4 provenance when present, counted separately', () => {
  const observations = [
    baseObs({ content: '**Actor:** @crinaldi (humano)\n\nRecovered body.' }),
    baseObs({ id: 2, sync_id: 'obs-2' }),
  ];
  const report = buildMigrationReport(observations);
  assert.equal(report.provenanceHistogram.recovered, 1);
  assert.equal(report.provenanceHistogram.fallback, 1);
});

test('buildMigrationReport: types histogram counts only successfully exported records', () => {
  const observations = [
    baseObs({ type: 'architecture' }),
    baseObs({ id: 2, sync_id: 'obs-2', type: 'architecture' }),
    baseObs({ id: 3, sync_id: 'obs-3', type: 'bugfix' }),
  ];
  const report = buildMigrationReport(observations);
  assert.deepEqual(report.typesHistogram, { architecture: 2, bugfix: 1 });
});

test('buildMigrationReport: scope:personal is counted as skipped, not rejected, not a record', () => {
  const observations = [baseObs({ scope: 'personal' }), baseObs({ id: 2, sync_id: 'obs-2' })];
  const report = buildMigrationReport(observations);
  assert.equal(report.skippedPersonal, 1);
  assert.equal(report.recordCount, 1);
});

test('buildMigrationReport: rejection report carries id/title/type/reason for each rejected observation', () => {
  const observations = [baseObs({ type: 'manual' }), baseObs({ id: 2, sync_id: 'obs-2' })];
  const report = buildMigrationReport(observations);
  assert.equal(report.rejected.length, 1);
  assert.equal(report.rejected[0].id, 'obs-aaaa1111');
  assert.equal(report.rejected[0].type, 'manual');
  assert.equal(report.rejected[0].title, 'A title');
  assert.match(report.rejected[0].reason, /non-enum/);
});

// ── MAJOR-3: loss accounting counts FILES, not observations ─────────────────
// (depends on MAJOR-2's emptyObservations/unparseable split landing first).

test('buildMigrationReport: with no chunk stats passed, unparseableChunks/emptyObservationsChunks default empty and no caveat note is claimed', () => {
  const report = buildMigrationReport([baseObs()]);
  assert.deepEqual(report.unparseableChunks, []);
  assert.deepEqual(report.emptyObservationsChunks, []);
  assert.equal(report.unparseableNote, undefined);
});

test('buildMigrationReport: accounting is complete and explicit for a mix of good / emptyObservations / genuinely-corrupt chunks (MAJOR-3)', () => {
  const chunksDir = tmpChunksDir();
  const goodPayload = { sessions: [], observations: [baseObs(), baseObs({ id: 2, sync_id: 'obs-2' })], prompts: [] };
  writeFileSync(join(chunksDir, 'good.jsonl.gz'), gzipSync(Buffer.from(JSON.stringify(goodPayload))));
  writeFileSync(
    join(chunksDir, 'sessions-only.jsonl.gz'),
    gzipSync(Buffer.from(JSON.stringify({ sessions: [{ id: 's1' }], observations: null, prompts: [] }))),
  );
  writeFileSync(join(chunksDir, 'corrupt.jsonl.gz'), 'not actually gzip');

  const { observations, unparseable, emptyObservations } = collectChunkObservations(chunksDir);
  const report = buildMigrationReport(observations, { unparseable, emptyObservations });

  // (1) correctly bucket each
  assert.equal(report.recordCount, 2);
  assert.deepEqual(report.emptyObservationsChunks, ['sessions-only.jsonl.gz']);
  assert.deepEqual(report.unparseableChunks, ['corrupt.jsonl.gz']);

  // (2) explicitly state the unknown-count caveat for unparseable chunks
  assert.ok(report.unparseableNote, 'unparseableNote must be present when any chunk is unparseable');
  assert.ok(report.unparseableNote.includes('1 chunk'));
  assert.ok(report.unparseableNote.includes('observation count unknown'));

  // (3) never claim a false total that silently absorbs the unparseable
  // chunk's observations as zero — the accounted-for total (records +
  // skipped + rejected) must equal exactly the observations we COULD parse
  // (2), with the unparseable chunk's unknown count called out separately,
  // never folded into that total as an implicit zero.
  assert.equal(report.recordCount + report.skippedPersonal + report.rejected.length, 2);
});

// ── MINOR-4: one malformed created_at must not abort the whole report ──────
// toUtcSeconds() throws on a bad timestamp; buildMigrationReport() must catch
// it per-observation so the rest of the batch still processes normally.

test('buildMigrationReport: one observation with a malformed created_at is rejected alone; the rest of the batch still processes (MINOR-4)', () => {
  const observations = [
    baseObs(),
    baseObs({ id: 2, sync_id: 'obs-2', created_at: 'not-a-real-timestamp' }),
    baseObs({ id: 3, sync_id: 'obs-3', type: 'architecture' }),
  ];
  const report = buildMigrationReport(observations);
  assert.equal(report.recordCount, 2, 'the two good observations must still be exported');
  assert.equal(report.rejected.length, 1);
  assert.equal(report.rejected[0].id, 'obs-2');
  assert.ok(report.rejected[0].reason, 'the malformed-timestamp rejection must carry a reason string');
  assert.match(report.rejected[0].reason, /not-a-real-timestamp/);
});
