// state-vocab.test.mjs — R998-1: every node maps to ONE state with a code, a
// word, a mark and a class; the priority is colour.mjs's; an unmapped status
// throws (the renderer's guard renders it `unknown`); not-computed ≠ unknown.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PLANNED, IN_FLIGHT, DONE, UNREADABLE } from '../../status/snapshot.mjs';
import { READY, BLOCKED, AWAITING_HUMAN, UNCLASSIFIED } from '../../status/epic-graph.mjs';
import { colourClass, NOT_COMPUTED_CLASS } from './colour.mjs';
import { stateOf, STATES, STATE_CODES, UNKNOWN_CODE } from './state-vocab.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const node = ({ status = READY, blockedBy = [], roadmap = { ok: true, value: { state: PLANNED } } } = {}) => ({ number: 1, status, blockedBy, roadmap });

const MATRIX = [
  ['unreadable', node({ status: UNREADABLE, roadmap: { ok: false, reason: 'x' } })],
  ['not-computed', node({ roadmap: { ok: false, reason: 'the PR list could not be read' } })],
  ['blocked', node({ blockedBy: [2] })],
  ['awaiting-review', node({ status: AWAITING_HUMAN })],
  ['planned', node({ roadmap: { ok: true, value: { state: PLANNED } } })],
  ['in-flight', node({ roadmap: { ok: true, value: { state: IN_FLIGHT } } })],
  ['done', node({ roadmap: { ok: true, value: { state: DONE } } })],
];

test('#998: every state has a distinct code, a word, a mark and the class colour.mjs returns', () => {
  const seen = new Set();
  for (const [code, n] of MATRIX) {
    const s = stateOf(n);
    assert.equal(s.code, code);
    assert.ok(s.label.length > 0 && s.mark.length > 0, code);
    assert.equal(s.className, colourClass(n), `${code}: state-vocab and colour.mjs are one table`);
    assert.ok(!seen.has(s.className), `${code}: class reused`); seen.add(s.className);
  }
  assert.deepEqual(STATE_CODES.slice().sort(), [...MATRIX.map(([c]) => c), 'ready-to-close', UNKNOWN_CODE].sort(), 'nine codes, no more, no less (ready-to-close is reached only through an epic rollup, #1309)');
});

test('#998: the priority is colour.mjs\'s — unreadable beats not-computed beats blocked beats awaiting beats the roadmap state', () => {
  assert.equal(stateOf(node({ status: UNREADABLE, blockedBy: [2], roadmap: { ok: false } })).code, 'unreadable');
  assert.equal(stateOf(node({ status: AWAITING_HUMAN, blockedBy: [2], roadmap: { ok: false } })).code, 'not-computed');
  assert.equal(stateOf(node({ status: AWAITING_HUMAN, blockedBy: [2] })).code, 'blocked');
  assert.equal(stateOf(node({ status: BLOCKED, blockedBy: [], roadmap: { ok: true, value: { state: DONE } } })).code, 'done', 'a known status with no open blocker takes the roadmap state, as colour.mjs does');
});

test('#1309 D138: ready-to-close has its own mark, class and word, shared with no other state', () => {
  const r = STATES['ready-to-close'];
  assert.deepEqual([r.label, r.mark, r.className], ['Ready to close', '◉', 'state-ready-to-close']);
  const others = Object.values(STATES).filter((s) => s.code !== 'ready-to-close');
  assert.ok(others.every((s) => s.mark !== r.mark && s.className !== r.className && s.label !== r.label));
});

test('#998: not-computed is not unknown — an unmapped status throws, and the two classes differ', () => {
  assert.throws(() => stateOf(node({ status: 'weird' })), /unknown node status "weird"/);
  assert.equal(STATES['not-computed'].className, NOT_COMPUTED_CLASS);
  assert.notEqual(STATES['not-computed'].className, STATES[UNKNOWN_CODE].className);
  assert.equal(STATES[UNKNOWN_CODE].className, 'node-unknown', 'the class the renderer already paints for the guard');
});

test('#998: every className has a rule in app.css', () => {
  const css = readFileSync(join(HERE, '..', 'static', 'app.css'), 'utf8');
  for (const code of STATE_CODES) assert.ok(css.includes(`.${STATES[code].className}`), `${code} → .${STATES[code].className} has no rule in app.css`);
});

// ── #1308: lifecycle state is separate from the track mark ────────────────
import { trackMarkOf, TRACK_MARKS, withBlockErrors } from './state-vocab.mjs';
import { buildGraph } from '../../status/epic-graph.mjs';

const READY_WORK = { missing: [], byIssue: new Map() };
const workWith = (...issues) => ({ missing: [], byIssue: new Map(issues.map((i) => [i, { issue: i, changes: [], worktrees: [{ leaf: 'w' }], branches: [], prs: [] }])) });
const pending = (...names) => ({ missing: names.map((name) => ({ name, state: 'pending', reason: 'loading from the forge…' })), byIssue: new Map() });
const undeclared = ({ labels, ...over } = {}) => ({ ...node({ status: UNCLASSIFIED, ...over }), ...(labels ? { labels } : {}) });

test('R1308-8: the ruled precedence — unreadable > done > blocked > awaiting-review > in-flight > not-computed > planned', () => {
  const w = workWith(1);
  const done = { ok: true, value: { state: DONE } };
  assert.equal(stateOf(node({ status: UNREADABLE, blockedBy: [2], roadmap: done }), w).code, 'unreadable');
  assert.equal(stateOf(node({ blockedBy: [2], roadmap: done }), w).code, 'done');
  assert.equal(stateOf(node({ status: AWAITING_HUMAN, blockedBy: [2] }), w).code, 'blocked');
  assert.equal(stateOf(node({ status: AWAITING_HUMAN }), w).code, 'awaiting-review');
  assert.equal(stateOf(node(), w).code, 'in-flight');
  assert.equal(stateOf(node(), pending('prs')).code, 'not-computed');
  assert.equal(stateOf(node(), READY_WORK).code, 'planned');
});

test('R1308-3/S2: an undeclared node with work evidence is In flight, never Undeclared', () => {
  assert.equal(stateOf(undeclared(), workWith(1)).code, 'in-flight');
  assert.ok(!('unclassified' in STATES), 'unclassified is no longer a lifecycle state');
});

test('R1308-4/S3: Planned only when every source is ready and none names the issue', () => {
  assert.equal(stateOf(undeclared(), READY_WORK).code, 'planned');
  assert.equal(stateOf(node(), READY_WORK).code, 'planned');
});

test('R1308-5/S5/S7: a pending or failed source with no evidence is Not computed, naming the source — never Planned; positive evidence wins (S6)', () => {
  const s = stateOf(node(), { missing: [{ name: 'prs', state: 'pending', reason: 'loading' }, { name: 'remoteChanges', state: 'failed', reason: 'fetch failed' }], byIssue: new Map() });
  assert.equal(s.code, 'not-computed');
  assert.match(s.reason, /prs/);
  assert.match(s.reason, /remoteChanges/);
  assert.match(s.reason, /fetch failed/);
  const w = workWith(1); w.missing = [{ name: 'prs', state: 'pending', reason: 'loading' }];
  assert.equal(stateOf(node(), w).code, 'in-flight', 'a local change dir is enough while prs is pending');
});

test('R1308-8/S10: Awaiting approval reads status:approved from the labels of an undeclared node, by the same rule as every node', () => {
  assert.equal(stateOf(undeclared({ labels: [] }), READY_WORK).code, 'awaiting-review');
  assert.equal(stateOf(undeclared({ labels: ['status:approved'] }), READY_WORK).code, 'planned');
  assert.equal(stateOf(undeclared({ labels: [] }), workWith(1)).code, 'awaiting-review', 'awaiting-review outranks in-flight');
  assert.equal(stateOf(undeclared(), READY_WORK).code, 'planned', 'no labels array makes no claim');
});

test('R1308-9/S12: stale evidence is still evidence — the index holds it and the state reads In flight', () => {
  assert.equal(stateOf(node(), workWith(1)).code, 'in-flight');
});

test('R1308-2: the track mark — Track <id>, ? No track, a warning for missing configuration, none when unreadable', () => {
  assert.deepEqual(Object.keys(TRACK_MARKS).sort(), ['declared', 'no-track', 'undeclared', 'unreadable-config']);
  assert.deepEqual(trackMarkOf({ status: READY, track: 'UI', declared: true }), { code: 'declared', label: 'Track UI', mark: '', className: 'track-declared', warning: false });
  assert.equal(trackMarkOf({ status: READY, track: null, declared: true }).label, 'No track');
  assert.equal(trackMarkOf({ status: READY, track: null, declared: true }).mark, '?');
  const u = trackMarkOf({ status: UNCLASSIFIED, track: null, declared: false });
  assert.equal(u.code, 'undeclared');
  assert.equal(u.mark, '⚠');
  assert.equal(u.label, 'Configuration missing');
  assert.equal(u.warning, true);
  assert.equal(trackMarkOf({ status: UNREADABLE, track: null, declared: false }), null);
});

test('R1308-5: the legacy call without a work index keeps the roadmap reading minus the unclassified branch', () => {
  assert.equal(stateOf(undeclared()).code, 'planned');
  assert.equal(stateOf(undeclared({ roadmap: { ok: true, value: { state: IN_FLIGHT } } })).code, 'in-flight');
});

// #1308 cold-1: a body whose block cannot be read is NOT a body with no block. buildGraph sets
// `declared: false` for both; the graph's own `blocksUnreadable` is what tells them apart.
const BLOCK = ['```brain-graph/1', 'track: UI', 'blocks: []', 'needs: []', '```'];
const MALFORMED = {
  'two fences': [...BLOCK, '', ...BLOCK].join('\n'),
  'an unterminated fence': BLOCK.slice(0, -1).join('\n'),
  'the legacy yaml fence with a protocol scalar': '```yaml\nprotocol: brain-graph/1\ntrack: UI\n```',
};
const realGraph = (body) => buildGraph([{ number: 7, title: 't', labels: ['status:approved'], state: 'open', body }]);

for (const [shape, body] of Object.entries(MALFORMED)) {
  test(`R1308-2/cold-1: ${shape} reads Configuration unreadable with the graph's error, never Configuration missing`, () => {
    const g = realGraph(body);
    assert.equal(g.blocksUnreadable.length, 1, 'the graph itself calls this body unreadable');
    const n = withBlockErrors(g).nodes[0];
    const mark = trackMarkOf(n);
    assert.equal(mark.code, 'unreadable-config');
    assert.equal(mark.label, 'Configuration unreadable');
    assert.equal(mark.warning, true);
    assert.equal(n.blockError, g.blocksUnreadable[0].error);
  });
}

test('R1308-2/cold-1: a body with no block at all stays Configuration missing through withBlockErrors', () => {
  const g = realGraph('nothing here');
  assert.deepEqual(g.blocksUnreadable, []);
  assert.equal(trackMarkOf(withBlockErrors(g).nodes[0]).code, 'undeclared');
});

// ── #1309: an epic's state follows its children ───────────────────────────
import { epicRollup } from './rollup-model.mjs';

const epicNode = (over = {}) => ({ ...node(), number: 878, kind: 'epic', ...over });
const hEntry = (over = {}) => ({ level: 'ticket', levelSource: 'default', parent: null, children: [], tracker: null, milestone: null, state: 'open', divergences: [], ...over });
/** A serialized hierarchy section: epic #878 with `closed`, `open` and `unknown` direct children (numbers 1001.. in that order). */
function hier({ closed = 0, open = 0, unknown = 0, unresolved = [], closedRead = { ok: true } } = {}) {
  const pairs = []; const children = []; let n = 1000;
  const add = (state) => { n += 1; children.push(n); pairs.push([n, hEntry({ parent: 878, state })]); };
  for (let i = 0; i < closed; i++) add('closed');
  for (let i = 0; i < open; i++) add('open');
  for (let i = 0; i < unknown; i++) add(null);
  pairs.push([878, hEntry({ level: 'epic', levelSource: 'block', children })]);
  return { ok: true, value: { issues: pairs, divergences: [], closedUnresolved: unresolved, closedRead } };
}
const lane = (closed) => ({ ok: true, value: { open: { state: 'complete', at: 'T' }, closed } });
const DONE_LANE = { state: 'complete', at: 'T' };
const rollupOf = (h, closedLane = DONE_LANE) => epicRollup(h, lane(closedLane), 878);
const ROLLUP_17_39 = () => rollupOf(hier({ closed: 17, open: 22 }));

test('R1309-3/S2: 17 of 39 children closed reads In flight with the rollup sentence', () => {
  const s = stateOf(epicNode(), READY_WORK, ROLLUP_17_39());
  assert.equal(s.code, 'in-flight');
  assert.equal(s.reason, '17 / 39 children closed');
});

test('R1309-6/S1: Planned only when the rollup counted zero closed, nothing unknown or unresolved, no child in flight, and every source is ready', () => {
  assert.equal(stateOf(epicNode(), READY_WORK, rollupOf(hier({ open: 3 }))).code, 'planned');
  assert.equal(stateOf(epicNode(), pending('prs'), rollupOf(hier({ open: 3 }))).code, 'not-computed', 'a missing work source still blocks Planned');
});

test('R1309-5/S3/S7: an uncounted or unavailable rollup with nothing in flight is Not computed in the rollup\'s own words, never Planned', () => {
  const lanes = [{ state: 'pending', at: null }, { state: 'disabled', at: null, reason: 'polling off' }, { state: 'failed', at: 'T', lastCompleteAt: null, reason: 'boom' }];
  for (const l of lanes) {
    const r = rollupOf(hier({ open: 3 }), l);
    const s = stateOf(epicNode(), READY_WORK, r);
    assert.equal(s.code, 'not-computed', l.state);
    assert.match(s.reason, /closed children/);
  }
  const notRead = stateOf(epicNode(), READY_WORK, rollupOf(hier({ open: 3, closedRead: { ok: false, reason: 'list not read' } })));
  assert.equal(notRead.code, 'not-computed');
  const hPending = epicRollup({ ok: false, pending: true, reason: 'loading open issues from the forge…' }, lane(DONE_LANE), 878);
  const p = stateOf(epicNode(), READY_WORK, hPending);
  assert.equal(p.code, 'not-computed');
  assert.match(p.reason, /loading open issues/);
  assert.equal(stateOf(epicNode(), READY_WORK, rollupOf(hier({ open: 3 }), { state: 'pending', at: null })).code, 'not-computed');
});

test('R1309-4/ruling c: closed null but an open child that work names reads In flight, naming the child', () => {
  const r = rollupOf(hier({ open: 3 }), { state: 'pending', at: null });
  const s = stateOf(epicNode(), workWith(1002), r);
  assert.equal(s.code, 'in-flight');
  assert.match(s.reason, /#1002/);
});

test('R1309-4/ruling b: zero closed with an in-flight open child reads In flight, also over unresolved or unknown evidence', () => {
  assert.equal(stateOf(epicNode(), workWith(1001), rollupOf(hier({ open: 2 }))).code, 'in-flight');
  assert.equal(stateOf(epicNode(), workWith(1001), rollupOf(hier({ open: 2, unresolved: [9] }))).code, 'in-flight');
  assert.equal(stateOf(epicNode(), workWith(5000), rollupOf(hier({ open: 2 }))).code, 'planned', 'work naming a non-child is not child evidence');
});

test('R1309-7/ruling a: every child closed on an open epic reads Ready to close — never Done', () => {
  const s = stateOf(epicNode(), READY_WORK, rollupOf(hier({ closed: 4 })));
  assert.equal(s.code, 'ready-to-close');
  assert.equal(s.label, 'Ready to close');
  assert.match(s.reason, /all 4 children closed; the epic is still open/);
  assert.equal(stateOf(epicNode(), workWith(878), rollupOf(hier({ closed: 4 }))).code, 'ready-to-close', 'it wins over the epic\'s own In flight');
  assert.equal(stateOf(epicNode({ roadmap: { ok: true, value: { state: DONE } } }), READY_WORK, rollupOf(hier({ closed: 4 }))).code, 'done');
});

test('R1309-5/ruling d: zero closed with unresolved closed issues, or an unknown child, is Not computed — never Planned', () => {
  assert.equal(stateOf(epicNode(), READY_WORK, rollupOf(hier({ open: 2, unresolved: [9] }))).code, 'not-computed');
  const u = stateOf(epicNode(), READY_WORK, rollupOf(hier({ open: 2, unknown: 1 })));
  assert.equal(u.code, 'not-computed');
  assert.match(u.reason, /1 state unknown/);
});

test('R1309-2/S8: Ready to close sits after Awaiting approval and before In flight; blocked, awaiting and closed epics keep their state', () => {
  const all = rollupOf(hier({ closed: 5 }));
  assert.equal(stateOf(epicNode({ blockedBy: [3] }), READY_WORK, all).code, 'blocked');
  assert.equal(stateOf(epicNode({ status: AWAITING_HUMAN }), READY_WORK, all).code, 'awaiting-review');
  assert.equal(stateOf(epicNode({ blockedBy: [3] }), READY_WORK, ROLLUP_17_39()).code, 'blocked');
  assert.equal(stateOf(epicNode({ roadmap: { ok: true, value: { state: DONE } } }), READY_WORK, ROLLUP_17_39()).code, 'done');
  assert.equal(stateOf(epicNode({ status: UNREADABLE }), READY_WORK, ROLLUP_17_39()).code, 'unreadable');
});

test('R1309-1/S10/D135: a non-epic ignores the rollup, and no rollup or no work is the legacy path', () => {
  assert.equal(stateOf(node({ roadmap: { ok: true, value: { state: PLANNED } } }), READY_WORK, ROLLUP_17_39()).code, 'planned');
  assert.equal(stateOf(epicNode(), READY_WORK).code, 'planned');
  assert.equal(stateOf(epicNode(), undefined, ROLLUP_17_39()).code, 'planned', 'without work the roadmap alone decides');
});

test('#1379/D163: the word of awaiting-review is Awaiting approval; the code and class keep their name', () => {
  assert.equal(STATES['awaiting-review'].label, 'Awaiting approval');
  assert.equal(STATES['awaiting-review'].code, 'awaiting-review');
  assert.equal(STATES['awaiting-review'].className, 'status-awaiting-review');
  for (const s of Object.values(STATES)) assert.doesNotMatch(s.label, /awaiting review/i);
});
