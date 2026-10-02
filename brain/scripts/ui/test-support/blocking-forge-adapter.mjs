// blocking-forge-adapter.mjs — a forge adapter whose `issueList` BLOCKS ITS THREAD (#1257 D63).
//
// The production adapters block their thread too: every verb ends in a `spawnSync`. This one
// does it deterministically, with `Atomics.wait`, so a test can prove that a server stays
// responsive while an adapter blocks without measuring any time:
//
//   slot 0  BLOCKED — the adapter stores 1 and notifies when its `issueList` starts waiting
//   slot 1  RELEASE — whoever may unblock the adapter stores 1 and notifies
//   slot 2  RESULT  — the adapter records RESULT_OK or RESULT_TIMED_OUT when its wait ends
//   slot 3  STATUS  — free for the test (the helper stores the HTTP status it saw)
//
// The wait's timeout is a deadlock guard that only a FAILING run reaches. No assertion depends
// on how long anything took, only on which of the two outcomes was recorded.

import { Worker } from 'node:worker_threads';
import { createServer as createNetServer } from 'node:net';

export const BLOCKED = 0;
export const RELEASE = 1;
export const RESULT = 2;
export const STATUS = 3;
export const RESULT_OK = 1;
export const RESULT_TIMED_OUT = 2;
// Sized for a CI runner (3x a local run); a passing run never waits this long.
export const DEADLOCK_GUARD_MS = 6000;

/** The factory a forge thread loads: `workerData` is `{sab}`, a SharedArrayBuffer of at least 4 Int32 slots. */
export function createBlockingAdapter({ sab } = {}) {
  const slots = new Int32Array(sab);
  return {
    async issueList() {
      Atomics.store(slots, BLOCKED, 1);
      Atomics.notify(slots, BLOCKED);
      const outcome = Atomics.wait(slots, RELEASE, 0, DEADLOCK_GUARD_MS);
      Atomics.store(slots, RESULT, outcome === 'timed-out' ? RESULT_TIMED_OUT : RESULT_OK);
      return [];
    },
    async mrList() { return []; },
    async issueView() { return { body: '', assignees: null }; },
    async prReviews() { return []; },
  };
}

/** Small adapters for the thread tests that must NOT block: one answers, one fails a verb, one cannot be built. */
export function createEchoAdapter() {
  return {
    async issueList(args) { return [{ echoed: args }]; },
    async mrList() { return []; },
    async issueView({ number }) { return { number, body: 'echo' }; },
    async prReviews() { throw new Error('reviews exploded'); },
  };
}
export function createBrokenFactory() { throw new Error('no such provider'); }

/** A port the OS just reported free. Another process could take it before it is bound: the test then fails on EADDRINUSE, never passes falsely. */
export const freePort = () => new Promise((resolve, reject) => {
  const probe = createNetServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
});

/** Resolves once the adapter has started blocking (slot 0), without polling and without a clock. */
export async function whenBlocked(slots) {
  return Atomics.waitAsync(slots, BLOCKED, 0, DEADLOCK_GUARD_MS).value; // a promise, or 'not-equal' when it already blocked
}

/** A worker that waits for the adapter to block, requests GET /, stores the status and releases the adapter. */
export function startRequester({ sab, port }) {
  const code = `
    const { workerData: { sab, port, BLOCKED, RELEASE, STATUS, GUARD } } = require('node:worker_threads');
    const slots = new Int32Array(sab);
    Atomics.wait(slots, BLOCKED, 0, GUARD);
    fetch('http://127.0.0.1:' + port + '/')
      .then((res) => Atomics.store(slots, STATUS, res.status))
      .catch(() => Atomics.store(slots, STATUS, -1))
      .finally(() => { Atomics.store(slots, RELEASE, 1); Atomics.notify(slots, RELEASE); });
  `;
  const worker = new Worker(code, { eval: true, workerData: { sab, port, BLOCKED, RELEASE, STATUS, GUARD: DEADLOCK_GUARD_MS } });
  const done = new Promise((resolve, reject) => { worker.once('exit', resolve); worker.once('error', reject); });
  return { worker, done };
}
