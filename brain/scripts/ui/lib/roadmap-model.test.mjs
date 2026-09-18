// roadmap-model.test.mjs — R882-2: the epic graph grouped for real. No
// timeline is computed (no start/due date exists anywhere in the data) —
// this is per-epic STATUS grouping only.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildRoadmapModel } from './roadmap-model.mjs';

const node = (number, over = {}) => ({
  number,
  title: `issue ${number}`,
  kind: null,
  parent: null,
  status: 'ready',
  blockedBy: [],
  roadmap: { ok: true, value: { state: 'planned' } },
  ...over,
});

const graph = (over = {}) => ({ ok: true, value: { nodes: [], declarationDivergences: [], ...over } });

test('#882 R882-2: a graph section that could not be computed is a stated reason, never an empty roadmap', () => {
  assert.deepEqual(buildRoadmapModel({ ok: false, reason: 'the issue list could not be read: gh exploded' }), {
    ok: false,
    reason: 'the issue list could not be read: gh exploded',
  });
  assert.equal(buildRoadmapModel(undefined).ok, false);
  assert.match(buildRoadmapModel(undefined).reason, /no graph section/);
});

test('#882 R882-2: an epic\'s declared children nest under it, each carrying its own roadmap state', () => {
  const epic = node(1, { kind: 'epic', title: 'the epic' });
  const c1 = node(2, { parent: 1, roadmap: { ok: true, value: { state: 'in-flight' } } });
  const c2 = node(3, { parent: 1, roadmap: { ok: true, value: { state: 'done' } } });
  const c3 = node(4, { parent: 1 });
  const model = buildRoadmapModel(graph({ nodes: [epic, c1, c2, c3] }));
  assert.equal(model.ok, true);
  assert.equal(model.value.epics.length, 1);
  const row = model.value.epics[0];
  assert.equal(row.number, 1);
  assert.deepEqual(row.children.map((c) => c.number), [2, 3, 4]);
  assert.equal(row.children[0].state.code, 'in-flight');
  assert.equal(row.children[1].state.code, 'done');
});

test('#882 R882-2: a node with no declared parent is never dropped — it lands in the unlinked bucket', () => {
  const model = buildRoadmapModel(graph({ nodes: [node(5)] }));
  assert.equal(model.ok, true);
  assert.equal(model.value.epics.length, 0);
  assert.deepEqual(model.value.unlinked.map((n) => n.number), [5]);
});

test('#882 R882-2: a parent that is not itself an epic is said, never silently trusted as a real epic', () => {
  const notEpic = node(1, { title: 'not an epic' });
  const child = node(2, { parent: 1 });
  const divergences = [{ number: 2, key: 'parent', value: 1, reason: 'parent-not-epic' }];
  const model = buildRoadmapModel(graph({ nodes: [notEpic, child], declarationDivergences: divergences }));
  assert.equal(model.ok, true);
  assert.equal(model.value.epics.length, 0, 'the non-epic parent gets no epic row');
  assert.deepEqual(model.value.unlinked.map((n) => n.number), [1, 2], 'neither node is dropped — the would-be parent is itself a plain unlinked node');
  const childRow = model.value.unlinked.find((n) => n.number === 2);
  assert.deepEqual(childRow.divergences, [{ key: 'parent', value: 1, reason: 'parent-not-epic' }], 'the child carries its own parent-not-epic divergence, never silently nested under #1');
});

test('#882 R882-2: determinism under shuffled input — the same graph, nodes in any order, is a byte-identical model', () => {
  const epic = node(10, { kind: 'epic' });
  const c1 = node(11, { parent: 10 });
  const c2 = node(12, { parent: 10 });
  const unlinked1 = node(13);
  const unlinked2 = node(14);
  const forward = buildRoadmapModel(graph({ nodes: [epic, c1, c2, unlinked1, unlinked2] }));
  const shuffled = buildRoadmapModel(graph({ nodes: [unlinked2, c2, epic, unlinked1, c1] }));
  assert.deepEqual(forward, shuffled);
});
