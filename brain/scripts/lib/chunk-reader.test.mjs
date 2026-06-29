// chunk-reader.test.mjs — best-effort reading of engram .memory/chunks/ (#96).
//
// The reader must NEVER throw: a missing directory, a non-gzip file, gzip that
// isn't JSON, or JSON without an observations array must all degrade to "skip".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { readChunkObservations } from './chunk-reader.mjs';

function makeRepo() {
  return mkdtempSync(join(tmpdir(), 'chunk-reader-'));
}

function writeChunk(repo, name, buffer) {
  const dir = join(repo, '.memory', 'chunks');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), buffer);
}

const gzObservations = (observations) =>
  gzipSync(Buffer.from(JSON.stringify({ sessions: null, observations }), 'utf8'));

test('readChunkObservations: absent .memory/chunks/ → [] (no crash)', () => {
  const repo = makeRepo();
  try {
    assert.deepEqual(readChunkObservations(repo), []);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('readChunkObservations: a valid chunk → its observations', () => {
  const repo = makeRepo();
  try {
    writeChunk(repo, 'a.jsonl.gz', gzObservations([
      { type: 'session_summary', title: 'Session summary: brain' },
      { type: 'architecture', title: 'x' },
    ]));
    const obs = readChunkObservations(repo);
    assert.equal(obs.length, 2);
    assert.ok(obs.some((o) => o.type === 'session_summary'));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('readChunkObservations: corrupt (non-gzip) chunk is skipped, valid ones survive', () => {
  const repo = makeRepo();
  try {
    writeChunk(repo, 'bad.jsonl.gz', Buffer.from('not gzip at all', 'utf8'));
    writeChunk(repo, 'good.jsonl.gz', gzObservations([{ type: 'session_summary' }]));
    const obs = readChunkObservations(repo);
    assert.equal(obs.length, 1);
    assert.equal(obs[0].type, 'session_summary');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('readChunkObservations: gzip that is not JSON → skipped', () => {
  const repo = makeRepo();
  try {
    writeChunk(repo, 'x.jsonl.gz', gzipSync(Buffer.from('this is not json', 'utf8')));
    assert.deepEqual(readChunkObservations(repo), []);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('readChunkObservations: JSON without observations array → []', () => {
  const repo = makeRepo();
  try {
    writeChunk(repo, 'x.jsonl.gz', gzipSync(Buffer.from(JSON.stringify({ sessions: null }), 'utf8')));
    assert.deepEqual(readChunkObservations(repo), []);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('readChunkObservations: ignores non-chunk files', () => {
  const repo = makeRepo();
  try {
    writeChunk(repo, 'manifest.json', Buffer.from('{}', 'utf8'));
    writeChunk(repo, 'real.jsonl.gz', gzObservations([{ type: 'session_summary' }]));
    const obs = readChunkObservations(repo);
    assert.equal(obs.length, 1);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
