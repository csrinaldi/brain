// hierarchy-adapter.mjs — the ADR-0039 resolver contract over today's `kind`
// and `parent` (#1199 R1199-5, D59).
//
// The contract is `{issues: Map<number, Entry>, divergences}` with
// `Entry = {level, levelSource, parent, children, tracker, milestone, state,
// divergences}`. The page is built against it, so #1251's resolver can swap the
// SOURCE without touching a consumer. This adapter is NOT that resolver and is
// named apart on purpose: `lib/ticket-hierarchy.mjs` belongs to #1251.
//
// It reads `kind`, `parent`, `tracker`, `state`, `ok` and epic-graph's
// `declarationDivergences`. It never reads `track`, `blocks`, `needs` or
// `files`: those stay in epic-graph.

const ENTRY_STATES = new Set(['open', 'closed']);

const byNumber = (a, b) => a - b;

/** `parent-ambiguous` is a prose fact; every other declaration divergence came from the block. */
const sourceOf = (reason) => (reason === 'parent-ambiguous' ? 'prose' : 'block');

/**
 * hierarchyFromGraph({nodes, declarationDivergences, closed}) -> {issues, divergences}
 *
 * `nodes`/`declarationDivergences` are the open graph's. `closed` is the
 * snapshot's `closedIssues.value` (`{nodes, declarationDivergences, unresolved}`)
 * or `null` when that section is not a value. A closed row in `unresolved` gets
 * no entry: the contract has no "parent unknown", and `parent: null` would claim "none".
 */
export function hierarchyFromGraph({ nodes = [], declarationDivergences = [], closed = null } = {}) {
  const all = [...nodes];
  const seen = new Set(nodes.map((n) => n.number));
  for (const n of closed?.nodes ?? []) if (!seen.has(n.number)) all.push(n);

  const entries = new Map();
  for (const n of [...all].sort((a, b) => a.number - b.number)) {
    const unreadable = n.ok === false;
    entries.set(n.number, {
      level: unreadable ? null : n.kind === 'epic' ? 'epic' : 'ticket',
      levelSource: unreadable ? null : n.kind === 'epic' ? 'block' : 'default',
      parent: n.parent ?? null,
      children: [],
      tracker: n.tracker ?? null,
      milestone: null,
      state: ENTRY_STATES.has(n.state) ? n.state : null,
      divergences: [],
    });
  }

  for (const [number, entry] of entries) {
    if (entry.parent !== null && entries.has(entry.parent)) entries.get(entry.parent).children.push(number);
  }
  for (const entry of entries.values()) entry.children.sort(byNumber);

  const divergences = [];
  for (const d of [...declarationDivergences, ...(closed?.declarationDivergences ?? [])]) {
    if (d.reason === 'parent-not-epic') {
      divergences.push({ issues: [d.number, d.value], field: 'parent', source: 'graph', expected: 'parent-not-epic', found: d.value });
    } else if (entries.has(d.number)) {
      entries.get(d.number).divergences.push({ source: sourceOf(d.reason), field: d.key, expected: d.reason, found: d.value });
    }
  }

  return { issues: entries, divergences };
}
