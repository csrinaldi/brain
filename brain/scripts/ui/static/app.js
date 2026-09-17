// app.js — the browser entry point (#881 PR 4 / B2). Wiring only: it reads
// the API, hands every frame to `lib/frames.mjs`, and turns the resulting
// state into DOM. Every non-trivial decision — what a frame means, where a
// node goes, what colour it is, what a tab shows — lives in a pure
// `lib/*.mjs` module with its own `node:test`, because this file has no test
// runner (no DOM harness exists in this repo, design D9). What CAN be
// asserted about it is asserted by scan: `app-source-guard.test.mjs`,
// `degradation-banner.test.mjs`, `views-owned.test.mjs`.
//
// Loaded as a plain ES module (`<script type="module" src="/app.js">`): the
// imports below are resolved by the browser against `server.mjs`'s
// `/lib/<module>.mjs` route, which serves the very same files node imports.
// No bundler, no dependency, no CDN (maintainer ruling, 2026-09-14).

import { initialPageState, applyFrame, parseFrame, streamFailed, controlFailed, sectionOf, requestSequence } from './lib/frames.mjs';
import { degradationBands, pollIndicator } from './lib/banners.mjs';
import { buildLaneModel } from './lib/lane-model.mjs';
import { buildDrawerModel } from './lib/drawer-model.mjs';
import { buildSddModel, STAGE_VOCAB } from './lib/sdd-model.mjs';
import { buildReviewTimeline } from './lib/review-timeline.mjs';
import { sourceStamp } from './lib/provenance.mjs';
import { MODES, PLACEHOLDERS, initialView, switchMode, keyAction } from './lib/view-model.mjs';

const mounts = {
  status: document.getElementById('status'),
  modes: document.getElementById('modes'),
  banners: document.getElementById('banners'),
  canvas: document.getElementById('canvas'),
  drawer: document.getElementById('drawer'),
};

let state = initialPageState();
/** The current mode id (#998 R998-2). `map` is the only one with content this PR; the router says so for the rest. */
let view = initialView();
/** The issue whose node is activated; `null` until one is. The drawer follows it — `map` mode only. */
let selectedIssue = null;
/** The last `GET /api/change/<N>` body for the selected issue; `null` while it is still being read. */
let changeView = null;
let activeTab = 'spec';
/**
 * Which track lanes are collapsed (#998 R998-3): a local Set, the same kind
 * of page-only interaction state `selectedIssue`/`activeTab` already are —
 * not part of `frames.mjs`'s state, because it is never derived from a
 * server frame. The `?` holding lane starts in it (lane-model.mjs's own
 * default), so this page never has to decide that on its own.
 */
let collapsedTracks = new Set(['?']);
/** The `?` holding lane's current page (#998 R998-3), 24 rows at a time. */
let holdingPage = 0;

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
  renderModes();
  renderBands();
  renderContent();
}

/** The four mode buttons, drawn straight from `lib/view-model.mjs`'s table — no inline handler, no second copy of the labels. */
function renderModes() {
  clear(mounts.modes);
  for (const mode of MODES) {
    const button = el('button', null, mode.label);
    button.type = 'button';
    if (mode.id === view) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => switchToMode(mode.id));
    mounts.modes.appendChild(button);
  }
}

function switchToMode(mode) {
  view = switchMode(view, mode);
  render();
}

/** The router (#998 R998-2/R998-4/R998-5): `map` draws the canvas + drawer, `sdd` draws the seven-stage matrix, `reviews` draws the timeline + verdict queue; the rest say which PR brings their content. */
function renderContent() {
  if (view === 'map') {
    renderLanes();
    renderDrawer();
    return;
  }
  if (view === 'sdd') {
    renderSdd();
    mounts.drawer.hidden = true;
    clear(mounts.drawer);
    return;
  }
  if (view === 'reviews') {
    renderReviews();
    mounts.drawer.hidden = true;
    clear(mounts.drawer);
    return;
  }
  clear(mounts.canvas);
  mounts.canvas.appendChild(said(PLACEHOLDERS[view]));
  mounts.drawer.hidden = true;
  clear(mounts.drawer);
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
/** The served branch, said with its own source stamp (#998 R998-6 T3) — a detached or unreadable HEAD is a said reason, never a blank header. */
function renderServedBranch(servedBranch) {
  const frag = document.createDocumentFragment();
  if (servedBranch === null) {
    frag.appendChild(el('span', 'served-branch', 'serving: unknown until the stream connects'));
    return frag;
  }
  const text = servedBranch.ok ? `serving ${servedBranch.branch}` : `serving: unknown (${servedBranch.reason})`;
  frag.appendChild(el('span', 'served-branch', text));
  frag.appendChild(renderSourceStamp(sourceStamp(servedBranch.source)));
  return frag;
}

function renderStatus() {
  const indicator = pollIndicator({ poller: state.meta?.poller ?? null, nowMs: Date.now() });
  clear(mounts.status);
  mounts.status.appendChild(el('strong', 'title', 'brain:ui'));
  mounts.status.appendChild(renderServedBranch(state.meta?.servedBranch ?? null));
  mounts.status.appendChild(el('span', indicator.paused ? 'poll-indicator paused' : 'poll-indicator', indicator.text));
  mounts.status.appendChild(el('span', 'poll-countdown', indicator.countdown));
  mounts.status.appendChild(el('span', 'spacer'));

  const toggle = el('button', 'poll-toggle', indicator.paused ? 'resume polling' : 'disable polling');
  toggle.addEventListener('click', () => postPoll(indicator.paused ? 'resume' : 'pause'));
  const once = el('button', 'poll-once', 'poll now');
  once.addEventListener('click', () => postPoll('once'));
  mounts.status.appendChild(toggle);
  mounts.status.appendChild(once);
}

/**
 * The DAG, drawn as track lanes (#998 R998-3): one row per declared track —
 * each with its OWN board, `layout()` run once per lane by `lane-model.mjs`
 * — then the `?` holding lane last, as a paged list rather than a board
 * (undeclared nodes carry no track to lay coordinates out against). Every
 * decision — grouping, coordinates, colour, which marks a node carries —
 * was already made by `lane-model.mjs`; this function only turns that model
 * into elements.
 */
function renderLanes() {
  const model = buildLaneModel(sectionOf(state, 'graph'), { collapsedTracks, holdingPage });
  clear(mounts.canvas);
  if (!model.ok) {
    mounts.canvas.appendChild(said(`the graph could not be computed: ${model.reason}`));
    return;
  }
  const { lanes, crossEdges, holding, droppedEdges, issuesUnreadable, edgeSummary } = model.value;
  mounts.canvas.appendChild(el('p', 'canvas-summary', `${lanes.length} track lane(s), ${holding.count} in the \`?\` holding lane`));
  mounts.canvas.appendChild(el('p', 'edge-summary', `edges: ${edgeSummary.laneInternal} in lanes, ${edgeSummary.holdingInternal} in the \`?\` holding lane, ${edgeSummary.crossLane} crossing lanes, ${edgeSummary.unknownNode} to an unknown node (${edgeSummary.total} total)`));

  for (const lane of lanes) mounts.canvas.appendChild(renderLaneRow(lane));
  mounts.canvas.appendChild(renderHoldingLane(holding));

  // A cross-lane edge is never a line (R998-3: lanes have no shared
  // coordinate space to draw one across) — it is said, like every other
  // fact this page lists beside a drawing rather than folding into it.
  if (crossEdges.length > 0) {
    mounts.canvas.appendChild(saidList(`${crossEdges.length} edge(s) cross lanes:`, crossEdges.map((e) => `#${e.from} → #${e.to} crosses lanes ${e.fromTrack} → ${e.toTrack}`)));
  }
  if (droppedEdges.length > 0) {
    mounts.canvas.appendChild(saidList(`${droppedEdges.length} edge(s) could not be drawn:`, droppedEdges.map((e) => `#${e.from} → #${e.to}: ${e.reason}`)));
  }
  if (issuesUnreadable.length > 0) {
    mounts.canvas.appendChild(saidList(`${issuesUnreadable.length} issue body(ies) could not be read:`, issuesUnreadable.map((i) => `#${i.number}: ${i.reason}`)));
  }
}

/** One state chip per code present in a lane's nodes, `mark word × n` — built from each node's own `state` (lane-model.mjs, state-vocab.mjs) so the header's summary cannot drift from the board below it. */
function stateChips(nodes) {
  const byCode = new Map();
  for (const node of nodes) {
    const entry = byCode.get(node.state.code) ?? { ...node.state, n: 0 };
    entry.n += 1;
    byCode.set(node.state.code, entry);
  }
  return [...byCode.values()];
}

function renderLaneHeader(label, count, nodes, toggle) {
  const header = el('div', 'lane-header');
  header.appendChild(el('strong', null, label));
  header.appendChild(el('span', 'lane-count', String(count)));
  const chips = el('span', 'lane-chips');
  for (const chip of stateChips(nodes)) chips.appendChild(el('span', 'chip', `${chip.mark} ${chip.label} × ${chip.n}`));
  header.appendChild(chips);
  if (toggle) header.appendChild(toggle);
  return header;
}

function renderLaneRow(lane) {
  const row = el('div', 'lane-row');
  row.appendChild(renderLaneHeader(lane.label, lane.count, lane.nodes, null));
  row.appendChild(renderLaneBoard(lane));
  return row;
}

/** One lane's own SVG board — the same drawing the single canvas used to be, now scoped to one lane's own coordinate space (R998-3). */
function renderLaneBoard(lane) {
  const board = svg('svg', { width: lane.width + 4, height: lane.height + 4, viewBox: `-2 -2 ${lane.width + 4} ${lane.height + 4}`, class: 'lane-board' });
  for (const edge of lane.edges) {
    const [start, end] = edge.points;
    board.appendChild(svg('line', { class: edge.reversed ? 'edge reversed' : 'edge', x1: start.x, y1: start.y, x2: end.x, y2: end.y }));
  }
  for (const node of lane.nodes) {
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
  return board;
}

/**
 * The `?` holding lane (#998 R998-3): a header with a show/hide toggle
 * (never a board), the fence an author pastes to leave it, and 24 rows at a
 * time while expanded. A lane with zero nodes does not exist, but the
 * holding lane always does — when empty, it says why instead of showing a
 * blank expanded area.
 */
function renderHoldingLane(holding) {
  const toggle = el('button', 'lane-toggle', holding.collapsed ? 'show' : 'hide');
  toggle.type = 'button';
  toggle.addEventListener('click', () => {
    collapsedTracks = new Set(collapsedTracks);
    if (collapsedTracks.has('?')) collapsedTracks.delete('?'); else collapsedTracks.add('?');
    render();
  });

  const row = el('div', 'lane-row holding');
  const header = renderLaneHeader('? — undeclared', holding.count, holding.nodes, toggle);
  header.appendChild(el('span', 'lane-edge-count', `${holding.edgeCount} edge(s)`));
  row.appendChild(header);
  if (holding.collapsed) return row;

  if (holding.note) {
    row.appendChild(said(holding.note));
    return row;
  }

  row.appendChild(el('p', 'note', "how to declare: paste this into the issue body, with your track's letter —"));
  const pre = document.createElement('pre');
  pre.textContent = holding.declareSnippet;
  row.appendChild(pre);

  const list = el('ul', 'holding-list');
  for (const node of holding.nodes) list.appendChild(el('li', null, `${node.state.mark} ${node.label}`));
  row.appendChild(list);

  // Holding-holding edges are a board, drawn like a lane's own (#998 R998-3
  // cold review): `lane-model.mjs` already laid it out over this same page's
  // subgraph, this only turns that into elements, same as `renderLaneBoard`.
  if (holding.edges.length > 0) {
    row.appendChild(el('p', 'note', `${holding.edges.length} edge(s) on this page:`));
    row.appendChild(renderLaneBoard({ nodes: holding.boardNodes, edges: holding.edges, width: holding.width, height: holding.height }));
  }

  if (holding.totalPages > 1) row.appendChild(renderPager(holding));
  return row;
}

function renderPager(holding) {
  const pager = el('div', 'pager');
  const prev = el('button', null, 'prev');
  prev.type = 'button';
  prev.disabled = holding.page === 0;
  prev.addEventListener('click', () => { holdingPage = Math.max(0, holdingPage - 1); render(); });
  const next = el('button', null, 'next');
  next.type = 'button';
  next.disabled = holding.page >= holding.totalPages - 1;
  next.addEventListener('click', () => { holdingPage = Math.min(holding.totalPages - 1, holdingPage + 1); render(); });
  pager.appendChild(prev);
  pager.appendChild(el('span', null, `page ${holding.page + 1} / ${holding.totalPages}`));
  pager.appendChild(next);
  return pager;
}

/**
 * The SDD view (#998 R998-4): one row per change — active first, archived
 * under their own heading with their archive path — each with its seven
 * stage cells, its task count, its slice plan (declared scope only, "PR
 * state is not read" said in band per the ruling), and its named
 * phase-order violations. `lib/sdd-model.mjs` decided all of it; this
 * renders one loop over rows this page never re-derives.
 */
function renderSdd() {
  const model = buildSddModel(sectionOf(state, 'changes'));
  clear(mounts.canvas);
  if (!model.ok) {
    mounts.canvas.appendChild(said(`the SDD view could not be computed: ${model.reason}`));
    return;
  }
  const { changes, totals, sliceNote } = model.value;
  mounts.canvas.appendChild(el('p', 'canvas-summary', `${totals.active} active change(s), ${totals.archived} archived, ${totals.withViolations} with a phase-order violation`));
  // Review of PR 4, fix 1: a not-issue-numbered archive/ dir is skipped from
  // the rows above but never silently dropped — said here by name.
  if (totals.archiveSkipped.count > 0) {
    mounts.canvas.appendChild(said(`${totals.archiveSkipped.count} archive dir(s) skipped: ${totals.archiveSkipped.names.join(', ')}`));
  }

  for (const change of changes.filter((c) => !c.archived)) mounts.canvas.appendChild(renderSddRow(change, sliceNote));
  const archived = changes.filter((c) => c.archived);
  if (archived.length > 0) {
    mounts.canvas.appendChild(el('h3', 'sdd-archived-heading', 'Archived'));
    for (const change of archived) mounts.canvas.appendChild(renderSddRow(change, sliceNote));
  }
}

/**
 * Every value this row draws carries its own source underneath it (A3,
 * extended to the SDD view by review of PR 4, fix 2): the row header already
 * stamped `change.dir`; each stage cell, the tasks line, and each slice line
 * now stamp their own `source` the same way, rather than trusting the
 * header's stamp to stand in for the whole row.
 */
function renderSddRow(change, sliceNote) {
  const row = el('div', 'sdd-row');
  const header = el('div', 'sdd-row-header');
  header.appendChild(el('strong', null, `#${change.issue}${change.slug ? ` ${change.slug}` : ''}`));
  header.appendChild(el('span', 'source', sourceStamp({ path: change.dir }).label));
  row.appendChild(header);

  const matrix = el('div', 'sdd-matrix');
  for (const stage of change.stages) {
    const cell = el('span', `sdd-stage sdd-stage-${stage.state}`, `${STAGE_VOCAB[stage.state].mark} ${stage.id} `);
    cell.appendChild(el('span', 'source', sourceStamp(stage.source).label));
    matrix.appendChild(cell);
  }
  row.appendChild(matrix);

  const t = change.tasks;
  const tasksLine = el('p', 'sdd-tasks', `tasks: ${t.checked} checked, ${t.open} open${t.next ? ` — next: ${t.next}` : ''} `);
  tasksLine.appendChild(el('span', 'source', sourceStamp(t.source).label));
  row.appendChild(tasksLine);

  if (change.slices.length > 0) {
    const wrap = document.createElement('div');
    wrap.appendChild(said(`slice plan (declared scope only — ${sliceNote}):`));
    const list = el('ul', 'said-list');
    for (const s of change.slices) {
      const li = document.createElement('li');
      li.appendChild(document.createTextNode(`slice ${s.n}: claims ${s.claims.join(', ')} → ${s.terminalPr} `));
      li.appendChild(el('span', 'source', sourceStamp(s.source).label));
      list.appendChild(li);
    }
    wrap.appendChild(list);
    row.appendChild(wrap);
  }
  if (change.phaseOrder.violations.length > 0) {
    row.appendChild(saidList(`${change.phaseOrder.violations.length} phase-order violation(s):`, change.phaseOrder.violations.map((v) => `${v.stage}: ${v.reason}`)));
  }
  return row;
}

/**
 * The reviews view (#998 R998-5): the verdict queue first ("waiting on a
 * verdict right now"), then one card per PR thread with its rounds oldest
 * first — verdict word + ✓/✕ mark, findings grouped by severity. An
 * unreadable thread is a row with its reason; a thread with no round says
 * so. `lib/review-timeline.mjs` decided all of it; this renders one loop
 * over rows this page never re-derives.
 */
function renderReviews() {
  const model = buildReviewTimeline(sectionOf(state, 'reviews'), sectionOf(state, 'prs'));
  clear(mounts.canvas);
  if (!model.ok) {
    mounts.canvas.appendChild(said(`the reviews timeline could not be computed: ${model.reason}`));
    return;
  }
  const { threads, queue, totals } = model.value;
  mounts.canvas.appendChild(el('p', 'canvas-summary', `${totals.threads} thread(s), ${totals.queue} waiting on a verdict, ${totals.unreadable} unreadable`));
  mounts.canvas.appendChild(renderQueue(queue));
  for (const thread of threads) mounts.canvas.appendChild(renderReviewThread(thread));
}

function renderQueue(queue) {
  const wrap = el('div', 'review-queue');
  wrap.appendChild(el('h3', null, 'waiting on a verdict right now'));
  if (queue.length === 0) {
    wrap.appendChild(said('nothing is waiting on a verdict'));
    return wrap;
  }
  const list = el('ul', 'queue-list');
  for (const item of queue) list.appendChild(el('li', null, `#${item.pr}${item.title ? ` ${item.title}` : ''} — ${item.wait}`));
  wrap.appendChild(list);
  return wrap;
}

function renderReviewThread(thread) {
  const card = el('div', 'review-card');
  card.appendChild(el('strong', null, `#${thread.pr}${thread.title ? ` ${thread.title}` : ''}`));
  if (thread.unreadable) {
    card.appendChild(said(`this thread could not be read: ${thread.unreadable.reason}`));
    return card;
  }
  if (thread.noRound) {
    card.appendChild(said('no round posted'));
    return card;
  }
  for (const round of thread.rounds) card.appendChild(renderReviewRound(round));
  return card;
}

/** One round: its verdict word + mark, its findings grouped by severity (#998 R998-5) — a finding's own `source` (its `file`/`line` anchor when the verdict carried one, per `verdict.mjs`'s `hasUsableAnchor`/REQ-405-2, measured on PR #1006) is rendered through the same `sourceStamp` helper as every other value on this page, beside its excerpt and cites. */
function renderReviewRound(round) {
  const row = el('div', 'review-round');
  const mark = round.verdict === 'APPROVE' ? '✓' : '✕';
  row.appendChild(el('p', 'review-round-head', `${mark} ${round.verdict} — rev ${round.rev}, ${round.author ?? 'unknown author'}${round.headSha7 ? `, head ${round.headSha7}` : ''}`));
  if (round.findings.length === 0) {
    row.appendChild(said('no findings'));
    return row;
  }
  const chips = el('div', 'severity-chips');
  for (const [severity, count] of Object.entries(round.bySeverity)) chips.appendChild(el('span', `severity-chip severity-${severity}`, `${severity} × ${count}`));
  row.appendChild(chips);
  for (const f of round.findings) {
    const item = el('div', 'finding');
    item.appendChild(el('strong', null, `${f.severity ?? 'unknown'} — ${f.id ?? '?'}`));
    item.appendChild(renderSourceStamp(sourceStamp(f.source))); // #998 R998-5: a finding's own file:line (or the said fallback), through the same stamp helper the door uses
    item.appendChild(el('p', null, `${f.evidenceExcerpt ?? ''}${f.cites ? ` (cites ${f.cites})` : ''}`));
    row.appendChild(item);
  }
  return row;
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
 * The inspector drawer: six tabs (#998 R998-6), one entry shape, and a
 * source string under every single value (A3). `drawer-model.mjs` decided
 * all of it — including
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
  card.appendChild(renderSourceStamp(item.sourceStamp)); // #998 R998-2: the design's stamp, beside the value itself (A3)
  for (const child of item.children ?? []) card.appendChild(renderEntry(child));
  return card;
}

/**
 * The stamp's label, plus a chip when it carries an href (#998 R998-2). The
 * href is the model's own guarantee (only an https forge/link URL ever gets
 * one) — this function sets it as an attribute, never as markup.
 */
function renderSourceStamp(stamp) {
  const wrap = document.createDocumentFragment();
  wrap.appendChild(el('span', 'source', stamp.label));
  if (stamp.href) {
    const chip = el('a', 'source-chip', 'open ↗');
    chip.setAttribute('href', stamp.href);
    chip.setAttribute('rel', 'noopener noreferrer');
    chip.setAttribute('target', '_blank');
    wrap.appendChild(chip);
  }
  return wrap;
}

/** The drawer's own IO. A failed read is a reason IN the drawer, never a drawer that stays empty. */
const changeRequests = requestSequence();
async function loadChange(issue) {
  const token = changeRequests.next();
  let next;
  try {
    const res = await fetch(`/api/change/${issue}`);
    if (!res.ok) throw new Error(`answered ${res.status}`);
    next = await res.json();
  } catch (err) {
    next = { ok: false, reason: `the change view for #${issue} could not be read: ${err.message}` };
  }
  // A slower answer for a node the operator has moved away from, or an older
  // answer for the SAME node (a burst of refs frames), never overwrites the
  // one now on screen.
  if (!changeRequests.isCurrent(token) || selectedIssue !== issue) return;
  changeView = next;
  renderDrawer();
}

// ── keyboard (#998 R998-2) ───────────────────────────────────────────────

/**
 * The nodes `j`/`k` may traverse (#998 R998-3): every board node across
 * every lane — never the `?` holding lane's paged rows, which carry no
 * board coordinates to traverse in reading order. Each lane lays itself out
 * in its OWN space starting at (0, 0) (lane-model.mjs), so two lanes' nodes
 * cannot be compared by `y` directly; folding the lane's row position into
 * a large offset keeps `keyAction`'s existing top-to-bottom sort correct
 * across the stacked rows without teaching `view-model.mjs` anything about
 * lanes.
 */
function drawnNodes() {
  if (view !== 'map') return [];
  const model = buildLaneModel(sectionOf(state, 'graph'), { collapsedTracks, holdingPage });
  if (!model.ok) return [];
  const nodes = [];
  model.value.lanes.forEach((lane, laneIndex) => {
    for (const node of lane.nodes) nodes.push({ ...node, y: laneIndex * 1e6 + node.y });
  });
  return nodes;
}

/**
 * One listener for the whole page, routed entirely through
 * `keyAction` — this function decides nothing, it only executes what that
 * pure function returned. A Cmd/Ctrl/Alt combination or a keystroke while
 * an input is focused is never this page's to take.
 */
function onKeyDown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
  const action = keyAction(view, event.key, { nodes: drawnNodes(), selected: selectedIssue });
  if (action.type === 'none') return;
  event.preventDefault();
  if (action.type === 'mode') switchToMode(action.mode);
  else if (action.type === 'select') selectNode(action.issue);
  else if (action.type === 'close') closeDrawer();
}

document.addEventListener('keydown', onKeyDown);

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
