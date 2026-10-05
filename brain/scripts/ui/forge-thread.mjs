// forge-thread.mjs — one worker thread per forge lane (#1257 D63, R11).
//
// Every forge verb ends in a `spawnSync` (`vcs/lib/exec.mjs`), so an adapter call BLOCKS the
// thread it runs on. On the server's thread that meant no HTTP request was answered while the
// poller listed issues. A forge thread runs the adapter in a `node:worker_threads` worker and
// hands the server a port with the four read verbs, each a promise over a message exchange:
// the event loop that serves the page never waits on a spawn.
//
// One thread per lane, never one shared: a lane that blocks (the closed list is one spawn of
// seconds) must not queue the other behind it. `vcs/lib/exec.mjs` stays synchronous on purpose;
// it is the seam under every verb and every CLI caller.

import { Worker } from 'node:worker_threads';

/** The only verbs a thread serves: the four the poller reads. A write verb is not reachable through it. */
export const FORGE_VERBS = ['issueList', 'mrList', 'issueView', 'prReviews'];

const WORKER_URL = new URL('./forge-thread-worker.mjs', import.meta.url);
const CLOSED_REASON = 'the forge thread is closed';

/** What the worker loads by default: the production resolver, `getVcs` from `vcs/cli.mjs`. */
export const PRODUCTION_RESOLVE = { module: new URL('../vcs/cli.mjs', import.meta.url).href, export: 'getVcs' };

/**
 * Message shapes, named once. Request: `{id, verb, args}`. Reply: `{id, ok:true, value}` or
 * `{id, ok:false, error}`, where `error` is the adapter's own message.
 *
 * @param {{resolve?: {module: string, export: string, workerData?: unknown}, _Worker?: typeof Worker}} [opts]
 * @returns {{port: Record<string, Function>, close: () => Promise<void>}}
 */
export function createForgeThread({ resolve = PRODUCTION_RESOLVE, _Worker = Worker } = {}) {
  const calls = new Map(); // id -> {resolve, reject}
  let nextId = 0;
  let endedBy = null; // once set, every later call rejects with it

  const worker = new _Worker(WORKER_URL, { workerData: { resolve } });
  // An idle thread must never be the reason a process stays alive: the server's own listener is.
  worker.unref();

  function rejectAll(reason) {
    for (const { reject } of calls.values()) reject(new Error(reason));
    calls.clear();
  }

  worker.on('message', ({ id, ok, value, error }) => {
    const call = calls.get(id);
    if (!call) return;
    calls.delete(id);
    if (ok) call.resolve(value); else call.reject(new Error(error));
  });
  worker.on('error', (err) => { endedBy ??= `the forge thread failed: ${err?.message ?? err}`; rejectAll(endedBy); });
  worker.on('exit', () => { endedBy ??= 'the forge thread exited'; rejectAll(endedBy); });

  const call = (verb, args) => new Promise((resolveCall, reject) => {
    if (endedBy) { reject(new Error(endedBy)); return; }
    const id = ++nextId;
    calls.set(id, { resolve: resolveCall, reject });
    worker.postMessage({ id, verb, args });
  });

  return {
    port: Object.fromEntries(FORGE_VERBS.map((verb) => [verb, (args) => call(verb, args)])),
    async close() {
      endedBy ??= CLOSED_REASON;
      rejectAll(CLOSED_REASON);
      await worker.terminate();
    },
  };
}
