// engram.pull.test.mjs — unit tests for pullMemory() (issue #59).
//
// Acceptance criteria:
//
//   (a) dirty manifest → restore called, then pull, then import, in order.
//   (b) clean manifest → no restore, pull + import (in order).
//   (c) failing git pull → error is propagated and import is NOT called.
//
// All seams are injected so no real git/engram subprocess is spawned.
// Assertions are on the call log and thrown errors.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// RED: this import will fail until pullMemory is exported from engram.mjs.
import { pullMemory } from './engram.mjs';

// ---------------------------------------------------------------------------
// (a) dirty manifest → restore called before pull, then import; order matters
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
// (b) clean manifest → NO restore; pull then import
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
// (c) failing git pull → error propagated, import NOT called
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
