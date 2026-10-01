// render-budget.test.mjs — the off-thread render with a time budget (#1218).
// Pure tests: spawn, setTimer and clearTimer are fakes, so every race (result
// versus timeout versus cancel versus error) runs in node with no real wait.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOffThread, RENDER_BUDGET_MS, TIMEOUT_NOTICE, timeoutNotice, FAILED_NOTICE, UNAVAILABLE_NOTICE } from './render-budget.mjs';

function fakeEffects({ spawnThrows = false, noWorker = false } = {}) {
  const log = [];
  const state = { timers: [], cleared: [], workers: [], log };
  state.setTimer = (fn, ms) => {
    log.push('timer');
    const handle = { fn, ms };
    state.timers.push(handle);
    return handle;
  };
  state.clearTimer = (handle) => state.cleared.push(handle);
  state.spawn = () => {
    log.push('spawn');
    if (spawnThrows) throw new Error('no worker');
    if (noWorker) return undefined;
    const worker = { posted: [], terminated: 0, onmessage: null, onerror: null };
    worker.postMessage = (message) => worker.posted.push(message);
    worker.terminate = () => { worker.terminated++; };
    state.workers.push(worker);
    return worker;
  };
  return state;
}

const TREE = { blocks: [{ t: 'hr' }], notices: [] };
const start = (fx, text = 'hello') => renderOffThread(text, { spawn: fx.spawn, setTimer: fx.setTimer, clearTimer: fx.clearTimer });
const idOf = (worker) => worker.posted[0].id;

test('#1218 R1218-5: the budget is 1500 ms and the three notices carry the spec wording', () => {
  assert.equal(RENDER_BUDGET_MS, 1500);
  assert.equal(TIMEOUT_NOTICE, 'this document was too slow to render (over 1500 ms) and is shown as plain text');
  assert.equal(FAILED_NOTICE, 'this document could not be rendered and is shown as plain text');
  assert.equal(UNAVAILABLE_NOTICE, 'this browser cannot render this document off the page, so it is shown as plain text');
});

test('#1218 R1218-4: a result resolves the tree and terminates the worker once', async () => {
  const fx = fakeEffects();
  const { promise } = start(fx, 'abc');
  const [worker] = fx.workers;
  assert.equal(worker.posted[0].text, 'abc');
  worker.onmessage({ data: { id: idOf(worker), ok: true, tree: TREE } });
  assert.deepEqual(await promise, { kind: 'tree', tree: TREE });
  assert.equal(worker.terminated, 1);
  assert.equal(fx.cleared.length, 1);
});

test('#1218 R1218-5: the timer is started before the worker, with the budget', () => {
  const fx = fakeEffects();
  start(fx);
  assert.deepEqual(fx.log, ['timer', 'spawn']);
  assert.equal(fx.timers[0].ms, 1500);
});

test('#1218 R1218-5: the timer firing resolves timeout and terminates the worker', async () => {
  const fx = fakeEffects();
  const { promise } = start(fx);
  fx.timers[0].fn();
  assert.deepEqual(await promise, { kind: 'timeout', budgetMs: 1500 });
  assert.equal(fx.workers[0].terminated, 1);
});

test('#1218 R1218-5: a result before the timer fires is accepted', async () => {
  const fx = fakeEffects();
  const { promise } = start(fx);
  const [worker] = fx.workers;
  worker.onmessage({ data: { id: idOf(worker), ok: true, tree: TREE } });
  fx.timers[0].fn(); // the stale timer, after the outcome
  assert.equal((await promise).kind, 'tree');
  assert.equal(worker.terminated, 1);
});

test('#1218 R1218-6: an error event resolves failed and terminates once', async () => {
  const fx = fakeEffects();
  const { promise } = start(fx);
  fx.workers[0].onerror({ message: 'RangeError' });
  assert.deepEqual(await promise, { kind: 'failed' });
  assert.equal(fx.workers[0].terminated, 1);
});

test('#1218 R1218-6: a worker that reports ok:false is failed', async () => {
  const fx = fakeEffects();
  const { promise } = start(fx);
  const [worker] = fx.workers;
  worker.onmessage({ data: { id: idOf(worker), ok: false, error: 'boom' } });
  assert.deepEqual(await promise, { kind: 'failed' });
  assert.equal(worker.terminated, 1);
});

test('#1218 R1218-6: a throwing spawn is failed, an absent worker is unavailable', async () => {
  assert.deepEqual(await start(fakeEffects({ spawnThrows: true })).promise, { kind: 'failed' });
  const fx = fakeEffects({ noWorker: true });
  assert.deepEqual(await start(fx).promise, { kind: 'unavailable' });
  assert.equal(fx.cleared.length, 1);
});

test('#1218 R1218-6: a missing spawn function is unavailable', async () => {
  const fx = fakeEffects();
  const { promise } = renderOffThread('x', { setTimer: fx.setTimer, clearTimer: fx.clearTimer });
  assert.deepEqual(await promise, { kind: 'unavailable' });
});

test('#1218 R1218-6: a malformed message is failed', async () => {
  for (const data of [null, 'tree', {}, { ok: true, tree: 5 }]) {
    const fx = fakeEffects();
    const { promise } = start(fx);
    const [worker] = fx.workers;
    worker.onmessage({ data: data && typeof data === 'object' ? { ...data, id: idOf(worker) } : data });
    assert.deepEqual(await promise, { kind: 'failed' }, JSON.stringify(data));
    assert.equal(worker.terminated, 1);
  }
});

test('#1218 R1218-7: cancel resolves cancelled, clears the timer and terminates once', async () => {
  const fx = fakeEffects();
  const { promise, cancel } = start(fx);
  cancel();
  cancel();
  assert.deepEqual(await promise, { kind: 'cancelled' });
  assert.equal(fx.workers[0].terminated, 1);
  assert.equal(fx.cleared.length, 1);
});

test('#1218 R1218-7: a message with another id is ignored; a late message after an outcome is ignored', async () => {
  const fx = fakeEffects();
  const { promise } = start(fx);
  const [worker] = fx.workers;
  worker.onmessage({ data: { id: idOf(worker) + 1000, ok: true, tree: TREE } });
  assert.equal(worker.terminated, 0);
  fx.timers[0].fn();
  assert.deepEqual(await promise, { kind: 'timeout', budgetMs: 1500 });
  worker.onmessage({ data: { id: idOf(worker), ok: true, tree: TREE } });
  worker.onerror({});
  assert.equal(worker.terminated, 1);
});

test('#1218 R1218-6: the promise never rejects, even when postMessage throws', async () => {
  const fx = fakeEffects();
  const spawn = () => {
    const worker = fx.spawn();
    worker.postMessage = () => { throw new Error('clone failed'); };
    return worker;
  };
  const { promise } = renderOffThread('x', { spawn, setTimer: fx.setTimer, clearTimer: fx.clearTimer });
  assert.deepEqual(await promise, { kind: 'failed' });
  assert.equal(fx.workers[0].terminated, 1);
});

// ── integration: the real worker file through worker_threads ──

import { nodeWebWorker } from '../test-support/node-web-worker.mjs';

const realEffects = (onSpawn) => ({
  spawn: () => {
    const worker = nodeWebWorker('/lib/markdown-worker.mjs');
    onSpawn?.(worker);
    return worker;
  },
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle),
});

test('#1218 R1218-5: many sub-threshold passages are cut at the budget and the thread exits', async () => {
  let worker;
  const input = Array.from({ length: 150 }, () => '_a '.repeat(590)).join('\n\n');
  const t0 = performance.now();
  const { promise } = renderOffThread(input, realEffects((w) => { worker = w; }));
  const outcome = await promise;
  const elapsed = performance.now() - t0;
  assert.deepEqual(outcome, { kind: 'timeout', budgetMs: 1500 });
  assert.ok(elapsed < RENDER_BUDGET_MS + 300, `took ${elapsed} ms`);
  await worker.exited;
});

test('#1218 R1218-5: the 200 KB emphasis input returns a degraded passage without reaching the timeout', async () => {
  const input = '*'.repeat(1e5) + 'a' + '*'.repeat(1e5);
  const { promise } = renderOffThread(input, realEffects());
  const outcome = await promise;
  assert.equal(outcome.kind, 'tree');
  assert.equal(outcome.tree.blocks[0].t, 'degraded');
});

test('#1218 R1218-5: a 262000-character block quote settles to a timeout or a tree within the budget and never throws', async () => {
  let worker;
  const t0 = performance.now();
  const { promise } = renderOffThread('>'.repeat(262000), realEffects((w) => { worker = w; }));
  const outcome = await promise;
  const elapsed = performance.now() - t0;
  assert.ok(outcome.kind === 'timeout' || outcome.kind === 'tree', `unexpected outcome ${outcome.kind}`);
  assert.ok(elapsed < RENDER_BUDGET_MS + 300, `took ${elapsed} ms`);
  await worker.exited;
});

test('#1218 R1218-5: the timeout notice states the budget actually enforced, an injected one included', async () => {
  const fx = fakeEffects();
  const { promise } = renderOffThread('x', { spawn: fx.spawn, setTimer: fx.setTimer, clearTimer: fx.clearTimer, budgetMs: 300 });
  assert.equal(fx.timers[0].ms, 300);
  fx.timers[0].fn();
  const outcome = await promise;
  assert.equal(outcome.kind, 'timeout');
  assert.match(timeoutNotice(outcome.budgetMs), /over 300 ms/);
  assert.doesNotMatch(timeoutNotice(outcome.budgetMs), /1500/);
  assert.equal(timeoutNotice(RENDER_BUDGET_MS), TIMEOUT_NOTICE);
});
