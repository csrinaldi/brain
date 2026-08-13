// plainfiles.share.test.mjs — unit tests for backends/plainfiles.mjs#share
// (C3, issue #246, REQ-C3-4). share() is a self-check rebuildIndex() ONLY —
// no data movement, since records already ARE the store.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// RED: share is not exported from plainfiles.mjs yet.
import { share } from './plainfiles.mjs';

test('share: calls rebuildIndex() only — no export, no data movement, no git call', async () => {
  const calls = [];
  const result = await share(
    { root: '/fake/root' },
    {
      _rebuildIndex: (opts) => { calls.push(['rebuildIndex', opts]); return { count: 3 }; },
    },
  );

  assert.deepEqual(calls.map((c) => c[0]), ['rebuildIndex']);
  assert.equal(calls[0][1].recordsDir, '/fake/root/.memory/records');
  assert.equal(calls[0][1].indexPath, '/fake/root/.memory/index.jsonl');
  assert.deepEqual(result, { indexCount: 3, duplicates: { ids: 0, lines: 0, groups: [] } });
});

// ── #574 — the self-check has to SAY what it collapsed ───────────────────────

test('share: carries the duplicate accounting out to the caller — a silent self-check is not one', async () => {
  const duplicates = { ids: 2, lines: 5, groups: [{ id: 'rec-a', occurrences: ['2026-07.jsonl:1', '2026-07.jsonl:9'] }] };
  const result = await share(
    { root: '/fake/root' },
    { _rebuildIndex: () => ({ count: 2038, duplicates }) },
  );

  assert.equal(result.indexCount, 2038);
  assert.deepEqual(result.duplicates, duplicates, 'cli.mjs prints this — it must survive the backend boundary');
});
