// colour.mjs — (roadmap.value.state, node.status) -> CSS class (R881-6,
// D9-note). Pure, imported by the browser AND by node:test (D9): it cannot
// import `PLANNED`/`READY`/etc. from `status/*.mjs`, so the STRING VALUES
// are repeated here as literals; `colour.test.mjs` imports the real
// constants and asserts every one still maps to a defined class — a
// renamed constant fails that test instead of quietly painting a node grey.
//
// Priority, highest first (R881-6):
//   1. `node.status === 'unreadable'` — the issue body could not be read.
//   2. `roadmap.ok === false` — "not computed", MUST NOT read as `planned`.
//   3. an open `blockedBy` — the blocked mark, overrides the state colour.
//   4. `node.status === 'awaiting-human'` — the RFC's awaiting-review mark.
//   5. otherwise, `roadmap.value.state` (`planned` / `in-flight` / `done`).
// `node.status === 'unclassified'` (no declaring source at all) gets its
// own mark rather than falling through to a roadmap state that describes a
// node nothing ever placed.

export const NOT_COMPUTED_CLASS = 'roadmap-not-computed';

const ROADMAP_STATE_CLASS = {
  planned: 'state-planned',
  'in-flight': 'state-in-flight',
  done: 'state-done',
};

const NODE_STATUS_CLASS = {
  ready: 'status-ready', // a ready node's colour comes from ROADMAP_STATE_CLASS (step 5), so this class is never returned; the entry is what makes `ready` a KNOWN status, and keeps the map exhaustive (D9-note)
  blocked: 'status-blocked',
  'awaiting-human': 'status-awaiting-review',
  unclassified: 'status-unclassified',
  unreadable: 'status-unreadable',
};

/**
 * colourClass(node) -> a CSS class name. Never returns undefined for a
 * known constant — an unknown value throws rather than degrading to an
 * unlabelled grey node (never empty-on-failure).
 *
 * @param {{status:string, blockedBy?:number[], roadmap:{ok:boolean,value?:{state:string},reason?:string}}} node
 */
export function colourClass(node) {
  if (node.status === 'unreadable') return classFor(NODE_STATUS_CLASS, 'unreadable');
  if (!node.roadmap || node.roadmap.ok !== true) return NOT_COMPUTED_CLASS;
  if (Array.isArray(node.blockedBy) && node.blockedBy.length > 0) return classFor(NODE_STATUS_CLASS, 'blocked');
  if (node.status === 'awaiting-human') return classFor(NODE_STATUS_CLASS, 'awaiting-human');
  if (node.status === 'unclassified') return classFor(NODE_STATUS_CLASS, 'unclassified');
  // A status this file has never heard of must not inherit the roadmap's
  // colour: it would paint an unclassified node as if something had placed it.
  if (!Object.hasOwn(NODE_STATUS_CLASS, node.status)) throw new Error(`colour.mjs: unknown node status "${node.status}" — a constant was renamed, or a new status shipped without updating this map`);
  return classFor(ROADMAP_STATE_CLASS, node.roadmap.value.state);
}

function classFor(map, key) {
  const cls = map[key];
  if (!cls) throw new Error(`colour.mjs: no CSS class for "${key}" — a constant was renamed without updating this map`);
  return cls;
}
