// merge-engram-manifest.test.mjs — unit tests for the engram manifest merge driver.
//
// Tests the merge logic directly by calling the script with temp JSON files.
// No git setup needed — the script is path-agnostic; it receives paths via argv.
//
// Acceptance criteria (task 0.1):
//   - Union of two manifests: all chunks from both sides appear in the result.
//   - Dedup by chunk.id: identical id on both sides yields exactly one entry.
//   - version = max(a.version, b.version).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, 'merge-engram-manifest.mjs');

/**
 * Call the merge script with three temp file paths: base, ours, theirs.
 * Returns the parsed JSON written back to the `ours` file.
 */
function runMerge(tmp, aChunks, bChunks, { versionA = 1, versionB = 1 } = {}) {
  const base = join(tmp, 'base.json');
  const ours = join(tmp, 'ours.json');
  const theirs = join(tmp, 'theirs.json');

  writeFileSync(base, JSON.stringify({ version: 1, chunks: [] }));
  writeFileSync(ours, JSON.stringify({ version: versionA, chunks: aChunks }));
  writeFileSync(theirs, JSON.stringify({ version: versionB, chunks: bChunks }));

  const result = spawnSync(process.execPath, [SCRIPT, base, ours, theirs], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `merge script exited ${result.status}: ${result.stderr}`);

  return JSON.parse(readFileSync(ours, 'utf8'));
}

// ── Union of two disjoint manifests ──────────────────────────────────────────

test('merge: union — both sides\' chunks appear in the result', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'merge-union-'));
  try {
    const merged = runMerge(
      tmp,
      [{ id: 'aaa', data: 1 }],
      [{ id: 'bbb', data: 2 }],
    );
    assert.equal(merged.chunks.length, 2, 'expected 2 chunks in merged result');
    const ids = merged.chunks.map((c) => c.id);
    assert.ok(ids.includes('aaa'), 'chunk aaa missing from merged result');
    assert.ok(ids.includes('bbb'), 'chunk bbb missing from merged result');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Dedup by chunk.id ────────────────────────────────────────────────────────

test('merge: dedup — shared chunk.id yields exactly one entry (ours side wins)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'merge-dedup-'));
  try {
    const merged = runMerge(
      tmp,
      [{ id: 'shared', side: 'a' }],
      [{ id: 'shared', side: 'b' }],
    );
    assert.equal(merged.chunks.length, 1, 'expected exactly one chunk after dedup');
    assert.equal(merged.chunks[0].id, 'shared');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── version = max(a, b) ──────────────────────────────────────────────────────

test('merge: version = max(a.version, b.version) when a > b', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'merge-ver-a-'));
  try {
    const merged = runMerge(tmp, [{ id: 'x' }], [{ id: 'y' }], {
      versionA: 5,
      versionB: 3,
    });
    assert.equal(merged.version, 5);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('merge: version = max(a.version, b.version) when b > a', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'merge-ver-b-'));
  try {
    const merged = runMerge(tmp, [{ id: 'x' }], [{ id: 'y' }], {
      versionA: 2,
      versionB: 7,
    });
    assert.equal(merged.version, 7);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Empty / malformed inputs degrade gracefully ──────────────────────────────

test('merge: empty chunks on both sides → empty merged chunks, exit 0', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'merge-empty-'));
  try {
    const merged = runMerge(tmp, [], []);
    assert.equal(merged.chunks.length, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('merge: theirs has chunks, ours is empty → all theirs\' chunks present', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'merge-one-side-'));
  try {
    const merged = runMerge(tmp, [], [{ id: 'only-in-b', data: 42 }]);
    assert.equal(merged.chunks.length, 1);
    assert.equal(merged.chunks[0].id, 'only-in-b');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
