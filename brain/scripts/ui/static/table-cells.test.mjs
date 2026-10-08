// table-cells.test.mjs — #1310 R1310-1..3: a class applied to a <td>/<th>/<tr>
// must not set a non-table `display`. `inline-block`/`block` on a cell takes it
// out of the table layout, so every later cell slides one column left. Chip
// styling belongs on an inner element.
//
// TWO NETS (#1318). The source scan below reads only the classes written as a literal
// argument of `el('td'|'th'|'tr', '<class>')`; it misses a conditional argument and a class
// added afterwards with `classList.add`. The RENDER guard at the end runs the real page on the
// fake DOM and reads the className of every td/th/tr it actually built, so it sees both.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

import { buildSnapshot, reviewRows } from '../../status/snapshot.mjs';
import { testTmp } from '../../lib/test-tmp.mjs';
import { MODES } from '../lib/view-model.mjs';
import { GOVERNANCE_VIEWS } from '../lib/governance-model.mjs';
import { installDom, fire, find, findAll, byClass } from '../test-support/dom.mjs';
import { loadApp, settle } from '../test-support/load-app.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_JS = readFileSync(join(HERE, 'app.js'), 'utf8');
const APP_CSS = readFileSync(join(HERE, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Every LITERAL class token given to a table element by `el('td'|'th'|'tr', <class>, ...)`. Conditional arguments and `classList.add` are the render guard's. */
function tableElementClasses(text) {
  const found = new Map();
  for (const m of text.matchAll(/\bel\(\s*'(td|th|tr)'\s*,\s*(?:'([^']*)'|`([^`]*)`)/g)) {
    const raw = (m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, ' ');
    for (const token of raw.split(/\s+/).filter(Boolean)) found.set(token, m[1]);
  }
  return found;
}

/** [{ selector, body }] for every flat rule in the stylesheet (media blocks flattened). */
function rules(css) {
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ selector: m[1].trim(), body: m[2] });
  return out;
}

/** True when the LAST compound of any selector in the list names `.cls`. */
function targetsClass(selector, cls) {
  return selector.split(',').some((s) => {
    const last = s.trim().split(/[\s>+~]+/).pop() ?? '';
    return new RegExp(`\\.${cls}(?![\\w-])`).test(last);
  });
}

test('#1310 R1310-1: the scan finds the table-element classes it is meant to guard', () => {
  const classes = tableElementClasses(APP_JS);
  for (const c of ['decision-title', 'anti-pattern-title', 'queue-pr', 'memory-when']) {
    assert.ok(classes.has(c), `${c} is applied to a table element and must be seen by the scan`);
  }
});

test('#1310 R1310-1: no rule for a class applied to a td/th/tr sets display', () => {
  const offenders = [];
  for (const [cls, tag] of tableElementClasses(APP_JS)) {
    for (const rule of rules(APP_CSS)) {
      if (targetsClass(rule.selector, cls) && /(^|[;\s])display\s*:/.test(rule.body)) {
        offenders.push(`.${cls} (on <${tag}>) in "${rule.selector}"`);
      }
    }
  }
  assert.deepEqual(offenders, [], 'a display on a table cell breaks the table layout');
});

function functionBody(name) {
  const start = APP_JS.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  return APP_JS.slice(start, APP_JS.indexOf('\n}\n', start) + 3);
}

test('#1310 R1310-2: the status and scope chips are inner elements of their cell, never the cell', () => {
  const dec = functionBody('renderDecisionRow');
  assert.doesNotMatch(dec, /el\('td',\s*`?'?decision-status(?![\w-])/, 'the status chip must not be the <td>');
  assert.match(dec, /el\('span',\s*`decision-status /, 'the status chip is a <span>');
  const anti = functionBody('renderAntiPatternRow');
  assert.doesNotMatch(anti, /el\('td',\s*'anti-pattern-scope'/, 'the scope chip must not be the <td>');
  assert.match(anti, /el\('span',\s*'anti-pattern-scope'/, 'the scope chip is a <span>');
});

test('#1310 R1310-1: the memory actor stack is an inner element, not the <td>', () => {
  assert.match(APP_JS, /el\('td', 'memory-actor-cell'\)/);
  assert.match(APP_JS, /el\('div', 'memory-actor'\)/);
});

test('#1310 R1310-3: a readable Decisions row has five cells and an Anti-patterns row four, matching their headers', () => {
  const tds = (name) => [...functionBody(name).matchAll(/el\('td'/g)].length;
  // one unreadable spanning cell + N readable cells
  assert.equal(tds('renderDecisionRow'), 1 + 5);
  assert.equal(tds('renderAntiPatternRow'), 1 + 4);
});

// ── #1318 R1318-1: the render guard ──────────────────────────────────────────

const MOUNT_IDS = ['status', 'modes', 'search', 'banners', 'governance-nav', 'canvas', 'drawer'];
const HEAD_SHA = 'a1b2c3d'.padEnd(40, '0');
const ok = (value) => ({ ok: true, value });
const verdictBody = (word) => `Round 1\n\n\`\`\`yaml\nprotocol: brain-review/2\nhead_sha: ${HEAD_SHA}\nrev: 1\nverdict: ${word}\nfindings: []\n\`\`\`\n`;
const thread = (pr, word) => reviewRows(pr, [{ body: verdictBody(word), author: 'bot' }]);

/** Boots the page on data that reaches every row kind of the four table views: readable and unreadable rows, an escalated and an openable queue row, an opened memory record. */
async function bootTables() {
  const root = testTmp('table-cells-render-');
  const records = join(root, '.memory', 'records');
  mkdirSync(records, { recursive: true });
  writeFileSync(join(records, '2026-09-rec-aaaa.jsonl'), `${JSON.stringify({ id: 'rec-aaaa', ts: '2026-09-18T22:10:52Z', actor: 'feat/x', actorKind: 'agent', type: 'architecture', project: 'brain', content: 'a decision' })}\n`);
  const vcs = {
    async issueList() { return [{ number: 881, title: 'a ticket', labels: ['status:approved'], assignees: [], state: 'open' }]; },
    async issueView() { return { body: '', assignees: [] }; },
    async mrList() { return []; },
    async prReviews() { return []; },
  };
  const snapshot = await buildSnapshot({ root, project: 'o/r', vcs, now: '2026-10-07T12:00:00.000Z', _run: () => { throw new Error('no git'); } });
  const adr = (number) => ({ ok: true, path: `brain/project/decisions/adr-000${number}-x.md`, number, title: `ADR ${number}`, status: 'Accepted', statusLine: 'Accepted', date: null, amendments: [{ n: 1, date: null, issue: null, summary: 'a fix' }], supersedes: [], supersededBy: null, issues: [5] });
  snapshot.adrs = ok([adr(1), adr(2), { ok: false, path: 'brain/project/decisions/adr-bad.md', reason: 'no `**Status**:` line' }]);
  snapshot.antiPatterns = ok({
    entries: [
      { ok: true, id: 'one', title: 'One', scope: 'core', path: 'brain/core/anti-patterns/one.md', issues: [1] },
      { ok: false, scope: 'project', path: 'brain/project/anti-patterns/bad.md', reason: 'unreadable' },
    ],
    unlistable: [],
  });
  snapshot.prs = ok([{ number: 885, issue: 881, title: 'pr 885', headBranch: 'feat/issue-881-x' }, { number: 886, issue: null, title: 'pr 886', headBranch: 'feat/other' }]);
  snapshot.reviews = ok([thread(885, 'STOP'), thread(886, 'REVISE')]);
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot, records: { 'rec-aaaa': { ok: true, id: 'rec-aaaa', file: '.memory/records/2026-09-rec-aaaa.jsonl', content: 'a decision', truncated: false, truncatedAt: null } } });
  await loadApp();
  await settle();
  return dom;
}

const click = async (dom, mount, label) => {
  fire(find(mount, (n) => n.tagName === 'BUTTON' && n.textContent.includes(label)), 'click');
  await settle();
};

/** className tokens of every td/th/tr under the canvas right now, with the tag they were seen on. */
function renderedTableClasses(dom, into) {
  for (const n of findAll(dom.mounts.canvas, (x) => ['TD', 'TH', 'TR'].includes(x.tagName))) {
    for (const token of String(n.className).split(/\s+/).filter(Boolean)) into.set(token, n.tagName.toLowerCase());
  }
}

async function collectRendered(dom) {
  const seen = new Map();
  await click(dom, dom.mounts.modes, MODES.find((m) => m.id === 'governance').label);
  for (const id of ['decisions', 'anti-patterns', 'queue']) {
    await click(dom, dom.mounts['governance-nav'], GOVERNANCE_VIEWS.find((v) => v.id === id).label);
    renderedTableClasses(dom, seen);
  }
  await click(dom, dom.mounts.modes, MODES.find((m) => m.id === 'memory').label);
  fire(find(dom.mounts.canvas, byClass('memory-toggle')), 'click'); // opens a record: the detail row is a tr too
  await settle();
  renderedTableClasses(dom, seen);
  return seen;
}

test('#1318 R1318-1: the render guard sees the classes the source scan cannot (conditional argument, classList.add, detail rows)', async (t) => {
  const dom = await bootTables();
  t.after(() => dom.restore());
  const seen = await collectRendered(dom);
  for (const c of ['queue-row', 'escalate', 'openable', 'decision-row', 'decision-unreadable', 'anti-pattern-row', 'memory-detail', 'decision-title', 'queue-pr', 'memory-when']) {
    assert.ok(seen.has(c), `${c} is on a rendered table element and must be seen by the render guard (seen: ${[...seen.keys()].join(', ')})`);
  }
  const literal = tableElementClasses(APP_JS);
  assert.ok(!literal.has('escalate') && !literal.has('openable'), 'and the source scan is blind to them, which is why this guard exists');
});

test('#1318 R1318-1: no rule for a class the page really puts on a td/th/tr sets display', async (t) => {
  const dom = await bootTables();
  t.after(() => dom.restore());
  const offenders = [];
  for (const [cls, tag] of await collectRendered(dom)) {
    for (const rule of rules(APP_CSS)) {
      if (targetsClass(rule.selector, cls) && /(^|[;\s])display\s*:/.test(rule.body)) offenders.push(`.${cls} (on <${tag}>) in "${rule.selector}"`);
    }
  }
  assert.deepEqual(offenders, [], 'a display on a table cell breaks the table layout');
});
