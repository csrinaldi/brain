// roadmap-model.mjs — the epic graph grouped by epic, for real (#882
// R882-2). Pure, imported by the browser and by node:test (D9): no
// `node:` builtin, no clock, no random, no fetch.
//
// Rule zero (the same "never filter a node away" discipline
// lane-model.mjs's `?` holding lane already holds for undeclared tracks):
// a node with no epic parent — no declared parent, or a declared parent
// that does not itself declare `kind: epic` — lands in the `unlinked`
// bucket, never dropped and never nested under a node that is not really
// an epic. No timeline is computed here (no start/due date exists
// anywhere in the data): this is per-epic STATUS grouping only.

import { stateOf } from './state-vocab.mjs';

const byNumber = (a, b) => a.number - b.number;

/** One roadmap row: the node's own roadmap state (state-vocab.mjs's own priority table — never a second computation of what a node's state is), its open blockers, and the `parent`-keyed divergences graph.mjs already found for it. */
function roadmapRow(node, divergences) {
  return {
    number: node.number,
    title: node.title,
    state: stateOf(node),
    blockedBy: node.blockedBy ?? [],
    divergences,
  };
}

/**
 * buildRoadmapModel(graphSection) -> {ok:true, value:{epics, unlinked}} |
 * {ok:false, reason}.
 *
 * `epics` is one row per `kind === 'epic'` node, its declared children
 * nested under it (every node whose `parent` resolves to that epic's
 * number). `unlinked` is every other node: no declared parent, or a
 * declared parent that does not resolve to an epic — carrying the
 * `parent`-keyed `declarationDivergences` entry as its own warning rather
 * than absorbing it silently.
 *
 * Determinism: the same graph, with `nodes` in any order, produces a
 * byte-identical model — every grouping sorts by issue number before it
 * builds a row.
 *
 * @param {{ok:boolean, value?:{nodes:Array, declarationDivergences?:Array}, reason?:string}} graphSection
 */
export function buildRoadmapModel(graphSection) {
  if (!graphSection || typeof graphSection !== 'object') return { ok: false, reason: 'no graph section was given to the roadmap' };
  if (graphSection.ok !== true) return { ok: false, reason: graphSection.reason };

  const { nodes = [], declarationDivergences = [] } = graphSection.value ?? {};

  const divergencesByNode = new Map();
  for (const d of declarationDivergences) {
    if (d.key !== 'parent') continue;
    const list = divergencesByNode.get(d.number) ?? [];
    list.push({ key: d.key, value: d.value, reason: d.reason });
    divergencesByNode.set(d.number, list);
  }
  const divergencesFor = (number) => divergencesByNode.get(number) ?? [];

  const sorted = [...nodes].sort(byNumber);
  const byNode = new Map(sorted.map((n) => [n.number, n]));

  const childrenByEpic = new Map();
  for (const n of sorted) if (n.kind === 'epic') childrenByEpic.set(n.number, []);

  const unlinked = [];
  for (const n of sorted) {
    if (n.kind === 'epic') continue;
    const parentNode = n.parent === null || n.parent === undefined ? null : byNode.get(n.parent);
    if (parentNode && parentNode.kind === 'epic') {
      childrenByEpic.get(parentNode.number).push(roadmapRow(n, divergencesFor(n.number)));
    } else {
      unlinked.push(roadmapRow(n, divergencesFor(n.number)));
    }
  }

  const epics = sorted
    .filter((n) => n.kind === 'epic')
    .map((n) => ({ ...roadmapRow(n, divergencesFor(n.number)), children: childrenByEpic.get(n.number) }));

  return { ok: true, value: { epics, unlinked } };
}
