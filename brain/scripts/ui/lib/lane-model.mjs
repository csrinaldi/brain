// lane-model.mjs — the graph section grouped into track lanes and the `?`
// holding lane (#998 R998-3). Pure, imported by the browser AND by
// node:test (D9): no `node:` builtin, no clock, no random.
//
// Ruling 1 (R881-6 S1) still holds here: NO NODE IS EVER FILTERED. A node
// with a declared track lands in that track's lane; a node with none —
// undeclared (`track === null`, or unreadable, which carries no track
// either) — lands in the `?` holding lane, paged rather than dropped.
//
// `layout.mjs` is a coordinate engine, and a lane is a GROUPING, not a
// second layout engine (design.md's "Component → module map"): this module
// calls `layout()` once per lane, over that lane's own subgraph, and never
// extends it. Each lane therefore owns its OWN coordinate space starting at
// (0, 0) — two lanes both place their first node at x=0, y=0 — which is why
// a cross-lane edge is never drawn as a line here: doing so would need one
// shared coordinate space across every row, which lanes deliberately do not
// have. It is reported instead, in `crossEdges`, and `app.js` says it as
// text under the lanes.
//
// Epic grouping (`node.kind`/`node.parent`) is not data yet (#967;
// proposal.md ruling 5, 2026-09-16) — `epicGrouping` says so rather than
// faking a `kind:'epic'` grouping the data cannot back.

import { layout } from './layout.mjs';
import { stateOf, STATES } from './state-vocab.mjs';

const PAGE_SIZE = 24;

/**
 * The exact text an author pastes into an issue body to declare a track
 * (#998 R998-3): the `brain-graph/1` fence `parseGraphBlock`
 * (`status/epic-graph.mjs`) reads. `track: A` is a worked example, not a
 * placeholder syntax — an author replaces the letter, not the shape.
 */
const DECLARE_SNIPPET = [
  '```brain-graph/1',
  'track: A',
  'blocks: []',
  'needs: []',
  'files: []',
  '```',
].join('\n');

/** The marks a node carries (canvas-model.mjs's own rule, repeated here for a per-lane node) plus its state-vocab word — the label's whole content. */
function stateAndMarks(node) {
  const marks = [];
  if (node.status === 'unreadable') marks.push('unreadable');
  else if (node.track == null) marks.push('? track');
  if (node.roadmap && node.roadmap.ok === false) marks.push('not computed');
  if (Array.isArray(node.blockedBy) && node.blockedBy.length > 0) {
    marks.push(`blocked by ${node.blockedBy.map((n) => `#${n}`).join(', ')}`);
  }
  let state;
  try {
    state = stateOf(node);
  } catch (err) {
    // One unknown state cannot blank a lane, the same rule canvas-model.mjs
    // holds for the single board: mark it, keep the rest drawing.
    state = STATES.unknown;
    marks.push(`unknown state: ${err?.message ?? err}`);
  }
  return { marks, state };
}

/** A drawable node — canvas-model.mjs's shape, plus the state word/mark (#998 R998-3) — for one lane's own board. */
function drawnNode(node, box) {
  const { marks, state } = stateAndMarks(node);
  return {
    number: node.number,
    label: `#${node.number} ${node.title ?? ''}`.trim(),
    className: state.className,
    marks,
    track: node.track ?? null,
    state: { code: state.code, label: state.label, mark: state.mark },
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
  };
}

/** A holding-lane row: the same facts, no board coordinates — the `?` lane is a paged list, never a drawing (undeclared nodes carry no track to lay a board out against). */
function holdingRow(node) {
  const { marks, state } = stateAndMarks(node);
  return {
    number: node.number,
    label: `#${node.number} ${node.title ?? ''}`.trim(),
    marks,
    state: { code: state.code, label: state.label, mark: state.mark },
  };
}

const byNumber = (a, b) => a.number - b.number;
const byFromTo = (a, b) => a.from - b.from || a.to - b.to;

/**
 * buildLaneModel(graphSection, {collapsedTracks, holdingPage}) ->
 * {ok:true, value:{lanes, crossEdges, holding, droppedEdges,
 * issuesUnreadable, epicGrouping}} | {ok:false, reason}
 *
 * Determinism: the same graph, with `nodes`/`edges` in any order, produces a
 * byte-identical model — every grouping sorts before it lays out or pages.
 *
 * @param {{ok:boolean, value?:{nodes:Array, edges:Array, issuesUnreadable?:Array}, reason?:string}} graphSection
 * @param {{collapsedTracks?: Set<string>, holdingPage?: number}} [options] `collapsedTracks` holds the track ids currently collapsed — the `?` lane starts in it, so it is collapsed by default without `app.js` deciding that on its own.
 */
export function buildLaneModel(graphSection, { collapsedTracks = new Set(['?']), holdingPage = 0 } = {}) {
  if (!graphSection || typeof graphSection !== 'object') return { ok: false, reason: 'no graph section was given to the lanes' };
  if (graphSection.ok !== true) return { ok: false, reason: graphSection.reason };

  const { nodes = [], edges = [], issuesUnreadable = [] } = graphSection.value ?? {};

  const trackOf = new Map(nodes.map((n) => [n.number, n.track ?? null]));
  const byTrack = new Map();
  const holdingNodes = [];
  for (const node of [...nodes].sort(byNumber)) {
    if (node.track == null) { holdingNodes.push(node); continue; }
    if (!byTrack.has(node.track)) byTrack.set(node.track, []);
    byTrack.get(node.track).push(node);
  }

  // Edges are classified ONCE, over the whole graph, before any lane's own
  // layout() runs — a lane that only ever saw its own node subset would
  // read the other endpoint of a cross-lane edge as an unknown node
  // (layout.mjs's own "unknown node" reason), which is a different fact
  // from "this edge leaves the lane". Every valid edge lands in exactly one
  // of three buckets below.
  const droppedEdges = [];
  const crossEdges = [];
  const perLaneEdges = new Map();
  const holdingEdges = [];
  for (const e of edges) {
    if (!trackOf.has(e.from) || !trackOf.has(e.to)) {
      droppedEdges.push({ from: e.from, to: e.to, reason: 'unknown node' });
      continue;
    }
    const fromTrack = trackOf.get(e.from);
    const toTrack = trackOf.get(e.to);
    if (fromTrack === toTrack) {
      // Both undeclared: internal to the HOLDING lane, not a track lane —
      // the `?` lane is still a lane for edge classification (R998-3's
      // cold review), so this edge is kept and counted, never silently
      // continued past.
      if (fromTrack == null) { holdingEdges.push({ from: e.from, to: e.to }); continue; }
      if (!perLaneEdges.has(fromTrack)) perLaneEdges.set(fromTrack, []);
      perLaneEdges.get(fromTrack).push({ from: e.from, to: e.to });
      continue;
    }
    crossEdges.push({ from: e.from, to: e.to, fromTrack: fromTrack ?? '?', toTrack: toTrack ?? '?' });
  }
  crossEdges.sort(byFromTo);
  droppedEdges.sort(byFromTo);
  holdingEdges.sort(byFromTo);

  const trackNames = [...byTrack.keys()].sort((a, b) => a.localeCompare(b));
  const lanes = trackNames.map((track) => {
    const laneNodes = byTrack.get(track);
    const laneEdges = (perLaneEdges.get(track) ?? []).slice().sort(byFromTo);
    const placed = layout({ nodes: laneNodes, edges: laneEdges });
    const drawn = laneNodes.map((node) => drawnNode(node, placed.nodes[node.number]));
    return {
      track,
      label: `Track ${track}`,
      count: drawn.length,
      collapsed: collapsedTracks.has(track),
      nodes: drawn,
      edges: placed.edges,
      width: placed.width,
      height: placed.height,
    };
  });

  const holdingSorted = [...holdingNodes].sort(byNumber);
  const holdingTotal = holdingSorted.length;
  const totalPages = Math.max(1, Math.ceil(holdingTotal / PAGE_SIZE));
  const page = Math.min(Math.max(0, holdingPage), totalPages - 1);
  const pageNodesRaw = holdingSorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const pageNodes = pageNodesRaw.map(holdingRow);

  // holding.edges is a BOARD, laid out the same way a lane's own edges are
  // (one layout() call, over that page's own subgraph) — it is never the
  // full cross-page edge set, because only the current page's nodes have
  // coordinates to draw a line between. holding.edgeCount, by contrast, is
  // every holding-holding edge across every page, so the collapsed header
  // can say the true total without expanding first.
  const pageNumbers = new Set(pageNodesRaw.map((n) => n.number));
  const pageHoldingEdges = holdingEdges.filter((e) => pageNumbers.has(e.from) && pageNumbers.has(e.to));
  const placedHolding = layout({ nodes: pageNodesRaw, edges: pageHoldingEdges });
  const boardNodes = pageNodesRaw.map((node) => drawnNode(node, placedHolding.nodes[node.number]));

  const holding = {
    track: '?',
    count: holdingTotal,
    collapsed: collapsedTracks.has('?'),
    page,
    totalPages,
    nodes: pageNodes,
    boardNodes,
    edges: placedHolding.edges,
    edgeCount: holdingEdges.length,
    width: placedHolding.width,
    height: placedHolding.height,
    declareSnippet: DECLARE_SNIPPET,
    // Never empty-on-failure: a page with nothing currently visible and a
    // track with nothing left to declare are different facts.
    note: holdingTotal === 0 ? 'every open issue declares a track' : null,
  };

  // Every valid edge lands in EXACTLY one of these four counts — the
  // classification invariant a cold review (#998 R998-3) found broken for
  // same-track null/null edges, which used to vanish uncounted.
  const laneInternal = lanes.reduce((sum, l) => sum + l.edges.length, 0);
  const edgeSummary = {
    laneInternal,
    holdingInternal: holdingEdges.length,
    crossLane: crossEdges.length,
    unknownNode: droppedEdges.length,
    total: laneInternal + holdingEdges.length + crossEdges.length + droppedEdges.length,
  };

  return {
    ok: true,
    value: {
      lanes,
      crossEdges,
      holding,
      droppedEdges,
      issuesUnreadable,
      edgeSummary,
      epicGrouping: { ok: false, reason: 'kind and parent are not data yet (#967)' },
    },
  };
}
