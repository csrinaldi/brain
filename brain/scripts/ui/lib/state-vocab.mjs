// state-vocab.mjs — the ONE table of node states (#998 R998-1): code, word,
// mark and CSS class; the precedence between them is `stateOf`'s alone (below). Pure, imported by the browser
// and by node:test (D9), so the status and roadmap strings are literals here;
// `state-vocab.test.mjs` imports the real constants and pins every one.
//
// A state is colour + mark + word so no reader depends on colour alone. The
// marks are the design's glyphs; `unknown` is the renderer's own output when
// this table throws on a status it has never heard of — that throw is
// deliberate (never empty-on-failure) and the per-node guard turns it into a
// said `unknown`, distinct from `not-computed`. `not-computed` is a node whose state cannot be
// claimed: with `work` it is derived from the work sources that are missing (D125) and its
// reason names them; on the legacy path (no `work`) it is a roadmap that said it could not be computed.
//
// The word of `awaiting-review` is "Awaiting approval" (#1379, D163): the state means the ISSUE lacks
// `status:approved`, not that a PR waits on review. The code, class and tokens keep the old name on purpose.

import { rollupLabel, staleSuffix } from './rollup-model.mjs';
import { APPROVED_LABEL } from './approval-label.mjs';

export const UNKNOWN_CODE = 'unknown';

export const STATES = Object.freeze({
  unreadable: Object.freeze({ code: 'unreadable', label: 'Unreadable', mark: '⚠', className: 'status-unreadable' }),
  'not-computed': Object.freeze({ code: 'not-computed', label: 'Not computed', mark: '—', className: 'roadmap-not-computed' }),
  blocked: Object.freeze({ code: 'blocked', label: 'Blocked', mark: '⊘', className: 'status-blocked' }),
  'awaiting-review': Object.freeze({ code: 'awaiting-review', label: 'Awaiting approval', mark: '◇', className: 'status-awaiting-review' }),
  'ready-to-close': Object.freeze({ code: 'ready-to-close', label: 'Ready to close', mark: '◉', className: 'state-ready-to-close' }),
  planned: Object.freeze({ code: 'planned', label: 'Planned', mark: '○', className: 'state-planned' }),
  'in-flight': Object.freeze({ code: 'in-flight', label: 'In flight', mark: '◐', className: 'state-in-flight' }),
  done: Object.freeze({ code: 'done', label: 'Done', mark: '●', className: 'state-done' }),
  [UNKNOWN_CODE]: Object.freeze({ code: UNKNOWN_CODE, label: 'Unknown state', mark: '✕', className: 'node-unknown' }),
});

export const STATE_CODES = Object.freeze(Object.keys(STATES));

// The statuses the graph can emit (epic-graph.mjs) and the roadmap states the
// snapshot can emit (snapshot.mjs). `ready` and `blocked` carry no class of
// their own: a ready node takes its roadmap state, and "blocked" is decided by
// an OPEN blocker in `blockedBy`, not by the status word.
const KNOWN_STATUS = new Set(['ready', 'blocked', 'awaiting-human', 'unclassified', 'unreadable']);
const ROADMAP_STATE_CODE = { planned: 'planned', 'in-flight': 'in-flight', done: 'done' };


const isBlocked = (node) => Array.isArray(node.blockedBy) && node.blockedBy.length > 0;

/**
 * Awaiting approval (code `awaiting-review`, kept — D163): the graph says so (`awaiting-human`), or — for a node nobody declares, which
 * epic-graph.mjs classifies before it ever reads the approval label — its own labels say it is not approved.
 * A node with no `labels` array makes no claim (#1308 ruling 2).
 */
function awaitingReview(node) {
  if (node.status === 'awaiting-human') return true;
  return node.status === 'unclassified' && Array.isArray(node.labels) && !node.labels.includes(APPROVED_LABEL);
}

const describeMissing = (m) => {
  if (m.state === 'pending') return `${m.name} is still loading`;
  const why = m.reason ? ` (${m.reason})` : '';
  return `${m.name} ${m.state === 'idle' ? 'was not read yet' : 'could not be read'}${why}`;
};

const notComputed = (reason) => ({ ...STATES['not-computed'], reason });
const inFlight = (reason) => ({ ...STATES['in-flight'], reason });

/**
 * The evidence an epic's children add (#1309, D132, D137). Returns a state, or null when the node's own
 * evidence decides. Nothing here claims Planned: an uncounted list is Not computed, in the rollup's own words.
 */
function epicProgress(node, work, rollup, roadmapCode) {
  const own = roadmapCode === 'in-flight' || work.byIssue.has(node.number);
  if (rollup.ok && rollup.value.closed !== null && rollup.value.closed === rollup.value.total && rollup.value.total > 0) {
    return { ...STATES['ready-to-close'], reason: `all ${rollup.value.total} children closed; the epic is still open${staleSuffix(rollup.value.load)}` };
  }
  if (own) return STATES['in-flight'];
  const label = rollupLabel(rollup);
  if (!rollup.ok) return notComputed(`children: ${label}`);
  const { closed, unknown, unresolved, openChildren } = rollup.value;
  if (closed > 0) return inFlight(label);
  const started = openChildren.filter((n) => work.byIssue.has(n));
  if (started.length > 0) return inFlight(`${started.length === 1 ? 'child' : 'children'} ${started.map((n) => `#${n}`).join(', ')} in flight`);
  if (closed === null || unknown > 0 || unresolved > 0) return notComputed(label);
  return null;
}

/**
 * stateOf(node, work, rollup) -> {code, label, mark, className, reason?}. Throws on a status or a
 * roadmap state this table does not know — a renamed constant fails the test
 * that imports the real ones instead of quietly painting a node grey.
 *
 * Precedence (#1309): Unreadable > Done > Blocked > Awaiting approval (code `awaiting-review`) > Ready to close >
 * In flight > Not computed > Planned. `work` is `workIndex(...)` (inflight-model.mjs): when given, In flight is read from
 * the four work sources and Planned is claimed only when every one of them is ready. Without it (legacy
 * callers) the roadmap alone decides, as before — minus the old `unclassified` short-circuit.
 *
 * `rollup` is `epicRollup(...)` (rollup-model.mjs); it is read only with `work` and for `node.kind === 'epic'`, and without it an epic
 * keeps the #1308 behaviour (#1309 D130, D135); Ready to close is reached only through it.
 *
 * @param {{number?:number, status:string, blockedBy?:number[], labels?:string[], roadmap:{ok:boolean, value?:{state:string}}}} node
 * @param {{missing:Array<{name:string,state:string,reason?:string}>, byIssue:Map<number,object>}} [work]
 * @param {object} [rollup]
 */
export function stateOf(node, work, rollup) {
  if (node.status === 'unreadable') return STATES.unreadable;
  const roadmapOk = !!node.roadmap && node.roadmap.ok === true;
  if (!work && !roadmapOk) return STATES['not-computed'];
  if (!KNOWN_STATUS.has(node.status)) throw new Error(`state-vocab.mjs: unknown node status "${node.status}" — a constant was renamed, or a new status shipped without updating this table`);
  const roadmapCode = roadmapOk ? ROADMAP_STATE_CODE[node.roadmap.value?.state] : null;
  if (roadmapOk && !roadmapCode) throw new Error(`state-vocab.mjs: no state for roadmap "${node.roadmap.value?.state}" — a constant was renamed without updating this table`);
  if (roadmapCode === 'done') return STATES.done;
  if (isBlocked(node)) return STATES.blocked;
  if (awaitingReview(node)) return STATES['awaiting-review'];
  if (!work) return STATES[roadmapCode];
  if (rollup && node.kind === 'epic') {
    const progress = epicProgress(node, work, rollup, roadmapCode);
    if (progress) return progress;
  }
  if (roadmapCode === 'in-flight' || work.byIssue.has(node.number)) return STATES['in-flight'];
  if (work.missing.length > 0) return { ...STATES['not-computed'], reason: work.missing.map(describeMissing).join('; ') };
  return STATES.planned;
}

// The track chip's own table (#1308 D126): a node's track is a different fact from its lifecycle.
// `undeclared` is a WARNING (D128): the issue is missing its `brain-graph/1` configuration.
export const TRACK_MARKS = Object.freeze({
  declared: Object.freeze({ code: 'declared', mark: '', className: 'track-declared', warning: false }),
  'no-track': Object.freeze({ code: 'no-track', label: 'No track', mark: '?', className: 'track-no-track', warning: false }),
  undeclared: Object.freeze({ code: 'undeclared', label: 'Configuration missing', mark: '⚠', className: 'track-undeclared', warning: true, title: 'this issue has no brain-graph/1 block: configuration missing' }),
  // A block exists and the graph could not read it (#1308 cold-1, D129): a different fact from "no block", and the
  // remedy is the opposite — fix the block, never paste another one.
  'unreadable-config': Object.freeze({ code: 'unreadable-config', label: 'Configuration unreadable', mark: '⚠', className: 'track-undeclared', warning: true }),
});

/**
 * withBlockErrors(graphValue) -> graphValue whose nodes carry `blockError` (the graph's own error text) when their
 * `brain-graph/1` block exists and could not be read. `buildGraph` sets `declared: false` for that body AND for a
 * body with no block, so the node alone cannot tell them apart; the graph-level `blocksUnreadable` list can.
 * Every lane-model entry point applies this once, so the chips and the paste block read one fact.
 */
export function withBlockErrors(graphValue) {
  const value = graphValue ?? {};
  const errors = new Map((value.blocksUnreadable ?? []).map((b) => [b.number, b.error]));
  if (errors.size === 0) return value;
  return { ...value, nodes: (value.nodes ?? []).map((n) => (errors.has(n.number) ? { ...n, blockError: errors.get(n.number) } : n)) };
}

/** trackMarkOf(node) -> {code, label, mark, className, warning} | null — null for an unreadable body: its declaration is unknown, not absent. */
export function trackMarkOf(node) {
  if (node.status === 'unreadable') return null;
  if (node.track != null) return { ...TRACK_MARKS.declared, label: `Track ${node.track}` };
  // The tooltip carries the graph's own error: a malformed block is never described as absent (#1308 review round 2).
  if (node.blockError != null) return { ...TRACK_MARKS['unreadable-config'], title: `brain-graph/1 configuration unreadable: ${node.blockError}` };
  if (node.declared === false) return { ...TRACK_MARKS.undeclared };
  return { ...TRACK_MARKS['no-track'] };
}
