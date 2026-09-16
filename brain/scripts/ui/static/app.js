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

import { initialPageState, applyFrame, streamFailed, sectionOf } from './lib/frames.mjs';
import { degradationBands, pollIndicator } from './lib/banners.mjs';

const mounts = {
  status: document.getElementById('status'),
  banners: document.getElementById('banners'),
  canvas: document.getElementById('canvas'),
  drawer: document.getElementById('drawer'),
};

let state = initialPageState();

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

// ── render ─────────────────────────────────────────────────────────────────

function render() {
  renderStatus();
  renderBands();
  renderCanvas();
}

/** R881-9: one band per degraded thing, each one BESIDE the data, never instead of it. */
function renderBands() {
  clear(mounts.banners);
  for (const band of degradationBands({ stream: state.stream, meta: state.meta, snapshot: state.snapshot })) {
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

function renderCanvas() {
  const graph = sectionOf(state, 'graph');
  clear(mounts.canvas);
  if (!graph.ok) {
    mounts.canvas.appendChild(said(`the graph could not be computed: ${graph.reason}`));
    return;
  }
  mounts.canvas.appendChild(el('p', 'canvas-summary', `${graph.value.nodes.length} open issue(s) in the read model`));
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
    state = { ...state, meta: { ...(state.meta ?? {}), poller: await res.json() } };
  } catch (err) {
    state = streamFailed(state, `the poll control failed: ${err.message}`);
  }
  render();
}

function subscribe() {
  const stream = new EventSource('/api/stream');
  for (const name of ['sync', 'section', 'refs', 'status']) {
    stream.addEventListener(name, (event) => {
      state = applyFrame(state, name, JSON.parse(event.data));
      render();
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
