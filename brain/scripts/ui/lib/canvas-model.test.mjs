import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCanvasModel } from './canvas-model.mjs';

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

test('#881 R881-6: a graph that could not be computed is a stated reason, never an empty canvas', () => {
  const model = buildCanvasModel({ ok: false, reason: 'the issue list could not be read: gh exploded' });
  assert.deepEqual(model, { ok: false, reason: 'the issue list could not be read: gh exploded' });
  assert.equal(buildCanvasModel(undefined).ok, false);
  assert.match(buildCanvasModel(undefined).reason, /no graph section/);
});

test('#881 R881-6 S1: every open issue becomes exactly one node — undeclared and unreadable ones included', () => {
  const model = buildCanvasModel(graph({
    nodes: [
      node(1),
      node(2, { track: null, status: 'unclassified', declared: false }),
      node(3, { status: 'unreadable', ok: false, reason: 'the issue body could not be read: 404', track: null, roadmap: { ok: false, reason: 'no PR list' } }),
    ],
    edges: [{ from: 1, to: 2 }],
    issuesUnreadable: [{ number: 3, reason: 'the issue body could not be read: 404' }],
  }));
  assert.equal(model.ok, true);
  assert.deepEqual(model.value.nodes.map((n) => n.number).sort((a, b) => a - b), [1, 2, 3]);
  for (const n of model.value.nodes) {
    assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), `#${n.number} must have coordinates`);
    assert.match(n.label, new RegExp(`^#${n.number} `), 'a node is labelled by its issue number and title');
  }
  assert.deepEqual(model.value.issuesUnreadable, [{ number: 3, reason: 'the issue body could not be read: 404' }]);
});

test('#881 R881-6: the `?` track, the unreadable mark and the "not computed" mark are all visible ON the node', () => {
  const model = buildCanvasModel(graph({
    nodes: [
      node(1, { track: null }),
      node(2, { status: 'unreadable', ok: false, roadmap: { ok: false, reason: 'unknown' } }),
      node(3, { roadmap: { ok: false, reason: 'the PR list could not be read' } }),
    ],
  }));
  const byNumber = Object.fromEntries(model.value.nodes.map((n) => [n.number, n]));
  assert.deepEqual(byNumber[1].marks, ['? track']);
  assert.equal(byNumber[2].className, 'status-unreadable');
  assert.ok(byNumber[2].marks.includes('unreadable'));
  assert.equal(byNumber[3].className, 'roadmap-not-computed');
  assert.ok(byNumber[3].marks.includes('not computed'), 'R881-6: "not computed" must never read as "planned"');
  assert.notEqual(byNumber[3].className, 'state-planned');
});

test('#881 R881-6: blocked overrides the state colour', () => {
  const model = buildCanvasModel(graph({ nodes: [node(1, { blockedBy: [2], status: 'blocked' }), node(2)], edges: [{ from: 2, to: 1 }] }));
  const byNumber = Object.fromEntries(model.value.nodes.map((n) => [n.number, n]));
  assert.equal(byNumber[1].className, 'status-blocked');
  assert.equal(byNumber[2].className, 'state-planned');
});

test('#881: one node with an unknown state cannot blank the canvas — it is marked and the rest still draws', () => {
  // `colour.mjs` THROWS on a state it does not know, by design (slice 3's
  // pre-push review left this obligation to the renderer explicitly).
  const model = buildCanvasModel(graph({
    nodes: [node(1), node(2, { roadmap: { ok: true, value: { state: 'sideways' } } }), node(3)],
  }));
  assert.equal(model.ok, true);
  const byNumber = Object.fromEntries(model.value.nodes.map((n) => [n.number, n]));
  assert.equal(byNumber[2].className, 'node-unknown');
  assert.ok(byNumber[2].marks.some((m) => /unknown state/.test(m) && /sideways/.test(m)), `the reason is said on the node: ${byNumber[2].marks.join(' | ')}`);
  assert.equal(byNumber[1].className, 'state-planned', 'every other node keeps its colour');
  assert.equal(byNumber[3].className, 'state-planned');
});

test('#881 R881-7: a reversed (back) edge is flagged for the renderer, and an edge to an unknown node is reported, not swallowed', () => {
  const model = buildCanvasModel(graph({
    nodes: [node(1), node(2)],
    edges: [{ from: 1, to: 2 }, { from: 2, to: 1 }, { from: 1, to: 99 }],
  }));
  assert.equal(model.value.edges.length, 2);
  assert.equal(model.value.edges.filter((e) => e.reversed).length, 1);
  assert.deepEqual(model.value.droppedEdges, [{ from: 1, to: 99, reason: 'unknown node' }]);
  for (const edge of model.value.edges) assert.equal(edge.points.length, 2, 'a straight line, two endpoints (D10)');
});

test('#881 R881-7: the same graph gives the same model twice, and the box fits every node', () => {
  const input = graph({ nodes: [node(3), node(1), node(2, { track: null })], edges: [{ from: 1, to: 3 }] });
  assert.deepEqual(buildCanvasModel(input), buildCanvasModel(input));
  const { value } = buildCanvasModel(input);
  for (const n of value.nodes) {
    assert.ok(n.x + n.w <= value.width, `#${n.number} is inside the canvas width`);
    assert.ok(n.y + n.h <= value.height, `#${n.number} is inside the canvas height`);
  }
  assert.deepEqual(value.unlinked, [2], 'a node in no edge is still drawn, in the trailing band (ruling 1)');
});
