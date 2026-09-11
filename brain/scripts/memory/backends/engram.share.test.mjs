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

test('#469 scrubMaterializedChunks: a directory of clean chunks resolves (REQ-469-1, E2)', async () => {
  await withChunkDir(async (root) => {
    writeFileSync(join(root, '.memory', 'chunks', 'clean.jsonl.gz'), gzipSync('{"text":"fine"}\n'));
    await assert.doesNotReject(() =>
      scrubMaterializedChunks(root, { _loadConfig: () => ({}), _scrubChunk: scrubChunkFile }),
    );
  });
});

// ── #874 split B (row —): share() is the plainfiles.share() mirror (R11, D6) ──
//
// The exporter is gone: `share()` no longer runs `engram sync --export`, no
// longer needs `_requireEngram()`, and no longer reads observations or writes
// records. `_ensureSymlink` is the ONE seam kept from the pre-#874 shape (R12).

test('share(): calls only _ensureSymlink then _rebuildIndex — no export, no engram binary required (R11/R12)', async () => {
  const called = [];
  const result = await share({
    root: '/fake/root',
    _ensureSymlink: (root) => called.push(['ensureSymlink', root]),
    _rebuildIndex: (opts) => { called.push(['rebuildIndex', opts]); return { count: 3 }; },
  });

  assert.deepEqual(called.map((c) => c[0]), ['ensureSymlink', 'rebuildIndex'], 'ensureSymlink must run before rebuildIndex');
  assert.equal(called[0][1], '/fake/root');
  assert.equal(called[1][1].recordsDir, '/fake/root/.memory/records');
  assert.equal(called[1][1].indexPath, '/fake/root/.memory/index.jsonl');
  assert.deepEqual(result, { indexCount: 3, duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] } });
});

test('share(): a FRESH WORKTREE (.memory/ present, .engram absent) self-heals the binding via the REAL ensureMemorySymlink', async () => {
  await withChunkDir(async (root) => {
    assert.ok(!existsSync(join(root, '.engram')), 'precondition: a fresh worktree has no .engram');

    await assert.doesNotReject(() => share({ root, _rebuildIndex: () => ({ count: 0 }) }));

    const stat = lstatSync(join(root, '.engram'));
    assert.ok(stat.isSymbolicLink(), 'share() must leave .engram a symlink, never a real directory');
    assert.equal(readlinkSync(join(root, '.engram')), '.memory');
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

test('share() is exported as a callable function', () => {
  assert.equal(typeof share, 'function', 'share must be exported from engram.mjs');
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
      // `null`, not `'origin/main'`: nothing resolved on this root, so there is
      // no ref to report. It USED to be the string, and every consumer that
      // printed it named a base that had answered nothing (cold review round 3).
      ref: null,
      stated: false,
      // No "— writing every candidate this run (pre-#701 behaviour)" tail: the
      // cli wrapper for this exact field says the same thing in the same printed
      // line, and the pre-commit gate — the other consumer — writes nothing at
      // all, so the clause was false there.
      reason: 'no upstream ref resolved (tried origin/HEAD, origin/main)',
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
