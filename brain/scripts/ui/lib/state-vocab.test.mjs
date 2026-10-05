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
  assert.deepEqual(STATE_CODES.slice().sort(), [...MATRIX.map(([c]) => c), UNKNOWN_CODE].sort(), 'eight codes, no more, no less');
});

test('#998: the priority is colour.mjs\'s — unreadable beats not-computed beats blocked beats awaiting beats the roadmap state', () => {
  assert.equal(stateOf(node({ status: UNREADABLE, blockedBy: [2], roadmap: { ok: false } })).code, 'unreadable');
  assert.equal(stateOf(node({ status: AWAITING_HUMAN, blockedBy: [2], roadmap: { ok: false } })).code, 'not-computed');
  assert.equal(stateOf(node({ status: AWAITING_HUMAN, blockedBy: [2] })).code, 'blocked');
  assert.equal(stateOf(node({ status: BLOCKED, blockedBy: [], roadmap: { ok: true, value: { state: DONE } } })).code, 'done', 'a known status with no open blocker takes the roadmap state, as colour.mjs does');
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
import { trackMarkOf, TRACK_MARKS } from './state-vocab.mjs';

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

test('R1308-8/S10: Awaiting review reads status:approved from the labels of an undeclared node, by the same rule as every node', () => {
  assert.equal(stateOf(undeclared({ labels: [] }), READY_WORK).code, 'awaiting-review');
  assert.equal(stateOf(undeclared({ labels: ['status:approved'] }), READY_WORK).code, 'planned');
  assert.equal(stateOf(undeclared({ labels: [] }), workWith(1)).code, 'awaiting-review', 'awaiting-review outranks in-flight');
  assert.equal(stateOf(undeclared(), READY_WORK).code, 'planned', 'no labels array makes no claim');
});

test('R1308-9/S12: stale evidence is still evidence — the index holds it and the state reads In flight', () => {
  assert.equal(stateOf(node(), workWith(1)).code, 'in-flight');
});

test('R1308-2: the track mark — Track <id>, ? No track, a warning for missing configuration, none when unreadable', () => {
  assert.deepEqual(Object.keys(TRACK_MARKS).sort(), ['declared', 'no-track', 'undeclared']);
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
