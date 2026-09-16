// canvas-model.mjs — the graph section turned into everything the SVG needs
// (#881 PR 4 / B2, R881-6/R881-7). Pure, imported by the browser AND by
// node:test (D9): `app.js` does nothing with this output but create
// elements.
//
// Two rules this module exists to hold:
//
//   1. NO NODE IS EVER FILTERED (ruling 1, R881-6 S1). Every open issue in
//      the section becomes exactly one drawable node — undeclared ones get
//      the `?` track mark, unreadable ones get the unreadable mark, and a
//      node whose roadmap is `{ok:false}` gets its own "not computed" mark
//      rather than the `planned` colour.
//   2. ONE UNKNOWN STATE CANNOT BLANK THE CANVAS. `colour.mjs` THROWS on a
//      state it does not know — deliberately, so a renamed constant cannot
//      quietly paint a node grey (slice 3's pre-push review left this
//      obligation to the renderer in writing). So the colour call is wrapped
//      PER NODE: that node is marked `unknown state: <reason>` and every
//      other node still draws.

import { layout } from './layout.mjs';
import { colourClass } from './colour.mjs';

/** The class for the one node `colour.mjs` refuses to map; `app.css` gives it its own outline. */
export const UNKNOWN_CLASS = 'node-unknown';

function marksFor(node) {
  const marks = [];
  if (node.status === 'unreadable') marks.push('unreadable');
  else if (node.track == null) marks.push('? track');
  if (node.roadmap && node.roadmap.ok === false) marks.push('not computed');
  if (Array.isArray(node.blockedBy) && node.blockedBy.length > 0) marks.push(`blocked by ${node.blockedBy.map((n) => `#${n}`).join(', ')}`);
  return marks;
}

/**
 * buildCanvasModel(graphSection) -> {ok:true, value:{nodes, edges, unlinked,
 * droppedEdges, issuesUnreadable, width, height}} | {ok:false, reason}
 *
 * @param {{ok:boolean, value?:{nodes:Array, edges:Array, issuesUnreadable?:Array}, reason?:string}} graphSection
 */
export function buildCanvasModel(graphSection) {
  if (!graphSection || typeof graphSection !== 'object') return { ok: false, reason: 'no graph section was given to the canvas' };
  if (graphSection.ok !== true) return { ok: false, reason: graphSection.reason };

  const { nodes = [], edges = [], issuesUnreadable = [] } = graphSection.value ?? {};
  const placed = layout({ nodes, edges });

  const drawn = nodes.map((node) => {
    const box = placed.nodes[node.number];
    let className;
    const marks = marksFor(node);
    try {
      className = colourClass(node);
    } catch (err) {
      className = UNKNOWN_CLASS;
      marks.push(`unknown state: ${err?.message ?? err}`);
    }
    return {
      number: node.number,
      label: `#${node.number} ${node.title ?? ''}`.trim(),
      className,
      marks,
      track: node.track ?? null,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
    };
  });

  return {
    ok: true,
    value: {
      nodes: drawn,
      edges: placed.edges,
      unlinked: placed.unlinked,
      // Said, never swallowed: an edge to a number that is not a node, and an
      // issue whose body the forge would not hand over, are both facts the
      // page lists beside the drawing (R881-9).
      droppedEdges: placed.droppedEdges,
      issuesUnreadable,
      width: placed.width,
      height: placed.height,
    },
  };
}
