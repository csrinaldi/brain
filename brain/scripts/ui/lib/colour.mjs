// colour.mjs — (roadmap.value.state, node.status) -> CSS class (R881-6,
// D9-note). Pure, imported by the browser AND by node:test (D9): it cannot
// import `PLANNED`/`READY`/etc. from `status/*.mjs`, so the STRING VALUES
// are repeated here as literals; `colour.test.mjs` imports the real
// constants and asserts every one still maps to a defined class — a
// renamed constant fails that test instead of quietly painting a node grey.
//
// Precedence (#1308 R1308-3): `stateOf` in state-vocab.mjs is the ONE authority; read the order there.
// This comment restates nothing it could drift from.
// `node.status === 'unclassified'` (no declaring source at all) is no longer a
// state (#1308): it reads its lifecycle like every node, and the missing
// declaration is the track chip's warning (`trackMarkOf`), a different fact.

import { stateOf, STATES } from './state-vocab.mjs';

// Since #998 the table lives in state-vocab.mjs (code + word + mark + class);
// this module is the class-only view of it, kept so every caller and test of
// colourClass() keeps working unchanged.
export const NOT_COMPUTED_CLASS = STATES['not-computed'].className;

/**
 * colourClass(node) -> a CSS class name. Never returns undefined for a known
 * constant — an unknown value throws rather than degrading to an unlabelled
 * grey node (never empty-on-failure).
 *
 * @param {{status:string, blockedBy?:number[], roadmap:{ok:boolean,value?:{state:string},reason?:string}}} node
 */
export function colourClass(node) {
  return stateOf(node).className;
}
