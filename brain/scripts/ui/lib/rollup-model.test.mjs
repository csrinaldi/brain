// rollup-model.test.mjs — #1199 R1199-6/R1199-7: the epic's closed / total, with
// unknown counted apart and the closed lane's load said in words.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hierarchyOf, epicRollup, rollupLabel, NO_CHILDREN } from './rollup-model.mjs';

const entry = (over = {}) => ({ level: 'ticket', levelSource: 'default', parent: null, children: [], tracker: null, milestone: null, state: 'open', divergences: [], ...over });

/** An epic #878 whose children are `{closed, open, unknown}` counts, as a serialized hierarchy section. */
function hierarchy({ closed = 0, open = 0, unknown = 0, unresolved = [], grandchildren = 0, closedRead = { ok: true } } = {}) {
  const pairs = [];
  const children = [];
  let n = 1000;
  const add = (state, over = {}) => { n += 1; children.push(n); pairs.push([n, entry({ parent: 878, state, ...over })]); return n; };
  for (let i = 0; i < closed; i++) add('closed');
  for (let i = 0; i < open; i++) add('open');
  for (let i = 0; i < unknown; i++) add(null);
  if (grandchildren > 0) {
    const nested = add('open', { level: 'epic', levelSource: 'block' });
    const grand = Array.from({ length: grandchildren }, (_, i) => 5000 + i);
    pairs.find(([k]) => k === nested)[1].children = grand;
    for (const g of grand) pairs.push([g, entry({ parent: nested, state: 'closed' })]);
  }
  pairs.push([878, entry({ level: 'epic', levelSource: 'block', children })]);
  pairs.sort((a, b) => a[0] - b[0]);
  return { ok: true, value: { issues: pairs, divergences: [], closedUnresolved: unresolved, closedRead } };
}
const load = (closed) => ({ ok: true, value: { open: { state: 'complete', at: 'T' }, closed } });
const COMPLETE = { state: 'complete', at: 'T' };
const label = (h, l) => rollupLabel(epicRollup(h, l, 878));

test('#1199 R1199-6: hierarchyOf rebuilds the Map from the pairs and passes a pending section through', () => {
  const h = hierarchyOf(hierarchy({ open: 1 }));
  assert.ok(h.value.issues instanceof Map);
  assert.equal(h.value.issues.get(878).level, 'epic');
  assert.deepEqual(hierarchyOf({ ok: false, pending: true, reason: 'loading open issues from the forge…' }), { ok: false, pending: true, reason: 'loading open issues from the forge…' });
  assert.deepEqual(hierarchyOf({ ok: false, reason: 'x' }), { ok: false, reason: 'x' });
  assert.equal(hierarchyOf(undefined).ok, false);
});

test('#1199 R1199-7: the counts are closed, open, unknown and total over the direct children', () => {
  const r = epicRollup(hierarchy({ closed: 12, open: 16, unknown: 1 }), load(COMPLETE), 878);
  assert.deepEqual(r.value, { closed: 12, open: 16, unknown: 1, total: 29, unresolved: 0, load: COMPLETE });
});

test('#1199 R1199-7: a complete list with unknown apart reads "12 / 29 children closed · 1 state unknown"', () => {
  assert.equal(label(hierarchy({ closed: 12, open: 16, unknown: 1 }), load(COMPLETE)), '12 / 29 children closed · 1 state unknown');
});

test('#1199 R1199-7: while the closed list is pending it counts, shows the open ones, and never says "0 /"', () => {
  const t = label(hierarchy({ open: 4 }), load({ state: 'pending', at: null }));
  assert.equal(t, 'counting closed children… · 4 open');
  assert.doesNotMatch(t, /0 \//);
  const r = epicRollup(hierarchy({ open: 4 }), load({ state: 'pending', at: null }), 878);
  assert.equal(r.value.closed, null);
  assert.equal(r.value.total, null);
});

test('#1199 R1199-7: a pending lane with a stated reason says it is not counted yet', () => {
  assert.equal(label(hierarchy({ open: 4 }), load({ state: 'pending', at: null, reason: 'polling is paused' })), 'closed children not counted yet (polling is paused) · 4 open');
});

test('#1199 R1199-7: a failed closed list with no data is "unknown", never an empty rollup', () => {
  const t = label(hierarchy({ open: 4 }), load({ state: 'failed', at: 'T', reason: 'rate limited', lastCompleteAt: null }));
  assert.equal(t, 'closed children unknown (rate limited) · 4 open');
  assert.doesNotMatch(t, /0 \//);
});

test('#1199 R1199-7: a failed refresh keeps the last complete count and says how old it is', () => {
  const t = label(hierarchy({ closed: 2, open: 3 }), load({ state: 'failed', at: 'T', reason: 'rate limited', lastCompleteAt: '2026-10-02T10:00:00.000Z' }));
  assert.equal(t, '2 / 5 children closed · closed list as of 2026-10-02T10:00:00.000Z; refresh failed (rate limited)');
});

test('#1199 R1199-7: a disabled closed read says why, with the open ones', () => {
  assert.equal(label(hierarchy({ open: 4 }), load({ state: 'disabled', at: null, reason: '--no-closed was given' })), 'closed children not read (--no-closed was given) · 4 open');
});

test('#1199 R1199-7: unresolved closed issues say more children may exist', () => {
  const unresolved = [{ number: 1, reason: 'r' }, { number: 2, reason: 'r' }, { number: 3, reason: 'r' }];
  assert.equal(label(hierarchy({ closed: 2, open: 3, unresolved }), load(COMPLETE)), '2 / 5 children closed · 3 closed issue(s) unresolved, so more children may exist');
});

test('#1199 R8: an epic with no children reads "no children declared" only once the closed list is complete', () => {
  assert.equal(NO_CHILDREN, 'no children declared');
  const done = label(hierarchy(), load(COMPLETE));
  assert.equal(done, 'no children declared');
  assert.doesNotMatch(done, /\d/);
  const counting = label(hierarchy(), load({ state: 'pending', at: null }));
  assert.equal(counting, 'counting closed children…');
  assert.doesNotMatch(counting, /no children declared/);
});

test('#1199 R9: only direct children count, and a nested epic counts once by its own state', () => {
  const r = epicRollup(hierarchy({ closed: 1, grandchildren: 5 }), load(COMPLETE), 878);
  assert.deepEqual([r.value.closed, r.value.open, r.value.total], [1, 1, 2]);
});

test('#1199 R1199-7: a section that is not a value is not a rollup, and a loading one stays loading', () => {
  const loading = { ok: false, pending: true, reason: 'loading open issues from the forge…' };
  assert.deepEqual(epicRollup(loading, load(COMPLETE), 878), loading);
  assert.deepEqual(epicRollup(hierarchy({ open: 1 }), { ok: false, reason: 'no VCS' }, 878), { ok: false, reason: 'no VCS' });
  assert.equal(epicRollup(hierarchy({ open: 1 }), load(COMPLETE), 9999).ok, false, 'an issue the hierarchy does not hold');
  assert.equal(rollupLabel(loading), 'loading open issues from the forge…');
  assert.match(rollupLabel({ ok: false, reason: 'no VCS' }), /^rollup unavailable: no VCS$/);
});

test('#1199 R1199-7: a complete closed lane over an unreadable closed list is "unknown", never "0 / n"', () => {
  const h = hierarchy({ open: 2, closedRead: { ok: false, reason: 'the closed-issue list could not be read: cache unreadable' } });
  const t = label(h, load(COMPLETE));
  assert.equal(t, 'closed children unknown (the closed-issue list could not be read: cache unreadable) · 2 open');
  assert.doesNotMatch(t, /0 \//);
  const r = epicRollup(h, load(COMPLETE), 878);
  assert.equal(r.value.closed, null);
  assert.equal(r.value.total, null);
});

test('#1199 R1199-7: a section that does not report closedRead is not trusted as a count', () => {
  const h = hierarchy({ open: 2 });
  delete h.value.closedRead;
  assert.match(label(h, load(COMPLETE)), /^closed children unknown \(/);
});

test('#1199 R8: no children declared with unresolved closed issues says they could not be read', () => {
  const unresolved = [{ number: 1, reason: 'r' }, { number: 2, reason: 'r' }];
  assert.equal(label(hierarchy({ unresolved }), load(COMPLETE)), 'no children declared; 2 closed issues could not be read');
  assert.equal(label(hierarchy({ unresolved: [{ number: 1, reason: 'r' }] }), load(COMPLETE)), 'no children declared; 1 closed issue could not be read');
});
