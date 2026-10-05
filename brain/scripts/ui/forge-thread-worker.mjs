// forge-thread-worker.mjs — the worker entry of `forge-thread.mjs` (#1257 D63).
//
// Loads `resolve.module`'s `resolve.export` ONCE, with `resolve.workerData`, then serves
// `{id, verb, args}` requests in order. A resolution that fails is not a crash: it is the
// reason every call is rejected with, which is what the poller records as the lane's failure.

import { parentPort, workerData } from 'node:worker_threads';

import { FORGE_VERBS } from './forge-thread.mjs';

const { resolve } = workerData;

const adapter = (async () => {
  const mod = await import(resolve.module);
  const factory = mod[resolve.export];
  if (typeof factory !== 'function') throw new Error(`${resolve.module} exports no function named ${resolve.export}`);
  return factory(resolve.workerData);
})();
adapter.catch(() => {}); // surfaced per call below, never as an unhandled rejection

let queue = Promise.resolve();
parentPort.on('message', ({ id, verb, args }) => {
  queue = queue.then(async () => {
    try {
      if (!FORGE_VERBS.includes(verb)) throw new Error(`"${verb}" is not a verb a forge thread serves`);
      const value = await (await adapter)[verb](args);
      parentPort.postMessage({ id, ok: true, value });
    } catch (err) {
      parentPort.postMessage({ id, ok: false, error: err?.message ?? String(err) });
    }
  });
});
