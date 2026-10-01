// markdown-worker.test.mjs — the worker half of the off-thread render (#1218).
// `reply` is the pure protocol; the real worker file runs under worker_threads
// through the shim and must return what the in-process adapter returns.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { reply } from './markdown-worker.mjs';
import { markdownTree } from './markdown.mjs';
import { nodeWebWorker } from '../test-support/node-web-worker.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// Every construct of the R1198-6 subset, plus a degraded passage.
const FIXTURE = [
  '---', 'status: draft', '---', '',
  '# Heading', '',
  'para with **strong**, _em_, ~~del~~, `code`, a [link](https://example.com/x), an [inert](./x.md) one,',
  'a hard break  ', 'and ![alt](https://example.com/i.png).', '',
  '- [x] done', '- [ ] open', '  - nested', '', '3. one', '4. two', '',
  '> quote', '',
  '| a | b |', '|:-|-:|', '| 1 | 2 |', '',
  '```js', 'const x = 1;', '```', '', '---', '',
  '<div>html</div>', '',
  'a*'.repeat(700),
].join('\n');

function viaWorker(text) {
  const worker = nodeWebWorker('/lib/markdown-worker.mjs');
  const t0 = performance.now();
  return new Promise((resolve, reject) => {
    worker.onmessage = (event) => {
      const startupMs = performance.now() - t0;
      worker.terminate();
      resolve({ message: event.data, startupMs });
    };
    worker.onerror = reject;
    worker.postMessage({ id: 7, text });
  });
}

test('#1218 R1218-4: reply returns the tree under the request id', () => {
  const out = reply({ id: 3, text: '# t' });
  assert.deepEqual(out, { id: 3, ok: true, tree: markdownTree('# t') });
});

test('#1218 R1218-4: reply reports a throw as ok:false with a message', () => {
  const out = reply({ id: 4, text: 'x' }, () => { throw new RangeError('boom'); });
  assert.equal(out.id, 4);
  assert.equal(out.ok, false);
  assert.match(out.error, /boom/);
});

test('#1218 R1218-4: the real worker returns the in-process tree for every construct', async (t) => {
  const { message, startupMs } = await viaWorker(FIXTURE);
  t.diagnostic(`worker startup to first reply: ${Math.round(startupMs)} ms`);
  assert.equal(message.id, 7);
  assert.equal(message.ok, true);
  assert.deepEqual(message.tree, markdownTree(FIXTURE));
  assert.ok(JSON.stringify(message.tree).includes('"degraded"'));
  assert.deepEqual(structuredClone(message.tree), message.tree);
});

test('#1218 R1218-4: the real worker returns the in-process tree for a real artifact', async () => {
  const text = readFileSync(join(HERE, '..', '..', '..', '..', 'openspec', 'changes', 'issue-1218-sdd-reader-bounded-time', 'spec.md'), 'utf8');
  const { message } = await viaWorker(text);
  assert.deepEqual(message.tree, markdownTree(text));
});
