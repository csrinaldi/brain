// brain/scripts/memory/day-start-sweep.test.mjs — unit tests for the
// synchronous day:start lane sweep (#906, design.md A7).
//
// The launcher (session-end-ship.mjs) detaches; this is its sibling — a
// SYNCHRONOUS sub-step inside day:start's own "Team memory" step, with its
// OWN timeout (day-start.mjs's run() passes none). It never throws: a
// non-zero ship exit or an unparseable --json line is reported, never
// fatal — the caller decides whether to warn.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { laneSweepEnabled, runLaneSweep } from './day-start-sweep.mjs';

// ── laneSweepEnabled — pure ─────────────────────────────────────────────────

test('laneSweepEnabled: true only when memory.lane.enabled === true', () => {
  assert.equal(laneSweepEnabled({ memory: { lane: { enabled: true } } }), true);
  assert.equal(laneSweepEnabled({ memory: { lane: { enabled: false } } }), false);
  assert.equal(laneSweepEnabled({}), false);
  assert.equal(laneSweepEnabled({ memory: {} }), false);
  assert.equal(laneSweepEnabled(undefined), false);
});

// ── runLaneSweep — flag off ──────────────────────────────────────────────────

test('flag off: _spawnSync is never called, returns skipped:true', () => {
  let called = false;
  const result = runLaneSweep({
    config: { memory: { lane: { enabled: false } } },
    _spawnSync: () => { called = true; },
  });
  assert.equal(called, false);
  assert.equal(result.skipped, true);
});

// ── runLaneSweep — flag on ───────────────────────────────────────────────────

test('flag on: one _spawnSync call with --json and a timeout', () => {
  const calls = [];
  runLaneSweep({
    config: { memory: { lane: { enabled: true } } },
    _spawnSync: (...args) => {
      calls.push(args);
      return { status: 0, stdout: '{"pushed":false,"collected":0}\n', stderr: '' };
    },
  });
  assert.equal(calls.length, 1, 'exactly one spawnSync call');
  const [cmd, argv, opts] = calls[0];
  assert.equal(cmd, process.execPath);
  assert.ok(argv.some((a) => a.endsWith('cli.mjs')));
  assert.ok(argv.includes('ship'));
  assert.ok(argv.includes('--json'));
  assert.equal(typeof opts.timeout, 'number');
  assert.ok(opts.timeout > 0);
});

test('flag on, exit 0, one JSON line: parsed into outcome, skipped:false', () => {
  const result = runLaneSweep({
    config: { memory: { lane: { enabled: true } } },
    _spawnSync: () => ({
      status: 0,
      stdout: '{"pushed":true,"pr":{"number":42},"autoMerge":{"enabled":true},"collected":3,"ref":"refs/heads/memory/x-2026-09-10"}\n',
      stderr: '',
    }),
  });
  assert.equal(result.skipped, false);
  assert.equal(result.status, 0);
  assert.equal(result.unparsed, false);
  assert.deepEqual(result.outcome, {
    pushed: true,
    pr: { number: 42 },
    autoMerge: { enabled: true },
    collected: 3,
    ref: 'refs/heads/memory/x-2026-09-10',
  });
});

test('non-zero child exit: reported in the outcome, never thrown', () => {
  assert.doesNotThrow(() => {
    const result = runLaneSweep({
      config: { memory: { lane: { enabled: true } } },
      _spawnSync: () => ({ status: 1, stdout: '', stderr: 'memory/cli: ship failed\n' }),
    });
    assert.equal(result.skipped, false);
    assert.equal(result.status, 1);
    assert.equal(result.outcome, null);
    assert.equal(result.unparsed, false);
  });
});

test('unparseable stdout: unparsed:true, still non-fatal', () => {
  assert.doesNotThrow(() => {
    const result = runLaneSweep({
      config: { memory: { lane: { enabled: true } } },
      _spawnSync: () => ({ status: 0, stdout: 'not json at all', stderr: '' }),
    });
    assert.equal(result.skipped, false);
    assert.equal(result.unparsed, true);
    assert.equal(result.outcome, null);
  });
});

test('spawnSync itself failing to start (ENOENT-shaped result): never throws, reports status null', () => {
  assert.doesNotThrow(() => {
    const result = runLaneSweep({
      config: { memory: { lane: { enabled: true } } },
      _spawnSync: () => ({ status: null, error: new Error('ENOENT'), stdout: '', stderr: '' }),
    });
    assert.equal(result.skipped, false);
    assert.equal(result.status, null);
    assert.equal(result.outcome, null);
  });
});
