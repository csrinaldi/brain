// dom.test.mjs — the harness has to be right about the browser, or every test
// that trusts it is worth nothing (#1059).
//
// This file exists because the shim once disagreed with the DOM and every
// suite still passed: it agreed with ITSELF. The disagreement was found by
// driving the live page by hand, which is exactly the work the harness was
// built to remove, so the behaviour is pinned here.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createElement, fire, listens, find, findAll, byClass, installDom } from './dom.mjs';

test('#1059: assigning textContent leaves a text node, so a later appendChild does not erase it', () => {
  // THE DEFECT. `renderGovernanceNav` builds a button as
  // `el('button', null, 'Verdict queue')` and then appends a count span. In a
  // browser the button reads "Verdict queue (1)". The shim kept the assigned
  // string in a field beside the children and returned it only when there were
  // none, so the label vanished the moment anything was appended and the
  // button read " (1)".
  const button = createElement('button');
  button.textContent = 'Verdict queue';
  const count = createElement('span');
  count.textContent = ' (1)';
  button.appendChild(count);

  assert.equal(button.textContent, 'Verdict queue (1)', 'both halves survive, in order');
});

test('#1059: assigning textContent replaces whatever was there, as the DOM does', () => {
  const node = createElement('div');
  node.appendChild(createElement('span')).textContent = 'old';
  node.textContent = 'new';
  assert.equal(node.textContent, 'new');
  assert.equal(node.childNodes.length, 1, 'one text node, not the old element beside it');
});

test('#1059: an empty assignment leaves no child, and reads back empty', () => {
  const node = createElement('div');
  node.textContent = 'something';
  node.textContent = '';
  assert.equal(node.textContent, '');
  assert.equal(node.childNodes.length, 0);
});

test('#1059: nested text concatenates depth first, in document order', () => {
  const row = createElement('div');
  const a = createElement('span');
  a.textContent = 'a';
  const wrap = createElement('span');
  const b = createElement('em');
  b.textContent = 'b';
  wrap.appendChild(b);
  row.appendChild(a);
  row.appendChild(wrap);
  assert.equal(row.textContent, 'ab');
});

test('#1059: a fragment hands over its children and keeps none', () => {
  const frag = createElement('#fragment');
  const one = createElement('span');
  one.textContent = '1';
  const two = createElement('span');
  two.textContent = '2';
  frag.appendChild(one);
  frag.appendChild(two);

  const host = createElement('div');
  host.appendChild(frag);
  assert.equal(host.childNodes.length, 2);
  assert.equal(frag.childNodes.length, 0, 'the fragment is spent, as in the DOM');
  assert.equal(host.textContent, '12');
});

test('#1059: classList writes through className, so both views of a class agree', () => {
  const node = createElement('div');
  node.className = 'card';
  node.classList.add('selected');
  assert.equal(node.className, 'card selected');
  assert.ok(node.classList.contains('card'));
  node.classList.remove('card');
  assert.equal(node.className, 'selected');
  assert.ok(byClass('selected')(node));
  assert.ok(!byClass('card')(node));
});

test('#1059: fire runs the listeners a node was given, and refuses a node that has none', () => {
  const node = createElement('button');
  let calls = 0;
  node.addEventListener('click', () => { calls += 1; });
  assert.ok(listens(node, 'click'));
  assert.ok(!listens(node, 'keydown'));
  fire(node, 'click');
  assert.equal(calls, 1);

  // A test that fires at a node with no handler is asserting nothing. It must
  // fail loudly rather than pass quietly.
  assert.throws(() => fire(node, 'keydown'), /no keydown listener/);
});

test('#1059: find walks the tree depth first and find returns the first match', () => {
  const root = createElement('div');
  const first = createElement('span');
  first.className = 'hit';
  const branch = createElement('div');
  const second = createElement('span');
  second.className = 'hit';
  branch.appendChild(second);
  root.appendChild(first);
  root.appendChild(branch);

  assert.equal(findAll(root, byClass('hit')).length, 2);
  assert.equal(find(root, byClass('hit')), first);
});

test('#1059: installDom restores every global it replaced', () => {
  const before = { document: globalThis.document, fetch: globalThis.fetch, EventSource: globalThis.EventSource };
  const dom = installDom({ mountIds: ['canvas'] });
  assert.notEqual(globalThis.document, before.document, 'the shim is installed');
  dom.restore();
  assert.equal(globalThis.document, before.document, 'and taken back out — a harness that leaks its globals poisons every later test in the run');
  assert.equal(globalThis.fetch, before.fetch);
  assert.equal(globalThis.EventSource, before.EventSource);
});

// ── #1218: a Worker for the page to spawn ──

test('#1218: by default the page gets a Worker that answers with the real reply, off the call stack', async () => {
  const dom = installDom({ mountIds: [] });
  try {
    assert.equal(typeof globalThis.Worker, 'function');
    const worker = new globalThis.Worker('/lib/markdown-worker.mjs', { type: 'module' });
    assert.equal(dom.workers.length, 1);
    const got = new Promise((resolve) => { worker.onmessage = (event) => resolve(event.data); });
    worker.postMessage({ id: 9, text: '# hi' });
    assert.equal(dom.workers[0].posted.length, 1, 'recorded synchronously');
    const data = await got;
    assert.equal(data.id, 9);
    assert.equal(data.ok, true);
    assert.equal(data.tree.blocks[0].t, 'heading');
    worker.terminate();
    assert.equal(dom.workers[0].terminated, 1);
  } finally {
    dom.restore();
  }
});

test('#1218: hold mode never answers until the test releases it', async () => {
  const dom = installDom({ mountIds: [], worker: 'hold' });
  try {
    const worker = new globalThis.Worker('/x', { type: 'module' });
    let answered = false;
    worker.onmessage = () => { answered = true; };
    worker.postMessage({ id: 1, text: 'a' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(answered, false);
    dom.workers[0].release();
    assert.equal(answered, true);
  } finally {
    dom.restore();
  }
});

test('#1218: null removes the Worker global and restore puts the previous one back', () => {
  const before = globalThis.Worker;
  const dom = installDom({ mountIds: [], worker: null });
  assert.equal(globalThis.Worker, undefined);
  dom.restore();
  assert.equal(globalThis.Worker, before);
});

test('#1218: the failing modes throw on construction, error, or send junk', async () => {
  let dom = installDom({ mountIds: [], worker: 'throw' });
  try { assert.throws(() => new globalThis.Worker('/x'), /cannot construct/); } finally { dom.restore(); }

  dom = installDom({ mountIds: [], worker: 'error' });
  try {
    const worker = new globalThis.Worker('/x');
    const got = new Promise((resolve) => { worker.onerror = resolve; });
    worker.postMessage({ id: 1, text: 'a' });
    await got;
  } finally { dom.restore(); }

  dom = installDom({ mountIds: [], worker: 'malformed' });
  try {
    const worker = new globalThis.Worker('/x');
    const got = new Promise((resolve) => { worker.onmessage = (event) => resolve(event.data); });
    worker.postMessage({ id: 1, text: 'a' });
    assert.equal(typeof (await got).tree, 'string');
  } finally { dom.restore(); }
});

test('#1218: childNodes is a NodeList, not an Array — no find, filter, map, some, every, reduce, includes, indexOf', () => {
  // A browser's NodeList has forEach, item, entries, keys, values, length, index
  // access and iteration, and nothing else. A shim that handed the page an Array
  // let `childNodes.find` pass every test and throw in the browser.
  const host = createElement('div');
  host.appendChild(createElement('span'));
  host.appendChild(createElement('em'));
  const list = host.childNodes;

  assert.equal(Array.isArray(list), false);
  for (const name of ['find', 'filter', 'map', 'some', 'every', 'reduce', 'includes', 'indexOf', 'push', 'slice']) {
    assert.equal(list[name], undefined, `a NodeList has no ${name}`);
  }
  assert.equal(list.length, 2);
  assert.equal(list[0].tagName, 'SPAN');
  assert.equal(list[2], undefined);
  assert.equal(list.item(1).tagName, 'EM');
  assert.equal(list.item(5), null);
  const seen = [];
  list.forEach((node, index) => seen.push(`${index}:${node.tagName}`));
  assert.deepEqual(seen, ['0:SPAN', '1:EM']);
  assert.deepEqual([...list].map((n) => n.tagName), ['SPAN', 'EM']);
  assert.deepEqual(Array.from(list.entries()).map(([i, n]) => `${i}:${n.tagName}`), ['0:SPAN', '1:EM']);
  assert.deepEqual(Array.from(list.keys()), [0, 1]);
  assert.deepEqual(Array.from(list.values()).map((n) => n.tagName), ['SPAN', 'EM']);
});

test('#1218: childNodes is live, as a browser NodeList is', () => {
  const host = createElement('div');
  const list = host.childNodes;
  host.appendChild(createElement('span'));
  assert.equal(list.length, 1, 'the same list sees the append');
  host.textContent = '';
  assert.equal(list.length, 0);
});

test('#1218: the page never calls an Array method on childNodes — a NodeList has none', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../static/app.js', import.meta.url), 'utf8');
  const hits = source.split('\n')
    .map((line, i) => ({ line: i + 1, text: line }))
    .filter(({ text }) => /childNodes\.(find|filter|map|some|every|reduce|includes|indexOf)\b/.test(text));
  assert.deepEqual(hits, [], 'childNodes is a NodeList in a browser: iterate it with for...of, forEach or index access');
});

test('#1313: insertBefore puts a child ahead of its reference, null appends, and nextSibling reads the order back', () => {
  const body = createElement('tbody');
  const a = body.appendChild(createElement('tr'));
  const c = body.appendChild(createElement('tr'));
  const b = createElement('tr');
  body.insertBefore(b, a.nextSibling);
  assert.deepEqual(body.childNodes.length, 3);
  assert.equal(a.nextSibling, b);
  assert.equal(b.nextSibling, c);
  assert.equal(c.nextSibling, null);
  assert.equal(b.parentNode, body);
  const d = createElement('tr');
  body.insertBefore(d, c.nextSibling);
  assert.equal(c.nextSibling, d, 'a null reference appends');
  body.removeChild(b);
  assert.equal(a.nextSibling, c);
  assert.throws(() => body.insertBefore(createElement('tr'), createElement('tr')), /not a child/);
});

test('#1313: `records` answers /api/record/<id>, logs the path, and a held answer waits until released', async () => {
  let release;
  const held = new Promise((r) => { release = r; });
  const dom = installDom({ mountIds: ['canvas'], records: { 'rec-a': { ok: true, content: 'x' }, 'rec-held': () => held.then(() => ({ ok: true, content: 'later' })), 'rec-bad': { status: 500, body: { ok: false, reason: 'boom' } } } });
  try {
    assert.deepEqual(await (await fetch('/api/record/rec-a')).json(), { ok: true, content: 'x' });
    const res = await fetch('/api/record/rec-bad');
    assert.equal(res.status, 500);
    assert.equal((await fetch('/api/record/rec-none')).status, 404);
    let settled = false;
    const pending = fetch('/api/record/rec-held').then((r) => { settled = true; return r.json(); });
    await new Promise((r) => setImmediate(r));
    assert.equal(settled, false);
    release();
    assert.deepEqual(await pending, { ok: true, content: 'later' });
    assert.deepEqual(dom.recordFetches, ['/api/record/rec-a', '/api/record/rec-bad', '/api/record/rec-none', '/api/record/rec-held']);
  } finally {
    dom.restore();
  }
});

// ── #1330: a scroller has a clientHeight and clamps scrollTop. SYNTHETIC: it models the one clamp, not a browser. ──

const tall = (lines) => {
  const body = createElement('div');
  for (let i = 0; i < lines; i += 1) body.appendChild(createElement('p')); // one line (20) each
  return body;
};

test('#1330: with no clientHeight an element is not a scroller; its scrollTop is a plain number', () => {
  const body = tall(3);
  assert.equal(body.clientHeight, 0);
  body.scrollTop = 500;
  assert.equal(body.scrollTop, 500, 'unchanged behaviour for every element that is not a scroller');
});

test('#1330: a scroller clamps scrollTop to [0, flowHeight - clientHeight]', () => {
  const body = tall(10); // 200 tall
  body.clientHeight = 80;
  assert.equal(body.scrollHeight, 200);
  body.scrollTop = 50;
  assert.equal(body.scrollTop, 50);
  body.scrollTop = 999;
  assert.equal(body.scrollTop, 120, '200 - 80');
  body.scrollTop = -5;
  assert.equal(body.scrollTop, 0);
});

test('#1330: a content shorter than its scroller cannot scroll at all', () => {
  const body = tall(2);
  body.clientHeight = 300;
  body.scrollTop = 40;
  assert.equal(body.scrollTop, 0);
});

test('#1330: min-height pads the flow, so padding a short last child makes its top reachable', () => {
  const body = tall(10);
  body.clientHeight = 100;
  const last = body._kids[9];
  assert.equal(last.getBoundingClientRect().top, 180);
  body.scrollTop = 180;
  assert.equal(body.scrollTop, 100, 'unpadded: the browser stops at 200 - 100, so the last child is stuck below the top');
  last.style.minHeight = '100px';
  body.scrollTop = 180;
  assert.equal(body.scrollTop, 180, 'padded to one body height: 280 - 100');
  assert.equal(last.getBoundingClientRect().top - body.getBoundingClientRect().top, 0);
});

test('#1330: installDom({ scrollers }) gives every element with that class a clientHeight, and restore() forgets it', () => {
  const dom = installDom({ mountIds: ['canvas'], scrollers: { 'drawer-body': 400 } });
  try {
    const body = createElement('div');
    body.className = 'drawer-body';
    assert.equal(body.clientHeight, 400);
    assert.equal(createElement('div').clientHeight, 0, 'other elements are not scrollers');
  } finally {
    dom.restore();
  }
  const after = createElement('div');
  after.className = 'drawer-body';
  assert.equal(after.clientHeight, 0, 'the configuration does not leak into the next test');
});
