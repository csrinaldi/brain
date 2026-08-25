// producer-forge-reach.test.mjs — #682 slice 3, judgment:cold-1 of the third
// cold review.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FORGE_CLIS,
  CLI_STATES,
  REACH_STATES,
  PROBE_TIMEOUT_MS,
  probeForgeCli,
  evaluateForgeReach,
  assertProducerCannotReachForge,
} from './producer-forge-reach.mjs';

const CLI = { name: 'gh', bin: 'gh', args: ['auth', 'status'] };

// ── probeForgeCli: the four facts stay four ────────────────────────────────

test('probeForgeCli: exit 0 is authenticated — the producer could post', () => {
  const r = probeForgeCli(CLI, {}, { _run: () => ({ status: 0, stdout: 'Logged in to github.com' }) });
  assert.equal(r.state, 'authenticated');
  assert.equal(r.cli, 'gh');
});

test('probeForgeCli: non-zero exit is unauthenticated', () => {
  const r = probeForgeCli(CLI, {}, { _run: () => ({ status: 1, stderr: 'not logged into any hosts' }) });
  assert.equal(r.state, 'unauthenticated');
});

test('probeForgeCli: ENOENT is absent, and ONLY ENOENT is', () => {
  const r = probeForgeCli(CLI, {}, { _run: () => ({ error: Object.assign(new Error('nope'), { code: 'ENOENT' }) }) });
  assert.equal(r.state, 'absent');
});

test('probeForgeCli: a timeout is unreadable, NOT absent — the binary is there', () => {
  // #614's conflation, which this module must not repeat: reading `error`
  // without reading `error.code` reports an installed-but-hung CLI as missing,
  // and "missing" would clear the channel this check exists to watch.
  const r = probeForgeCli(CLI, {}, { _run: () => ({ error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }) }) });
  assert.equal(r.state, 'unreadable');
  assert.match(r.detail, /timed out/);
});

test('probeForgeCli: EACCES is unreadable, not absent', () => {
  const r = probeForgeCli(CLI, {}, { _run: () => ({ error: Object.assign(new Error('denied'), { code: 'EACCES' }) }) });
  assert.equal(r.state, 'unreadable');
});

test('probeForgeCli: a runner that throws is unreadable, never a crash', () => {
  const r = probeForgeCli(CLI, {}, { _run: () => { throw new Error('spawn blew up'); } });
  assert.equal(r.state, 'unreadable');
  assert.match(r.detail, /spawn blew up/);
});

test('probeForgeCli: the PRODUCER env is what reaches the runner, not brain\'s', () => {
  // The whole question this module asks is about the post-scrub environment.
  // A probe run against `process.env` would measure brain and clear the
  // producer — a true answer to the wrong question.
  let seen = null;
  const producerEnv = { PATH: '/usr/bin', HOME: '/home/op' };
  probeForgeCli(CLI, producerEnv, { _run: (_c, _a, opts) => { seen = opts.env; return { status: 1 }; } });
  assert.deepEqual(seen, producerEnv);
});

test('probeForgeCli: the probe is bounded — an unbounded one converts refusal into a hang', () => {
  let seen = null;
  probeForgeCli(CLI, {}, { _run: (_c, _a, opts) => { seen = opts.timeoutMs; return { status: 1 }; } });
  assert.equal(seen, PROBE_TIMEOUT_MS);
});

// ── evaluateForgeReach: fail-closed folding ────────────────────────────────

test('evaluateForgeReach: every CLI absent or logged out is closed', () => {
  const v = evaluateForgeReach([
    { cli: 'gh', state: 'absent', detail: null },
    { cli: 'glab', state: 'unauthenticated', detail: null },
  ]);
  assert.equal(v.state, 'closed');
  assert.equal(v.ok, true);
});

test('evaluateForgeReach: one authenticated CLI refuses', () => {
  const v = evaluateForgeReach([
    { cli: 'gh', state: 'authenticated', detail: 'Logged in' },
    { cli: 'glab', state: 'absent', detail: null },
  ]);
  assert.equal(v.state, 'reachable');
  assert.equal(v.ok, false);
  assert.match(v.reason, /gh/);
});

test('evaluateForgeReach: unreadable refuses — "could not look" is not "nothing there"', () => {
  const v = evaluateForgeReach([
    { cli: 'gh', state: 'unreadable', detail: 'timed out' },
    { cli: 'glab', state: 'absent', detail: null },
  ]);
  assert.equal(v.state, 'indeterminate');
  assert.equal(v.ok, false);
  assert.match(v.reason, /timed out/);
});

test('evaluateForgeReach: reachable BEATS indeterminate — report what is definitely true', () => {
  // A run where one CLI is authenticated and another timed out is not an
  // inconclusive probe. Reporting it as one would hand the operator the weaker
  // reason and hide the actionable half.
  const v = evaluateForgeReach([
    { cli: 'gh', state: 'authenticated', detail: 'Logged in' },
    { cli: 'glab', state: 'unreadable', detail: 'timed out' },
  ]);
  assert.equal(v.state, 'reachable');
  assert.match(v.reason, /still authenticates/);
});

test('evaluateForgeReach: an EMPTY probe list is indeterminate, never closed', () => {
  // Measuring nothing and reporting "closed" is the exact false clearance this
  // module exists to prevent.
  const v = evaluateForgeReach([]);
  assert.equal(v.state, 'indeterminate');
  assert.equal(v.ok, false);
});

test('evaluateForgeReach: a non-array is indeterminate, not a crash', () => {
  assert.equal(evaluateForgeReach(null).state, 'indeterminate');
  assert.equal(evaluateForgeReach(undefined).ok, false);
});

test('evaluateForgeReach: the refusal reason names the remedy, not just the fault', () => {
  const v = evaluateForgeReach([{ cli: 'gh', state: 'authenticated', detail: null }]);
  assert.match(v.reason, /Log it out|route the stage/);
});

// ── assertProducerCannotReachForge: the whole call ─────────────────────────

test('assertProducerCannotReachForge: probes every declared CLI', () => {
  const probed = [];
  const v = assertProducerCannotReachForge({}, {
    _run: (bin) => { probed.push(bin); return { status: 1 }; },
  });
  assert.deepEqual(probed, FORGE_CLIS.map((c) => c.bin));
  assert.equal(v.state, 'closed');
});

test('assertProducerCannotReachForge: refuses when a CLI is logged in', () => {
  const v = assertProducerCannotReachForge({}, { _run: () => ({ status: 0, stdout: 'Logged in' }) });
  assert.equal(v.ok, false);
  assert.equal(v.state, 'reachable');
});

test('assertProducerCannotReachForge: an empty CLI list refuses rather than clearing', () => {
  const v = assertProducerCannotReachForge({}, { clis: [], _run: () => ({ status: 1 }) });
  assert.equal(v.state, 'indeterminate');
});

// ── the declared shapes ────────────────────────────────────────────────────

test('the state vocabularies are frozen and non-overlapping', () => {
  assert.ok(Object.isFrozen(CLI_STATES) && Object.isFrozen(REACH_STATES));
  assert.equal(new Set(CLI_STATES).size, CLI_STATES.length);
  assert.equal(new Set(REACH_STATES).size, REACH_STATES.length);
});

test('every state probeForgeCli can return is declared in CLI_STATES', () => {
  const produced = [
    probeForgeCli(CLI, {}, { _run: () => ({ status: 0 }) }).state,
    probeForgeCli(CLI, {}, { _run: () => ({ status: 1 }) }).state,
    probeForgeCli(CLI, {}, { _run: () => ({ error: Object.assign(new Error(''), { code: 'ENOENT' }) }) }).state,
    probeForgeCli(CLI, {}, { _run: () => { throw new Error('x'); } }).state,
  ];
  for (const s of produced) assert.ok(CLI_STATES.includes(s), `${s} is not declared`);
  assert.equal(new Set(produced).size, 4, 'all four facts are reachable and distinct');
});

test('every verdict evaluateForgeReach can return is declared in REACH_STATES', () => {
  const produced = [
    evaluateForgeReach([{ cli: 'gh', state: 'absent' }]).state,
    evaluateForgeReach([{ cli: 'gh', state: 'authenticated' }]).state,
    evaluateForgeReach([{ cli: 'gh', state: 'unreadable', detail: 'x' }]).state,
  ];
  for (const s of produced) assert.ok(REACH_STATES.includes(s), `${s} is not declared`);
  assert.equal(new Set(produced).size, 3);
});
