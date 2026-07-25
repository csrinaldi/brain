// engram.save-search-unsupported.test.mjs — REQ-C3-5 / obs #578's "engram
// search stub: YES" ruling. Under MEMORY_BACKEND=engram, `memory save ...`
// and `memory search ...` must each reject with a message pointing to the
// native engram tool (mem_save / mem_search) — never-cryptic on the engram
// side of the Q1 asymmetry too, never a silent no-op, and nothing is
// written/read via this path.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// RED: save/search are not exported from engram.mjs yet.
import { save, search } from './engram.mjs';

test('engram.save: rejects with a message pointing to native mem_save', async () => {
  await assert.rejects(
    () => save(),
    (err) => {
      assert.ok(err.message.includes('mem_save'), `expected the refusal to name mem_save: ${err.message}`);
      return true;
    },
  );
});

test('engram.search: rejects with a message pointing to native mem_search', async () => {
  await assert.rejects(
    () => search(),
    (err) => {
      assert.ok(err.message.includes('mem_search'), `expected the refusal to name mem_search: ${err.message}`);
      return true;
    },
  );
});
