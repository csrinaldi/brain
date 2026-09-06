// hydration-guard.test.mjs — the machine-scoped, non-blocking guard around the
// engram adapter's import window (#820, memory 2.0 task 0.1). Real fs on a tmp
// path; only pid liveness and the clock are seams. Every case in spec.md of
// openspec/changes/issue-820-import-hydration-guard is pinned here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { testTmp } from '../../lib/test-tmp.mjs';
import { acquireHydrationGuard, withHydrationGuard, DEFAULT_LOCK_PATH, DEFAULT_STALE_MS } from './hydration-guard.mjs';

const lockIn = () => join(testTmp('hydration-guard-'), 'brain-memory-hydration.lock');
const alive = () => true;
const dead = () => false;

test('acquire: creates the lock with an owner record; release removes it', () => {
  const lockPath = lockIn();
  const g = acquireHydrationGuard({ lockPath, _pidAlive: alive, _now: () => 1000, _pid: 4242 });
  assert.equal(g.held, true);
  assert.equal(existsSync(lockPath), true);
  assert.deepEqual(JSON.parse(readFileSync(join(lockPath, 'owner.json'), 'utf8')), { pid: 4242, startedAt: 1000 });
  g.release();
  assert.equal(existsSync(lockPath), false);
});

test('contended: a live, young holder → held:false with the owner, lock untouched', () => {
  const lockPath = lockIn();
  mkdirSync(lockPath);
  writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ pid: 99, startedAt: 5000 }));
  const g = acquireHydrationGuard({ lockPath, _pidAlive: alive, _now: () => 5000 + 60_000 });
  assert.equal(g.held, false);
  assert.equal(g.owner.pid, 99);
  assert.equal(g.owner.ageMs, 60_000);
  assert.equal(existsSync(join(lockPath, 'owner.json')), true);
});

test('stale by dead pid: reclaimed, then held', () => {
  const lockPath = lockIn();
  mkdirSync(lockPath);
  writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ pid: 99, startedAt: 5000 }));
  const g = acquireHydrationGuard({ lockPath, _pidAlive: dead, _now: () => 6000, _pid: 1 });
  assert.equal(g.held, true);
  assert.equal(JSON.parse(readFileSync(join(lockPath, 'owner.json'), 'utf8')).pid, 1);
  g.release();
});

test('stale by age: a live holder older than staleMs is reclaimed', () => {
  const lockPath = lockIn();
  mkdirSync(lockPath);
  writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ pid: 99, startedAt: 0 }));
  const g = acquireHydrationGuard({ lockPath, staleMs: 1000, _pidAlive: alive, _now: () => 5000, _pid: 1 });
  assert.equal(g.held, true);
  g.release();
});

test('an unreadable owner record counts as stale — a lock nobody can identify does not wedge hydration', () => {
  const lockPath = lockIn();
  mkdirSync(lockPath); // no owner.json at all
  const g = acquireHydrationGuard({ lockPath, _pidAlive: alive, _now: () => 1, _pid: 1 });
  assert.equal(g.held, true);
  g.release();
});

test('withHydrationGuard: runs fn when held and releases; a throw inside still releases', () => {
  const lockPath = lockIn();
  const ok = withHydrationGuard(() => 'ran', { lockPath, _pidAlive: alive });
  assert.deepEqual(ok, { held: true, result: 'ran' });
  assert.equal(existsSync(lockPath), false);
  assert.throws(() => withHydrationGuard(() => { throw new Error('boom'); }, { lockPath, _pidAlive: alive }), /boom/);
  assert.equal(existsSync(lockPath), false, 'released on throw');
});

test('withHydrationGuard: contended → fn is NOT called', () => {
  const lockPath = lockIn();
  mkdirSync(lockPath);
  writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ pid: 99, startedAt: 5000 }));
  let calls = 0;
  const r = withHydrationGuard(() => { calls++; }, { lockPath, _pidAlive: alive, _now: () => 5001 });
  assert.equal(r.held, false);
  assert.equal(calls, 0);
});

test('defaults: machine-scoped path under tmpdir, not the repo; 10-minute staleness', () => {
  assert.match(DEFAULT_LOCK_PATH, /brain-memory-hydration\.lock$/);
  assert.doesNotMatch(DEFAULT_LOCK_PATH, /\.memory/);
  assert.equal(DEFAULT_STALE_MS, 600_000);
});
