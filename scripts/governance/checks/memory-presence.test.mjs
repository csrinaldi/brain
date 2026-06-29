// memory-presence.test.mjs — Unit tests for memoryPresence check (REQ-S4-1)
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { memoryPresence } from './memory-presence.mjs';

test('memoryPresence: changedFiles includes .memory/chunks/ file → pass', () => {
  assert.deepEqual(
    memoryPresence(['.memory/chunks/foo.jsonl.gz', 'src/feature.mjs']),
    { pass: true },
  );
});

test('memoryPresence: no .memory/ file in changedFiles → fail with reason', () => {
  const r = memoryPresence(['src/feature.mjs', 'brain/HOME.md']);
  assert.equal(r.pass, false);
  assert.ok(typeof r.reason === 'string' && r.reason.length > 0, 'reason must be present');
});
