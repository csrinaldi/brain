// markdown-render.test.mjs — an SDD stage row expands into its document, drawn
// by the REAL app.js on the fake DOM (#1198). The hostile fixture is the
// proposal, so every assertion about elements, attributes and links is made
// on what the page actually built, not on the tree that fed it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSnapshot } from '../../status/snapshot.mjs';
import { buildChangeView } from '../change-route.mjs';
import { testTmp } from '../../lib/test-tmp.mjs';
import { installDom, fire, find, findAll, byClass } from '../test-support/dom.mjs';
import { loadApp, settle } from '../test-support/load-app.mjs';
import { fakeGit } from '../test-support/fake-git.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const XSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'test-support', 'fixtures', 'markdown-xss.txt'), 'utf8');
const MOUNT_IDS = ['status', 'modes', 'search', 'banners', 'governance-nav', 'canvas', 'drawer'];
const ISSUE = 1198;
const DIR = 'openspec/changes/issue-1198-sdd-artifact-reader';
const HEAD = 'abc1234'.padEnd(40, '0');
const TIP = 'def5678'.padEnd(40, '0');
const BRANCH = 'feat/issue-1198-reader';
const ISSUES = [{ number: ISSUE, title: 'feat(ui): every SDD artifact is readable', labels: ['status:approved'], body: ['## What it is', '', '```brain-graph/1', 'track:    UI', 'blocks:   []', 'needs:    []', '```', ''].join('\n') }];

const RICH = [
  '# Title', '', 'para with `code` and **bold** and [rel](./design.md)', '',
  '- [x] done', '- [ ] open', '', '3. three', '4. four', '',
  '| a | b |', '|:-|-:|', '| 1 | 2 |', '', '> quote', '', '---', '', '```js', '<b>raw</b>', '```', '',
  'struck ~~gone~~ then a hard break  ', 'next line', '',
].join('\n');

async function boot({ proposal = XSS, resume = '---\nnext_action: go\n---\n\nresume **body**\n', design, worker } = {}) {
  const root = testTmp('md-render-');
  writeFileSync(join(root, 'brain.config.json'), readFileSync(join(REPO, 'brain.config.json'), 'utf8'));
  mkdirSync(join(root, DIR), { recursive: true });
  const files = { [`${DIR}/proposal.md`]: proposal, [`${DIR}/spec.md`]: '# Spec\n', [`${DIR}/tasks.md`]: '- [x] a\n' };
  if (design !== undefined) files[`${DIR}/design.md`] = design;
  for (const [path, text] of Object.entries(files)) writeFileSync(join(root, path), text);
  const vcs = {
    async issueList() { return ISSUES.map(({ number, title, labels }) => ({ number, title, labels, assignees: [] })); },
    async issueView() { return { body: ISSUES[0].body, assignees: [] }; },
  };
  const snapshot = await buildSnapshot({ root, project: 'csrinaldi/brain', vcs, now: '2026-09-19T12:00:00.000Z', _run: () => { throw new Error('no git'); } });
  const run = fakeGit({ files, head: HEAD, branches: { [BRANCH]: { commit: TIP, files: { [`${DIR}/proposal.md`]: proposal, ...(resume === null ? {} : { [`${DIR}/resume.md`]: resume }) } } } });
  snapshot.prs = { ok: true, value: [{ number: 5, title: 'x', headBranch: BRANCH, issue: ISSUE }] };
  const changes = { [ISSUE]: buildChangeView({ root, issue: ISSUE, snapshot, _run: run }) };
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot, changes, ...(worker === undefined ? {} : { worker }) });
  await loadApp();
  await settle();
  return dom;
}

async function openSdd(dom) {
  const card = findAll(dom.mounts.canvas, byClass('node-card')).find((c) => c.getAttribute('data-issue') === String(ISSUE));
  fire(card, 'click');
  await settle();
  const tabs = find(dom.mounts.drawer, byClass('tabs'));
  fire(Array.from(tabs.childNodes).find((b) => b.textContent.includes('SDD')), 'click');
  await settle();
}

const rows = (dom) => findAll(dom.mounts.drawer, byClass('card'));
const toggleOf = (dom, name) => {
  const row = rows(dom).find((r) => find(r, byClass('stage-name'))?.textContent === name);
  return { row, button: row && find(row, byClass('doc-toggle')) };
};
const all = (root) => findAll(root, () => true);

test('#1198 R1198-1/2: a readable document gets a native toggle; missing and unreadable say so and get no button', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  await openSdd(dom);

  const proposal = toggleOf(dom, 'proposal');
  assert.equal(proposal.button.tagName, 'BUTTON');
  assert.equal(proposal.button.getAttribute('aria-expanded'), 'false');
  assert.equal(proposal.button.getAttribute('aria-controls'), `doc-${ISSUE}-proposal`);

  const design = toggleOf(dom, 'design');
  assert.equal(design.button, null);
  assert.match(design.row.textContent, /design\.md is not committed at HEAD/);
  const archive = toggleOf(dom, 'archive');
  assert.equal(archive.button, null, 'archive is a stage, not a document');
  assert.doesNotMatch(archive.row.textContent, /not committed|could not be read/);
  assert.equal(findAll(dom.mounts.drawer, byClass('tabs'))[0].childNodes.length, 6, 'no tab was added');
});

test('#1198 R1198-1/5/16: expanding appends a labelled region with stamp, path and commit; collapsing removes it; the drawer is not re-rendered', async (t) => {
  const dom = await boot({ proposal: RICH });
  t.after(() => dom.restore());
  await openSdd(dom);

  const { row, button } = toggleOf(dom, 'proposal');
  assert.equal(find(row, (n) => n.tagName === 'SECTION'), null, 'lazy: nothing rendered before the first expansion');
  const drawerBefore = dom.mounts.drawer.childNodes.length;
  fire(button, 'click');
  await settle();
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  const region = find(row, (n) => n.tagName === 'SECTION');
  assert.equal(region.getAttribute('role'), 'region');
  assert.equal(region.getAttribute('id'), `doc-${ISSUE}-proposal`);
  const stamp = `${DIR}/proposal.md @ ${HEAD.slice(0, 12)}`;
  assert.equal(region.getAttribute('aria-label'), stamp);
  assert.match(region.textContent, new RegExp(`${DIR}/proposal\\.md`));
  assert.match(region.textContent, new RegExp(HEAD.slice(0, 12)));
  assert.equal(dom.mounts.drawer.childNodes.length, drawerBefore, 'the click toggled in place and did not rebuild the drawer');
  assert.ok(row.parentNode, 'the row node itself survived, so focus survives');

  fire(button, 'click');
  await settle();
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(find(row, (n) => n.tagName === 'SECTION'), null);
});

test('#1198 R1198-16: the expanded state survives a drawer re-render (a tab switch and back)', async (t) => {
  const dom = await boot({ proposal: RICH });
  t.after(() => dom.restore());
  await openSdd(dom);
  fire(toggleOf(dom, 'proposal').button, 'click');
  await settle();
  const tabs = Array.from(find(dom.mounts.drawer, byClass('tabs')).childNodes);
  fire(tabs.find((b) => b.textContent.includes('Tasks')), 'click');
  fire(Array.from(find(dom.mounts.drawer, byClass('tabs')).childNodes).find((b) => b.textContent.includes('SDD')), 'click');
  await settle();
  const again = toggleOf(dom, 'proposal');
  assert.equal(again.button.getAttribute('aria-expanded'), 'true');
  assert.ok(find(again.row, (n) => n.tagName === 'SECTION'));
});

test('#1198 R1198-6: the page maps blocks to elements — headings, lists, task marks, tables, code, quote, hr, del, br, inert links', async (t) => {
  const dom = await boot({ proposal: RICH });
  t.after(() => dom.restore());
  await openSdd(dom);
  const { row, button } = toggleOf(dom, 'proposal');
  fire(button, 'click');
  await settle();
  const tags = (tag) => findAll(row, (n) => n.tagName === tag);
  assert.equal(tags('H3').length, 1, 'a level-1 heading is h3, under the drawer title');
  assert.equal(tags('OL')[0].getAttribute('start'), '3');
  assert.equal(tags('UL').length, 1);
  assert.deepEqual(findAll(row, byClass('md-task')).map((n) => n.textContent.trim()), ['☑', '☐']);
  assert.ok(find(row, (n) => n.tagName === 'THEAD'));
  assert.ok(find(row, (n) => n.tagName === 'TBODY'));
  assert.ok(find(row, byClass('md-align-left')) && find(row, byClass('md-align-right')));
  assert.equal(tags('BLOCKQUOTE').length, 1);
  assert.equal(tags('HR').length, 1);
  assert.equal(tags('PRE')[0].textContent, '<b>raw</b>');
  assert.equal(tags('B').length, 0, 'fenced code interprets nothing');
  assert.equal(tags('DEL').length, 1, 'strikethrough is part of the R1198-6 subset');
  assert.equal(tags('DEL')[0].textContent, 'gone');
  assert.equal(tags('BR').length, 1, 'a hard line break is part of the R1198-6 subset');
  const inert = find(row, byClass('md-inert'));
  assert.match(inert.textContent, /rel/);
  assert.equal(find(inert, (n) => n.tagName === 'CODE').textContent, './design.md');
  assert.equal(findAll(row, (n) => n.tagName === 'A').length, 0, 'a relative link is not a link');
  for (const n of all(row)) assert.equal(n.getAttribute?.('title') ?? null, null);
});

test('#1198 R1198-7 to 10/12: the hostile fixture builds no active element, no handler, no style, and only https links', async (t) => {
  const dom = await boot({ proposal: XSS });
  t.after(() => dom.restore());
  await openSdd(dom);
  const { row, button } = toggleOf(dom, 'proposal');
  fire(button, 'click');
  await settle();

  const nodes = all(row);
  for (const n of nodes) {
    assert.ok(!['SCRIPT', 'IMG', 'IFRAME', 'STYLE', 'OBJECT', 'EMBED', 'INPUT'].includes(n.tagName), `${n.tagName} must never be built`);
    for (const name of Object.keys(n.attributes ?? {})) {
      assert.ok(!/^on/i.test(name), `attribute ${name}`);
      assert.notEqual(name, 'style');
    }
  }
  const anchors = nodes.filter((n) => n.tagName === 'A');
  assert.ok(anchors.length >= 2, 'the fixture has live links');
  for (const a of anchors) {
    assert.match(a.getAttribute('href'), /^https?:\/\//);
    assert.equal(a.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(a.getAttribute('target'), '_blank');
    assert.equal(a.getAttribute('referrerpolicy'), 'no-referrer');
  }
  const text = row.textContent;
  assert.ok(text.includes("<script>alert('raw-script')</script>"), 'the script text is visible, as text');
  assert.ok(text.includes('<img src=x onerror=alert(1)>'));
  assert.ok(text.includes('javascript:alert(1)'), 'a refused link shows its target as text');
  assert.ok(text.includes('[image: img]'));
  assert.ok(!anchors.some((a) => /javascript|evil\.example/.test(a.getAttribute('href'))));
});

test('#1198 R1198-14: two renders of the same input build the same structure', async (t) => {
  const shape = (n) => ({ tag: n.tagName, cls: n.className, text: n.childNodes.length === 0 ? n.textContent : undefined, attrs: n.attributes && { ...n.attributes }, kids: Array.from(n.childNodes).map(shape) });
  const a = await boot({ proposal: RICH });
  await openSdd(a);
  fire(toggleOf(a, 'proposal').button, 'click');
  await settle();
  const first = shape(find(toggleOf(a, 'proposal').row, (n) => n.tagName === 'SECTION'));
  a.restore();
  const b = await boot({ proposal: RICH });
  t.after(() => b.restore());
  await openSdd(b);
  fire(toggleOf(b, 'proposal').button, 'click');
  await settle();
  assert.deepEqual(shape(find(toggleOf(b, 'proposal').row, (n) => n.tagName === 'SECTION')), first);
});

test('#1198 R1198-3: a truncated document shows the note beside its text', async (t) => {
  const dom = await boot({ design: `# Big\n${'x'.repeat(300000)}\n` });
  t.after(() => dom.restore());
  await openSdd(dom);
  const { row, button } = toggleOf(dom, 'design');
  fire(button, 'click');
  await settle();
  assert.match(find(row, (n) => n.tagName === 'SECTION').textContent, /truncated at 262144 bytes/);
});

test('#1198 D10: resume.md is reachable from the SDD tab as an unnumbered row and renders its body as markdown', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  await openSdd(dom);
  const row = rows(dom).find((r) => /working memory/.test(r.textContent));
  assert.ok(row, 'the resume row exists');
  assert.equal(find(row, byClass('stage-number')), null, 'unnumbered');
  fire(find(row, byClass('doc-toggle')), 'click');
  await settle();
  const region = find(row, (n) => n.tagName === 'SECTION');
  assert.match(region.textContent, /next_action: go/, 'the frontmatter is shown');
  assert.ok(find(region, (n) => n.tagName === 'STRONG'), 'the body is markdown');
  assert.match(region.getAttribute('aria-label'), new RegExp(`resume\\.md @ ${TIP.slice(0, 12)}`));
});

test('#1198 R1198-2: a branch with no resume.md says it is not committed, with no toggle', async (t) => {
  const dom = await boot({ resume: null });
  t.after(() => dom.restore());
  await openSdd(dom);
  const row = rows(dom).find((r) => /working memory/.test(r.textContent));
  assert.match(row.textContent, new RegExp(`resume\\.md is not committed at ${BRANCH}`));
  assert.equal(find(row, byClass('doc-toggle')), null);
});

// ── #1218: the page renders each document off the main thread, within a budget ──

const LOADING = 'rendering the document…';
const TIMEOUT = 'this document was too slow to render (over 1500 ms) and is shown as plain text';
const FAILED = 'this document could not be rendered and is shown as plain text';
const UNAVAILABLE = 'this browser cannot render this document off the page, so it is shown as plain text';

/** Swap setTimeout around a synchronous action so the page's timers are captured, not run. */
function holdTimers(action) {
  const realSet = globalThis.setTimeout;
  const timers = [];
  globalThis.setTimeout = (fn, ms) => { const handle = { fn, ms }; timers.push(handle); return handle; };
  try { action(); } finally { globalThis.setTimeout = realSet; }
  return timers;
}
const click = (button) => holdTimers(() => fire(button, 'click'));
const sectionOf = (row) => find(row, (n) => n.tagName === 'SECTION');
const hasMd = (row) => find(row, byClass('md')) !== null;
const NOTE_TEXTS = (row) => findAll(row, byClass('note')).map((n) => n.textContent);

test('#1218 R1218-4: expanding creates exactly one worker, two open rows have two distinct workers, a result terminates its worker once', async (t) => {
  const dom = await boot({ proposal: RICH });
  t.after(() => dom.restore());
  await openSdd(dom);
  fire(toggleOf(dom, 'proposal').button, 'click');
  assert.equal(dom.workers.length, 1);
  assert.equal(dom.workers[0].posted[0].text, RICH);
  fire(toggleOf(dom, 'spec').button, 'click');
  assert.equal(dom.workers.length, 2);
  assert.notEqual(dom.workers[0], dom.workers[1]);
  await settle();
  assert.deepEqual(dom.workers.map((w) => w.terminated), [1, 1]);
  assert.ok(hasMd(toggleOf(dom, 'proposal').row));
});

test('#1218 R1218-7: a loading line shows while the worker has not answered and is replaced by the elements', async (t) => {
  const dom = await boot({ proposal: RICH, worker: 'hold' });
  t.after(() => dom.restore());
  await openSdd(dom);
  const { row, button } = toggleOf(dom, 'proposal');
  fire(button, 'click');
  const region = sectionOf(row);
  const loading = find(region, byClass('doc-loading'));
  assert.equal(loading.tagName, 'P');
  assert.equal(loading.textContent, LOADING);
  assert.equal(loading.getAttribute('role'), 'status');
  assert.equal(region.getAttribute('aria-busy'), 'true');
  assert.equal(hasMd(row), false, 'no empty body, no half-rendered body');
  dom.workers[0].release();
  await settle();
  assert.equal(find(region, byClass('doc-loading')), null);
  assert.notEqual(region.getAttribute('aria-busy'), 'true');
  assert.ok(hasMd(row));
});

test('#1218 R1218-5: a click on a hostile document returns at once with the loading line', async (t) => {
  const deepQuote = '>'.repeat(262000);
  const deepList = Array.from({ length: 700 }, (_, i) => `${' '.repeat(i)}- x`).join('\n');
  for (const proposal of [deepQuote, deepList]) {
    const dom = await boot({ proposal, worker: 'hold' });
    const { row, button } = (await openSdd(dom), toggleOf(dom, 'proposal'));
    const t0 = performance.now();
    click(button);
    const ms = performance.now() - t0;
    assert.ok(ms < 100, `the click took ${ms} ms`);
    assert.equal(find(sectionOf(row), byClass('doc-loading')).textContent, LOADING);
    dom.restore();
  }
  assert.ok(t);
});

test('#1218 R1218-5: a worker that never answers is cut at 1500 ms and the whole document is shown as written', async (t) => {
  const dom = await boot({ proposal: RICH, worker: 'hold' });
  t.after(() => dom.restore());
  await openSdd(dom);
  const { row, button } = toggleOf(dom, 'proposal');
  const timers = click(button);
  assert.equal(timers.find((h) => h.ms === 1500) !== undefined, true);
  assert.equal(dom.workers[0].terminated, 0);
  timers.find((h) => h.ms === 1500).fn();
  await settle();
  assert.equal(dom.workers[0].terminated, 1);
  assert.ok(NOTE_TEXTS(row).includes(TIMEOUT));
  assert.ok(!row.textContent.includes('formatting marks'));
  assert.equal(find(sectionOf(row), byClass('md-plain')).textContent, RICH);
  assert.equal(findAll(row, (n) => ['H3', 'TABLE'].includes(n.tagName)).length, 0);
  assert.equal(find(row, byClass('doc-loading')), null);
});

test('#1218 R1218-5: a result inside the budget is accepted and carries no timeout notice', async (t) => {
  const dom = await boot({ proposal: RICH });
  t.after(() => dom.restore());
  await openSdd(dom);
  const { row, button } = toggleOf(dom, 'proposal');
  const timers = click(button);
  await settle();
  assert.ok(hasMd(row));
  assert.ok(!row.textContent.includes(TIMEOUT));
  timers.find((h) => h.ms === 1500).fn(); // the late timer must change nothing
  await settle();
  assert.ok(hasMd(row));
  assert.ok(!row.textContent.includes(TIMEOUT));
});

test('#1218 R1218-5: one row timing out leaves another row and its worker untouched', async (t) => {
  const dom = await boot({ proposal: RICH, worker: 'hold' });
  t.after(() => dom.restore());
  await openSdd(dom);
  const first = toggleOf(dom, 'proposal');
  const second = toggleOf(dom, 'spec');
  const timers = [...click(first.button), ...click(second.button)];
  timers.filter((h) => h.ms === 1500)[0].fn();
  await settle();
  assert.equal(dom.workers[0].terminated, 1);
  assert.equal(dom.workers[1].terminated, 0);
  dom.workers[1].release();
  await settle();
  assert.ok(hasMd(second.row));
  assert.ok(!second.row.textContent.includes(TIMEOUT));
  assert.ok(first.row.textContent.includes(TIMEOUT));
});

test('#1218 R1218-6: an error event, a throwing constructor and a malformed message each say the render failed, with the source as text', async () => {
  for (const mode of ['error', 'throw', 'malformed']) {
    const dom = await boot({ proposal: RICH, worker: mode });
    try {
      await openSdd(dom);
      const { row, button } = toggleOf(dom, 'proposal');
      fire(button, 'click');
      await settle();
      assert.ok(NOTE_TEXTS(row).includes(FAILED), mode);
      assert.ok(!row.textContent.includes(TIMEOUT), mode);
      assert.equal(find(sectionOf(row), byClass('md-plain')).textContent, RICH, mode);
      assert.deepEqual(dom.workers.map((w) => w.terminated), mode === 'throw' ? [] : [1], mode);
    } finally {
      dom.restore();
    }
  }
});

test('#1218 R1218-6: with no Worker the page says so, shows the source, and never tokenizes on the main thread', async (t) => {
  const dom = await boot({ proposal: RICH, worker: null });
  t.after(() => dom.restore());
  await openSdd(dom);
  const { row, button } = toggleOf(dom, 'proposal');
  fire(button, 'click');
  await settle();
  assert.ok(NOTE_TEXTS(row).includes(UNAVAILABLE));
  assert.ok(!row.textContent.includes(FAILED));
  assert.equal(find(sectionOf(row), byClass('md-plain')).textContent, RICH);
  assert.equal(findAll(row, (n) => n.tagName === 'H3').length, 0);
});

test('#1218 R1218-2: a degraded passage shows its notice, then its text as typed, and the rest still renders', async (t) => {
  const bad = 'a*'.repeat(700);
  const dom = await boot({ proposal: `# Title\n\n${bad}\n\nlater **bold**\n` });
  t.after(() => dom.restore());
  await openSdd(dom);
  const { row, button } = toggleOf(dom, 'proposal');
  fire(button, 'click');
  await settle();
  assert.ok(NOTE_TEXTS(row).includes('a passage with 700 formatting marks is shown as plain text'));
  assert.ok(row.textContent.includes(bad), 'the passage is shown as typed');
  assert.equal(findAll(row, (n) => n.tagName === 'EM').length, 0);
  assert.equal(findAll(row, (n) => n.tagName === 'H3').length, 1);
  assert.equal(findAll(row, (n) => n.tagName === 'STRONG').length, 1);
});

test('#1218 R1218-7: a result for a collapsed row is dropped and its worker is terminated', async (t) => {
  const dom = await boot({ proposal: RICH, worker: 'hold' });
  t.after(() => dom.restore());
  await openSdd(dom);
  const { row, button } = toggleOf(dom, 'proposal');
  fire(button, 'click');
  fire(button, 'click');
  assert.equal(dom.workers[0].terminated, 1);
  dom.workers[0].onmessage({ data: { id: dom.workers[0].posted[0].id, ok: true, tree: { blocks: [{ t: 'hr' }], notices: [] } } });
  await settle();
  assert.equal(sectionOf(row), null);
});

test('#1218 R1218-7: a stale result after collapse and re-expand never reaches the DOM, whatever the arrival order', async (t) => {
  const dom = await boot({ proposal: RICH, worker: 'hold' });
  t.after(() => dom.restore());
  await openSdd(dom);
  const { row, button } = toggleOf(dom, 'proposal');
  fire(button, 'click');
  fire(button, 'click');
  fire(button, 'click');
  assert.equal(dom.workers.length, 2, 'a collapse cancelled the first request and the re-expand started a second');
  dom.workers[1].release();
  await settle();
  assert.ok(hasMd(row));
  const before = findAll(row, () => true).length;
  const stale = { id: dom.workers[0].posted[0].id, ok: true, tree: { blocks: [{ t: 'hr' }, { t: 'hr' }], notices: [] } };
  dom.workers[0].onmessage({ data: stale });
  await settle();
  assert.equal(findAll(row, () => true).length, before);
  assert.equal(findAll(row, (n) => n.tagName === 'HR').length, 1, 'only the second request\'s hr');
});

test('#1218 R1218-7: a stale timer does not show the timeout notice', async (t) => {
  const dom = await boot({ proposal: RICH, worker: 'hold' });
  t.after(() => dom.restore());
  await openSdd(dom);
  const { row, button } = toggleOf(dom, 'proposal');
  const firstTimers = click(button);
  click(button);
  click(button);
  firstTimers.find((h) => h.ms === 1500).fn();
  await settle();
  assert.ok(!row.textContent.includes(TIMEOUT));
  assert.equal(find(sectionOf(row), byClass('doc-loading')).textContent, LOADING);
});

test('#1218 R1218-7: a re-render reuses the in-flight request; selecting a node cancels every request', async (t) => {
  const dom = await boot({ proposal: RICH, worker: 'hold' });
  t.after(() => dom.restore());
  await openSdd(dom);
  fire(toggleOf(dom, 'proposal').button, 'click');
  const tabs = Array.from(find(dom.mounts.drawer, byClass('tabs')).childNodes);
  fire(tabs.find((b) => b.textContent.includes('Tasks')), 'click');
  fire(Array.from(find(dom.mounts.drawer, byClass('tabs')).childNodes).find((b) => b.textContent.includes('SDD')), 'click');
  assert.equal(dom.workers.length, 1, 'no second worker for the same document');
  assert.equal(find(toggleOf(dom, 'proposal').row, byClass('doc-loading')).textContent, LOADING);
  dom.workers[0].release();
  await settle();
  assert.ok(hasMd(toggleOf(dom, 'proposal').row), 'the re-rendered row got the result');

  fire(toggleOf(dom, 'spec').button, 'click');
  assert.equal(dom.workers.length, 2);
  const card = findAll(dom.mounts.canvas, byClass('node-card')).find((c) => c.getAttribute('data-issue') === String(ISSUE));
  fire(card, 'click');
  assert.equal(dom.workers[1].terminated, 1, 'selecting a node cancelled the pending request');
});

// ── #1218 cold review round 3: an outcome that failed stays put until the user retries ──

const FRAMES = 3;

for (const [outcome, worker, notice] of [['failed', 'error', FAILED], ['unavailable', null, UNAVAILABLE]]) {
  test(`#1218 R1218-6: the ${outcome} outcome stays as it was across ${FRAMES} stream frames, with no new worker and no loading line`, async (t) => {
    const dom = await boot({ proposal: RICH, worker });
    t.after(() => dom.restore());
    await openSdd(dom);
    fire(toggleOf(dom, 'proposal').button, 'click');
    await settle();
    const spawned = dom.workers.length;
    const timers = holdTimers(() => { for (let i = 0; i < FRAMES; i += 1) dom.emit('sync'); });
    await settle();
    const { row } = toggleOf(dom, 'proposal');
    assert.equal(dom.workers.length, spawned, 'no worker was started by a frame');
    assert.equal(timers.length, 0, 'no render was requested by a frame');
    assert.ok(NOTE_TEXTS(row).includes(notice));
    assert.equal(find(row, byClass('doc-loading')), null);
  });
}

test('#1218 R1218-5: a timed-out document stays as it was across stream frames, with no new worker and no loading line', async (t) => {
  const dom = await boot({ proposal: RICH, worker: 'hold' });
  t.after(() => dom.restore());
  await openSdd(dom);
  const timers = click(toggleOf(dom, 'proposal').button);
  timers.find((h) => h.ms === 1500).fn();
  await settle();
  const later = holdTimers(() => { for (let i = 0; i < FRAMES; i += 1) dom.emit('sync'); });
  await settle();
  const { row } = toggleOf(dom, 'proposal');
  assert.equal(dom.workers.length, 1);
  assert.equal(later.length, 0);
  assert.ok(NOTE_TEXTS(row).includes(TIMEOUT));
  assert.equal(find(row, byClass('doc-loading')), null);
});

test('#1218 R1218-7: collapsing and re-expanding a failed document asks for it again', async (t) => {
  const dom = await boot({ proposal: RICH, worker: 'error' });
  t.after(() => dom.restore());
  await openSdd(dom);
  const { button } = toggleOf(dom, 'proposal');
  click(button);
  await settle();
  assert.equal(dom.workers.length, 1);
  click(button);
  click(button);
  await settle();
  assert.equal(dom.workers.length, 2);
});

test('#1218 R1218-7: collapsing and re-expanding a timed-out document asks for it again', async (t) => {
  const dom = await boot({ proposal: RICH, worker: 'hold' });
  t.after(() => dom.restore());
  await openSdd(dom);
  const { button } = toggleOf(dom, 'proposal');
  const timers = click(button);
  timers.find((h) => h.ms === 1500).fn();
  await settle();
  assert.equal(dom.workers.length, 1);
  click(button);
  click(button);
  assert.equal(dom.workers.length, 2);
  dom.workers[1].release();
  await settle();
  assert.ok(hasMd(toggleOf(dom, 'proposal').row), 'the second request is answered');
});

test('#1218 R1218-7: collapsing and re-expanding an unavailable document asks for it again', async (t) => {
  const dom = await boot({ proposal: RICH, worker: null });
  t.after(() => dom.restore());
  await openSdd(dom);
  const { button } = toggleOf(dom, 'proposal');
  click(button);
  await settle();
  const again = holdTimers(() => { fire(button, 'click'); fire(button, 'click'); });
  assert.equal(again.length, 1, 'the re-expand requested the render again');
});
