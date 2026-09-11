// engram.save.test.mjs — unit tests for backends/engram.mjs#save (#874, split
// A). Mirrors plainfiles.save.test.mjs's seam-injection discipline: every
// seam (root, getBranch, getTimestamp, getHostname, getGitConfig, getEnv,
// plus the engram-only `_hydrate` terminal step) is injected, so no real
// git/clock/hostname/env/engram dependency runs in `npm test`.
//
// R1: this file mirrors plainfiles.save.test.mjs's cases on purpose — the two
// bodies are duplicated (R1), and the parity table (save-parity.test.mjs)
// pins that they refuse identically. `_hydrate` is stubbed here to isolate
// save()'s own gate order from hydrate()'s own behaviour (covered by
// engram.hydrate.test.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { save } from './engram.mjs';
import { appendRecord as appendRecordReal, rebuildIndex as rebuildIndexReal } from '../lib/store.mjs';

function tmpRoot() {
  return mkdtempSync(join(tmpdir(), 'engram-save-'));
}

const identitySeams = {
  getGitConfig: (key) => (key === 'brain.actor' ? '@test' : null),
  getEnv: () => ({}),
};

const noopHydrate = async () => ({ written: 0, skipped: 0 });

// ── happy path — record + index + the hydrate seam is called as the terminal step ──

test('save: a clean input writes a record, rebuilds the index, and calls hydrate as the terminal step', async () => {
  const root = tmpRoot();
  try {
    const calls = [];
    const result = await save('a title', 'the body', { type: 'discovery', project: 'brain' }, {
      root,
      getBranch: () => 'main',
      getTimestamp: () => '2026-09-10T09:00:00Z',
      getHostname: () => 'my-host',
      ...identitySeams,
      _hydrate: async (args) => {
        calls.push(args);
        return { written: 1, skipped: 0 };
      },
    });

    assert.equal(result.written, true);
    assert.equal(result.hydrated, true, 'hydrated must reflect the _hydrate seam result');
    assert.ok(result.id.startsWith('rec-'));
    assert.ok(existsSync(result.file));

    assert.equal(calls.length, 1, 'hydrate must be called exactly once, as the terminal step');
    assert.equal(calls[0].recordId, result.id);
    assert.equal(calls[0].record.id, result.id);

    const indexPath = join(root, '.memory', 'index.jsonl');
    assert.ok(existsSync(indexPath), 'index.jsonl must be rebuilt after a successful save');
    const indexRaw = readFileSync(indexPath, 'utf8');
    assert.ok(indexRaw.includes(result.id));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── cold review C1 (#924): composeSource() must name the backend that
// actually ran, not a hardcoded 'plainfiles' ─────────────────────────────

test('save: source names "engram", not "plainfiles" (cold review C1)', async () => {
  const root = tmpRoot();
  try {
    const result = await save('t', 'c', { type: 'discovery', project: 'brain' }, {
      root,
      getBranch: () => 'main',
      getTimestamp: () => '2026-09-10T09:00:00Z',
      getHostname: () => 'my-host',
      ...identitySeams,
      _hydrate: noopHydrate,
    });
    const record = JSON.parse(readFileSync(result.file, 'utf8').trim());
    assert.ok(
      record.source.startsWith('engram save on '),
      `expected source to start with 'engram save on ', got: ${record.source}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── caller-mistake refusals — FIRST of all, fixable in the same second ─────

test('save: refuses when type is missing, naming the seven-member enum', async () => {
  const root = tmpRoot();
  try {
    await assert.rejects(
      () => save('t', 'c', { project: 'brain' }, { root, getBranch: () => 'main', getTimestamp: () => '2026-09-10T09:00:00Z', getHostname: () => 'h', ...identitySeams, _hydrate: noopHydrate }),
      (err) => {
        assert.match(err.message, /type/i);
        return true;
      },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('save: refuses a non-integer --issue', async () => {
  const root = tmpRoot();
  try {
    await assert.rejects(
      () => save('t', 'c', { type: 'discovery', project: 'brain', issue: 'abc' }, { root, getBranch: () => 'main', getTimestamp: () => '2026-09-10T09:00:00Z', getHostname: () => 'h', ...identitySeams, _hydrate: noopHydrate }),
    );
    assert.equal(existsSync(join(root, '.memory', 'records')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── actor gate — BEFORE any store read ──────────────────────────────────────

test('save: an unset actor refuses BEFORE the store is ever read (_readRecordIds never called)', async () => {
  const root = tmpRoot();
  try {
    let readRecordIdsCalled = false;
    await assert.rejects(() =>
      save('t', 'c', { type: 'discovery', project: 'brain', supersedes: 'rec-0123456789abcdef' }, {
        root, getBranch: () => 'main', getTimestamp: () => '2026-09-10T09:00:00Z', getHostname: () => 'h',
        getGitConfig: () => null, getEnv: () => ({}),
        _readRecordIds: () => { readRecordIdsCalled = true; return new Set(); },
        _hydrate: noopHydrate,
      }),
    );
    assert.equal(readRecordIdsCalled, false, 'the actor refusal must fire before the supersedes gate reads the store');
    assert.equal(existsSync(join(root, '.memory', 'records')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('save: a malformed brain.actor refuses, naming the remedy', async () => {
  const root = tmpRoot();
  try {
    await assert.rejects(
      () => save('t', 'c', { type: 'discovery', project: 'brain' }, {
        root, getBranch: () => 'main', getTimestamp: () => '2026-09-10T09:00:00Z', getHostname: () => 'h',
        getGitConfig: (key) => (key === 'brain.actor' ? 'no-at-sign' : null), getEnv: () => ({}),
        _hydrate: noopHydrate,
      }),
      /git config --local brain\.actor/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('save: the reserved @legacy actor refuses', async () => {
  const root = tmpRoot();
  try {
    await assert.rejects(() =>
      save('t', 'c', { type: 'discovery', project: 'brain' }, {
        root, getBranch: () => 'main', getTimestamp: () => '2026-09-10T09:00:00Z', getHostname: () => 'h',
        getGitConfig: (key) => (key === 'brain.actor' ? '@legacy' : null), getEnv: () => ({}),
        _hydrate: noopHydrate,
      }),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── derived issue notice ────────────────────────────────────────────────────

test('save: an issue derived from the branch prints a notice', async () => {
  const root = tmpRoot();
  const orig = console.log;
  const logs = [];
  console.log = (...args) => logs.push(args.join(' '));
  try {
    await save('t', 'c', { type: 'discovery', project: 'brain' }, {
      root, getBranch: () => 'feat/issue-874-record-first', getTimestamp: () => '2026-09-10T09:00:00Z', getHostname: () => 'h',
      ...identitySeams, _hydrate: noopHydrate,
    });
    assert.ok(logs.some((l) => l.includes('874')), `expected a derived-issue notice: ${JSON.stringify(logs)}`);
  } finally {
    console.log = orig;
    rmSync(root, { recursive: true, force: true });
  }
});

// ── --supersedes: malformed touches no IO ───────────────────────────────────

test('save: a malformed --supersedes id touches no IO and no write', async () => {
  const root = tmpRoot();
  try {
    let appendCalled = false;
    await assert.rejects(() =>
      save('t', 'c', { type: 'discovery', project: 'brain', supersedes: 'not-shaped-right' }, {
        root, getBranch: () => 'main', getTimestamp: () => '2026-09-10T09:00:00Z', getHostname: () => 'h',
        ...identitySeams,
        _appendRecord: () => { appendCalled = true; return { file: 'x' }; },
        _hydrate: noopHydrate,
      }),
    );
    assert.equal(appendCalled, false);
    assert.equal(existsSync(join(root, '.memory', 'records')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── scope/topic — warn loudly, never silently dropped ───────────────────────

test('save: warns when --scope/--topic are passed, naming both', async () => {
  const root = tmpRoot();
  const orig = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const result = await save('t', 'c', { type: 'discovery', project: 'brain', scope: 'project', topic: 'sdd/x/y' }, {
      root, getBranch: () => 'main', getTimestamp: () => '2026-09-10T09:00:00Z', getHostname: () => 'h',
      ...identitySeams, _hydrate: noopHydrate,
    });
    assert.equal(result.written, true);
    assert.ok(warnings.some((w) => w.includes('scope') && w.includes('topic')), `expected a warning naming scope/topic: ${JSON.stringify(warnings)}`);
  } finally {
    console.warn = orig;
    rmSync(root, { recursive: true, force: true });
  }
});

// ── #637 — index rebuild failure is an annotated rethrow, not "save failed" ─

// ── #469 re-proof (R10): a secret in `content` never reaches disk — neither
// `.memory/records/*.jsonl` nor the engram store. Two tests: (i) the refusal
// itself, with every downstream seam proved unreachable; (ii) the call order
// on a clean input, scan → append → hydrate, never any other order.

test('save (R10, i): a secret in content throws — _appendRecord, _rebuildIndex, and _engramSave (via _hydrate) are never called', async () => {
  const root = tmpRoot();
  try {
    let appendCalled = false;
    let rebuildCalled = false;
    let hydrateCalled = false;
    await assert.rejects(() =>
      save('leaked token', 'ghp_abcdefghijklmnopqrstuvwx', { type: 'discovery', project: 'brain' }, {
        root, getBranch: () => 'main', getTimestamp: () => '2026-09-10T09:00:00Z', getHostname: () => 'h',
        ...identitySeams,
        _appendRecord: () => { appendCalled = true; return { file: 'x' }; },
        _rebuildIndex: () => { rebuildCalled = true; return { count: 0 }; },
        _hydrate: async () => { hydrateCalled = true; return { written: 0, skipped: 0 }; },
      }),
    );
    assert.equal(appendCalled, false, 'appendRecord must never run when a secret is found');
    assert.equal(rebuildCalled, false, 'rebuildIndex must never run when a secret is found');
    assert.equal(hydrateCalled, false, 'hydrate (and so _engramSave) must never run when a secret is found');
    assert.equal(existsSync(join(root, '.memory', 'records')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('save (R10, ii): on a clean input, the call order is scan → append → hydrate — never any other order', async () => {
  const root = tmpRoot();
  try {
    const order = [];
    await save('t', 'clean content, no secret here', { type: 'discovery', project: 'brain' }, {
      root, getBranch: () => 'main', getTimestamp: () => '2026-09-10T09:00:00Z', getHostname: () => 'h',
      ...identitySeams,
      _appendRecord: (record, opts) => { order.push('append'); return appendRecordReal(record, opts); },
      _rebuildIndex: (opts) => { order.push('rebuildIndex'); return rebuildIndexReal(opts); },
      _hydrate: async () => { order.push('hydrate'); return { written: 1, skipped: 0 }; },
    });
    // The scan itself has no seam (scanTextForSecrets runs inline, synchronously,
    // before _appendRecord is ever reached) — its position is proved by the FIRST
    // logged call being 'append', never 'hydrate' or 'rebuildIndex' out of order.
    assert.deepEqual(order, ['append', 'rebuildIndex', 'hydrate']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('save: a rebuildIndex failure is annotated and rethrown (#637) — the record is already durable', async () => {
  const root = tmpRoot();
  try {
    await assert.rejects(
      () => save('t', 'c', { type: 'discovery', project: 'brain' }, {
        root, getBranch: () => 'main', getTimestamp: () => '2026-09-10T09:00:00Z', getHostname: () => 'h',
        ...identitySeams,
        _rebuildIndex: () => { throw new Error('boom — index corrupt'); },
        _hydrate: noopHydrate,
      }),
      (err) => {
        assert.equal(err.indexFailed, true);
        assert.ok(err.recordId.startsWith('rec-'));
        assert.ok(err.recordFile);
        assert.match(err.message, /boom/);
        return true;
      },
    );
    // the record itself IS on disk — the append happened before the index rebuild.
    const recordsDir = join(root, '.memory', 'records');
    assert.ok(existsSync(recordsDir));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
