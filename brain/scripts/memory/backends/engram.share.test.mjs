// engram.share.test.mjs — unit tests for the secret-scrub wiring in share()
// (issue #214, C1b). All seams are injected so no real engram binary, git
// subprocess, or gzip file is required for the orchestration tests. The
// full-config-resolution tests confirm the real default/config path via
// resolveSecretConfig, which is itself pure-unit-tested in secret-scrub.test.mjs.
//
// RED: scrubMaterializedChunks import fails until engram.mjs wires it in.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { share, scrubMaterializedChunks, _defaultChangedChunkFiles } from './engram.mjs';
import { DEFAULT_SECRET_PATTERNS } from '../lib/secret-scrub.mjs';

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

test('share(): calls requireEngram → export → scrub, in order, and resolves on a clean run', async () => {
  const callLog = [];
  await share({
    root: '/fake/root',
    _requireEngram: () => { callLog.push('requireEngram'); return 'engram'; },
    _export: () => { callLog.push('export'); },
    _changedChunkFiles: () => { callLog.push('changedChunkFiles'); return []; },
    _loadConfig: () => ({}),
    _scrubChunk: () => null,
  });
  assert.deepEqual(callLog, ['requireEngram', 'export', 'changedChunkFiles']);
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
