// engram.share.test.mjs — unit tests for the secret-scrub wiring in share()
// (issue #214, C1b). All seams are injected so no real engram binary, git
// subprocess, or gzip file is required for the orchestration tests. The
// full-config-resolution tests confirm the real default/config path via
// resolveSecretConfig, which is itself pure-unit-tested in secret-scrub.test.mjs.
//
// RED: scrubMaterializedChunks import fails until engram.mjs wires it in.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, mkdirSync, readdirSync, symlinkSync, writeFileSync, readFileSync, lstatSync, readlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { gzipSync } from 'node:zlib';

import {
  share,
  scrubMaterializedChunks,
  dualWriteRecords,
  assertExportDestinationIsRead,
  _defaultChangedChunkFiles,
  _defaultReadObservations,
  _defaultShareExport,
} from './engram.mjs';
import { DEFAULT_SECRET_PATTERNS, scrubChunkFile } from '../lib/secret-scrub.mjs';
import { buildRecord } from '../lib/format.mjs';

// #677 — records live one per file (`<yyyy-mm>-<id>.jsonl`), so "how many
// physical lines did this share append" is a question about the STORE, not
// about a month file. Counting across `records/` keeps these assertions
// measuring what they always meant instead of what the old layout happened to
// make convenient.
function physicalRecordLines(dir) {
  const recordsDir = join(dir, '.memory', 'records');
  if (!existsSync(recordsDir)) return [];
  return readdirSync(recordsDir)
    .filter((f) => f.endsWith('.jsonl'))
    .sort()
    .flatMap((f) => readFileSync(join(recordsDir, f), 'utf8').split('\n').filter(Boolean));
}


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

// ── issue #469: the detector reads the FILESYSTEM, not git ──────────────────
//
// These four cases replace the `_spawn`-shaped ones. They were not wrong about
// git; they were about the wrong question. `.memory/chunks/` is GITIGNORED
// (`.gitignore:84`) and `git status --porcelain` never reports ignored paths, so
// the set was ALWAYS empty and the scrub had never scanned a chunk — while every
// one of those tests passed. That is the reason this file now drives the outcome
// (which files come back) rather than the plumbing (what git printed): a suite
// that pins the plumbing of a query that cannot return anything is green for a
// gate that does nothing.
//
// `--ignored` is not the fix, measured (design D1): three of four git spellings
// report `!! .memory/chunks/` — the DIRECTORY — which the old suffix-only filter
// dropped, leaving the scan at zero. Hence the isFile() case below.

/**
 * Temp root shaped like a checked-out tree: `.memory/chunks/` present, `.engram`
 * absent — which is also exactly what a fresh git worktree looks like.
 *
 * Cleanup follows the callback's COMPLETION, not its return (issue #657). An
 * async callback returns a pending promise at its first `await`, so the plain
 * `try/finally` this replaces deleted the directory right there — every
 * filesystem assertion after an await ran against a path that no longer existed,
 * and a test could only pass by not looking. Sync callbacks keep their original
 * behaviour: cleanup still runs before the helper returns, so sync callers need
 * no `await` and none was added.
 */
const withChunkDir = (fn) => {
  const root = mkdtempSync(join(tmpdir(), 'brain-469-'));
  const cleanup = () => rmSync(root, { recursive: true, force: true });
  let result;
  try {
    mkdirSync(join(root, '.memory', 'chunks'), { recursive: true });
    result = fn(root);
  } catch (err) {
    cleanup();
    throw err;
  }
  if (result && typeof result.then === 'function') {
    return result.then(
      (value) => { cleanup(); return value; },
      (err) => { cleanup(); throw err; },
    );
  }
  cleanup();
  return result;
};

test('#469 _defaultChangedChunkFiles: returns the chunks that EXIST on disk, whatever git thinks (REQ-469-1)', () => {
  withChunkDir((root) => {
    const dir = join(root, '.memory', 'chunks');
    writeFileSync(join(dir, 'a.jsonl.gz'), gzipSync('{}\n'));
    writeFileSync(join(dir, 'b.jsonl.gz'), gzipSync('{}\n'));
    // The whole point: these files are gitignored, so the previous implementation
    // returned [] here. Sorted because readdir order is not guaranteed and the
    // claim is about the SET, not the order.
    assert.deepStrictEqual(_defaultChangedChunkFiles(root).sort(), [
      join(dir, 'a.jsonl.gz'),
      join(dir, 'b.jsonl.gz'),
    ]);
  });
});

test('#469 _defaultChangedChunkFiles: an unreadable chunk directory fails CLOSED (REQ-469-2, E3)', () => {
  // ENOENT is deliberately fatal, not empty. share() reaches the scrub only AFTER
  // `engram sync --export` ran, so a missing chunk directory at that point means
  // the export wrote where this process does not read — REQ-469-3's failure,
  // caught a second way.
  const missing = join(mkdtempSync(join(tmpdir(), 'brain-469-')), 'nope');
  assert.throws(
    () => _defaultChangedChunkFiles(missing),
    (err) => {
      assert.ok(/fail closed/i.test(err.message), `expected fail-closed message, got: ${err.message}`);
      assert.ok(err.message.includes('ENOENT'), `expected the error CODE surfaced, got: ${err.message}`);
      assert.ok(
        err.message.includes(join(missing, '.memory', 'chunks')),
        `expected the directory named, got: ${err.message}`,
      );
      return true;
    },
  );
  // And any other read error too — EACCES is the one an operator actually hits.
  assert.throws(
    () =>
      _defaultChangedChunkFiles('/fake/root', {
        _listDir: () => {
          const e = new Error('permission denied');
          e.code = 'EACCES';
          throw e;
        },
      }),
    (err) => /fail closed/i.test(err.message) && err.message.includes('EACCES'),
  );
});

test('#469 _defaultChangedChunkFiles: an EMPTY chunk directory returns [] — a fresh clone is not a failure (REQ-469-2, E4)', () => {
  // This is the distinction the git version could not draw, and the reason it
  // failed open: it could not tell "nothing to scan" from "cannot look", so it
  // reported the second as the first on every single run.
  withChunkDir((root) => {
    assert.deepStrictEqual(_defaultChangedChunkFiles(root), []);
  });
});

test('#469 _defaultChangedChunkFiles: drops non-chunk files AND directories — on type, not on name (REQ-469-1, E5)', () => {
  withChunkDir((root) => {
    const dir = join(root, '.memory', 'chunks');
    writeFileSync(join(dir, 'a.jsonl.gz'), gzipSync('{}\n'));
    writeFileSync(join(dir, 'notes.txt'), 'not a chunk');
    // A DIRECTORY whose name ends in .jsonl.gz. Not contrived: three of the four
    // git spellings in design D1 returned a directory path, and a suffix-only
    // filter cannot see the difference. scrubChunkFile would readFileSync it →
    // EISDIR, on the one path that must never fail on its own input.
    mkdirSync(join(dir, 'legacy.jsonl.gz'));
    assert.deepStrictEqual(_defaultChangedChunkFiles(root), [join(dir, 'a.jsonl.gz')]);
  });
});

test('#469 the SCANNED set contains the READ set — a symlinked chunk is scanned, not bypassed (round-1 BLOCKER)', () => {
  // The invariant is not that the scanner and _defaultReadObservations agree; it
  // is that nothing reaches records/ unscanned. The first draft used
  // Dirent.isFile() to drop directories and thereby dropped SYMLINKS too, while
  // the reader's readFileSync follows them — so a symlinked chunk carrying a
  // secret went into the append-only log, in a public repository, unscanned.
  //
  // Asserted as the SUPERSET property over a directory holding every awkward
  // shape at once, rather than one case per test: the defect was a shape nobody
  // enumerated, so the fixture is what has to be exhaustive.
  withChunkDir((root) => {
    const dir = join(root, '.memory', 'chunks');
    const outside = join(root, 'elsewhere');
    mkdirSync(outside);

    writeFileSync(join(dir, 'plain.jsonl.gz'), gzipSync('{"observations":[]}\n'));
    writeFileSync(join(outside, 'target.jsonl.gz'), gzipSync('{"observations":[]}\n'));
    symlinkSync(join(outside, 'target.jsonl.gz'), join(dir, 'linked.jsonl.gz'));
    mkdirSync(join(dir, 'adir.jsonl.gz'));                       // a DIRECTORY (E5)
    symlinkSync(outside, join(dir, 'linkdir.jsonl.gz'));         // a symlink to a DIRECTORY
    writeFileSync(join(dir, 'notes.txt'), 'not a chunk');

    const scanned = _defaultChangedChunkFiles(root).map((p) => p.split('/').pop()).sort();
    assert.deepStrictEqual(scanned, ['linked.jsonl.gz', 'plain.jsonl.gz'],
      'a symlink to a chunk is a chunk the reader will follow, so it must be scanned; ' +
      'a directory is not, whether reached directly or through a link');

    // The superset property, stated over the reader's own enumeration rule
    // (suffix match, readFileSync) rather than over a hand-written list — a
    // hand-written list is how the symlink shape got missed in the first place.
    const readable = readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl.gz'))
      .filter((f) => {
        try {
          readFileSync(join(dir, f));
          return true;
        } catch {
          return false; // EISDIR — the reader buckets these as unparseable
        }
      })
      .sort();
    for (const f of readable) {
      assert.ok(scanned.includes(f), `${f} is readable by _defaultReadObservations but was NOT scanned`);
    }
  });
});

test('#469 _defaultChangedChunkFiles: an entry that cannot be stat\'d fails CLOSED (round-1 BLOCKER)', () => {
  // Same rule as the directory read: "cannot look" must never be reported as
  // "nothing to scan". A broken symlink is the reachable case.
  assert.throws(
    () =>
      _defaultChangedChunkFiles('/fake/root', {
        _listDir: () => [{ name: 'ghost.jsonl.gz' }],
        _stat: () => {
          const e = new Error('no such file');
          e.code = 'ENOENT';
          throw e;
        },
      }),
    (err) => /fail closed/i.test(err.message) && err.message.includes('ghost.jsonl.gz'),
  );
});

test('#469 scrubMaterializedChunks: a planted secret ABORTS before records/ is touched (REQ-469-1, E1)', async () => {
  // The acceptance case, end to end over the REAL scrubChunkFile and a REAL gzip
  // chunk on a REAL directory — no seam between the plant and the abort. The
  // ticket is explicit that a passing test proves nothing here, because the old
  // code passed everything while scanning zero chunks. What this asserts is the
  // abort itself.
  await withChunkDir(async (root) => {
    const dir = join(root, '.memory', 'chunks');
    writeFileSync(join(dir, 'clean.jsonl.gz'), gzipSync('{"text":"nothing here"}\n'));
    writeFileSync(
      join(dir, 'leaked.jsonl.gz'),
      gzipSync('{"text":"token ghp_0123456789abcdefghijklmnopqrstuvwxyz"}\n'),
    );
    await assert.rejects(
      () => scrubMaterializedChunks(root, { _loadConfig: () => ({}), _scrubChunk: scrubChunkFile }),
      (err) => {
        assert.ok(err.message.includes('leaked.jsonl.gz'), `expected the chunk named, got: ${err.message}`);
        return true;
      },
    );
  });
});

test('#469 share: a planted secret aborts BEFORE records/ is appended (REQ-469-1, E1 — the ticket acceptance)', async () => {
  // E1 claims two things and the case above only measured one. This measures the
  // other: not merely that the scrub throws, but that the append-only records log
  // was never touched. That ordering is the whole reason scrubMaterializedChunks
  // runs before dualWriteRecords (issue #221 fix pass), and nothing was driving it
  // through a REAL chunk on disk — only through injected file lists, which cannot
  // fail the way the gitignored directory failed.
  await withChunkDir(async (root) => {
    writeFileSync(
      join(root, '.memory', 'chunks', 'leaked.jsonl.gz'),
      gzipSync('{"text":"token ghp_0123456789abcdefghijklmnopqrstuvwxyz"}\n'),
    );
    const appended = [];
    await assert.rejects(
      () =>
        share({
          root,
          _requireEngram: () => 'engram',
          _ensureSymlink: () => {},
          _export: () => {},
          _loadConfig: () => ({}),
          _scrubChunk: scrubChunkFile,
          _readObservations: () => ({ observations: [{ text: 'x' }] }),
          _appendRecord: (...args) => appended.push(args),
          _rebuildIndex: () => ({}),
        }),
      (err) => err.message.includes('leaked.jsonl.gz'),
    );
    assert.deepStrictEqual(appended, [], 'the append-only records log must never be written on an aborted share');
  });
});

test('#469 scrubMaterializedChunks: a directory of clean chunks resolves (REQ-469-1, E2)', async () => {
  await withChunkDir(async (root) => {
    writeFileSync(join(root, '.memory', 'chunks', 'clean.jsonl.gz'), gzipSync('{"text":"fine"}\n'));
    await assert.doesNotReject(() =>
      scrubMaterializedChunks(root, { _loadConfig: () => ({}), _scrubChunk: scrubChunkFile }),
    );
  });
});

// ── issue #657: the export must be anchored to `root`, and the .engram → .memory
//    binding must hold in a WORKTREE, where `setup()` never ran ────────────────
//
// The binding is local and gitignored (.gitignore:68), so a worktree created
// after `memory:setup` has `.memory/` checked out and NO `.engram`. Since
// AGENTS.md:212 makes worktree-per-task mandatory, that is the ordinary case.
// These tests pin the two halves of the fix: ensure-before-export, and an export
// anchored to `root` rather than to whatever cwd git handed the hook.

test('#657 _defaultShareExport: anchors the export to `root` via an explicit cwd (never the ambient cwd)', () => {
  const calls = [];
  _defaultShareExport('engram', '/main/repo', { _exec: (...args) => calls.push(args) });

  assert.equal(calls.length, 1, 'the export must run exactly once');
  const [bin, argv, opts] = calls[0];
  assert.equal(bin, 'engram');
  assert.deepStrictEqual(argv, ['sync', '--export']);
  assert.equal(
    opts.cwd,
    '/main/repo',
    'cwd must be the resolved root — inheriting the process cwd is the defect: git runs hooks ' +
      'with cwd set to the invoking worktree, which is how memory landed in the wrong tree',
  );
});

test('#657 share(): ensures the .engram → .memory binding BEFORE exporting, not after', async () => {
  // Ordering is the claim: ensuring the binding after the export would leave the
  // export itself writing into a real .engram/ — the failure being fixed.
  const called = [];
  await share({
    root: '/fake/root',
    _requireEngram: () => 'engram',
    _ensureSymlink: () => called.push('ensureSymlink'),
    _export: () => called.push('export'),
    _readObservations: () => ({ observations: [] }),
    _changedChunkFiles: () => [],
    _loadConfig: () => ({}),
    _scrubChunk: () => null,
    _rebuildIndex: () => ({ count: 0 }),
  });

  assert.deepStrictEqual(called, ['ensureSymlink', 'export']);
});

test('#657 share(): passes the resolved root to the export seam, so the export can anchor to it', async () => {
  const exportArgs = [];
  await share({
    root: '/main/repo',
    _requireEngram: () => 'engram',
    _ensureSymlink: () => {},
    _export: (...args) => exportArgs.push(args),
    _readObservations: () => ({ observations: [] }),
    _changedChunkFiles: () => [],
    _loadConfig: () => ({}),
    _scrubChunk: () => null,
    _rebuildIndex: () => ({ count: 0 }),
  });

  assert.deepStrictEqual(exportArgs, [['engram', '/main/repo']]);
});

test('#657 share(): a FRESH WORKTREE (.memory/ present, .engram absent) self-heals the binding and the destination check passes', async () => {
  // The end-to-end scenario, with the REAL ensureMemorySymlink. Before the fix
  // this root reached `engram sync --export` with no binding at all, so engram
  // created a real .engram/ and every chunk it wrote was invisible to the readers.
  await withChunkDir(async (root) => {
    assert.ok(!existsSync(join(root, '.engram')), 'precondition: a fresh worktree has no .engram');

    await assert.doesNotReject(() =>
      share({
        root,
        _requireEngram: () => 'engram',
        // _ensureSymlink intentionally NOT injected — the real one is under test.
        _export: () => {},
        _readObservations: () => ({ observations: [] }),
        _changedChunkFiles: () => [],
        _loadConfig: () => ({}),
        _scrubChunk: () => null,
        _rebuildIndex: () => ({ count: 0 }),
      }),
    );

    const stat = lstatSync(join(root, '.engram'));
    assert.ok(stat.isSymbolicLink(), 'share() must leave .engram a symlink, never a real directory');
    assert.equal(readlinkSync(join(root, '.engram')), '.memory');
    // The binding is what makes the #469 destination check pass on this tree.
    assert.doesNotThrow(() => assertExportDestinationIsRead(root));
  });
});

// ── issue #469 REQ-469-3: the export must write where share() reads ──────────

test('#469 assertExportDestinationIsRead: a real .engram directory THROWS (E6)', () => {
  assert.throws(
    () =>
      assertExportDestinationIsRead('/fake/root', {
        _resolveDir: (p) => (p.endsWith('.engram') ? '/fake/root/.engram' : '/fake/root/.memory'),
      }),
    (err) => {
      assert.ok(err.message.includes('.engram'), `expected both paths named, got: ${err.message}`);
      assert.ok(err.message.includes('.memory'), `expected both paths named, got: ${err.message}`);
      assert.ok(
        /symlink|memory:setup/.test(err.message),
        `expected the remedy, got: ${err.message}`,
      );
      return true;
    },
  );
});

test('#469 assertExportDestinationIsRead: a RESOLVED match passes, an absent .engram passes (E7)', () => {
  // Compared on resolved paths, not on symlink type — a symlink, a bind mount or
  // anything else that lands both on one directory is the same fact.
  assert.doesNotThrow(() =>
    assertExportDestinationIsRead('/fake/root', { _resolveDir: () => '/fake/root/.memory' }),
  );
  // Absent .engram: engram writes to .memory directly, the post-migration state.
  assert.doesNotThrow(() =>
    assertExportDestinationIsRead('/fake/root', {
      _resolveDir: (p) => (p.endsWith('.engram') ? null : '/fake/root/.memory'),
    }),
  );
});

test('#469 share: the destination check runs BEFORE the scrub, and stops the run (REQ-469-3, E6)', async () => {
  // Ordering is the claim. If the check ran after the scrub, the run would report
  // a clean scrub it performed on an unrelated directory — which is the failure.
  const called = [];
  await assert.rejects(
    () =>
      share({
        root: '/fake/root',
        _requireEngram: () => 'engram',
        _ensureSymlink: () => {},
        _export: () => called.push('export'),
        _resolveDir: (p) => (p.endsWith('.engram') ? '/elsewhere' : '/fake/root/.memory'),
        _changedChunkFiles: () => {
          called.push('scrub');
          return [];
        },
        _readObservations: () => {
          called.push('records');
          return { observations: [] };
        },
        _loadConfig: () => ({}),
      }),
    (err) => /engram sync --export/.test(err.message),
  );
  assert.deepStrictEqual(called, ['export'], 'neither the scrub nor the record write may run');
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

test('share(): records write is UNCONDITIONAL — runs even with NO memory.dualWrite key present (gate retired by deletion, D3/C4, issue #229)', async () => {
  const callLog = [];
  await share({
    root: '/fake/root',
    _requireEngram: () => { callLog.push('requireEngram'); return 'engram'; },
    _ensureSymlink: () => { callLog.push('ensureSymlink'); },
    _export: () => { callLog.push('export'); },
    _readObservations: () => { callLog.push('readObservations'); return { observations: [] }; },
    _changedChunkFiles: () => { callLog.push('changedChunkFiles'); return []; },
    _loadConfig: () => ({}), // no memory key at all — must NOT gate the write
    _scrubChunk: () => null,
    // #574: `share` ends with a self-check reindex on the zero-observation
    // path. Stubbed because this test is about ORDER, and the unstubbed seam
    // would run the REAL rebuildIndex against the literal '/fake/root' —
    // silently creating it when the suite runs as root, and failing with
    // EACCES when it does not. That asymmetry is what turned three of these
    // into CI-only failures.
    _rebuildIndex: () => { callLog.push('rebuildIndex'); return { count: 0 }; },
  });
  // record-write runs unconditionally: order requireEngram → ensureSymlink → export → scrub(chunks) → write(records)
  assert.deepEqual(callLog, ['requireEngram', 'ensureSymlink', 'export', 'changedChunkFiles', 'readObservations', 'rebuildIndex']);
});

test('share(): records write is UNCONDITIONAL — a leftover memory.dualWrite value in config does not change the order or outcome (the key is retired; no runtime code reads it)', async () => {
  const callLog = [];
  await share({
    root: '/fake/root',
    _requireEngram: () => { callLog.push('requireEngram'); return 'engram'; },
    _ensureSymlink: () => { callLog.push('ensureSymlink'); },
    _export: () => { callLog.push('export'); },
    _readObservations: () => { callLog.push('readObservations'); return { observations: [] }; },
    _changedChunkFiles: () => { callLog.push('changedChunkFiles'); return []; },
    _loadConfig: () => ({ memory: { dualWrite: false } }), // leftover value, if any — irrelevant now
    _scrubChunk: () => null,
    _rebuildIndex: () => { callLog.push('rebuildIndex'); return { count: 0 }; },
  });
  assert.deepEqual(callLog, ['requireEngram', 'ensureSymlink', 'export', 'changedChunkFiles', 'readObservations', 'rebuildIndex']);
});

test('share(): a secret in a candidate record aborts before any records/ append (the scan-then-write guard holds unconditionally, independent of any config)', async () => {
  // The write is unconditional now (gate retired, D3/C4) — guarded here so a
  // future edit can't silently drop the records-log protection.
  await assert.rejects(
    () =>
      share({
        root: '/fake/root',
        _requireEngram: () => 'engram',
        _ensureSymlink: () => {},
        _export: () => {},
        _changedChunkFiles: () => [],
        _readObservations: () => ({ observations: [{ id: 1, sync_id: 'obs-1', type: 'decision', title: 'T', content: 'ghp_AAAAAAAAAAAAAAAAAAAA', project: 'brain', scope: 'project', created_at: '2026-07-01 01:19:12' }] }),
        _appendRecord: () => { throw new Error('appendRecord must NOT run when a candidate has a secret'); },
        _loadConfig: () => ({}),
        _scrubChunk: () => null,
      }),
    /ghp_|secret/i,
  );
});

test('share(): a secret hit in a materialized chunk fails closed (non-zero — the caller sees a thrown error)', async () => {
  await assert.rejects(
    () =>
      share({
        root: '/fake/root',
        _requireEngram: () => 'engram',
        _ensureSymlink: () => {},
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
        _ensureSymlink: () => {},
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

test('dualWriteRecords: no observations → resolves without appending or reindexing, all accounting fields present at zero', async () => {
  let appendCalled = false;
  let reindexCalled = false;
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [] }),
    _exportObservation: () => { throw new Error('must not be called when there are no observations'); },
    _appendRecord: () => { appendCalled = true; },
    _rebuildIndex: () => { reindexCalled = true; return { count: 0 }; },
    _loadConfig: () => ({}),
  });
  assert.equal(appendCalled, false);
  assert.equal(reindexCalled, false);
  assert.deepEqual(result, {
    written: 0,
    deduped: 0,
    // issue #701 — no candidates, so the upstream seam was never called
    // either (same early return); the sub-bucket still reports zero.
    dedupedUpstream: 0,
    errored: 0,
    rejected: 0,
    skippedPersonal: 0,
    unprovenanced: 0,
    unparseableChunks: 0,
    emptyObservationsChunks: 0,
    // #574: zero here means "no reindex ran, so nothing was measured" — the
    // accounting is present and honest rather than absent, and this run read
    // no observations at all, so it read no records either.
    duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] },
  });
});

test('dualWriteRecords: a clean run appends every candidate record and reindexes', async () => {
  const recA = buildRecord({ ...baseRecordFields, content: 'A' });
  const recB = buildRecord({ ...baseRecordFields, content: 'B' });
  const appended = [];
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [{ id: 1 }, { id: 2 }] }),
    _exportObservation: (obs) => ({ record: obs.id === 1 ? recA : recB, recovered: false }),
    _appendRecord: (record) => { appended.push(record); },
    _readRecordIds: () => new Set(),
    _rebuildIndex: () => ({ count: 2 }),
    _loadConfig: () => ({}),
  });
  assert.deepEqual(appended, [recA, recB]);
  assert.equal(result.written, 2);
  assert.equal(result.deduped, 0);
  assert.equal(result.indexCount, 2);
});

test('dualWriteRecords: skipped/rejected/errored observations are ALL accounted for — nothing silently dropped (issue #221 fix pass, MAJOR)', async () => {
  const recA = buildRecord({ ...baseRecordFields, content: 'A' });
  const appended = [];
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] }),
    _exportObservation: (obs) => {
      if (obs.id === 1) return { record: recA, recovered: false };
      if (obs.id === 2) throw new Error('malformed observation');
      if (obs.id === 3) return { skipped: 'scope:personal' };
      return { rejected: { id: '4', title: '', type: 'manual', reason: 'non-enum type' } };
    },
    _appendRecord: (record) => { appended.push(record); },
    _readRecordIds: () => new Set(),
    _rebuildIndex: () => ({ count: 1 }),
    _loadConfig: () => ({}),
  });
  assert.deepEqual(appended, [recA]);
  assert.deepEqual(result, {
    written: 1,
    deduped: 0,
    dedupedUpstream: 0,
    errored: 1,
    rejected: 1,
    skippedPersonal: 1,
    // #541 — the surviving candidate carried no §4 block, which is what the whole
    // store looks like: 2070 of 2163 records materialised that way.
    unprovenanced: 1,
    unparseableChunks: 0,
    emptyObservationsChunks: 0,
    indexCount: 1,
    // #574 — an `_rebuildIndex` stub that predates the accounting reports zero,
    // never a fabricated number (normalizeDuplicates).
    duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] },
    // issue #701 — this test's `root` ('/fake/root') is not a git repo, so the
    // DEFAULT `_upstreamRecordIds` seam (not stubbed here) genuinely fails to
    // resolve any ref — the accidental-pass case design.md names explicitly.
    // `dualWriteRecords.test.mjs`'s deliberate test covers the injected case.
    upstreamScope: {
      applied: false,
      ref: 'origin/main',
      stated: false,
      reason: 'no upstream ref resolved (tried origin/HEAD, origin/main) — writing every candidate this run (pre-#701 behaviour)',
      // `null`, not absent: `brain.config.json` was ABSENT here, which is a
      // clean "no stated ref", not a failed read. The field is only a string
      // when the config existed and could not be read (cold review round 2).
      configError: null,
      entries: 0,
      unnamed: 0,
    },
  });
});

test('dualWriteRecords: skipped/rejected observations are excluded from candidates, never appended', async () => {
  const recA = buildRecord({ ...baseRecordFields, content: 'A' });
  const appended = [];
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [{ id: 1 }, { id: 2 }, { id: 3 }] }),
    _exportObservation: (obs) => {
      if (obs.id === 1) return { record: recA, recovered: false };
      if (obs.id === 2) return { skipped: 'scope:personal' };
      return { rejected: { id: '3', title: '', type: 'manual', reason: 'non-enum type' } };
    },
    _appendRecord: (record) => { appended.push(record); },
    _readRecordIds: () => new Set(),
    _rebuildIndex: () => ({ count: 1 }),
    _loadConfig: () => ({}),
  });
  assert.deepEqual(appended, [recA]);
  assert.equal(result.written, 1);
  assert.equal(result.skippedPersonal, 1);
  assert.equal(result.rejected, 1);
});

test('dualWriteRecords: a throwing exportObservation on one observation does not abort the others', async () => {
  const recB = buildRecord({ ...baseRecordFields, content: 'B' });
  const appended = [];
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [{ id: 1 }, { id: 2 }] }),
    _exportObservation: (obs) => {
      if (obs.id === 1) throw new Error('malformed observation');
      return { record: recB, recovered: false };
    },
    _appendRecord: (record) => { appended.push(record); },
    _readRecordIds: () => new Set(),
    _rebuildIndex: () => ({ count: 1 }),
    _loadConfig: () => ({}),
  });
  assert.deepEqual(appended, [recB]);
  assert.equal(result.written, 1);
  assert.equal(result.errored, 1);
});

test('dualWriteRecords: unparseable/empty-observations chunk buckets are surfaced in the accounting, never silently dropped', async () => {
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [], unparseable: ['bad.jsonl.gz'], emptyObservations: ['empty.jsonl.gz'] }),
    _exportObservation: () => { throw new Error('must not be called'); },
    _appendRecord: () => { throw new Error('must not be called'); },
    _rebuildIndex: () => { throw new Error('must not be called'); },
    _loadConfig: () => ({}),
  });
  assert.deepEqual(result, {
    written: 0,
    deduped: 0,
    dedupedUpstream: 0,
    errored: 0,
    rejected: 0,
    skippedPersonal: 0,
    unprovenanced: 0,
    unparseableChunks: 1,
    emptyObservationsChunks: 1,
    duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] },
  });
});

test('dualWriteRecords: a secret in a candidate record line aborts BEFORE any append — records/ stays untouched (victim-file style)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-dual-write-'));
  try {
    const recordsDir = join(dir, '.memory', 'records');
    const leaked = buildRecord({ ...baseRecordFields, content: 'token: ghp_abcdefghijklmnopqrstuvwxyz01' });

    await assert.rejects(
      () =>
        dualWriteRecords(dir, {
          _readObservations: () => ({ observations: [{ id: 1 }] }),
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
    const { appendRecord, rebuildIndex, readRecordIds } = await import('../lib/store.mjs');
    const recA = buildRecord({ ...baseRecordFields, content: 'A clean candidate.' });
    const result = await dualWriteRecords(dir, {
      _readObservations: () => ({ observations: [{ id: 1 }] }),
      _exportObservation: () => ({ record: recA, recovered: false }),
      _appendRecord: appendRecord,
      _readRecordIds: readRecordIds,
      _rebuildIndex: rebuildIndex,
      _loadConfig: () => ({}),
    });
    assert.equal(result.written, 1);
    assert.equal(existsSync(join(dir, '.memory', 'records', `2026-07-${recA.id}.jsonl`)), true);
    assert.equal(existsSync(join(dir, '.memory', 'index.jsonl')), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// dualWriteRecords() — idempotency: dedup by content-addressed id (issue #221
// fix pass, BLOCKER). `records/` is append-only; the same candidate must
// never be appended twice, whether across separate share() runs or within
// one batch.
// ---------------------------------------------------------------------------

test('dualWriteRecords: id-dedup — a second identical share appends 0 new physical lines (idempotent)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-dual-write-idempotent-'));
  try {
    const { appendRecord, rebuildIndex, readRecordIds } = await import('../lib/store.mjs');
    const recA = buildRecord({ ...baseRecordFields, content: 'stable content' });
    const runOpts = {
      _readObservations: () => ({ observations: [{ id: 1 }] }),
      _exportObservation: () => ({ record: recA, recovered: false }),
      _appendRecord: appendRecord,
      _readRecordIds: readRecordIds,
      _rebuildIndex: rebuildIndex,
      _loadConfig: () => ({}),
    };

    const first = await dualWriteRecords(dir, runOpts);
    assert.equal(first.written, 1);
    assert.equal(first.deduped, 0);

    const second = await dualWriteRecords(dir, runOpts);
    assert.equal(second.written, 0);
    assert.equal(second.deduped, 1);

    const lines = physicalRecordLines(dir);
    assert.equal(lines.length, 1, 'the same observation must never produce a second physical line');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dualWriteRecords: id-dedup — a share with one already-recorded + one NEW observation appends exactly the new one', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-dual-write-partial-new-'));
  try {
    const { appendRecord, rebuildIndex, readRecordIds } = await import('../lib/store.mjs');
    const recA = buildRecord({ ...baseRecordFields, content: 'already recorded' });
    const recB = buildRecord({ ...baseRecordFields, content: 'brand new' });

    await dualWriteRecords(dir, {
      _readObservations: () => ({ observations: [{ id: 1 }] }),
      _exportObservation: () => ({ record: recA, recovered: false }),
      _appendRecord: appendRecord,
      _readRecordIds: readRecordIds,
      _rebuildIndex: rebuildIndex,
      _loadConfig: () => ({}),
    });

    const second = await dualWriteRecords(dir, {
      _readObservations: () => ({ observations: [{ id: 1 }, { id: 2 }] }),
      _exportObservation: (obs) => ({ record: obs.id === 1 ? recA : recB, recovered: false }),
      _appendRecord: appendRecord,
      _readRecordIds: readRecordIds,
      _rebuildIndex: rebuildIndex,
      _loadConfig: () => ({}),
    });
    assert.equal(second.written, 1);
    assert.equal(second.deduped, 1);

    const lines = physicalRecordLines(dir);
    assert.equal(lines.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dualWriteRecords: id-dedup — two identical observations in the SAME batch collapse to a single physical line', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-dual-write-within-batch-'));
  try {
    const { appendRecord, rebuildIndex, readRecordIds } = await import('../lib/store.mjs');
    const recA = buildRecord({ ...baseRecordFields, content: 'duplicate within batch' });
    const result = await dualWriteRecords(dir, {
      _readObservations: () => ({ observations: [{ id: 1 }, { id: 2 }] }),
      _exportObservation: () => ({ record: recA, recovered: false }), // both observations export to the SAME record
      _appendRecord: appendRecord,
      _readRecordIds: readRecordIds,
      _rebuildIndex: rebuildIndex,
      _loadConfig: () => ({}),
    });
    assert.equal(result.written, 1);
    assert.equal(result.deduped, 1);
    const lines = physicalRecordLines(dir);
    assert.equal(lines.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// _defaultReadObservations() — must surface unparseable/empty-observations
// chunk buckets, not just the flattened observations (issue #221 fix pass,
// MAJOR — mirrors migrate-v1.mjs's collectChunkObservations() contract).
// ---------------------------------------------------------------------------

test('_defaultReadObservations: surfaces unparseable + emptyObservations chunk buckets, never just the flattened list', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-read-observations-'));
  try {
    const chunksDir = join(dir, '.memory', 'chunks');
    mkdirSync(chunksDir, { recursive: true });
    writeFileSync(join(chunksDir, 'good.jsonl.gz'), gzipSync(JSON.stringify({ observations: [{ id: 1, type: 'decision' }] })));
    writeFileSync(join(chunksDir, 'empty.jsonl.gz'), gzipSync(JSON.stringify({ sessions: [{}], observations: null })));
    writeFileSync(join(chunksDir, 'corrupt.jsonl.gz'), Buffer.from('not gzip at all'));

    const result = _defaultReadObservations(dir);
    assert.deepEqual(result.observations, [{ id: 1, type: 'decision' }]);
    assert.deepEqual(result.unparseable, ['corrupt.jsonl.gz']);
    assert.deepEqual(result.emptyObservations, ['empty.jsonl.gz']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('share(): the chunk backstop (C1b) still runs when there are no observations to dual-write', async () => {
  const callLog = [];
  await share({
    root: '/fake/root',
    _requireEngram: () => 'engram',
    _export: () => {},
    _readObservations: () => ({ observations: [] }),
    _changedChunkFiles: () => { callLog.push('scrubbedChunks'); return []; },
    _loadConfig: () => ({}),
    _scrubChunk: () => null,
    _rebuildIndex: () => ({ count: 0 }), // #574 self-check — stubbed off the real filesystem (see the order test above)
  });
  assert.deepEqual(callLog, ['scrubbedChunks']);
});

test('share(): a secret in a candidate RECORD aborts the share AFTER the chunk backstop already ran (issue #221 fix pass, MINOR — reordered so a records-log gate failure never leaves an already-mutated append-only log)', async () => {
  const leaked = buildRecord({ ...baseRecordFields, content: 'token: AKIAABCDEFGHIJKLMNOP' });
  let chunkScrubRan = false;
  await assert.rejects(
    () =>
      share({
        root: '/fake/root',
        _requireEngram: () => 'engram',
        _export: () => {},
        _readObservations: () => ({ observations: [{ id: 1 }] }),
        _exportObservation: () => ({ record: leaked, recovered: false }),
        _appendRecord: () => { throw new Error('must not append on a secret hit'); },
        _rebuildIndex: () => { throw new Error('must not reindex on a secret hit'); },
        _changedChunkFiles: () => { chunkScrubRan = true; return []; },
        _loadConfig: () => ({}), // write is unconditional now (gate retired, D3/C4) — no config needed to exercise the candidate scan
        _scrubChunk: () => null,
      }),
    /AKIA/,
  );
  assert.equal(chunkScrubRan, true, 'the chunk backstop (unconditional, now first) must have already run before the records dual-write aborted');
});

// ═══════════════════════════════════════════════════════════════════════════
// #541 — the emitter's absence is COUNTED, not absorbed.
//
// `exportObservation` has always returned `recovered`, and the share loop has
// always discarded it. So an observation arriving with no §4 provenance block got
// the fallback — actor `@legacy`, `issue` never set — and the resulting record
// read exactly like a healthy one. Measured on the real store: 2070 of 2163.
//
// COUNTED, never rejected. Refusing would turn `share` against the 2070
// observations this repository already holds — the same trap #529's ruling refused
// for `memory-gate`, where tightening before the writer worked would have blocked
// every PR with no override.
// ═══════════════════════════════════════════════════════════════════════════

test('#541: an observation with NO provenance block is counted as unprovenanced, and still written', async () => {
  const bare = {
    // engram's naive timestamp shape ('YYYY-MM-DD HH:MM:SS'), the same one every
    // other fixture in this file uses — an ISO string with a Z throws in toUtcSeconds
    // and the observation lands in `errored`, not in the bucket under test.
    id: 1, sync_id: 'obs-bare', type: 'discovery', project: 'brain', scope: 'project',
    created_at: '2026-08-11 10:00:00', title: 'no block', content: 'just prose, no Actor line',
  };
  const appended = [];
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [bare] }),
    _appendRecord: (r) => { appended.push(r); return { file: 'f' }; },
    _rebuildIndex: () => ({ count: 1 }),
    _loadConfig: () => ({}),
  });

  assert.equal(result.unprovenanced, 1, 'the absence must reach the accounting, not stop at a discarded flag');
  assert.equal(result.written, 1, 'and the record is still written — counting is not refusing');
  assert.equal(appended[0].actor, '@legacy', 'the fallback is what makes it invisible without the count');
  assert.ok(!('issue' in appended[0]), 'and the field #368 measured 2157 times empty is simply absent');
});

test('#541: an observation WITH a provenance block is not counted', async () => {
  // The counterweight. Without it the counter could be a constant and the test above
  // would still pass — a number that is always 1 measures nothing.
  const withBlock = {
    id: 2, sync_id: 'obs-good', type: 'discovery', project: 'brain', scope: 'project',
    created_at: '2026-08-11 10:00:00', title: 'has a block',
    content: '**Actor:** @crinaldi (humano)\n**Fuente:** issue #541\n\nthe body',
  };
  const appended = [];
  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [withBlock] }),
    _appendRecord: (r) => { appended.push(r); return { file: 'f' }; },
    _rebuildIndex: () => ({ count: 1 }),
    _loadConfig: () => ({}),
  });

  assert.equal(result.unprovenanced, 0, 'a compliant observation must not inflate the count');
  assert.equal(appended[0].actor, '@crinaldi', 'and its real actor survives instead of @legacy');
  assert.equal(appended[0].issue, 541, 'and its issue is recovered — the adapter was never the defect');
});
