// plainfiles.hydrate.test.mjs — the bulk `hydrate` verb on plainfiles (#1115, REQ-1115-1/1b, REQ-MB-7/9).
// plainfiles' records ARE the backend, so hydrating is rebuilding the derived index; its read-only
// `verify` form (ruling Q1) only reports whether that index is current.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTempTree } from '../../../__fixtures__/tmp-tree.mjs';
import { buildRecord } from '../../../memory/lib/format.mjs';
import { appendRecord } from '../../../memory/lib/store.mjs';
import { hydrate } from './plainfiles.mjs';

const BASE = { ts: '2026-07-29T12:00:00Z', actor: '@crinaldi', actorKind: 'human', type: 'decision', project: 'brain' };

function fixture(t, n = 3) {
  const root = mkdtempSync(join(tmpdir(), 'brain-pf-hydrate-'));
  t.after(() => removeTempTree(root));
  const recordsDir = join(root, '.memory', 'records');
  mkdirSync(recordsDir, { recursive: true });
  for (let i = 0; i < n; i++) appendRecord(buildRecord({ ...BASE, content: `Record ${i}.` }), { recordsDir });
  return { root, indexPath: join(root, '.memory', 'index.jsonl') };
}

test('hydrate (bulk): rebuilds the index under root and reports {written:0, skipped:N, indexCount:N, duplicates}', async (t) => {
  const { root, indexPath } = fixture(t, 3);
  const r = await hydrate({ root });
  assert.equal(r.written, 0);
  assert.equal(r.skipped, 3);
  assert.equal(r.indexCount, 3);
  assert.equal(r.duplicates.ids, 0);
  assert.equal(r.verified, undefined);
  assert.equal(readFileSync(indexPath, 'utf8').split('\n').filter(Boolean).length, 3);
});

test('hydrate (bulk): paths come from root, through the _rebuildIndex seam, with no git', async () => {
  const calls = [];
  const r = await hydrate(
    { root: '/some/root' },
    { _rebuildIndex: (args) => { calls.push(args); return { count: 7, duplicates: undefined }; } },
  );
  assert.deepEqual(calls, [{ recordsDir: '/some/root/.memory/records', indexPath: '/some/root/.memory/index.jsonl' }]);
  assert.equal(r.skipped, 7);
  assert.equal(r.indexCount, 7);
});

test('hydrate: a recordId is accepted and ignored — the record already is the store', async (t) => {
  const { root } = fixture(t, 1);
  const r = await hydrate({ root, recordId: 'rec-anything' });
  assert.equal(r.skipped, 1);
});

test('hydrate: two runs leave index.jsonl byte-identical (REQ-MB-9)', async (t) => {
  const { root, indexPath } = fixture(t, 3);
  await hydrate({ root });
  const first = readFileSync(indexPath, 'utf8');
  await hydrate({ root });
  assert.equal(readFileSync(indexPath, 'utf8'), first);
});

test('hydrate({verify:true}): never rebuilds, reports stale, leaves a drifted index untouched', async (t) => {
  const { root, indexPath } = fixture(t, 2);
  writeFileSync(indexPath, 'drifted\n', 'utf8');
  const r = await hydrate({ root, verify: true }, { _rebuildIndex: () => { throw new Error('verify must not rebuild'); } });
  assert.equal(r.verified, true);
  assert.equal(r.stale, true);
  assert.equal(r.written, 0);
  assert.equal(r.skipped, 2);
  assert.equal(r.indexCount, 2);
  assert.equal(readFileSync(indexPath, 'utf8'), 'drifted\n');
});

test('hydrate({verify:true}): a current index reports stale:false and creates nothing when absent-and-empty', async (t) => {
  const { root, indexPath } = fixture(t, 2);
  await hydrate({ root });
  const r = await hydrate({ root, verify: true });
  assert.equal(r.stale, false);
  const empty = mkdtempSync(join(tmpdir(), 'brain-pf-hydrate-empty-'));
  t.after(() => removeTempTree(empty));
  const e = await hydrate({ root: empty, verify: true });
  assert.equal(e.stale, false);
  assert.equal(existsSync(join(empty, '.memory')), false);
  assert.ok(existsSync(indexPath));
});
