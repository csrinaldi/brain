// app.js — the browser entry point (#881 PR 4 / B2). Wiring only: it reads
// the API, hands every frame to `lib/frames.mjs`, and turns the resulting
// state into DOM. Every non-trivial decision — what a frame means, where a
// node goes, what colour it is, what a tab shows — lives in a pure
// `lib/*.mjs` module with its own `node:test`, because this file has no test
// runner (no DOM harness exists in this repo, design D9). What CAN be
// asserted about it is asserted by scan: `app-source-guard.test.mjs`,
// `degradation-banner.test.mjs`, `no-management-views.test.mjs`.
//
// Loaded as a plain ES module (`<script type="module" src="/app.js">`): the
// imports below are resolved by the browser against `server.mjs`'s
// `/lib/<module>.mjs` route, which serves the very same files node imports.
// No bundler, no dependency, no CDN (maintainer ruling, 2026-09-14).

import { initialPageState, applyFrame, parseFrame, streamFailed, controlFailed, sectionOf } from './lib/frames.mjs';
import { degradationBands, pollIndicator } from './lib/banners.mjs';
import { buildCanvasModel } from './lib/canvas-model.mjs';
import { buildDrawerModel } from './lib/drawer-model.mjs';

const mounts = {
  status: document.getElementById('status'),
  banners: document.getElementById('banners'),
  canvas: document.getElementById('canvas'),
  drawer: document.getElementById('drawer'),
};

let state = initialPageState();
/** The issue whose node is activated; `null` until one is. The drawer follows it. */
let selectedIssue = null;
/** The last `GET /api/change/<N>` body for the selected issue; `null` while it is still being read. */
let changeView = null;
let activeTab = 'spec';

// ── DOM helpers ────────────────────────────────────────────────────────────

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** A stated reason, in band. The one thing this page never does is show an empty area instead (R881-9). */
function said(text) {
  return el('p', 'said', text);
}

/** A stated list — the same rule as `said`, for facts that come by the handful. */
function saidList(heading, lines) {
  const wrap = document.createElement('div');
  wrap.appendChild(said(heading));
  const list = el('ul', 'said-list');
  for (const line of lines) list.appendChild(el('li', null, line));
  wrap.appendChild(list);
  return wrap;
}

// The SVG namespace: an identifier `createElementNS` compares by string, not
// a resource anything fetches (the source guard allows this one constant).
const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

function svgText(x, y, className, text) {
  const node = svg('text', { x, y, class: className });
  node.textContent = text;
  return node;
}

// ── render ─────────────────────────────────────────────────────────────────

function render() {
  renderStatus();
  renderBands();
  renderCanvas();
  renderDrawer();
}

/** R881-9: one band per degraded thing, each one BESIDE the data, never instead of it. */
function renderBands() {
  clear(mounts.banners);
  for (const band of degradationBands({ stream: state.stream, controls: state.controls, meta: state.meta, snapshot: state.snapshot })) {
    const node = el('div', 'band');
    node.appendChild(el('span', null, band.text));
    if (band.detail?.length) {
      const list = el('ul', 'said-list');
      for (const line of band.detail) list.appendChild(el('li', null, line));
      node.appendChild(list);
    }
    mounts.banners.appendChild(node);
  }
}

/**
 * The maintainer's poll ruling, rendered: a visible "forge polled N s ago /
 * paused" indicator, a control that disables polling, and a button for one
 * manual poll. Both controls POST — the only mutation verbs this server
 * accepts (R881-5).
 */
function renderStatus() {
  const indicator = pollIndicator({ poller: state.meta?.poller ?? null, nowMs: Date.now() });
  clear(mounts.status);
  mounts.status.appendChild(el('strong', 'title', 'brain:ui'));
  mounts.status.appendChild(el('span', indicator.paused ? 'poll-indicator paused' : 'poll-indicator', indicator.text));
  mounts.status.appendChild(el('span', 'spacer'));

  const toggle = el('button', 'poll-toggle', indicator.paused ? 'resume polling' : 'disable polling');
  toggle.addEventListener('click', () => postPoll(indicator.paused ? 'resume' : 'pause'));
  const once = el('button', 'poll-once', 'poll now');
  once.addEventListener('click', () => postPoll('once'));
  mounts.status.appendChild(toggle);
  mounts.status.appendChild(once);
}

/**
 * The DAG, drawn (R881-6/R881-7). Every decision — coordinates, colour, which
 * marks a node carries — was already made by `canvas-model.mjs`; this
 * function only turns that model into elements, which is why it has no
 * branches beyond "was the graph computable at all".
 */
function renderCanvas() {
  const model = buildCanvasModel(sectionOf(state, 'graph'));
  clear(mounts.canvas);
  if (!model.ok) {
    mounts.canvas.appendChild(said(`the graph could not be computed: ${model.reason}`));
    return;
  }
  const { nodes, edges, droppedEdges, issuesUnreadable, unlinked, width, height } = model.value;
  mounts.canvas.appendChild(el('p', 'canvas-summary', `${nodes.length} open issue(s), ${edges.length} edge(s), ${unlinked.length} in no edge`));

  const board = svg('svg', { width: width + 4, height: height + 4, viewBox: `-2 -2 ${width + 4} ${height + 4}` });
  for (const edge of edges) {
    const [start, end] = edge.points;
    // A reversed edge is a back edge the layout flipped to break a cycle: it
    // is DRAWN dashed rather than hidden, because the cycle is a fact about
    // the declarations, not a drawing problem (R881-7).
    board.appendChild(svg('line', { class: edge.reversed ? 'edge reversed' : 'edge', x1: start.x, y1: start.y, x2: end.x, y2: end.y }));
  }
  for (const node of nodes) {
    const selected = node.number === selectedIssue ? ' selected' : '';
    const group = svg('g', { class: `node ${node.className}${selected}`, role: 'button', tabindex: 0, 'data-issue': node.number });
    group.appendChild(svg('rect', { x: node.x, y: node.y, width: node.w, height: node.h }));
    const title = svg('title');
    title.textContent = [node.label, ...node.marks].join(' — ');
    group.appendChild(title);
    group.appendChild(svgText(node.x + 8, node.y + 22, 'label', node.label.slice(0, 24)));
    if (node.marks.length > 0) group.appendChild(svgText(node.x + 8, node.y + 42, 'mark', node.marks.join(', ').slice(0, 28)));
    group.addEventListener('click', () => selectNode(node.number));
    group.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') selectNode(node.number); });
    board.appendChild(group);
  }
  mounts.canvas.appendChild(board);

  if (droppedEdges.length > 0) {
    mounts.canvas.appendChild(saidList(`${droppedEdges.length} edge(s) could not be drawn:`, droppedEdges.map((e) => `#${e.from} → #${e.to}: ${e.reason}`)));
  }
  if (issuesUnreadable.length > 0) {
    mounts.canvas.appendChild(saidList(`${issuesUnreadable.length} issue body(ies) could not be read:`, issuesUnreadable.map((i) => `#${i.number}: ${i.reason}`)));
  }
}

/** Activating a node selects it and opens the drawer on its Spec tab (R881-8). */
function selectNode(issue) {
  selectedIssue = issue;
  changeView = null;
  activeTab = 'spec';
  render();
  loadChange(issue);
}

function closeDrawer() {
  selectedIssue = null;
  changeView = null;
  render();
}

/**
 * The inspector drawer: four tabs, one entry shape, and a source string under
 * every single value (A3). `drawer-model.mjs` decided all of it — including
 * that a tab which failed keeps its reason and that an unreadable review
 * thread is still an entry — so this renders one loop, with no per-tab
 * branch to get wrong.
 */
function renderDrawer() {
  clear(mounts.drawer);
  mounts.drawer.hidden = selectedIssue === null;
  if (selectedIssue === null) return;

  const close = el('button', 'close', 'close');
  close.addEventListener('click', closeDrawer);
  mounts.drawer.appendChild(close);
  mounts.drawer.appendChild(el('h2', null, `#${selectedIssue}`));

  if (changeView === null) {
    mounts.drawer.appendChild(el('p', 'note', 'reading this change…'));
    return;
  }
  const model = buildDrawerModel(changeView);
  if (!model.ok) {
    mounts.drawer.appendChild(said(model.reason));
    return;
  }
  mounts.drawer.appendChild(el('p', 'note', model.value.changeDir ? `change dir: ${model.value.changeDir}` : 'no change dir for this issue in the read model'));

  const tabs = el('div', 'tabs');
  for (const tab of model.value.tabs) {
    const button = el('button', null, tab.ok ? tab.label : `${tab.label} !`);
    button.setAttribute('aria-selected', String(tab.id === activeTab));
    button.addEventListener('click', () => { activeTab = tab.id; renderDrawer(); });
    tabs.appendChild(button);
  }
  mounts.drawer.appendChild(tabs);
  mounts.drawer.appendChild(renderTab(model.value.tabs.find((t) => t.id === activeTab) ?? model.value.tabs[0]));
}

function renderTab(tab) {
  const wrap = document.createElement('div');
  if (tab.note) wrap.appendChild(el('p', 'note', `source: ${tab.note}`));
  if (!tab.ok) {
    wrap.appendChild(said(tab.reason));
    if (tab.source) wrap.appendChild(el('span', 'source', tab.source));
  }
  for (const item of tab.entries) wrap.appendChild(renderEntry(item));
  // "read, and empty" and "never read" are different facts, so they are
  // different sentences — an empty area would say neither.
  if (tab.ok && tab.entries.length === 0) wrap.appendChild(said('this tab\'s source was read and has nothing in it'));
  return wrap;
}

function renderEntry(item) {
  const card = el('div', item.pending ? 'card pending' : 'card');
  const done = item.done === undefined ? '' : item.done ? '[x] ' : '[ ] ';
  card.appendChild(el('strong', null, `${done}${item.title}`));
  if (item.detail) card.appendChild(el('p', null, item.detail));
  card.appendChild(el('span', 'source', item.source)); // A3: the path or the URL, beside the value itself
  for (const child of item.children ?? []) card.appendChild(renderEntry(child));
  return card;
}

/** The drawer's own IO. A failed read is a reason IN the drawer, never a drawer that stays empty. */
async function loadChange(issue) {
  let next;
  try {
    const res = await fetch(`/api/change/${issue}`);
    if (!res.ok) throw new Error(`answered ${res.status}`);
    next = await res.json();
  } catch (err) {
    next = { ok: false, reason: `the change view for #${issue} could not be read: ${err.message}` };
  }
  // A slower answer for a node the operator has already moved away from must
  // not overwrite the one now on screen.
  if (selectedIssue !== issue) return;
  changeView = next;
  renderDrawer();
}

// ── the API: one REST read, then the stream ────────────────────────────────

async function readSnapshot() {
  try {
    const res = await fetch('/api/snapshot');
    if (!res.ok) throw new Error(`GET /api/snapshot answered ${res.status}`);
    state = applyFrame(state, 'sync', { snapshot: await res.json() });
  } catch (err) {
    state = streamFailed(state, `the snapshot could not be read: ${err.message}`);
  }
  render();
}

/** The poller's own three controls. Its answer IS the new poller state, so no extra read is needed. */
async function postPoll(action) {
  try {
    const res = await fetch(`/api/poll/${action}`, { method: 'POST' });
    if (!res.ok) throw new Error(`POST /api/poll/${action} answered ${res.status}`);
    state = { ...state, controls: { ok: true }, meta: { ...(state.meta ?? {}), poller: await res.json() } };
  } catch (err) {
    // Its own band: the stream is still connected and every value on screen
    // is still current — only this button did not take (R881-4).
    state = controlFailed(state, { action, reason: err.message });
  }
  render();
}

function subscribe() {
  const stream = new EventSource('/api/stream');
  for (const name of ['sync', 'section', 'refs', 'status']) {
    stream.addEventListener(name, (event) => {
      const parsed = parseFrame(event.data);
      // A frame this page cannot read is a band, not an exception swallowed
      // by the callback: every held value stays, the reason is on screen.
      if (!parsed.ok) { state = streamFailed(state, parsed.reason); render(); return; }
      state = applyFrame(state, name, parsed.frame);
      render();
      // Q3/A2: a worktree's head moved, so the open drawer's Working memory
      // tab (`git show <branch>:resume.md`) is the one value the snapshot
      // diff cannot refresh on its own.
      if (name === 'refs' && selectedIssue !== null) loadChange(selectedIssue);
    });
  }
  // `EventSource` reconnects on its own; the band says the page is no longer
  // live meanwhile, and every held value stays on screen (R881-9).
  stream.addEventListener('error', () => {
    state = streamFailed(state, 'the live stream dropped — reconnecting; the values below are the last ones read');
    render();
  });
  return stream;
}

render();
readSnapshot().then(subscribe);
// "polled 5 s ago" is a claim that goes stale by itself, so the indicator
// re-renders on a clock of its own; nothing is re-fetched here.
setInterval(renderStatus, 5000);
