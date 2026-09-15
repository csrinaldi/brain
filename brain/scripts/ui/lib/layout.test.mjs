// layout.test.mjs — R881-7, D10. `layout({nodes, edges})` is a pure function
// to per-node coordinates: same input -> same output, a cycle never crashes
// or drops a node, and a blocker always lands strictly above the node it
// blocks.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { layout } from './layout.mjs';

function node(number, extra = {}) {
  return { number, ...extra };
}

function everyNodeNumber(result) {
  return [...result.layers.flat(), ...result.unlinked].sort((a, b) => a - b);
}

test('#881: same input, same output — two calls on the same {nodes, edges} return byte-identical coordinates', () => {
  const nodes = [node(1), node(2), node(3)];
  const edges = [{ from: 1, to: 2 }, { from: 2, to: 3 }];
  const first = layout({ nodes, edges });
  const second = layout({ nodes, edges });
  assert.deepEqual(first, second);
});

test('#881: same input, same output — a shuffled node array still returns byte-identical coordinates (D10 pass 3, no convergence loop)', () => {
  const edges = [{ from: 1, to: 2 }, { from: 2, to: 3 }, { from: 1, to: 3 }];
  const inOrder = layout({ nodes: [node(1), node(2), node(3)], edges });
  const shuffled = layout({ nodes: [node(3), node(1), node(2)], edges });
  assert.deepEqual(inOrder, shuffled);
});

test('#881: a cycle does not crash or hide any node, and the back edge is truly reversed for layering', () => {
  const nodes = [node(1), node(2), node(3)];
  const edges = [{ from: 1, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 1 }]; // a 3-cycle, as `divergences` may report
  assert.doesNotThrow(() => layout({ nodes, edges }));
  const result = layout({ nodes, edges });
  assert.deepEqual(everyNodeNumber(result), [1, 2, 3]);
  for (const n of [1, 2, 3]) assert.ok(result.nodes[n], `node ${n} has no coordinate`);
  // 1 is the DFS root (smallest node number): its only incoming edge is the
  // 3->1 back edge, which pass 1 MUST reverse away from being an incoming
  // edge of 1 — so 1 stays in layer 0. A layering pass that failed to
  // reverse the back edge would feed layer(1) back into its own
  // computation and grow it without bound across the bounded-relaxation
  // passes instead of settling at 0.
  assert.equal(result.nodes[1].layer, 0);
});

test('#881: the blockedBy orientation pin — every n.blockedBy member lands in a strictly smaller layer than n', () => {
  // epic-graph.mjs:432-438: `from` is the blocker, `to` is the blocked.
  const nodes = [
    node(1, { blockedBy: [] }),
    node(2, { blockedBy: [1] }),
    node(3, { blockedBy: [1, 2] }),
  ];
  const edges = [{ from: 1, to: 2 }, { from: 1, to: 3 }, { from: 2, to: 3 }];
  const result = layout({ nodes, edges });
  for (const n of nodes) {
    for (const blocker of n.blockedBy) {
      assert.ok(
        result.nodes[blocker].layer < result.nodes[n.number].layer,
        `blocker ${blocker} must be in a strictly smaller layer than ${n.number}`,
      );
    }
  }
});

test('#881: a node with no edges lands in the trailing unlinked band, never dropped (ruling 1)', () => {
  const nodes = [node(1), node(2), node(9)]; // 9 is the `?`-track node, no edges at all
  const edges = [{ from: 1, to: 2 }];
  const result = layout({ nodes, edges });
  assert.deepEqual(result.unlinked, [9]);
  assert.ok(result.nodes[9], 'the unlinked node still has a coordinate');
  assert.ok(!result.layers.flat().includes(9), 'an unlinked node is never placed in a layer');
});

test('#881: an empty graph returns an empty layout, not a throw', () => {
  const result = layout({ nodes: [], edges: [] });
  assert.deepEqual(result.layers, []);
  assert.deepEqual(result.unlinked, []);
  assert.deepEqual(result.nodes, {});
  assert.equal(result.width, 0);
  assert.equal(result.height, 0);
});

test('#881: a reversed (back) edge is marked reversed:true on the output, the forward edge is not', () => {
  const nodes = [node(1), node(2)];
  const edges = [{ from: 1, to: 2 }, { from: 2, to: 1 }];
  const result = layout({ nodes, edges });
  const forward = result.edges.find((e) => e.from === 1 && e.to === 2);
  const back = result.edges.find((e) => e.from === 2 && e.to === 1);
  assert.equal(forward.reversed, false);
  assert.equal(back.reversed, true);
});

test('#881: every layout edge carries two coordinate points', () => {
  const nodes = [node(1), node(2)];
  const edges = [{ from: 1, to: 2 }];
  const result = layout({ nodes, edges });
  const [edge] = result.edges;
  assert.equal(edge.points.length, 2);
  for (const p of edge.points) {
    assert.equal(typeof p.x, 'number');
    assert.equal(typeof p.y, 'number');
  }
});
