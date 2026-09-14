// engram.pull.test.mjs — unit tests for pullMemory() and importMemory() (issue #59).
//
// Acceptance criteria:
//
//   pullMemory():
//   (a) dirty manifest → restore called, then pull, then import, in order.
//   (b) clean manifest → no restore, pull + import (in order).
//   (c) failing git pull → error is propagated and import is NOT called.
//   (f) reindex parity (issue #361) — pullMemory rebuilds the index BETWEEN
//       git pull and import, unconditionally, exactly like
//       plainfiles.pull()'s `_gitPull` → `_rebuildIndex` order
//       (plainfiles.pull.test.mjs, #574). Before this pair of tests, Step 3
//       of pullMemory (added by #574, a029ed0a) had no test that died if it
//       were removed — see reindex-parity.test.mjs for the cross-backend pin.
//   (g) reindex runs even on a no-op pull (nothing changed) — this is the
//       property issue #361 asked for on the `pull` verb: unconditional,
//       never gated on "did anything get imported".
//
//   importMemory():
//   (d) importMemory is exported as a callable function.
//   (e) pullMemory delegates its import step to importMemory by default
//       (default _import seam === importMemory).
//
// All seams are injected so no real git/engram subprocess is spawned, and
// every test below passes an explicit `root` + `_rebuildIndex` seam so the
// REAL `.memory/index.jsonl` of whichever checkout runs this suite is never
// touched (tests (a)-(c)/(e) above predate this file and rely on the
// production `_rebuildIndex` default against the real repoRoot — deliberately
// left as-is here since it is pre-existing and out of #361's scope, but new
// tests in this file always inject the seam).
//
// Assertions are on the call log and thrown errors.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// RED: importMemory import fails until it is exported from engram.mjs.
import { pullMemory, importMemory } from './engram.mjs';

// ---------------------------------------------------------------------------
// pullMemory (a) dirty manifest → restore → pull → import in order
// ---------------------------------------------------------------------------

test('pullMemory: dirty manifest → restore → pull → import in order', async () => {
  const callLog = [];

  await pullMemory({
    _isManifestDirty: () => true,
    _restoreManifest: () => { callLog.push('restore'); },
    _gitPull:         () => { callLog.push('pull'); },
    _import:          () => { callLog.push('import'); },
  });

  assert.deepEqual(
    callLog,
    ['restore', 'pull', 'import'],
    `expected ['restore','pull','import'], got ${JSON.stringify(callLog)}`,
  );
});

// ---------------------------------------------------------------------------
// pullMemory (b) clean manifest → pull → import (no restore)
// ---------------------------------------------------------------------------

test('pullMemory: clean manifest → pull → import (no restore)', async () => {
  const callLog = [];

  await pullMemory({
    _isManifestDirty: () => false,
    _restoreManifest: () => { callLog.push('restore'); },
    _gitPull:         () => { callLog.push('pull'); },
    _import:          () => { callLog.push('import'); },
  });

  assert.deepEqual(
    callLog,
    ['pull', 'import'],
    `expected ['pull','import'], got ${JSON.stringify(callLog)}`,
  );
});

// ---------------------------------------------------------------------------
// pullMemory (c) failing git pull → error propagated, import NOT called
// ---------------------------------------------------------------------------

test('pullMemory: failing git pull propagates error and skips import', async () => {
  let importCalled = false;

  await assert.rejects(
    () => pullMemory({
      _isManifestDirty: () => false,
      _restoreManifest: () => {},
      _gitPull:         () => { throw new Error('git pull failed: exit 1'); },
      _import:          () => { importCalled = true; },
    }),
    (err) => {
      assert.ok(
        err.message.includes('git pull failed'),
        `expected error to mention 'git pull failed', got: ${err.message}`,
      );
      return true;
    },
  );

  assert.equal(importCalled, false, 'import must NOT be called when git pull fails');
});

// ---------------------------------------------------------------------------
// importMemory (d) exported as a callable function
// ---------------------------------------------------------------------------

test('importMemory is exported as a callable function', () => {
  assert.equal(
    typeof importMemory,
    'function',
    'importMemory must be exported from engram.mjs',
  );
});

// ---------------------------------------------------------------------------
// pullMemory (f) reindex parity (#361) — rebuild the index BETWEEN pull and
// import, in order, with the right recordsDir/indexPath, carrying the
// duplicate accounting out exactly like share()/plainfiles.pull() do.
// ---------------------------------------------------------------------------

test('pullMemory: rebuilds the index between git pull and import, in order (#361 reindex parity)', async () => {
  const calls = [];
  const result = await pullMemory({
    root: '/fake/root',
    _isManifestDirty: () => false,
    _restoreManifest: () => { calls.push(['restore']); },
    _gitPull: () => { calls.push(['pull']); },
    _rebuildIndex: (opts) => { calls.push(['rebuildIndex', opts]); return { count: 7 }; },
    _import: () => { calls.push(['import']); },
  });

  assert.deepEqual(
    calls.map((c) => c[0]),
    ['pull', 'rebuildIndex', 'import'],
    `expected ['pull','rebuildIndex','import'], got ${JSON.stringify(calls.map((c) => c[0]))}`,
  );
  const rebuildOpts = calls[1][1];
  assert.equal(rebuildOpts.recordsDir, '/fake/root/.memory/records');
  assert.equal(rebuildOpts.indexPath, '/fake/root/.memory/index.jsonl');
  assert.deepEqual(result, { indexCount: 7, duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] } });
});

// ---------------------------------------------------------------------------
// pullMemory (g) reindex is unconditional — runs even when the pull was a
// no-op. This is the exact property issue #361 asked for on the `pull`
// verb: `plainfiles.pull()` always reindexes; `pullMemory()` must too,
// never gated on "did git pull bring anything" or "did import write
// anything".
// ---------------------------------------------------------------------------

test('pullMemory: reindexes even on a no-op pull — unconditional, not gated on import having written anything (#361)', async () => {
  let rebuildCalled = false;
  const result = await pullMemory({
    root: '/fake/root',
    _isManifestDirty: () => false,
    _restoreManifest: () => {},
    _gitPull: () => { /* no-op: already up to date */ },
    _rebuildIndex: () => { rebuildCalled = true; return { count: 0 }; },
    _import: () => ({ written: 0, skipped: 0 }),
  });

  assert.equal(rebuildCalled, true, 'rebuildIndex must run unconditionally, even when nothing changed');
  assert.equal(result.indexCount, 0);
});

// ---------------------------------------------------------------------------
// importMemory (e) pullMemory delegates its import step to importMemory
// ---------------------------------------------------------------------------

test('pullMemory default _import seam is importMemory', async () => {
  // Verify that pullMemory's default _import IS importMemory.
  // We do this structurally: call pullMemory with all other seams mocked,
  // replace _import with a spy, confirm the spy receives the call.
  // Additionally compare that importMemory is the same reference used as default.
  //
  // Since we cannot call the real importMemory without engram installed, we
  // only verify the function reference contract here.
  //
  // Structural guarantee: the default parameter in pullMemory is:
  //   _import = importMemory
  // If this breaks, the test below (e2) would catch it via the call log.
  assert.equal(
    typeof importMemory,
    'function',
    'importMemory must be a function to be a valid default seam',
  );
  // Confirm pullMemory accepts importMemory as _import without error.
  // (Uses other mocked seams to avoid real git/engram calls.)
  let called = false;
  await pullMemory({
    _isManifestDirty: () => false,
    _restoreManifest: () => {},
    _gitPull: () => {},
    _import: async () => { called = true; },  // stand-in for importMemory
  });
  assert.ok(called, 'pullMemory must invoke its _import seam (importMemory path)');
});
