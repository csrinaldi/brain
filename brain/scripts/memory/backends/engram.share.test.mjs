// engram.share.test.mjs — unit tests for the secret-scrub wiring in share()
// (issue #214, C1b). All seams are injected so no real engram binary, git
// subprocess, or gzip file is required for the orchestration tests. The
// full-config-resolution tests confirm the real default/config path via
// resolveSecretConfig, which is itself pure-unit-tested in secret-scrub.test.mjs.
//
// RED: scrubMaterializedChunks import fails until engram.mjs wires it in.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { share, scrubMaterializedChunks, dualWriteRecords, _defaultChangedChunkFiles } from './engram.mjs';
import { DEFAULT_SECRET_PATTERNS } from '../lib/secret-scrub.mjs';
import { buildRecord } from '../lib/format.mjs';

// ---------------------------------------------------------------------------
// scrubMaterializedChunks — the testable core, independent of requireEngram()
// ---------------------------------------------------------------------------

test('scrubMaterializedChunks: no changed chunks → resolves without throwing', async () => {
  await assert.doesNotReject(() =>
    scrubMaterializedChunks('/fake/root', {
      _changedChunkFiles: () => [],
      _loadConfig: () => ({}),
      _scrubChunk: () => {
        throw new Error('_scrubChunk must not be called when there are no changed chunks');
      },
    }),
  );
});

test('scrubMaterializedChunks: a clean changed chunk → resolves without throwing', async () => {
  await assert.doesNotReject(() =>
    scrubMaterializedChunks('/fake/root', {
      _changedChunkFiles: () => ['/fake/root/.memory/chunks/abc123.jsonl.gz'],
      _loadConfig: () => ({}),
      _scrubChunk: () => null,
    }),
  );
});

test('scrubMaterializedChunks: a secret hit fails closed and names the pattern + file:line', async () => {
  await assert.rejects(
    () =>
      scrubMaterializedChunks('/fake/root', {
        _changedChunkFiles: () => ['/fake/root/.memory/chunks/leaked.jsonl.gz'],
        _loadConfig: () => ({}),
        _scrubChunk: () => ({ pattern: 'ghp_[A-Za-z0-9]{20,}', lineNumber: 7, line: 'ghp_xxx' }),
      }),
    (err) => {
      assert.ok(err.message.includes('leaked.jsonl.gz'), `expected file in message, got: ${err.message}`);
      assert.ok(err.message.includes('7'), `expected line number in message, got: ${err.message}`);
      assert.ok(err.message.includes('ghp_'), `expected pattern in message, got: ${err.message}`);
      return true;
    },
  );
});

test('_defaultChangedChunkFiles: git failure fails CLOSED (refuses to share), never returns [] silently', () => {
  assert.throws(
    () =>
      _defaultChangedChunkFiles('/fake/root', {
        _spawn: () => ({ status: 128, stdout: '', stderr: 'fatal: dubious ownership' }),
      }),
    (err) => {
      assert.ok(/fail closed/i.test(err.message), `expected fail-closed message, got: ${err.message}`);
      assert.ok(err.message.includes('dubious ownership'), `expected git stderr surfaced, got: ${err.message}`);
      return true;
    },
  );
});

test('_defaultChangedChunkFiles: a clean git run (status 0, no changes) returns [] — no scan, no permablock', () => {
  const out = _defaultChangedChunkFiles('/fake/root', { _spawn: () => ({ status: 0, stdout: '', stderr: '' }) });
  assert.deepEqual(out, []);
});

test('scrubMaterializedChunks: default patterns are used when config has no governance keys', async () => {
  let seenPatternSources;
  await scrubMaterializedChunks('/fake/root', {
    _changedChunkFiles: () => ['/fake/root/.memory/chunks/x.jsonl.gz'],
    _loadConfig: () => ({}),
    _scrubChunk: (path, patterns) => {
      seenPatternSources = patterns.map((p) => p.source);
      return null;
    },
  });
  for (const d of DEFAULT_SECRET_PATTERNS) {
    assert.ok(seenPatternSources.includes(d), `expected default pattern to reach _scrubChunk: ${d}`);
  }
});

test('scrubMaterializedChunks: a consumer allowlist entry reaches _scrubChunk and can suppress a hit', async () => {
  let seenAllowSources;
  await scrubMaterializedChunks('/fake/root', {
    _changedChunkFiles: () => ['/fake/root/.memory/chunks/x.jsonl.gz'],
    _loadConfig: () => ({ governance: { memorySecretAllowPatterns: ['glpat-TUTORIAL-EXAMPLE'] } }),
    _scrubChunk: (path, patterns, allowPatterns) => {
      seenAllowSources = allowPatterns.map((p) => p.source);
      return null; // simulate the allowlist having suppressed the match
    },
  });
  assert.deepEqual(seenAllowSources, ['glpat-TUTORIAL-EXAMPLE']);
});

test('scrubMaterializedChunks: scans every changed chunk, not just the first', async () => {
  const scanned = [];
  await scrubMaterializedChunks('/fake/root', {
    _changedChunkFiles: () => ['/fake/root/.memory/chunks/a.jsonl.gz', '/fake/root/.memory/chunks/b.jsonl.gz'],
    _loadConfig: () => ({}),
    _scrubChunk: (path) => {
      scanned.push(path);
      return null;
    },
  });
  assert.deepEqual(scanned, ['/fake/root/.memory/chunks/a.jsonl.gz', '/fake/root/.memory/chunks/b.jsonl.gz']);
});

// ---------------------------------------------------------------------------
// share() — full orchestration with every seam injected (no real engram/git)
// ---------------------------------------------------------------------------

test('share() is exported as a callable function', () => {
  assert.equal(typeof share, 'function', 'share must be exported from engram.mjs');
});

test('share(): calls requireEngram → export → dual-write(records) → scrub(chunks), in order, and resolves on a clean run', async () => {
  const callLog = [];
  await share({
    root: '/fake/root',
    _requireEngram: () => { callLog.push('requireEngram'); return 'engram'; },
    _export: () => { callLog.push('export'); },
    _readObservations: () => { callLog.push('readObservations'); return []; },
    _changedChunkFiles: () => { callLog.push('changedChunkFiles'); return []; },
    _loadConfig: () => ({}),
    _scrubChunk: () => null,
  });
  assert.deepEqual(callLog, ['requireEngram', 'export', 'readObservations', 'changedChunkFiles']);
});

test('share(): a secret hit in a materialized chunk fails closed (non-zero — the caller sees a thrown error)', async () => {
  await assert.rejects(
    () =>
      share({
        root: '/fake/root',
        _requireEngram: () => 'engram',
        _export: () => {},
        _changedChunkFiles: () => ['/fake/root/.memory/chunks/leaked.jsonl.gz'],
        _loadConfig: () => ({}),
        _scrubChunk: () => ({ pattern: 'AKIA[0-9A-Z]{16}', lineNumber: 2, line: 'AKIAABCDEFGHIJKLMNOP' }),
      }),
    (err) => {
      assert.ok(err.message.includes('leaked.jsonl.gz'));
      return true;
    },
  );
});

test('share(): there is no --no-scrub style bypass parameter — the allowlist is the only valve', async () => {
  // Structural guard: share()'s options object has no "skipScrub"/"noScrub" seam.
  // Passing one must be silently ignored (not a recognized option), proving the
  // ONLY way to suppress a hit is the config-level allowlist path exercised above.
  await assert.rejects(
    () =>
      share({
        root: '/fake/root',
        _requireEngram: () => 'engram',
        _export: () => {},
        _changedChunkFiles: () => ['/fake/root/.memory/chunks/leaked.jsonl.gz'],
        _loadConfig: () => ({}),
        _scrubChunk: () => ({ pattern: 'ghp_[A-Za-z0-9]{20,}', lineNumber: 1, line: 'ghp_x' }),
        noScrub: true,
        skipScrub: true,
      }),
    /leaked\.jsonl\.gz/,
  );
});

// ---------------------------------------------------------------------------
// dualWriteRecords() — scan-then-write over the RECORDS log (issue #221,
// C2b-1, design.md Decision 1 + REQ-C2B1-3). Independent of requireEngram()/
// the real export, mirroring how scrubMaterializedChunks is unit-tested
// separately from share()'s full orchestration.
// ---------------------------------------------------------------------------

const baseRecordFields = {
  ts: '2026-07-04T12:00:00Z', actor: '@crinaldi', actorKind: 'human', type: 'decision', project: 'brain',
};

test('dualWriteRecords: no observations → resolves without appending or reindexing', async () => {
  let appendCalled = false;
  let reindexCalled = false;
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => [],
    _exportObservation: () => { throw new Error('must not be called when there are no observations'); },
    _appendRecord: () => { appendCalled = true; },
    _rebuildIndex: () => { reindexCalled = true; return { count: 0 }; },
    _loadConfig: () => ({}),
  });
  assert.equal(appendCalled, false);
  assert.equal(reindexCalled, false);
  assert.equal(result.written, 0);
});

test('dualWriteRecords: a clean run appends every candidate record and reindexes', async () => {
  const recA = buildRecord({ ...baseRecordFields, content: 'A' });
  const recB = buildRecord({ ...baseRecordFields, content: 'B' });
  const appended = [];
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => [{ id: 1 }, { id: 2 }],
    _exportObservation: (obs) => ({ record: obs.id === 1 ? recA : recB, recovered: false }),
    _appendRecord: (record) => { appended.push(record); },
    _rebuildIndex: () => ({ count: 2 }),
    _loadConfig: () => ({}),
  });
  assert.deepEqual(appended, [recA, recB]);
  assert.equal(result.written, 2);
  assert.equal(result.indexCount, 2);
});

test('dualWriteRecords: skipped/rejected observations are excluded from candidates, never appended', async () => {
  const recA = buildRecord({ ...baseRecordFields, content: 'A' });
  const appended = [];
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => [{ id: 1 }, { id: 2 }, { id: 3 }],
    _exportObservation: (obs) => {
      if (obs.id === 1) return { record: recA, recovered: false };
      if (obs.id === 2) return { skipped: 'scope:personal' };
      return { rejected: { id: '3', title: '', type: 'manual', reason: 'non-enum type' } };
    },
    _appendRecord: (record) => { appended.push(record); },
    _rebuildIndex: () => ({ count: 1 }),
    _loadConfig: () => ({}),
  });
  assert.deepEqual(appended, [recA]);
  assert.equal(result.written, 1);
});

test('dualWriteRecords: a throwing exportObservation on one observation does not abort the others', async () => {
  const recB = buildRecord({ ...baseRecordFields, content: 'B' });
  const appended = [];
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => [{ id: 1 }, { id: 2 }],
    _exportObservation: (obs) => {
      if (obs.id === 1) throw new Error('malformed observation');
      return { record: recB, recovered: false };
    },
    _appendRecord: (record) => { appended.push(record); },
    _rebuildIndex: () => ({ count: 1 }),
    _loadConfig: () => ({}),
  });
  assert.deepEqual(appended, [recB]);
  assert.equal(result.written, 1);
});

test('dualWriteRecords: a secret in a candidate record line aborts BEFORE any append — records/ stays untouched (victim-file style)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-dual-write-'));
  try {
    const recordsDir = join(dir, '.memory', 'records');
    const leaked = buildRecord({ ...baseRecordFields, content: 'token: ghp_abcdefghijklmnopqrstuvwxyz01' });

    await assert.rejects(
      () =>
        dualWriteRecords(dir, {
          _readObservations: () => [{ id: 1 }],
          _exportObservation: () => ({ record: leaked, recovered: false }),
          _appendRecord: () => { throw new Error('appendRecord must NEVER be called on a secret hit'); },
          _rebuildIndex: () => { throw new Error('rebuildIndex must NEVER be called on a secret hit'); },
          _loadConfig: () => ({}),
        }),
      (err) => {
        assert.ok(/ghp_/.test(err.message), `expected the secret pattern in the error, got: ${err.message}`);
        return true;
      },
    );
    // The append-only records log must never have been created at all.
    assert.equal(existsSync(recordsDir), false, 'records/ must be untouched on a secret hit');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dualWriteRecords: a clean run against the REAL appendRecord/rebuildIndex writes records/ and index.jsonl', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-dual-write-clean-'));
  try {
    const { appendRecord, rebuildIndex } = await import('../lib/store.mjs');
    const recA = buildRecord({ ...baseRecordFields, content: 'A clean candidate.' });
    const result = await dualWriteRecords(dir, {
      _readObservations: () => [{ id: 1 }],
      _exportObservation: () => ({ record: recA, recovered: false }),
      _appendRecord: appendRecord,
      _rebuildIndex: rebuildIndex,
      _loadConfig: () => ({}),
    });
    assert.equal(result.written, 1);
    assert.equal(existsSync(join(dir, '.memory', 'records', '2026-07.jsonl')), true);
    assert.equal(existsSync(join(dir, '.memory', 'index.jsonl')), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('share(): the chunk backstop (C1b) still runs after a clean dual-write', async () => {
  const callLog = [];
  await share({
    root: '/fake/root',
    _requireEngram: () => 'engram',
    _export: () => {},
    _readObservations: () => [],
    _changedChunkFiles: () => { callLog.push('scrubbedChunks'); return []; },
    _loadConfig: () => ({}),
    _scrubChunk: () => null,
  });
  assert.deepEqual(callLog, ['scrubbedChunks']);
});

test('share(): a secret in a candidate RECORD aborts the whole share BEFORE the chunk backstop even runs', async () => {
  const leaked = buildRecord({ ...baseRecordFields, content: 'token: AKIAABCDEFGHIJKLMNOP' });
  let chunkScrubRan = false;
  await assert.rejects(
    () =>
      share({
        root: '/fake/root',
        _requireEngram: () => 'engram',
        _export: () => {},
        _readObservations: () => [{ id: 1 }],
        _exportObservation: () => ({ record: leaked, recovered: false }),
        _appendRecord: () => { throw new Error('must not append on a secret hit'); },
        _rebuildIndex: () => { throw new Error('must not reindex on a secret hit'); },
        _changedChunkFiles: () => { chunkScrubRan = true; return []; },
        _loadConfig: () => ({}),
        _scrubChunk: () => null,
      }),
    /AKIA/,
  );
  assert.equal(chunkScrubRan, false, 'the chunk backstop must not run once the records dual-write already aborted');
});
