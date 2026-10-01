// node-web-worker.mjs — runs a browser-style worker file under worker_threads
// (#1218). The worker file talks to `globalThis.postMessage` and
// `globalThis.onmessage`; this shim provides both and bridges them to the
// parent. Test support only; it is not served.

import { Worker } from 'node:worker_threads';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const UI_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const BOOTSTRAP = `
const { parentPort, workerData } = require('node:worker_threads');
globalThis.postMessage = (message) => parentPort.postMessage(message);
const ready = import(workerData.file);
parentPort.on('message', async (data) => {
  await ready;
  globalThis.onmessage({ data });
});
`;

/** A Worker-shaped object for a page path such as '/lib/markdown-worker.mjs'. */
export function nodeWebWorker(pagePath) {
  const file = pathToFileURL(join(UI_ROOT, pagePath)).href;
  const thread = new Worker(BOOTSTRAP, { eval: true, workerData: { file } });
  const worker = {
    onmessage: null,
    onerror: null,
    postMessage: (message) => thread.postMessage(message),
    terminate: () => thread.terminate(),
    exited: new Promise((resolve) => thread.once('exit', resolve)),
  };
  thread.on('message', (data) => worker.onmessage?.({ data }));
  thread.on('error', (error) => worker.onerror?.(error));
  return worker;
}
