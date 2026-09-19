// lane-model.test.mjs — #998 R998-3: track lanes and the `?` holding lane.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildLaneModel, nodeSummaryFor } from './lane-model.mjs';
import { parseGraphBlock } from '../../status/epic-graph.mjs';

const node = (number, over = {}) => ({
  number,
  title: `issue ${number}`,
  status: 'ready',
  track: 'A',
  blockedBy: [],
  ok: true,
  roadmap: { ok: true, value: { state: 'planned' } },
  ...over,
});

const graph = (value) => ({ ok: true, value: { nodes: [], edges: [], issuesUnreadable: [], ...value } });

test('#998 R998-3: a graph that could not be computed is a stated reason, never an empty lane row', () => {
  const model = buildLaneModel({ ok: false, reason: 'the issue list could not be read: gh exploded' });
  assert.deepEqual(model, { ok: false, reason: 'the issue list could not be read: gh exploded' });
  assert.equal(buildLaneModel(undefined).ok, false);
  assert.match(buildLaneModel(undefined).reason, /no graph section/);
});

test('#998 R998-3: the undeclared majority lands in the `?` holding lane, collapsed by default, with a visible total', () => {
  const nodes = [];
  for (let i = 1; i <= 67; i++) nodes.push(node(i, { track: null }));
  for (let i = 68; i <= 91; i++) nodes.push(node(i, { track: i % 2 === 0 ? 'A' : 'B' }));
  const model = buildLaneModel(graph({ nodes }));
  assert.equal(model.ok, true);
  assert.equal(model.value.holding.count, 67);
  assert.equal(model.value.holding.collapsed, true, 'the `?` lane is collapsed by default');
  const totalInLanes = model.value.lanes.reduce((sum, l) => sum + l.count, 0);
  assert.equal(totalInLanes + model.value.holding.count, 91, 'every node lands in exactly one lane or the holding lane');
  const s = model.value.edgeSummary;
  assert.equal(s.laneInternal + s.holdingInternal + s.crossLane + s.unknownNode, 0, 'no edges in this fixture, so every count and the sum is zero');
  assert.equal(s.total, 0, "the 91-node fixture's edgeSummary sums to its edge count (0)");
});

test('#998 R998-3: an edge between two undeclared nodes belongs to the holding lane — it is classified, not swallowed', () => {
  const model = buildLaneModel(graph({
    nodes: [node(1, { track: null }), node(2, { track: null })],
    edges: [{ from: 1, to: 2 }],
  }));
  assert.equal(model.value.holding.edges.length, 1, 'the holding-holding edge lands in holding.edges');
  assert.equal(model.value.holding.edges[0].from, 1);
  assert.equal(model.value.holding.edges[0].to, 2);
  assert.equal(model.value.holding.edgeCount, 1, 'counted for the collapsed header');
  assert.deepEqual(model.value.edgeSummary, { laneInternal: 0, holdingInternal: 1, crossLane: 0, unknownNode: 0, total: 1 });
});

test('#998 R998-3: an edge from the holding lane to a declared track crosses lanes, named `?`', () => {
  const model = buildLaneModel(graph({
    nodes: [node(1, { track: null }), node(2, { track: 'A' })],
    edges: [{ from: 1, to: 2 }],
  }));
  assert.deepEqual(model.value.crossEdges, [{ from: 1, to: 2, fromTrack: '?', toTrack: 'A' }]);
  assert.equal(model.value.holding.edges.length, 0, 'a cross-lane edge belongs to neither the holding board nor a lane board');
  assert.equal(model.value.edgeSummary.crossLane, 1);
  assert.equal(model.value.edgeSummary.total, 1);
});

test('#998 R998-3: the holding lane pages at 24 per page', () => {
  const nodes = Array.from({ length: 50 }, (_, i) => node(i + 1, { track: null }));
  const model = buildLaneModel(graph({ nodes }), { holdingPage: 1 });
  assert.equal(model.value.holding.nodes.length, 24);
  assert.deepEqual(model.value.holding.nodes.map((n) => n.number), Array.from({ length: 24 }, (_, i) => 25 + i));
  assert.equal(model.value.holding.totalPages, 3);
});

test('#998 R998-3: a reversed edge inside a lane is kept, marked, and never treated as leaving the lane', () => {
  const model = buildLaneModel(graph({
    nodes: [node(1), node(2)],
    edges: [{ from: 1, to: 2 }, { from: 2, to: 1 }],
  }));
  const laneA = model.value.lanes.find((l) => l.track === 'A');
  assert.equal(laneA.edges.length, 2);
  assert.equal(laneA.edges.filter((e) => e.reversed).length, 1);
  assert.equal(model.value.crossEdges.length, 0);
});

test('#998 R998-3: a cross-lane edge is never dropped — it is reported with both lanes named', () => {
  const model = buildLaneModel(graph({
    nodes: [node(1, { track: 'A' }), node(2, { track: 'B' })],
    edges: [{ from: 1, to: 2 }],
  }));
  assert.deepEqual(model.value.crossEdges, [{ from: 1, to: 2, fromTrack: 'A', toTrack: 'B' }]);
  for (const lane of model.value.lanes) assert.equal(lane.edges.length, 0, "the cross edge belongs to neither lane's own board");
});

test('#998 R998-3: an edge to an unknown node is reported, not swallowed', () => {
  const model = buildLaneModel(graph({ nodes: [node(1)], edges: [{ from: 1, to: 99 }] }));
  assert.deepEqual(model.value.droppedEdges, [{ from: 1, to: 99, reason: 'unknown node' }]);
});

test('#998 R998-3: every node carries a state word and mark for the label, alongside its existing marks', () => {
  const model = buildLaneModel(graph({ nodes: [node(1, { blockedBy: [2] })] }));
  const drawn = model.value.lanes[0].nodes[0];
  assert.deepEqual(drawn.state, { code: 'blocked', label: 'Blocked', mark: '⊘' });
  assert.ok(Array.isArray(drawn.marks) && drawn.marks.some((m) => m.includes('blocked by')));
});

test('#998 R998-3: epic grouping says "not data yet" instead of faking lanes', () => {
  const model = buildLaneModel(graph({ nodes: [node(1)] }));
  assert.deepEqual(model.value.epicGrouping, { ok: false, reason: 'kind and parent are not data yet (#967)' });
});

test('#998 R998-3: the declare snippet parses as a real brain-graph/1 declaration', () => {
  const model = buildLaneModel(graph({ nodes: [] }));
  const parsed = parseGraphBlock(model.value.holding.declareSnippet);
  assert.ok(parsed && parsed.ok !== false, `the snippet must parse: ${JSON.stringify(parsed)}`);
  assert.equal(typeof parsed.track, 'string');
  assert.ok(parsed.track.length > 0, 'the snippet declares a track, the whole point of pasting it');
});

test('#998 R998-3: a lane with zero nodes does not exist', () => {
  const model = buildLaneModel(graph({ nodes: [node(1, { track: 'A' })] }));
  assert.deepEqual(model.value.lanes.map((l) => l.track), ['A']);
  assert.ok(model.value.lanes.every((l) => l.count > 0));
});

test('#998 R998-3: the `?` lane with zero nodes says every open issue declares a track', () => {
  const model = buildLaneModel(graph({ nodes: [node(1, { track: 'A' })] }));
  assert.equal(model.value.holding.count, 0);
  assert.equal(model.value.holding.note, 'every open issue declares a track');
});

test('#998 R998-3: the same graph, nodes and edges shuffled, gives a byte-identical model', () => {
  const nodes = [node(3, { track: 'B' }), node(1, { track: 'A' }), node(5, { track: null }), node(2, { track: 'A' }), node(4, { track: 'B' })];
  const edges = [{ from: 1, to: 2 }, { from: 3, to: 4 }];
  const a = buildLaneModel(graph({ nodes, edges }));
  const b = buildLaneModel(graph({ nodes: [...nodes].reverse(), edges: [...edges].reverse() }));
  assert.deepEqual(a, b);
});

// ── #1059 phase 3: the design draws a lane as a grid of cards ─────────────
// A card names the issue, its title on its own line, its state, and what it
// waits on. `label` glued the number and the title into one string for an SVG
// text node; a card needs them apart, and the edges it used to draw as lines
// become the words "blocked by #N" on the card that is blocked.
test('#1059 region 03: a lane node carries its title and what blocks it, apart from its label', () => {
  const model = buildLaneModel({ ok: true, value: {
    nodes: [
      { number: 881, title: 'ui server, SVG canvas, SSE live stream', track: 'UI', status: 'ready', blockedBy: [], roadmap: { ok: true, value: { state: 'in-flight' } } },
      { number: 882, title: 'management views', track: 'UI', status: 'blocked', blockedBy: [881], roadmap: { ok: true, value: { state: 'planned' } } },
    ],
    edges: [{ from: 881, to: 882 }],
    tracks: new Map([['UI', [881, 882]]]),
  } });

  assert.equal(model.ok, true);
  const [lane] = model.value.lanes;
  const [first, second] = lane.nodes;
  assert.equal(first.title, 'ui server, SVG canvas, SSE live stream', 'the title stands on its own, not glued into the label');
  assert.deepEqual(second.blockedBy, [881], 'what a node waits on is a fact of the card, not only a drawn line');
  assert.deepEqual(first.blockedBy, []);
});

// #1059 phase 5: the design states the batch as a proportion — "67 of 91 open
// issues declared no block" — so the holding lane carries the total it is a
// part of, rather than the page computing it from two places.
test('#1059 region 04: the holding lane knows the whole it is a part of', () => {
  const model = buildLaneModel({ ok: true, value: {
    nodes: [
      { number: 1, title: 'a', track: 'UI', status: 'ready', blockedBy: [] },
      { number: 2, title: 'b', track: null, status: 'unclassified', blockedBy: [] },
      { number: 3, title: 'c', track: null, status: 'unclassified', blockedBy: [] },
    ],
    edges: [],
    tracks: new Map([['UI', [1]]]),
  } });

  assert.equal(model.value.holding.count, 2);
  assert.equal(model.value.holding.total, 3, 'the batch says "2 of 3", and both numbers come from one place');
});

// ── #1059 region 08: the drawer's own header names the node ───────────────
// The design's panel opens with the issue's number, its state, its track and a
// link to the forge. That is the same shape a card carries, so it comes from
// the same place rather than being derived a second time in the page.
test('#1059 region 08: nodeSummaryFor gives the drawer the node a card would show', () => {
  const graph = { ok: true, value: {
    nodes: [{ number: 881, title: 'ui server', track: 'UI', status: 'ready', blockedBy: [879], roadmap: { ok: true, value: { state: 'in-flight' } } }],
    edges: [], tracks: new Map([['UI', [881]]]),
  } };

  const found = nodeSummaryFor(graph, 881);
  assert.equal(found.ok, true);
  assert.equal(found.value.number, 881);
  assert.equal(found.value.title, 'ui server');
  assert.equal(found.value.track, 'UI');
  assert.deepEqual(found.value.blockedBy, [879]);
  assert.equal(typeof found.value.state.label, 'string');
  assert.equal(typeof found.value.state.mark, 'string');

  const missing = nodeSummaryFor(graph, 4242);
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /#4242/, 'an issue the graph does not hold says which one');

  const unreadable = nodeSummaryFor({ ok: false, reason: 'the forge would not answer' }, 881);
  assert.equal(unreadable.reason, 'the forge would not answer', 'the section\'s own reason passes through');
});
