// engram.share.test.mjs — unit tests for backends/engram.mjs#share (#874
// split B, row 5). share() is now the plainfiles.share() mirror (R11, D6):
// a bare _ensureSymlink(root) + rebuildIndex() self-check. It no longer
// exports, reads observations, scans chunks, or dual-writes records — those
// surfaces (rows 1-4) are retired or in the process of retiring; see
// openspec/changes/issue-874-record-first/{design,tasks}.md.
//
// Modelled on plainfiles.share.test.mjs (82 lines) — the twin this function
// now mirrors.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { share } from './engram.mjs';
import { buildRecord } from '../lib/format.mjs';
import { appendRecord } from '../lib/store.mjs';
import { testTmp } from '../../lib/test-tmp.mjs';

test('share: calls _ensureSymlink then _rebuildIndex, in that order — no export, no observation read, no engram binary required (R11/R12)', async () => {
  const calls = [];
  const result = await share({
    root: '/fake/root',
    _ensureSymlink: (root) => calls.push(['ensureSymlink', root]),
    _rebuildIndex: (opts) => { calls.push(['rebuildIndex', opts]); return { count: 3 }; },
  });

  assert.deepEqual(calls.map((c) => c[0]), ['ensureSymlink', 'rebuildIndex'], 'ensureSymlink must run before rebuildIndex');
  assert.equal(calls[0][1], '/fake/root');
  assert.equal(calls[1][1].recordsDir, '/fake/root/.memory/records');
  assert.equal(calls[1][1].indexPath, '/fake/root/.memory/index.jsonl');
  assert.deepEqual(result, { indexCount: 3, duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] } });
});

// ── #574 — the self-check has to SAY what it collapsed ───────────────────────

test('share: carries the duplicate accounting out to the caller — a silent self-check is not one', async () => {
  const duplicates = { ids: 2, lines: 5, divergent: 0, groups: [{ id: 'rec-a', occurrences: ['2026-07.jsonl:1', '2026-07.jsonl:9'] }] };
  const result = await share(
    { root: '/fake/root', _rebuildIndex: () => ({ count: 2038, duplicates }) },
  );

  assert.equal(result.indexCount, 2038);
  assert.deepEqual(result.duplicates, duplicates, 'cli.mjs prints this — it must survive the backend boundary');
});

// ── source guard (row 5) — the exporter's seams are GONE, not merely unused ──

test('share: the function body names none of the retired exporter seams — a source guard, not a behavioral one', () => {
  const src = share.toString();
  for (const retired of ['requireEngram', '_export', '_readObservations', 'dualWriteRecords']) {
    assert.doesNotMatch(
      src, new RegExp(retired),
      `share() must not reference ${retired} — it was retired by #874 split B, not merely left uncalled`,
    );
  }
});

// ── R12 — _ensureSymlink is the ONE seam kept from the pre-#874 shape ────────

test('share: over a real temp store, a FRESH WORKTREE self-heals the .engram → .memory binding via the REAL ensureMemorySymlink (R12)', async () => {
  const root = testTmp('engram-share-');
  mkdirSync(join(root, '.memory'), { recursive: true });
  assert.ok(!existsSync(join(root, '.engram')), 'precondition: a fresh worktree has no .engram');

  await assert.doesNotReject(() => share({ root, _rebuildIndex: () => ({ count: 0 }) }));

  const stat = lstatSync(join(root, '.engram'));
  assert.ok(stat.isSymbolicLink(), 'share() must leave .engram a symlink, never a real directory');
  assert.equal(readlinkSync(join(root, '.engram')), '.memory');
});

// ── rule 3 (R11) — share completes with the engram binary ABSENT ─────────────

function walk(dir, base = '') {
  const out = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    out.push(rel);
    if (statSync(full).isDirectory()) out.push(...walk(full, rel));
  }
  return out;
}

test('share: over a real temp store with no engram binary anywhere on PATH, share() still completes — the .memory/ tree is index.jsonl + records/, no chunks/ (rule 3, D4 guard 3)', async () => {
  const root = testTmp('engram-share-');
  const recordsDir = join(root, '.memory', 'records');
  const rec = buildRecord({
    ts: '2026-07-04T12:00:00Z',
    actor: '@crinaldi',
    actorKind: 'human',
    type: 'decision',
    project: 'brain',
    content: 'seed record',
  });
  const { filename } = appendRecord(rec, { recordsDir });

  const result = await share({ root });

  assert.deepEqual(result, { indexCount: 1, duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] } });
  const tree = walk(join(root, '.memory'));
  assert.deepEqual(
    tree,
    ['index.jsonl', 'records', `records/${filename}`],
    'no chunks/ was ever created — share() never touched the engram binary',
  );
});
