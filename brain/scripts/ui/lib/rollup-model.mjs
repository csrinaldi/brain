// rollup-model.mjs — how far along an epic is (#1199 R1199-6/7, D62). Pure,
// imported by the browser AND by node:test.
//
// The snapshot's `hierarchy` section carries the Map as `[number, Entry]` pairs
// (JSON drops a Map); `hierarchyOf` rebuilds it. The rollup counts the epic's
// DIRECT children (R9) by `state`: closed, open, and unknown apart, because a
// child whose state nobody knows is never "not done" (R3). The closed count is
// worded from the closed lane's load (#1257's `forgeLoad`): while that lane is
// loading, failed with no data, or disabled, the numbers are `null` and the
// sentence says so, because "0 / n" there would be a count nobody took.

export const NO_CHILDREN = 'no children declared';

/** hierarchyOf(section) -> {ok:true, value:{issues: Map, divergences, closedUnresolved}} | {ok:false, pending?, reason} */
export function hierarchyOf(section) {
  if (!section || typeof section !== 'object') return { ok: false, reason: 'no hierarchy section was given' };
  if (section.ok !== true) return { ok: false, ...(section.pending === true ? { pending: true } : {}), reason: section.reason };
  const { issues, divergences, closedUnresolved } = section.value;
  return { ok: true, value: { issues: new Map(issues), divergences, closedUnresolved } };
}

const unavailable = (section) => ({ ok: false, ...(section.pending === true ? { pending: true } : {}), reason: section.reason });

/** True when the closed list that fed the hierarchy is a real count: complete, or a refresh failed over a complete one. */
const hasClosedData = (entry) => entry.state === 'complete' || (entry.state === 'failed' && entry.lastCompleteAt !== null);

/**
 * epicRollup(hierarchySection, forgeLoadSection, epic) ->
 *   {ok:true, value:{closed:number|null, open, unknown, total:number|null, unresolved, load}} | {ok:false, pending?, reason}
 *
 * `forgeLoadSection` is the snapshot's `forgeLoad` SECTION; its `closed` entry is `load`.
 */
export function epicRollup(hierarchySection, forgeLoadSection, epic) {
  const h = hierarchyOf(hierarchySection);
  if (!h.ok) return h;
  if (!forgeLoadSection || forgeLoadSection.ok !== true) return unavailable(forgeLoadSection ?? { reason: 'no forgeLoad section was given' });
  const entry = h.value.issues.get(epic);
  if (!entry) return { ok: false, reason: `the hierarchy holds no issue #${epic}` };

  const states = entry.children.map((n) => h.value.issues.get(n)?.state ?? null);
  const load = forgeLoadSection.value.closed;
  const counted = hasClosedData(load);
  return {
    ok: true,
    value: {
      closed: counted ? states.filter((s) => s === 'closed').length : null,
      open: states.filter((s) => s === 'open').length,
      unknown: states.filter((s) => s === null).length,
      total: counted ? states.length : null,
      unresolved: h.value.closedUnresolved.length,
      load,
    },
  };
}

/** The wording of one closed-lane state that carries no count (the numbers are `null`). */
function uncountedWords(load) {
  if (load.state === 'pending') return load.reason ? `closed children not counted yet (${load.reason})` : 'counting closed children…';
  if (load.state === 'disabled') return `closed children not read (${load.reason})`;
  return `closed children unknown (${load.reason})`;
}

/** rollupLabel(rollup) -> the one sentence the heading and the drawer show. Text only; the caller sets it with `textContent`. */
export function rollupLabel(rollup) {
  if (!rollup.ok) return rollup.pending === true ? rollup.reason : `rollup unavailable: ${rollup.reason}`;
  const { closed, open, unknown, total, unresolved, load } = rollup.value;
  const unknownSuffix = unknown > 0 ? ` · ${unknown} state unknown` : '';
  if (closed === null) return `${uncountedWords(load)}${open > 0 ? ` · ${open} open` : ''}${unknownSuffix}`;
  if (total === 0) return NO_CHILDREN;
  const stale = load.state === 'failed' ? ` · closed list as of ${load.lastCompleteAt}; refresh failed (${load.reason})` : '';
  const more = unresolved > 0 ? ` · ${unresolved} closed issue(s) unresolved, so more children may exist` : '';
  return `${closed} / ${total} children closed${unknownSuffix}${stale}${more}`;
}
