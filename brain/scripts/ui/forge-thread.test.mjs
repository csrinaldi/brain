import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { EventEmitter } from 'node:events';
import { createServer as createHttpServer } from 'node:http';

import { createForgeThread } from './forge-thread.mjs';
import {
  RELEASE, RESULT, STATUS, RESULT_OK, freePort, startRequester, whenBlocked,
} from './test-support/blocking-forge-adapter.mjs';

const ADAPTERS = new URL('./test-support/blocking-forge-adapter.mjs', import.meta.url).href;
const resolveTo = (name, workerData) => ({ module: ADAPTERS, export: name, workerData });

/** A thread over one of the support adapters, terminated when the test ends. */
function threadFor(t, name, workerData, extra = {}) {
  const thread = createForgeThread({ resolve: resolveTo(name, workerData), ...extra });
  t.after(() => thread.close());
  return thread;
}

test('#1257 D63: a verb round-trips through the worker, arguments in and value out', async (t) => {
  const { port } = threadFor(t, 'createEchoAdapter');
  assert.deepEqual(await port.issueList({ project: 'o/r', state: 'closed' }), [{ echoed: { project: 'o/r', state: 'closed' } }]);
  assert.deepEqual(await port.issueView({ project: 'o/r', number: 7 }), { number: 7, body: 'echo' });
  assert.deepEqual(await port.mrList({ project: 'o/r' }), []);
});

test('#1257 D63: the port is exactly the four read verbs', (t) => {
  const { port } = threadFor(t, 'createEchoAdapter');
  assert.deepEqual(Object.keys(port).sort(), ['issueList', 'issueView', 'mrList', 'prReviews']);
});

test('#1257 D63: a rejected call carries the adapter\'s error message', async (t) => {
  const { port } = threadFor(t, 'createEchoAdapter');
  await assert.rejects(() => port.prReviews({ project: 'o/r', number: 1 }), /^Error: reviews exploded$/);
  assert.deepEqual(await port.mrList({ project: 'o/r' }), [], 'one rejected call does not poison the thread');
});

test('#1257 D63: a failed resolution rejects every call with its reason', async (t) => {
  const { port } = threadFor(t, 'createBrokenFactory');
  await assert.rejects(() => port.issueList({ project: 'o/r' }), /no such provider/);
  await assert.rejects(() => port.mrList({ project: 'o/r' }), /no such provider/);
});

test('#1257 D63: a module that cannot be loaded is a rejection too, not a crash', async (t) => {
  const thread = createForgeThread({ resolve: { module: new URL('./test-support/does-not-exist.mjs', import.meta.url).href, export: 'x' } });
  t.after(() => thread.close());
  await assert.rejects(() => thread.port.issueList({}), /./);
});

test('#1257 D63: close() terminates the worker and later calls reject', async () => {
  const workers = [];
  class SpyWorker extends Worker { constructor(...args) { super(...args); workers.push(this); } }
  const thread = createForgeThread({ resolve: resolveTo('createEchoAdapter'), _Worker: SpyWorker });
  assert.deepEqual(await thread.port.mrList({}), []);
  await thread.close();
  assert.equal(workers[0].threadId, -1, 'the worker has exited');
  await assert.rejects(() => thread.port.mrList({}), /closed/);
});

test('#1257 D63: a call in flight when the thread closes is rejected, not left pending', async () => {
  class SilentWorker extends EventEmitter {
    postMessage() {} // never answers
    unref() {}
    async terminate() { this.emit('exit', 1); }
  }
  const thread = createForgeThread({ resolve: resolveTo('createEchoAdapter'), _Worker: SilentWorker });
  const pending = thread.port.mrList({});
  await thread.close();
  await assert.rejects(() => pending, /closed/);
});

test('#1257 D63: a bare HTTP server on this thread answers GET / while the thread\'s adapter blocks', async (t) => {
  const sab = new SharedArrayBuffer(16);
  const slots = new Int32Array(sab);
  const http = createHttpServer((req, res) => { res.writeHead(200); res.end('ok'); });
  const port = await freePort();
  await new Promise((resolve) => http.listen(port, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => http.close(resolve)));
  const requester = startRequester({ sab, port });
  t.after(() => requester.worker.terminate());
  const thread = threadFor(t, 'createBlockingAdapter', { sab });

  await thread.port.issueList({}); // blocks the THREAD until the requester has been answered
  await requester.done;
  assert.equal(Atomics.load(slots, STATUS), 200, 'this thread was free to answer');
  assert.equal(Atomics.load(slots, RESULT), RESULT_OK, 'and that answer is what released the adapter');
});

test('#1257 R1257-9: a blocked thread does not delay a second thread\'s issueList', async (t) => {
  const sab = new SharedArrayBuffer(16);
  const slots = new Int32Array(sab);
  const closedLane = threadFor(t, 'createBlockingAdapter', { sab });
  const openLane = threadFor(t, 'createEchoAdapter');

  const held = closedLane.port.issueList({ state: 'closed' });
  await whenBlocked(slots);
  const answered = await openLane.port.issueList({ state: 'open' });
  assert.equal(answered.length, 1, 'the open thread answered');
  assert.equal(Atomics.load(slots, RELEASE), 0, 'while the closed thread was still blocked');

  Atomics.store(slots, RELEASE, 1);
  Atomics.notify(slots, RELEASE);
  await held;
  assert.equal(Atomics.load(slots, RESULT), RESULT_OK);
});
