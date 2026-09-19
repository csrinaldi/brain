// app-smoke.test.mjs — the page is RUN, not scanned (#1059).
//
// `app-source-guard.test.mjs` asserts what the page's source may contain. This
// file asserts that the page WORKS: it boots the real `static/app.js` against
// a real snapshot, renders every mode, and activates the controls a reader
// activates. Three defects shipped in #1059 that no scan could have seen, and
// every one of them is a one-line failure here.
//
// THE FIXTURE IS NOT INVENTED. The data comes out of `status/snapshot.mjs` —
// the same builder `server.mjs` serves — fed by issue BODIES, which is the
// text a maintainer actually writes. Nothing in this file describes the shape
// of a node or a change; the production readers decide that. The defect this
// harness exists to catch was caused by a test that invented a shape and then
// asserted only the fields every shape happened to share.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSnapshot } from '../../status/snapshot.mjs';
import { testTmp } from '../../lib/test-tmp.mjs';
import { MODES } from '../lib/view-model.mjs';
import { installDom, fire, find, findAll, byClass } from '../test-support/dom.mjs';
import { loadApp, settle } from '../test-support/load-app.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const MOUNT_IDS = ['status', 'modes', 'banners', 'governance-nav', 'canvas', 'drawer'];

/** The declaration block exactly as it is written in an issue body. */
function fence(lines) {
  return ['## What it is', '', 'Prose the parser must step over.', '', '```brain-graph/1', ...lines, '```', ''].join('\n');
}

const ISSUES = [
  {
    number: 878, title: 'epic(ui): Brain UI — the project\'s state', labels: ['type:feature', 'status:approved'],
    body: fence(['kind:     epic', 'track:    UI', 'tracker:  feature/brain-ui', 'blocks:   []', 'needs:    []']),
  },
  {
    number: 1059, title: 'feat(ui): the page is built from the design', labels: ['status:approved'],
    body: fence(['track:    UI', 'parent:   878', 'blocks:   []', 'needs:    []']),
  },
  {
    number: 1032, title: 'feat(ui): the lanes group by epic', labels: [],
    body: fence(['track:    UI', 'parent:   878', 'blocks:   []', 'needs:    [1059]']),
  },
  {
    number: 907, title: 'fix(governance): a check with no declared track', labels: [],
    body: 'This issue declares nothing at all, which is the `?` holding lane.\n',
  },
  // A DIFFERENT track that needs a UI ticket. The page never draws a line
  // across lanes (R998-3: they share no coordinate space), it SAYS the edge —
  // and saying it is what calls `saidList`, the helper that was missing.
  {
    number: 1024, title: 'fix(governance): the memory gate reads the PR context', labels: [],
    body: fence(['track:    GOVERNANCE', 'blocks:   []', 'needs:    [1059]']),
  },
  // A body the forge will not hand over. The node still enters the graph with
  // what the LIST said, and the page must say the body is unknown rather than
  // draw it as an issue that declared nothing.
  { number: 953, title: 'feat(vcs): a body this harness refuses to serve', labels: [], body: null },
];

const VCS = {
  async issueList() { return ISSUES.map(({ number, title, labels }) => ({ number, title, labels, assignees: [] })); },
  async issueView({ number }) {
    const issue = ISSUES.find((i) => i.number === number);
    if (!issue) throw new Error(`no such issue #${number}`);
    if (issue.body === null) throw new Error('the forge refused this body');
    return { body: issue.body, assignees: [] };
  },
};

/** A repository with just enough on disk for the readers to have something true to say. */
function fixtureRepo() {
  const root = testTmp('ui-smoke-repo-');
  writeFileSync(join(root, 'brain.config.json'), readFileSync(join(REPO, 'brain.config.json'), 'utf8'));
  const change = join(root, 'openspec', 'changes', 'issue-1059-design-structure');
  mkdirSync(change, { recursive: true });
  writeFileSync(join(change, 'proposal.md'), '# Proposal\n');
  writeFileSync(join(change, 'spec.md'), '# Spec\n');
  writeFileSync(join(change, 'design.md'), '# Design\n');
  writeFileSync(join(change, 'tasks.md'), '# Tasks\n\n- [x] one\n- [ ] two\n');
  return root;
}

async function boot() {
  const snapshot = await buildSnapshot({
    root: fixtureRepo(),
    project: 'csrinaldi/brain',
    vcs: VCS,
    now: '2026-09-19T12:00:00.000Z',
    // No git in a temp directory, and a harness must not depend on one.
    _run: () => { throw new Error('git is not available in this harness'); },
  });
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot });
  await loadApp();
  await settle();
  return dom;
}

const cards = (dom) => findAll(dom.mounts.canvas, byClass('node-card'));
const cardFor = (dom, issue) => cards(dom).find((c) => c.getAttribute('data-issue') === String(issue));

/**
 * The mode control, found by the LABEL the table declares — `view-model.mjs`
 * is the single source of those words, and a `data-mode` attribute invented
 * here would be a second one that the page does not have to keep true.
 */
function modeButton(dom, id) {
  const label = MODES.find((m) => m.id === id)?.label;
  assert.ok(label, `${id} is a real mode`);
  const button = find(dom.mounts.modes, (n) => n.tagName === 'BUTTON' && n.textContent.includes(label));
  assert.ok(button, `the ${id} mode has a control reading "${label}"`);
  return button;
}

test('#1059 smoke: the page boots against a real snapshot and draws the board', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());

  assert.ok(dom.mounts.status.childNodes.length > 0, 'the status bar drew');
  assert.ok(dom.mounts.modes.childNodes.length > 0, 'the mode bar drew');
  // Three issues declare a track and become cards; the fourth declares
  // nothing and belongs to the `?` holding lane, which the design draws as a
  // batch of tiles rather than as cards (#1059 phase 5).
  assert.equal(cards(dom).length, 4, `every issue that declared a track became a card, drawn: ${cards(dom).length}`);
  const count = find(dom.mounts.canvas, byClass('batch-count'));
  assert.ok(count, 'the holding lane states its own proportion');
  assert.match(count.textContent, /2 of 6 open issues/, 'and the proportion is of the whole graph, not of the lane');

  // It opens collapsed, so the tiles are behind the toggle — which makes this
  // the cheapest place to prove the toggle is wired at all.
  assert.equal(findAll(dom.mounts.canvas, byClass('batch-tile')).length, 0, 'collapsed, so no tiles yet');
  fire(find(dom.mounts.canvas, byClass('lane-toggle')), 'click');
  const batch = findAll(dom.mounts.canvas, byClass('batch-tile'));
  assert.equal(batch.length, 2, 'expanded, the issues with no declared track are tiles — never silently missing');
  assert.match(batch.map((t) => t.textContent).join(' '), /#907/);

  // `saidList` was called in seven places and defined in none, and nothing
  // caught it because no fixture ever reached one of those branches. These
  // two are the cheapest of the seven to provoke, and they run on every boot.
  const board = dom.mounts.canvas.textContent;
  assert.match(board, /edge\(s\) cross lanes/, 'a cross-lane edge is said, because it is never drawn');
  assert.match(board, /#1059 → #1024 crosses lanes UI → GOVERNANCE/, 'and it names both ends and both lanes — the edge points from the blocker to the blocked');
  assert.match(board, /issue body\(ies\) could not be read/, 'a body the forge refused is stated, never rendered as "declared nothing"');
  assert.match(board, /#953/);

  // The exact defect that shipped: `sddForIssue` returned the raw snapshot
  // entry, `renderNodeSdd` read a `stages` it does not carry, and the throw
  // took `renderLanes` down with it — a blank board, not a failing test.
  const card = cardFor(dom, 1059);
  assert.ok(card, 'the issue that owns a change directory is on the board');
  assert.match(card.textContent, /tasks 1\/2/, 'its strip counts the change directory\'s ticked tasks');
});

test('#1059 smoke: clicking a ticket opens its panel, from every mode', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());

  assert.equal(dom.mounts.drawer.hidden, true, 'nothing is selected yet, so no panel');

  fire(cardFor(dom, 878), 'click');
  await settle();
  assert.equal(dom.mounts.drawer.hidden, false, 'the panel opened');
  assert.match(dom.mounts.drawer.textContent, /#878/, 'and it is about the ticket that was clicked');

  // The epic's children are declared BY THE CHILDREN, so the panel's list is
  // whoever points at it (#1059 phase 10).
  assert.match(dom.mounts.drawer.textContent, /#1059/, 'the panel lists the tickets that declare this one as their parent');
  assert.match(dom.mounts.drawer.textContent, /#1032/);

  // The defect the maintainer hit: a mode is about the PROJECT, a panel is
  // about a TICKET, so switching mode may not shut the panel.
  for (const mode of ['sdd', 'reviews', 'governance', 'map']) {
    fire(modeButton(dom, mode), 'click');
    await settle();
    assert.equal(dom.mounts.drawer.hidden, false, `the panel survives the ${mode} mode — closing it is the reader's own control`);
  }
});

test('#1059 smoke: every mode renders without throwing, and the theme control takes', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());

  for (const mode of ['sdd', 'reviews', 'governance', 'map']) {
    fire(modeButton(dom, mode), 'click');
    await settle();
    assert.ok(dom.mounts.canvas.childNodes.length > 0, `the ${mode} mode drew something — an empty area is the one thing this page never shows`);
  }

  const select = find(dom.mounts.status, (n) => n.tagName === 'SELECT');
  assert.ok(select, 'the theme control is in the status bar');
  select.value = 'dark';
  fire(select, 'change');
  assert.equal(dom.documentElement.getAttribute('data-theme'), 'dark', 'an explicit choice stamps the document');
  assert.equal(dom.storage.get('brain:ui:theme'), 'dark', 'and it is remembered for the next visit');
});
