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

import { laneSweepEnabled, runLaneSweep, laneSweepLine } from './day-start-sweep.mjs';

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

// ── laneSweepLine — pure, four branches (#906 cold review C5) ───────────────
//
// day-start.mjs's step-5 wiring had ZERO behavioural coverage before this: a
// mutant turning a `warn(...)` into something fatal was invisible. Extracting
// the RENDER DECISION into this pure function (never calls t(), never touches
// I/O, never throws) makes that decision independently testable, and pins
// that day-start.mjs's own wiring only ever has `warn`/`ok`/nothing to choose
// from — never a path to a fatal exit.

test('laneSweepLine: flag off (skipped) → level "skip", nothing to render', () => {
  const line = laneSweepLine({ skipped: true, status: null, outcome: null, unparsed: false });
  assert.equal(line.level, 'skip');
  assert.equal(line.key, null);
});

test('laneSweepLine: exit 0, pushed → level "ok", the shipped key with ref/number params', () => {
  const line = laneSweepLine({
    skipped: false,
    status: 0,
    unparsed: false,
    outcome: { pushed: true, pr: { number: 42 }, ref: 'refs/heads/memory/x-2026-09-10' },
  });
  assert.equal(line.level, 'ok');
  assert.equal(line.key, 'day.memory.laneSweep.shipped');
  assert.deepEqual(line.params, { ref: 'refs/heads/memory/x-2026-09-10', number: 42 });
});

// R11 (#920): a reconciliation-without-a-push (find/create + arm ran, with
// zero new commits) must render as work, never as "nothing" — a false
// negative about memory delivery.

test('laneSweepLine: reconciled without a push → level "ok", the reconciled key with ref/number params', () => {
  const line = laneSweepLine({
    skipped: false,
    status: 0,
    unparsed: false,
    outcome: { pushed: false, reconciled: true, pr: { number: 42 }, ref: 'refs/heads/memory/x-2026-09-10' },
  });
  assert.equal(line.level, 'ok');
  assert.equal(line.key, 'day.memory.laneSweep.reconciled');
  assert.deepEqual(line.params, { ref: 'refs/heads/memory/x-2026-09-10', number: 42 });
});

test('laneSweepLine: pushed:true still wins over reconciled:true (pushed is checked first)', () => {
  const line = laneSweepLine({
    skipped: false,
    status: 0,
    unparsed: false,
    outcome: { pushed: true, reconciled: true, pr: { number: 7 }, ref: 'refs/heads/memory/x-2026-09-10' },
  });
  assert.equal(line.level, 'ok');
  assert.equal(line.key, 'day.memory.laneSweep.shipped');
});

test('laneSweepLine: pushed:false and reconciled:false still falls through to "nothing"', () => {
  const line = laneSweepLine({
    skipped: false,
    status: 0,
    unparsed: false,
    outcome: { pushed: false, reconciled: false, collected: 0 },
  });
  assert.equal(line.level, 'ok');
  assert.equal(line.key, 'day.memory.laneSweep.nothing');
  assert.deepEqual(line.params, {});
});

test('laneSweepLine: exit 0, nothing pushed → level "ok", the nothing key, no params', () => {
  const line = laneSweepLine({
    skipped: false,
    status: 0,
    unparsed: false,
    outcome: { pushed: false, collected: 0 },
  });
  assert.equal(line.level, 'ok');
  assert.equal(line.key, 'day.memory.laneSweep.nothing');
  assert.deepEqual(line.params, {});
});

// F2 (cold review, #921/#923): before this fix, `laneSweepLine()` read only
// `pushed`/`reconciled` off the parsed outcome and fell through to
// `.nothing` whenever neither was true — even when `ship --json`'s own
// outcome carried a non-empty `skippedWorktrees` (#921). That is exactly the
// indistinguishability the ticket named, on the one surface (`day:start`)
// that discards the ship child's stderr entirely (see runLaneSweep() above:
// it never reads `result.stderr`).

test('laneSweepLine: nothing pending, and nothing skipped → still the plain "nothing" line (regression guard)', () => {
  const line = laneSweepLine({
    skipped: false,
    status: 0,
    unparsed: false,
    outcome: { pushed: false, collected: 0, skippedWorktrees: [] },
  });
  assert.equal(line.level, 'ok');
  assert.equal(line.key, 'day.memory.laneSweep.nothing');
  assert.deepEqual(line.params, {});
});

test('laneSweepLine: nothing pending, but a worktree was skipped → level "ok", the worktreeSkipped key, count+paths (never the plain "nothing" line)', () => {
  const line = laneSweepLine({
    skipped: false,
    status: 0,
    unparsed: false,
    outcome: {
      pushed: false, collected: 0,
      skippedWorktrees: [{ path: '/repo/wt-b', reason: 'fatal: not a git repository' }],
    },
  });
  assert.equal(line.level, 'ok');
  assert.equal(line.key, 'day.memory.laneSweep.worktreeSkipped');
  assert.deepEqual(line.params, { count: 1, paths: '/repo/wt-b (fatal: not a git repository)' });
});

test('laneSweepLine: pushed:true with a skipped worktree still renders "shipped" (documented scope boundary — the skip is still visible via --json and the SessionEnd log, not duplicated here)', () => {
  const line = laneSweepLine({
    skipped: false,
    status: 0,
    unparsed: false,
    outcome: {
      pushed: true, pr: { number: 42 }, ref: 'refs/heads/memory/x-2026-09-10',
      skippedWorktrees: [{ path: '/repo/wt-b', reason: 'fatal: not a git repository' }],
    },
  });
  assert.equal(line.level, 'ok');
  assert.equal(line.key, 'day.memory.laneSweep.shipped');
});

test('laneSweepLine: non-zero exit (ship failure) → level "warn", never "die" — an i18n detail KEY, not a literal string', () => {
  const line = laneSweepLine({ skipped: false, status: 1, unparsed: false, outcome: null });
  assert.equal(line.level, 'warn');
  assert.equal(line.key, 'day.memory.laneSweep.warn');
  assert.equal(line.params.detailKey, 'day.memory.laneSweep.detailExitCode');
  assert.deepEqual(line.params.detailParams, { status: 1 });
});

test('laneSweepLine: unparseable stdout → level "warn", the unparsed detail key', () => {
  const line = laneSweepLine({ skipped: false, status: 0, unparsed: true, outcome: null });
  assert.equal(line.level, 'warn');
  assert.equal(line.key, 'day.memory.laneSweep.warn');
  assert.equal(line.params.detailKey, 'day.memory.laneSweep.detailUnparsed');
  assert.deepEqual(line.params.detailParams, {});
});

test('laneSweepLine: null status (spawnSync itself failed to start) reads as a warn with "unknown" in the exit-code detail params, not a crash', () => {
  const line = laneSweepLine({ skipped: false, status: null, unparsed: false, outcome: null });
  assert.equal(line.level, 'warn');
  assert.equal(line.params.detailKey, 'day.memory.laneSweep.detailExitCode');
  assert.equal(line.params.detailParams.status, 'unknown');
});

test('laneSweepLine never returns a level outside {skip, ok, warn} — the only vocabulary day-start.mjs is allowed to render', () => {
  const cases = [
    { skipped: true, status: null, outcome: null, unparsed: false },
    { skipped: false, status: 0, outcome: { pushed: true, pr: {}, ref: 'x' }, unparsed: false },
    { skipped: false, status: 0, outcome: { pushed: false }, unparsed: false },
    { skipped: false, status: 1, outcome: null, unparsed: false },
    { skipped: false, status: 0, outcome: null, unparsed: true },
  ];
  for (const c of cases) {
    assert.ok(['skip', 'ok', 'warn'].includes(laneSweepLine(c).level));
  }
});
