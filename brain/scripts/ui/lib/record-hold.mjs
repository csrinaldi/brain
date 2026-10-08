// record-hold.mjs — which opened records the page keeps holding (#1377, D160/D173).
// Pure: sets in, ids out. `app.js` owns the maps and the cancelling; this owns the rule.
//
// Two surfaces open records and share one read cache (`recordLoads`, `recordTrees`): the
// Memory ledger and the drawer's Records tab. An open id belongs to the surface that opened
// it; a read is held while ANY surface has its id open.

/** The ids in `open` that `visible` no longer contains: rows the surface cannot draw any more. */
export function staleIds(open, visible) {
  return [...open].filter((id) => !visible.has(id));
}

/** The ids in `held` that no open set contains: their reads are held for nobody. */
export function unheldIds(held, ...openSets) {
  return [...held].filter((id) => !openSets.some((open) => open.has(id)));
}
